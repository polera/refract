import type { Fiber } from "./types.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";
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
let reactCompatEventMode = false;
const reactCompatWrappers = new WeakMap<EventListener, EventListener>();

export function setHtmlSanitizer(sanitizer: HtmlSanitizer | null): void {
  htmlSanitizer = sanitizer ?? identitySanitizer;
}

export function setUnsafeUrlPropChecker(checker: UnsafeUrlPropChecker | null): void {
  unsafeUrlPropChecker = checker ?? (() => false);
}

export function setReactCompatEventMode(enabled: boolean): void {
  reactCompatEventMode = enabled;
}

function identitySanitizer(html: string): string {
  return html;
}

function getEventListener(handler: unknown): EventListener {
  if (typeof handler !== "function") {
    return handler as EventListener;
  }
  if (!reactCompatEventMode) {
    return handler as EventListener;
  }

  const typedHandler = handler as EventListener;
  const existing = reactCompatWrappers.get(typedHandler);
  if (existing) return existing;

  const wrapped: EventListener = (event: Event) => {
    const eventRecord = event as unknown as Record<string, unknown>;
    if (!("nativeEvent" in eventRecord)) {
      try {
        Object.defineProperty(event, "nativeEvent", {
          configurable: true,
          enumerable: false,
          value: event,
          writable: false,
        });
      } catch {
        // ignore if event object is non-extensible
      }
    }
    typedHandler(event);
  };
  reactCompatWrappers.set(typedHandler, wrapped);
  return wrapped;
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
  el: Element,
  oldProps: Record<string, unknown>,
  newProps: Record<string, unknown>,
): void {
  const isSvgElement = el.namespaceURI === SVG_NS;

  for (const key of Object.keys(oldProps)) {
    if (key === "children" || key === "key" || key === "ref") continue;
    if (!(key in newProps)) {
      if (key.startsWith("on")) {
        el.removeEventListener(key.slice(2).toLowerCase(), getEventListener(oldProps[key]));
      } else {
        const attr = normalizeAttributeName(key, isSvgElement);
        if (attr.namespaceURI) {
          el.removeAttributeNS(attr.namespaceURI, attr.localName);
        } else {
          el.removeAttribute(attr.name);
        }
      }
    }
  }

  for (const key of Object.keys(newProps)) {
    if (key === "children" || key === "key" || key === "ref") continue;
    if (oldProps[key] === newProps[key]) continue;

    switch (key) {
      case "dangerouslySetInnerHTML": {
        const raw = (newProps[key] as { __html?: unknown } | undefined)?.__html;
        if (typeof raw !== "string") {
          throw new TypeError("dangerouslySetInnerHTML expects a string __html value");
        }
        el.innerHTML = htmlSanitizer(raw);
        break;
      }
      case "className":
        if (newProps[key] == null || newProps[key] === false) {
          el.removeAttribute("class");
        } else {
          el.setAttribute("class", String(newProps[key]));
        }
        break;
      case "style":
        if (typeof newProps[key] === "object" && newProps[key] !== null) {
          const prevStyles = (typeof oldProps[key] === "object" && oldProps[key] !== null)
            ? oldProps[key] as Record<string, unknown>
            : {};
          const styles = newProps[key] as Record<string, unknown>;
          for (const prop of Object.keys(prevStyles)) {
            if (!(prop in styles)) {
              (el as HTMLElement).style[prop as any] = "";
            }
          }
          for (const [prop, val] of Object.entries(styles)) {
            (el as HTMLElement).style[prop as any] = val == null ? "" : String(val);
          }
        } else {
          el.removeAttribute("style");
        }
        break;
      default:
        if (key.startsWith("on")) {
          let event = key.slice(2).toLowerCase();
          if (reactCompatEventMode && event === "change") {
            const tagName = el.tagName;
            if (tagName === "TEXTAREA") {
              event = "input";
            } else if (tagName === "INPUT") {
              const type = (el as HTMLInputElement).type;
              if (type !== "checkbox" && type !== "radio" && type !== "file") {
                event = "input";
              }
            }
          }

          if (oldProps[key]) {
            el.removeEventListener(event, getEventListener(oldProps[key]));
          }
          el.addEventListener(event, getEventListener(newProps[key]));
        } else {
          const value = newProps[key];
          const attr = normalizeAttributeName(key, isSvgElement);
          const securityKey = isSvgElement ? attr.name : key;
          if (unsafeUrlPropChecker(securityKey, value)) {
            if (attr.namespaceURI) {
              el.removeAttributeNS(attr.namespaceURI, attr.localName);
            } else {
              el.removeAttribute(attr.name);
            }
            continue;
          }
          if (value == null || value === false) {
            if (attr.namespaceURI) {
              el.removeAttributeNS(attr.namespaceURI, attr.localName);
            } else {
              el.removeAttribute(attr.name);
            }
          } else if (value === true) {
            if (attr.namespaceURI) {
              el.setAttributeNS(attr.namespaceURI, attr.name, "true");
            } else {
              el.setAttribute(attr.name, "true");
            }
          } else {
            if (attr.namespaceURI) {
              el.setAttributeNS(attr.namespaceURI, attr.name, String(value));
            } else {
              el.setAttribute(attr.name, String(value));
            }
          }
        }
        break;
    }
  }
}

type NormalizedAttribute = {
  name: string;
  localName: string;
  namespaceURI: string | null;
};

function normalizeAttributeName(key: string, isSvgElement: boolean): NormalizedAttribute {
  if (!isSvgElement) {
    return { name: key, localName: key, namespaceURI: null };
  }

  if (key.startsWith("xlink") && key.length > 5) {
    const local = key.slice(5);
    const localName = local.charAt(0).toLowerCase() + local.slice(1);
    return { name: `xlink:${localName.toLowerCase()}`, localName: localName.toLowerCase(), namespaceURI: XLINK_NS };
  }

  if (key === "xmlnsXlink") {
    return { name: "xmlns:xlink", localName: "xlink", namespaceURI: XMLNS_NS };
  }

  if (key.startsWith("xml") && key.length > 3) {
    const local = key.slice(3);
    const localName = local.charAt(0).toLowerCase() + local.slice(1);
    return { name: `xml:${localName}`, localName, namespaceURI: XML_NS };
  }

  if (SVG_ATTR_CASE_PRESERVED.has(key) || key.startsWith("aria-") || key.startsWith("data-")) {
    return { name: key, localName: key, namespaceURI: null };
  }

  if (SVG_ATTR_KEBAB_CASE.has(key)) {
    const name = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    return { name, localName: name, namespaceURI: null };
  }

  return { name: key, localName: key, namespaceURI: null };
}

const SVG_ATTR_CASE_PRESERVED = new Set([
  "viewBox",
  "preserveAspectRatio",
  "gradientUnits",
  "gradientTransform",
  "patternUnits",
  "patternContentUnits",
  "patternTransform",
  "maskUnits",
  "maskContentUnits",
  "filterUnits",
  "primitiveUnits",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "markerUnits",
  "markerWidth",
  "markerHeight",
  "refX",
  "refY",
  "stdDeviation",
]);

const SVG_ATTR_KEBAB_CASE = new Set([
  "clipPath",
  "clipRule",
  "fillOpacity",
  "fillRule",
  "floodColor",
  "floodOpacity",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeMiterlimit",
  "strokeOpacity",
  "strokeWidth",
  "stopColor",
  "stopOpacity",
  "fontFamily",
  "fontSize",
  "fontSizeAdjust",
  "fontStretch",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "glyphOrientationHorizontal",
  "glyphOrientationVertical",
  "letterSpacing",
  "wordSpacing",
  "textAnchor",
  "textDecoration",
  "textRendering",
  "dominantBaseline",
  "alignmentBaseline",
  "baselineShift",
  "colorInterpolation",
  "colorInterpolationFilters",
  "colorProfile",
  "colorRendering",
  "imageRendering",
  "shapeRendering",
  "pointerEvents",
  "lightingColor",
  "unicodeBidi",
  "renderingIntent",
  "vectorEffect",
  "writingMode",
  "markerStart",
  "markerMid",
  "markerEnd",
]);
