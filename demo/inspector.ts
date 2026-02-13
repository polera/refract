import {
  setDevtoolsHook,
  type RefractDevtoolsFiberSnapshot,
  type RefractDevtoolsRootSnapshot,
} from "../src/refract/index.js";

interface InspectorState {
  commits: number;
  unmounts: number;
  rendererId: number | null;
  rendererName: string;
  root: RefractDevtoolsRootSnapshot | null;
}

export function mountInspector(host: HTMLElement | null): void {
  if (typeof document === "undefined") return;

  const target = host ?? document.body;
  const panel = document.createElement("section");
  panel.className = "inspector";
  panel.innerHTML = `
    <div class="inspector-header">
      <span class="inspector-title">Refract Inspector</span>
      <span class="inspector-renderer" data-renderer>renderer: -</span>
    </div>
    <div class="inspector-stats">
      <div><span>Commits</span><strong data-commits>0</strong></div>
      <div><span>Unmounts</span><strong data-unmounts>0</strong></div>
      <div><span>Nodes</span><strong data-nodes>0</strong></div>
      <div><span>Root</span><strong data-root>-</strong></div>
    </div>
    <div class="inspector-tree" data-tree>
      <p class="inspector-empty">Waiting for first render...</p>
    </div>
  `;
  target.appendChild(panel);

  const rendererEl = panel.querySelector("[data-renderer]") as HTMLElement;
  const commitsEl = panel.querySelector("[data-commits]") as HTMLElement;
  const unmountsEl = panel.querySelector("[data-unmounts]") as HTMLElement;
  const nodesEl = panel.querySelector("[data-nodes]") as HTMLElement;
  const rootEl = panel.querySelector("[data-root]") as HTMLElement;
  const treeEl = panel.querySelector("[data-tree]") as HTMLElement;

  const state: InspectorState = {
    commits: 0,
    unmounts: 0,
    rendererId: null,
    rendererName: "-",
    root: null,
  };

  const renderPanel = (): void => {
    rendererEl.textContent =
      state.rendererId == null
        ? `renderer: ${state.rendererName}`
        : `renderer: ${state.rendererName}#${state.rendererId}`;
    commitsEl.textContent = String(state.commits);
    unmountsEl.textContent = String(state.unmounts);
    rootEl.textContent = state.root?.container ?? "-";

    const current = state.root?.current ?? null;
    nodesEl.textContent = current ? String(countNodes(current)) : "0";

    treeEl.replaceChildren();
    if (!current) {
      const empty = document.createElement("p");
      empty.className = "inspector-empty";
      empty.textContent = "No committed root.";
      treeEl.appendChild(empty);
      return;
    }

    const list = document.createElement("ul");
    list.className = "inspector-list";
    list.appendChild(renderFiber(current));
    treeEl.appendChild(list);
  };

  setDevtoolsHook({
    inject(renderer) {
      state.rendererName = renderer.name;
      return 1;
    },
    onCommitFiberRoot(rendererId, root) {
      state.commits += 1;
      state.rendererId = rendererId;
      state.root = root;
      renderPanel();
    },
    onCommitFiberUnmount() {
      state.unmounts += 1;
      renderPanel();
    },
  });

  renderPanel();
}

function renderFiber(fiber: RefractDevtoolsFiberSnapshot): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "inspector-item";

  const line = document.createElement("div");
  line.className = "inspector-line";

  const type = document.createElement("span");
  type.className = "inspector-node-type";
  type.textContent = fiber.type;
  line.appendChild(type);

  if (fiber.key != null) {
    const key = document.createElement("span");
    key.className = "inspector-meta";
    key.textContent = `key=${String(fiber.key)}`;
    line.appendChild(key);
  }

  if (fiber.dom) {
    const dom = document.createElement("span");
    dom.className = "inspector-meta";
    dom.textContent = `dom=${fiber.dom}`;
    line.appendChild(dom);
  }

  if (fiber.hookState.length > 0) {
    const hooks = document.createElement("span");
    hooks.className = "inspector-meta";
    hooks.textContent = `hooks=${fiber.hookState.length}`;
    line.appendChild(hooks);
  }

  const propCount = Object.keys(fiber.props).length;
  if (propCount > 0) {
    const props = document.createElement("span");
    props.className = "inspector-meta";
    props.textContent = `props=${propCount}`;
    line.appendChild(props);
  }

  item.appendChild(line);

  if (fiber.children.length > 0) {
    const list = document.createElement("ul");
    list.className = "inspector-list";
    for (const child of fiber.children) {
      list.appendChild(renderFiber(child));
    }
    item.appendChild(list);
  }

  return item;
}

function countNodes(fiber: RefractDevtoolsFiberSnapshot): number {
  let total = 1;
  for (const child of fiber.children) {
    total += countNodes(child);
  }
  return total;
}
