import type { SceneDocument, UIElement } from "@openscene/protocol";

import type { ComponentMeta } from "./meta";

type EditorElement = UIElement & { name?: string };

/** One row of the sidebar tree, computed from the flat `spec.elements` map. */
export interface SidebarTreeItem {
  id: string;
  label: string;
  kind: "element" | "slot";
  /** Element component type; undefined for slot nodes. */
  type?: string;
  /** Child item ids: element children plus named-slot nodes. */
  children?: string[];
  /** Element contains children or non-empty named slots. */
  hasContent?: boolean;
}

export type ChildContainer = { parentId: string; slotName?: string; index?: number };

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

/**
 * Computes the sidebar tree directly from the flat `spec.elements` map:
 * element `children` resolve to child items, and named slots (declared in the
 * manifest or present on the element) become virtual slot nodes. Returns null
 * when the document has no resolvable root element.
 */
export function buildPageTreeItems(
  document: SceneDocument,
  getMeta: (type: string) => ComponentMeta | undefined,
): Record<string, SidebarTreeItem> | null {
  const elements = document.spec.elements as Record<string, EditorElement | undefined>;
  const rootId = document.spec.root;
  if (!rootId || !elements[rootId]) return null;

  const items: Record<string, SidebarTreeItem> = {};

  /** Visits the element and its subtree; returns false when unresolved or cyclic. */
  const visitElement = (id: string, path: Set<string>): boolean => {
    if (path.has(id)) return false;
    const element = elements[id];
    if (!element) return false;
    const nextPath = new Set(path).add(id);
    const meta = getMeta(element.type);
    const childItemIds: string[] = [];
    let elementChildCount = 0;

    for (const childId of element.children ?? []) {
      if (!elements[childId]) continue;
      if (visitElement(childId, nextPath)) {
        elementChildCount += 1;
        childItemIds.push(childId);
      }
    }

    const slotNames = new Set<string>();
    for (const slotName of Object.keys(meta?.slots ?? {})) {
      if (slotName !== "default") slotNames.add(slotName);
    }
    for (const slotName of Object.keys(element.slots ?? {})) {
      if (slotName !== "default") slotNames.add(slotName);
    }

    for (const slotName of slotNames) {
      const slotChildIds = (element.slots?.[slotName] ?? []).filter((childId) =>
        visitElement(childId, nextPath),
      );
      items[slotNodeId(id, slotName)] = {
        id: slotNodeId(id, slotName),
        label: meta?.slots?.[slotName]?.title ?? slotName,
        kind: "slot",
        children: slotChildIds,
      };
      childItemIds.push(slotNodeId(id, slotName));
    }

    const hasSlotContent = Object.values(element.slots ?? {}).some((ids) => (ids?.length ?? 0) > 0);
    items[id] = {
      id,
      label: element.name || meta?.title || element.type,
      type: element.type,
      kind: "element",
      children: childItemIds,
      hasContent: elementChildCount > 0 || hasSlotContent,
    };
    return true;
  };

  visitElement(rootId, new Set());
  return items;
}

export function getElementLocation(document: SceneDocument, elementId: string) {
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
  document: SceneDocument,
  elementId: string,
  target: ChildContainer | undefined,
): SceneDocument {
  if (!target) return { ...document, spec: { ...document.spec, root: elementId } };
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

export function removeElementFromContainer(document: SceneDocument, elementId: string) {
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
      : { ...parent, slots: undefined };
  } else {
    elements[location.parentId] = {
      ...parent,
      children: (parent.children ?? []).filter((id) => id !== elementId),
    };
  }
  return { ...document, spec: { ...document.spec, elements } };
}

export function collectDescendants(document: SceneDocument, rootId: string) {
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

export function deleteElementRecursive(document: SceneDocument, elementId: string) {
  if (elementId === document.spec.root) {
    const root = document.spec.elements[elementId];
    return {
      ...document,
      spec: {
        ...document.spec,
        elements: { [elementId]: { type: root?.type ?? "View", props: {}, children: [] } },
      },
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
