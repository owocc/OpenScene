import type { SceneDocumentSnapshot } from "@openscene/protocol";

import type { AppDocument, JsonValue } from "./document";

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJsonValue(item)]));
  return null;
}

export function applyRemoteScene(document: AppDocument, scene: SceneDocumentSnapshot): AppDocument {
  return {
    ...document,
    spec: {
      ...document.spec,
      root: scene.root,
      state: toJsonValue(scene.state) as Record<string, JsonValue>,
      elements: Object.fromEntries(
        Object.entries(scene.elements).map(([id, element]) => [
          id,
          {
            type: element.type,
            props: toJsonValue(element.props) as Record<string, JsonValue>,
            children: element.children ?? [],
            slots: element.slots ?? {},
          },
        ]),
      ),
    },
  };
}
