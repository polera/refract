import { createServer } from "http";
import { readFileSync, statSync, readdirSync } from "fs";
import { join, extname, resolve, sep } from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";
import puppeteer from "puppeteer";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// --- Helpers ---

function getFileSizes(dir, prefix = "") {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getFileSizes(fullPath, join(prefix, entry.name)));
    } else {
      const raw = statSync(fullPath).size;
      const content = readFileSync(fullPath);
      const gzip = gzipSync(content).length;
      results.push({ file: join(prefix, entry.name), raw, gzip });
    }
  }
  return results;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} kB`;
}

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
};

function serveDir(dir, port) {
  const baseDir = resolve(dir);
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
      let pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;

      try {
        pathname = decodeURIComponent(pathname);
      } catch {
        res.writeHead(400);
        res.end("Bad request");
        return;
      }

      const filePath = resolve(baseDir, `.${pathname}`);
      if (filePath !== baseDir && !filePath.startsWith(baseDir + sep)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      try {
        const content = readFileSync(filePath);
        const ext = extname(filePath);
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(port, "127.0.0.1", () => resolveServer(server));
  });
}

async function measureLoadSample(browser, url) {
  const page = await browser.newPage();
  try {
    // Disable cache to get consistent measurements.
    await page.setCacheEnabled(false);

    // Block external image requests to isolate JS/rendering perf.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (req.url().includes("picsum.photos")) {
        req.abort();
      } else {
        req.continue();
      }
    });

    const start = performance.now();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const domContentLoaded = performance.now() - start;

    // Measure when the app div has children (framework has rendered).
    const renderTime = await page.evaluate(() => {
      const start = performance.now();
      return new Promise((resolve) => {
        const check = () => {
          const app = document.getElementById("app");
          if (app && app.children.length > 0) {
            resolve(performance.now() - start);
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });
    });

    // Get Performance API metrics from the page.
    const perfMetrics = await page.evaluate(() => {
      const entries = performance.getEntriesByType("navigation");
      const nav = entries[0];
      return {
        domInteractive: nav.domInteractive,
        domContentLoadedEnd: nav.domContentLoadedEventEnd,
        loadEventEnd: nav.loadEventEnd,
        responseEnd: nav.responseEnd,
        transferSize: nav.transferSize,
      };
    });

    return {
      domContentLoaded,
      renderTime,
      ...perfMetrics,
    };
  } finally {
    await page.close();
  }
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values, p) {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  const clamped = Math.max(0, Math.min(sorted.length - 1, index));
  return sorted[clamped];
}

function stats(values) {
  const med = median(values);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return { median: med, min, max, avg, stddev: Math.sqrt(variance), p95: percentile(values, 95) };
}

function readPositiveInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) return fallback;
  return value;
}

function readNonNegativeInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 0) return fallback;
  return value;
}

function readPositiveFloat(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

// --- Framework definitions ---

const frameworks = [
  { label: "Refract (core)", dist: join(__dirname, "refract-core-demo", "dist"), port: 4001, path: "/" },
  {
    label: "Refract (core+hooks)",
    dist: join(__dirname, "refract-core-hooks-demo", "dist"),
    port: 4002,
    path: "/",
  },
  {
    label: "Refract (core+context)",
    dist: join(__dirname, "refract-core-context-demo", "dist"),
    port: 4003,
    path: "/",
  },
  {
    label: "Refract (core+memo)",
    dist: join(__dirname, "refract-core-memo-demo", "dist"),
    port: 4004,
    path: "/",
  },
  {
    label: "Refract (core+security)",
    dist: join(__dirname, "refract-core-security-demo", "dist"),
    port: 4005,
    path: "/",
  },
  { label: "Refract (refract)", dist: join(__dirname, "refract-full-demo", "dist"), port: 4006, path: "/" },
  { label: "React", dist: join(__dirname, "react-demo", "dist"), port: 4007, path: "/" },
  { label: "Preact", dist: join(__dirname, "preact-demo", "dist"), port: 4008, path: "/" },
];

// --- Main ---

const RUNS = readPositiveInt("BENCH_RUNS", 15);
const WARMUP_RUNS = readNonNegativeInt("BENCH_WARMUP", 3);
const GUARDRAILS_ENABLED = process.env.BENCH_GUARDRAILS === "0";
const DCL_P95_MAX = readPositiveFloat("BENCH_GUARDRAIL_DCL_P95_MAX", 16);
const DCL_SD_MAX = readPositiveFloat("BENCH_GUARDRAIL_DCL_SD_MAX", 2);
const CI_MODE = process.env.CI === "true" || process.env.CI === "1";
const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH;
const GUARDRAIL_FRAMEWORK_LABEL = "Refract (refract)";

console.log("=".repeat(60));
console.log("  Refract Entrypoints vs React vs Preact — Load Time Benchmark");
console.log("=".repeat(60));
console.log();

// 1. Bundle size comparison
console.log("📦 BUNDLE SIZES");
console.log("-".repeat(50));

for (const fw of frameworks) {
  const files = getFileSizes(fw.dist);
  const jsFiles = files.filter((f) => f.file.endsWith(".js"));
  const cssFiles = files.filter((f) => f.file.endsWith(".css"));

  const totalJS = jsFiles.reduce((s, f) => s + f.raw, 0);
  const totalJSGzip = jsFiles.reduce((s, f) => s + f.gzip, 0);
  const totalCSS = cssFiles.reduce((s, f) => s + f.raw, 0);
  const totalCSSGzip = cssFiles.reduce((s, f) => s + f.gzip, 0);
  const totalAll = files.reduce((s, f) => s + f.raw, 0);
  const totalAllGzip = files.reduce((s, f) => s + f.gzip, 0);

  console.log(`\n  ${fw.label}:`);
  for (const f of files) {
    console.log(`    ${f.file.padEnd(35)} ${formatBytes(f.raw).padStart(10)}  (gzip: ${formatBytes(f.gzip)})`);
  }
  console.log(`    ${"─".repeat(55)}`);
  console.log(`    ${"JS total".padEnd(35)} ${formatBytes(totalJS).padStart(10)}  (gzip: ${formatBytes(totalJSGzip)})`);
  console.log(`    ${"CSS total".padEnd(35)} ${formatBytes(totalCSS).padStart(10)}  (gzip: ${formatBytes(totalCSSGzip)})`);
  console.log(`    ${"All assets".padEnd(35)} ${formatBytes(totalAll).padStart(10)}  (gzip: ${formatBytes(totalAllGzip)})`);
}

// 2. Load time comparison
console.log("\n");
console.log("⏱  LOAD TIME MEASUREMENTS");
console.log(
  `   (${RUNS} measured + ${WARMUP_RUNS} warmup runs per framework, cache disabled, images blocked, round-robin order)`,
);
console.log("-".repeat(50));

const servers = [];
for (const fw of frameworks) {
  servers.push(await serveDir(fw.dist, fw.port));
}

const launchOptions = {
  headless: true,
  ...(PUPPETEER_EXECUTABLE_PATH ? { executablePath: PUPPETEER_EXECUTABLE_PATH } : {}),
  ...(CI_MODE ? { args: ["--no-sandbox", "--disable-setuid-sandbox"] } : {}),
};

const browser = await puppeteer.launch(launchOptions);
const timings = {};
for (const fw of frameworks) {
  timings[fw.label] = [];
}

const totalRuns = RUNS + WARMUP_RUNS;

try {
  for (let run = 0; run < totalRuns; run++) {
    for (let offset = 0; offset < frameworks.length; offset++) {
      const fw = frameworks[(run + offset) % frameworks.length];
      const sample = await measureLoadSample(browser, `http://localhost:${fw.port}${fw.path ?? "/"}`);
      if (run >= WARMUP_RUNS) {
        timings[fw.label].push(sample);
      }
    }
  }
} finally {
  await browser.close();
  for (const server of servers) {
    server.close();
  }
}

function printTimingTable(label, times) {
  const metrics = {
    "DOM Interactive": times.map((t) => t.domInteractive),
    "DOMContentLoaded": times.map((t) => t.domContentLoadedEnd),
    "App Render (rAF)": times.map((t) => t.renderTime),
  };

  console.log(`\n  ${label}:`);
  for (const [name, values] of Object.entries(metrics)) {
    const s = stats(values);
    console.log(
      `    ${name.padEnd(22)} median: ${s.median.toFixed(2).padStart(7)}ms` +
      `   p95: ${s.p95.toFixed(2).padStart(7)}ms` +
      `   min: ${s.min.toFixed(2).padStart(7)}ms` +
      `   max: ${s.max.toFixed(2).padStart(7)}ms` +
      `   sd: ${s.stddev.toFixed(2).padStart(6)}`
    );
  }
}

for (const fw of frameworks) {
  printTimingTable(fw.label, timings[fw.label]);
}

// 3. Summary comparison
console.log("\n");
console.log("📊 SUMMARY COMPARISON");
console.log("-".repeat(70));

function getJSSizes(dist) {
  const files = getFileSizes(dist);
  const jsFiles = files.filter((f) => f.file.endsWith(".js"));
  return {
    raw: jsFiles.reduce((s, f) => s + f.raw, 0),
    gzip: jsFiles.reduce((s, f) => s + f.gzip, 0),
  };
}

const sizes = {};
const dclStats = {};
const renderStats = {};
for (const fw of frameworks) {
  sizes[fw.label] = getJSSizes(fw.dist);
  dclStats[fw.label] = stats(timings[fw.label].map((t) => t.domContentLoadedEnd));
  renderStats[fw.label] = stats(timings[fw.label].map((t) => t.renderTime));
}

const colFramework = 30;
const colMetric = 12;

console.log(
  `  ${"Framework".padEnd(colFramework)} ${"JS raw".padStart(colMetric)} ${"JS gzip".padStart(colMetric)} ${"DCL med".padStart(colMetric)} ${"DCL p95".padStart(colMetric)} ${"DCL sd".padStart(colMetric)} ${"Render med".padStart(colMetric)}`
);
console.log(`  ${"─".repeat(colFramework + colMetric * 6 + 6)}`);

for (const fw of frameworks) {
  const label = fw.label;
  const dcl = dclStats[label];
  const render = renderStats[label];
  console.log(
    `  ${label.padEnd(colFramework)} ${formatBytes(sizes[label].raw).padStart(colMetric)} ${formatBytes(sizes[label].gzip).padStart(colMetric)} ${(dcl.median.toFixed(2) + "ms").padStart(colMetric)} ${(dcl.p95.toFixed(2) + "ms").padStart(colMetric)} ${(dcl.stddev.toFixed(2) + "ms").padStart(colMetric)} ${(render.median.toFixed(2) + "ms").padStart(colMetric)}`,
  );
}

if (GUARDRAILS_ENABLED) {
  console.log("\n");
  console.log("🚦 CI GUARDRAILS");
  console.log("-".repeat(50));

  const refractDcl = dclStats[GUARDRAIL_FRAMEWORK_LABEL];
  if (!refractDcl) {
    console.log(`  [FAIL] Missing guardrail framework: ${GUARDRAIL_FRAMEWORK_LABEL}`);
    process.exitCode = 1;
  } else {
    const checks = [
      {
        label: `${GUARDRAIL_FRAMEWORK_LABEL} DOMContentLoaded p95 <= ${DCL_P95_MAX.toFixed(2)}ms`,
        actual: refractDcl.p95,
        pass: refractDcl.p95 <= DCL_P95_MAX,
      },
      {
        label: `${GUARDRAIL_FRAMEWORK_LABEL} DOMContentLoaded sd <= ${DCL_SD_MAX.toFixed(2)}ms`,
        actual: refractDcl.stddev,
        pass: refractDcl.stddev <= DCL_SD_MAX,
      },
    ];

    for (const check of checks) {
      const status = check.pass ? "PASS" : "FAIL";
      console.log(`  [${status}] ${check.label} (actual: ${check.actual.toFixed(2)}ms)`);
    }

    const failures = checks.filter((check) => !check.pass);
    if (failures.length > 0) {
      console.log("\n  Guardrails failed.");
      process.exitCode = 1;
    } else {
      console.log("\n  Guardrails passed.");
    }
  }
}

console.log("\n" + "=".repeat(60));
console.log("  Done.");
console.log("=".repeat(60));
