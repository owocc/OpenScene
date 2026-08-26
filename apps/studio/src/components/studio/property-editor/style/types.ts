import type { AppType } from "@openscene-ai/core";
import type { EditorMeta } from "@/core/meta";
import type { JsonValue } from "@/core/document";

export interface StyleControlProps {
  meta: EditorMeta;
  value: JsonValue | undefined;
  onChange: (value: JsonValue) => void;
  appType?: AppType;
}

export interface StyleEntry {
  id: string;
  key: string;
  value: JsonValue;
}
