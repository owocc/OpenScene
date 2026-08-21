import type { AppDocument, AppElement } from "./document";
import type { ComponentMeta } from "./meta";

export type ElementTreeNode = {
  kind: "element";
  id: string;
  type: string;
  label: string;
  isRoot: boolean;
  element: AppElement;
  children: TreeNode[];
};

export type SlotTreeNode = {
  kind: "slot";
  id: string;
  label: string;
  parentId: string;
  slotName: string;
  children: ElementTreeNode[];
};

export type TreeNode = ElementTreeNode | SlotTreeNode;

export type ChildContainer = {
  parentId: string;
  slotName?: string;
  index?: number;
};

export function slotNodeId(parentId: string, slotName: string) {
  return `${parentId}:slot:${slotName}`;
}

export function parseSlotNodeId(id: string) {
  const marker = ":slot:";
  const index = id.indexOf(marker);
  if (index <= 0 || index + marker.length >= id.length) return undefined;
  return { parentId: id.slice(0, index), slotName: id.slice(index + marker.length) };
}

export function isSlotNodeId(id: string) {
  return parseSlotNodeId(id) !== undefined;
}

function childIds(element: AppElement, slotName?: string) {
  return slotName ? (element.slots?.[slotName] ?? []) : (element.children ?? []);
}

function buildElement(
  document: AppDocument,
  id: string,
  getMeta: (type: string) => ComponentMeta | undefined,
  path: Set<string>,
  isRoot = false,
): ElementTreeNode | undefined {
  const element = document.spec.elements[id];
  if (!element || path.has(id)) return undefined;

  const nextPath = new Set(path).add(id);
  const meta = getMeta(element.type);
  const children: TreeNode[] = childIds(element).flatMap((childId) => {
    const child = buildElement(document, childId, getMeta, nextPath);
    return child ? [child] : [];
  });

  for (const slotName of Object.keys(meta?.slots ?? {})) {
    if (slotName === "default") continue;
    const slotChildren = childIds(element, slotName).flatMap((childId) => {
      const child = buildElement(document, childId, getMeta, nextPath);
      return child ? [child] : [];
    });
    children.push({
      kind: "slot",
      id: slotNodeId(id, slotName),
      label: meta?.slots?.[slotName]?.title || slotName,
      parentId: id,
      slotName,
      children: slotChildren,
    });
  }

  for (const [slotName, ids] of Object.entries(element.slots ?? {})) {
    if (slotName === "default" || meta?.slots?.[slotName]) continue;
    const slotChildren = ids.flatMap((childId) => {
      const child = buildElement(document, childId, getMeta, nextPath);
      return child ? [child] : [];
    });
    children.push({
      kind: "slot",
      id: slotNodeId(id, slotName),
      label: slotName,
      parentId: id,
      slotName,
      children: slotChildren,
    });
  }

  return {
    kind: "element",
    id,
    type: element.type,
    label: element.name || meta?.title || element.type,
    isRoot,
    element,
    children,
  };
}

export function buildTree(
  document: AppDocument,
  getMeta: (type: string) => ComponentMeta | undefined,
) {
  if (!document.spec.root) return undefined;
  return buildElement(document, document.spec.root, getMeta, new Set(), true);
}

export function getElementLocation(document: AppDocument, elementId: string) {
  for (const [parentId, element] of Object.entries(document.spec.elements)) {
    const childIndex = element.children?.indexOf(elementId) ?? -1;
    if (childIndex >= 0) return { parentId, index: childIndex } satisfies ChildContainer;
    for (const [slotName, children] of Object.entries(element.slots ?? {})) {
      const slotIndex = children.indexOf(elementId);
      if (slotIndex >= 0) return { parentId, slotName, index: slotIndex } satisfies ChildContainer;
    }
  }
  return undefined;
}

export function insertElement(
  document: AppDocument,
  elementId: string,
  target: ChildContainer | undefined,
): AppDocument {
  if (!target) {
    return { ...document, spec: { ...document.spec, root: elementId } };
  }

  const parent = document.spec.elements[target.parentId];
  if (!parent) return document;
  const index = target.index ?? Number.MAX_SAFE_INTEGER;
  const elements = { ...document.spec.elements };
  if (target.slotName) {
    const children = [...(parent.slots?.[target.slotName] ?? [])];
    children.splice(Math.min(index, children.length), 0, elementId);
    elements[target.parentId] = {
      ...parent,
      slots: { ...parent.slots, [target.slotName]: children },
    };
  } else {
    const children = [...(parent.children ?? [])];
    children.splice(Math.min(index, children.length), 0, elementId);
    elements[target.parentId] = { ...parent, children };
  }
  return { ...document, spec: { ...document.spec, elements } };
}

export function removeElementFromContainer(document: AppDocument, elementId: string) {
  const location = getElementLocation(document, elementId);
  if (!location) return document;
  const parent = document.spec.elements[location.parentId];
  if (!parent) return document;
  const elements = { ...document.spec.elements };
  if (location.slotName) {
    const slots = { ...parent.slots };
    const children = (slots[location.slotName] ?? []).filter((id) => id !== elementId);
    if (children.length === 0) delete slots[location.slotName];
    else slots[location.slotName] = children;
    elements[location.parentId] = Object.keys(slots).length
      ? { ...parent, slots }
      : (() => {
          const next = { ...parent };
          delete next.slots;
          return next;
        })();
  } else {
    elements[location.parentId] = {
      ...parent,
      children: (parent.children ?? []).filter((id) => id !== elementId),
    };
  }
  return { ...document, spec: { ...document.spec, elements } };
}

export function collectDescendants(document: AppDocument, rootId: string) {
  const removed = new Set<string>();
  const visit = (id: string) => {
    if (removed.has(id)) return;
    removed.add(id);
    const element = document.spec.elements[id];
    if (!element) return;
    element.children?.forEach(visit);
    Object.values(element.slots ?? {})
      .flat()
      .forEach(visit);
  };
  visit(rootId);
  return removed;
}

export function deleteElementRecursive(document: AppDocument, elementId: string) {
  if (elementId === document.spec.root) {
    return {
      ...document,
      spec: { ...document.spec, root: "", elements: {} },
    };
  }
  const removed = collectDescendants(document, elementId);
  const detached = removeElementFromContainer(document, elementId);
  return {
    ...detached,
    spec: {
      ...detached.spec,
      elements: Object.fromEntries(
        Object.entries(detached.spec.elements).filter(([id]) => !removed.has(id)),
      ),
    },
  };
}
