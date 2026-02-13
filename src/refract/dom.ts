import type { Fiber } from "./types.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set([
  "svg", "circle", "ellipse", "line", "path", "polygon", "polyline",
  "rect", "g", "defs", "use", "text", "tspan", "image", "clipPath",
  "mask", "pattern", "marker", "linearGradient", "radialGradient", "stop",
  "foreignObject", "symbol", "desc", "title",
]);

export type HtmlSanitizer = (html: string) => string;
export type UnsafeUrlPropChecker = (key: string, value: unknown) => boolean;

let htmlSanitizer: HtmlSanitizer = identitySanitizer;
let unsafeUrlPropChecker: UnsafeUrlPropChecker = () => false;

export function setHtmlSanitizer(sanitizer: HtmlSanitizer | null): void {
  htmlSanitizer = sanitizer ?? identitySanitizer;
}

export function setUnsafeUrlPropChecker(checker: UnsafeUrlPropChecker | null): void {
  unsafeUrlPropChecker = checker ?? (() => false);
}

function identitySanitizer(html: string): string {
  return html;
}

/** Create a real DOM node from a fiber */
export function createDom(fiber: Fiber): Node {
  if (fiber.type === "TEXT") {
    return document.createTextNode(fiber.props.nodeValue as string);
  }
  const tag = fiber.type as string;
  const isSvg = SVG_TAGS.has(tag) || isSvgContext(fiber);
  const el = isSvg
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);
  applyProps(el as HTMLElement, {}, fiber.props);
  return el;
}

/** Check if a fiber is inside an SVG context */
function isSvgContext(fiber: Fiber): boolean {
  let f = fiber.parent;
  while (f) {
    if (f.type === "svg") return true;
    if (typeof f.type === "string" && f.type !== "svg" && f.dom) return false;
    f = f.parent;
  }
  return false;
}

/** Apply props to a DOM element, diffing against old props */
export function applyProps(
  el: HTMLElement,
  oldProps: Record<string, unknown>,
  newProps: Record<string, unknown>,
): void {
  for (const key of Object.keys(oldProps)) {
    if (key === "children" || key === "key" || key === "ref") continue;
    if (!(key in newProps)) {
      if (key.startsWith("on")) {
        el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key] as EventListener);
      } else {
        el.removeAttribute(key);
      }
    }
  }

  for (const key of Object.keys(newProps)) {
    if (key === "children" || key === "key" || key === "ref") continue;
    if (oldProps[key] === newProps[key]) continue;

    if (key === "dangerouslySetInnerHTML") {
      const raw = (newProps[key] as { __html?: unknown } | undefined)?.__html;
      if (typeof raw !== "string") {
        throw new TypeError("dangerouslySetInnerHTML expects a string __html value");
      }
      el.innerHTML = htmlSanitizer(raw);
    } else if (key.startsWith("on")) {
      const event = key.slice(2).toLowerCase();
      if (oldProps[key]) {
        el.removeEventListener(event, oldProps[key] as EventListener);
      }
      el.addEventListener(event, newProps[key] as EventListener);
    } else if (key === "className") {
      el.setAttribute("class", newProps[key] as string);
    } else if (key === "style") {
      if (typeof newProps[key] === "object" && newProps[key] !== null) {
        const prevStyles = (typeof oldProps[key] === "object" && oldProps[key] !== null)
          ? oldProps[key] as Record<string, unknown>
          : {};
        const styles = newProps[key] as Record<string, unknown>;
        for (const prop of Object.keys(prevStyles)) {
          if (!(prop in styles)) {
            (el.style as unknown as Record<string, string>)[prop] = "";
          }
        }
        for (const [prop, val] of Object.entries(styles)) {
          (el.style as unknown as Record<string, string>)[prop] = val == null ? "" : String(val);
        }
      } else {
        el.removeAttribute("style");
      }
    } else {
      if (unsafeUrlPropChecker(key, newProps[key])) {
        el.removeAttribute(key);
        continue;
      }
      el.setAttribute(key, String(newProps[key]));
    }
  }
}
