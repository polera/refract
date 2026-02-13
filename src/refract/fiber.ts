export {
  currentFiber,
  pushDeletion,
  renderFiber,
  scheduleRender,
} from "./coreRenderer.js";
export { markPendingEffects } from "./hooksRuntime.js";
export { memo, shallowEqual } from "./memo.js";
export { setHtmlSanitizer } from "./features/security.js";
export type { HtmlSanitizer } from "./dom.js";
