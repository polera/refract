import { createServer } from "http";
import { readFileSync, statSync, readdirSync } from "fs";
import { join, extname } from "path";
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
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let filePath = join(dir, req.url === "/" ? "index.html" : req.url);
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
    server.listen(port, () => resolve(server));
  });
}

async function measureLoadTime(browser, url, label, runs = 10) {
  const times = [];

  for (let i = 0; i < runs; i++) {
    const page = await browser.newPage();

    // Disable cache to get consistent measurements
    await page.setCacheEnabled(false);

    // Block external image requests to isolate JS/rendering perf
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

    // Measure when the app div has children (framework has rendered)
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

    // Get Performance API metrics from the page
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

    times.push({
      domContentLoaded,
      renderTime,
      ...perfMetrics,
    });

    await page.close();
  }

  return times;
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stats(values) {
  const med = median(values);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { median: med, min, max, avg };
}

// --- Main ---

const RUNS = 15;

console.log("=".repeat(60));
console.log("  Refract (freact) vs React — Load Time Benchmark");
console.log("=".repeat(60));
console.log();

// 1. Bundle size comparison
const freactDist = join(__dirname, "..", "demo", "dist");
const reactDist = join(__dirname, "react-demo", "dist");

console.log("📦 BUNDLE SIZES");
console.log("-".repeat(50));

for (const [label, dir] of [["Freact", freactDist], ["React", reactDist]]) {
  const files = getFileSizes(dir);
  const jsFiles = files.filter((f) => f.file.endsWith(".js"));
  const cssFiles = files.filter((f) => f.file.endsWith(".css"));
  const htmlFiles = files.filter((f) => f.file.endsWith(".html"));

  const totalJS = jsFiles.reduce((s, f) => s + f.raw, 0);
  const totalJSGzip = jsFiles.reduce((s, f) => s + f.gzip, 0);
  const totalCSS = cssFiles.reduce((s, f) => s + f.raw, 0);
  const totalCSSGzip = cssFiles.reduce((s, f) => s + f.gzip, 0);
  const totalAll = files.reduce((s, f) => s + f.raw, 0);
  const totalAllGzip = files.reduce((s, f) => s + f.gzip, 0);

  console.log(`\n  ${label}:`);
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
console.log(`   (${RUNS} runs per framework, cache disabled, images blocked)`);
console.log("-".repeat(50));

const freactServer = await serveDir(freactDist, 4001);
const reactServer = await serveDir(reactDist, 4002);

const browser = await puppeteer.launch({ headless: true });

const freactTimes = await measureLoadTime(browser, "http://localhost:4001", "Freact", RUNS);
const reactTimes = await measureLoadTime(browser, "http://localhost:4002", "React", RUNS);

await browser.close();
freactServer.close();
reactServer.close();

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
      `   min: ${s.min.toFixed(2).padStart(7)}ms` +
      `   max: ${s.max.toFixed(2).padStart(7)}ms`
    );
  }
}

printTimingTable("Freact", freactTimes);
printTimingTable("React", reactTimes);

// 3. Summary comparison
console.log("\n");
console.log("📊 SUMMARY COMPARISON");
console.log("-".repeat(50));

const freactJSSize = getFileSizes(freactDist).filter((f) => f.file.endsWith(".js")).reduce((s, f) => s + f.raw, 0);
const reactJSSize = getFileSizes(reactDist).filter((f) => f.file.endsWith(".js")).reduce((s, f) => s + f.raw, 0);
const freactJSGzip = getFileSizes(freactDist).filter((f) => f.file.endsWith(".js")).reduce((s, f) => s + f.gzip, 0);
const reactJSGzip = getFileSizes(reactDist).filter((f) => f.file.endsWith(".js")).reduce((s, f) => s + f.gzip, 0);

const freactDCL = stats(freactTimes.map((t) => t.domContentLoadedEnd));
const reactDCL = stats(reactTimes.map((t) => t.domContentLoadedEnd));
const freactRender = stats(freactTimes.map((t) => t.renderTime));
const reactRender = stats(reactTimes.map((t) => t.renderTime));

const col1 = 25;
const col2 = 15;
const col3 = 15;
const col4 = 10;

console.log(
  `  ${"Metric".padEnd(col1)} ${"Freact".padStart(col2)} ${"React".padStart(col3)} ${"Ratio".padStart(col4)}`
);
console.log(`  ${"─".repeat(col1 + col2 + col3 + col4 + 3)}`);
console.log(
  `  ${"JS bundle (raw)".padEnd(col1)} ${formatBytes(freactJSSize).padStart(col2)} ${formatBytes(reactJSSize).padStart(col3)} ${(reactJSSize / freactJSSize).toFixed(1).padStart(col4 - 1)}x`
);
console.log(
  `  ${"JS bundle (gzip)".padEnd(col1)} ${formatBytes(freactJSGzip).padStart(col2)} ${formatBytes(reactJSGzip).padStart(col3)} ${(reactJSGzip / freactJSGzip).toFixed(1).padStart(col4 - 1)}x`
);
console.log(
  `  ${"DOMContentLoaded (med)".padEnd(col1)} ${(freactDCL.median.toFixed(2) + "ms").padStart(col2)} ${(reactDCL.median.toFixed(2) + "ms").padStart(col3)} ${(reactDCL.median / freactDCL.median).toFixed(1).padStart(col4 - 1)}x`
);
console.log(
  `  ${"App render (med)".padEnd(col1)} ${(freactRender.median.toFixed(2) + "ms").padStart(col2)} ${(reactRender.median.toFixed(2) + "ms").padStart(col3)} ${(reactRender.median / freactRender.median).toFixed(1).padStart(col4 - 1)}x`
);

console.log("\n" + "=".repeat(60));
console.log("  Done.");
console.log("=".repeat(60));
