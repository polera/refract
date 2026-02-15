import { setHtmlSanitizer as setHtmlSanitizerImpl, setUnsafeUrlPropChecker } from "../dom.js";
import type { HtmlSanitizer } from "../dom.js";

const URL_ATTRS = new Set(["href", "src", "action", "formaction", "xlink:href"]);
const BLOCKED_HTML_TAGS = new Set(["script", "iframe", "object", "embed", "link", "meta", "base"]);

function normalizedUrl(value: string): string {
  return value.replace(/[\u0000-\u0020\u007f]+/g, "").toLowerCase();
}

function isUnsafeUrl(value: string): boolean {
  const normalized = normalizedUrl(value);
  return normalized.startsWith("javascript:") || normalized.startsWith("vbscript:");
}

function isUnsafeUrlProp(key: string, value: unknown): boolean {
  if (typeof value !== "string") return false;
  return URL_ATTRS.has(key.toLowerCase()) && isUnsafeUrl(value);
}

function defaultHtmlSanitizer(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;

  const elements = template.content.querySelectorAll("*");
  for (const element of elements) {
    const tagName = element.tagName.toLowerCase();
    if (BLOCKED_HTML_TAGS.has(tagName)) {
      element.remove();
      continue;
    }

    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase();
      if (attrName.startsWith("on")) {
        element.removeAttribute(attr.name);
        continue;
      }

      if (URL_ATTRS.has(attrName) && isUnsafeUrl(attr.value)) {
        element.removeAttribute(attr.name);
      }
    }
  }

  return template.innerHTML;
}

export function setHtmlSanitizer(sanitizer: HtmlSanitizer | null): void {
  setHtmlSanitizerImpl(sanitizer ?? defaultHtmlSanitizer);
}

let initialized = false;

export function ensureSecurityDefaults(): void {
  if (!initialized) {
    initialized = true;
    setHtmlSanitizerImpl(defaultHtmlSanitizer);
    setUnsafeUrlPropChecker(isUnsafeUrlProp);
  }
}
