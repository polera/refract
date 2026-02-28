import type { Fiber } from "./types.js";

const SVG_NS = "http://www.w3.org/2000/svg";

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
  const isSvg = tag === "svg" || isSvgContext(fiber);
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
    if (f.type === "foreignObject") return false;
    if (f.type === "svg") return true;
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
        } else if (
          !isSvgElement &&
          (key === "value" || key === "checked") &&
          (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")
        ) {
          // Use DOM property for form element values (like React does), so that
          // controlled inputs update their displayed value correctly.
          (el as any)[key] = newProps[key] ?? (key === "checked" ? false : "");
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

  const name = key.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
  return { name, localName: name, namespaceURI: null };
}
