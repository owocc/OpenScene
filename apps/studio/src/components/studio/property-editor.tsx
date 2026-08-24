import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  dynamicMode,
  dynamicValue,
  dynamicValueText,
  getBindingType,
  getEditableStatePaths,
  isRecord,
  isDynamicValue,
  normalizeStatePath,
  type DynamicMode,
  type JsonValue,
} from "@/core/document";
import { LOCAL_TEST_SESSION_ID } from "@/core/local-test-session";
import type { ComponentMeta, EditorMeta, PropMeta } from "@/core/meta";
import { useI18n } from "@/i18n";
import { useQueryStore } from "@/stores";
import { createOpenSceneClient } from "@openscene/api-client";
import {
  openApiMethods,
  type OpenApiMethod,
  type OpenApiRequestParams,
  type OpenApiValue,
} from "@openscene/schema";
import { cn } from "@/lib/utils";
const inputClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const textareaClassName =
  "min-h-16 w-full resize-y rounded-lg border border-input bg-background px-2.5 py-2 font-mono text-[11px] leading-5 shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

interface ControlProps {
  meta: EditorMeta;
  value: JsonValue | undefined;
  onChange: (value: JsonValue) => void;
}

type ControlRenderer = (props: ControlProps) => ReactNode;

function stringValue(value: JsonValue | undefined) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function TextControl({ meta, value, onChange }: ControlProps) {
  return (
    <input
      className={inputClassName}
      placeholder={meta.placeholder}
      value={stringValue(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TextareaControl({ meta, value, onChange }: ControlProps) {
  return (
    <textarea
      className={textareaClassName}
      placeholder={meta.placeholder}
      value={stringValue(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function NumberControl({ meta, value, onChange }: ControlProps) {
  return (
    <input
      className={inputClassName}
      type="number"
      min={meta.minimum}
      max={meta.maximum}
      step={meta.step ?? (meta.control === "integer" ? 1 : "any")}
      value={typeof value === "number" ? value : stringValue(value)}
      onChange={(event) => {
        if (event.target.value === "") return;
        const next =
          meta.control === "integer"
            ? Number.parseInt(event.target.value, 10)
            : Number(event.target.value);
        if (Number.isFinite(next)) onChange(next);
      }}
    />
  );
}

function SelectControl({ meta, value, onChange }: ControlProps) {
  const serialized = JSON.stringify(value ?? "");
  return (
    <select
      className={inputClassName}
      value={serialized}
      onChange={(event) => {
        const option = meta.options?.find(
          (candidate) => JSON.stringify(candidate.value) === event.target.value,
        );
        if (option) onChange(option.value);
      }}
    >
      {meta.options?.map((option) => (
        <option
          key={`${option.label}-${JSON.stringify(option.value)}`}
          value={JSON.stringify(option.value)}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}

function BooleanControl({ value, onChange }: ControlProps) {
  return (
    <label className="flex h-8 items-center justify-between rounded-lg border border-input bg-background px-2.5 text-xs">
      <span>{value === true ? "启用" : "关闭"}</span>
      <input
        type="checkbox"
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function ColorControl({ meta, value, onChange }: ControlProps) {
  const text = stringValue(value);
  const color = /^#[0-9a-f]{6}$/i.test(text) ? text : "#111827";
  return (
    <div className="flex gap-2">
      <input
        className="h-8 w-10 cursor-pointer rounded-lg border border-input bg-background p-1"
        type="color"
        value={color}
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        className={inputClassName}
        placeholder={meta.placeholder ?? "#111827"}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function parseUnit(value: JsonValue | undefined) {
  if (typeof value === "number") return { number: value, unit: "px" };
  if (typeof value !== "string") return { number: "", unit: "px" };
  const match = value.trim().match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))([a-z%]*)$/i);
  if (!match) return { number: "", unit: value };
  return { number: match[1], unit: match[2] || "px" };
}

function UnitControl({ meta, value, onChange }: ControlProps) {
  const parsed = parseUnit(value);
  const keywords = meta.keywords ?? [];
  return (
    <div className="flex gap-1.5">
      <input
        className={inputClassName}
        type="number"
        min={meta.minimum}
        max={meta.maximum}
        step={meta.step ?? "any"}
        value={parsed.number}
        placeholder={keywords[0] ?? "0"}
        onChange={(event) => {
          if (event.target.value === "") return onChange("");
          onChange(`${event.target.value}${parsed.unit}`);
        }}
      />
      <select
        className="h-8 w-20 rounded-lg border border-input bg-background px-2 text-xs"
        value={parsed.unit}
        onChange={(event) => {
          if (parsed.number === "") return onChange(event.target.value);
          onChange(`${parsed.number}${event.target.value}`);
        }}
      >
        {meta.units?.map((unitName) => (
          <option key={unitName} value={unitName}>
            {unitName}
          </option>
        ))}
        {keywords.map((keyword) => (
          <option key={keyword} value={keyword}>
            {keyword}
          </option>
        ))}
      </select>
    </div>
  );
}

function parseSpacing(value: JsonValue | undefined) {
  const raw = stringValue(value).trim() || "0px";
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
  return parts.slice(0, 4);
}

function SpacingControl({ meta, value, onChange }: ControlProps) {
  const [top, right, bottom, left] = parseSpacing(value);
  const values = { top, right, bottom, left };
  const update = (side: keyof typeof values, next: string) =>
    onChange(
      `${side === "top" ? next : top} ${side === "right" ? next : right} ${side === "bottom" ? next : bottom} ${side === "left" ? next : left}`,
    );
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <label key={side} className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-8 capitalize">{side}</span>
          <input
            className={inputClassName}
            list={`${side}-units`}
            value={values[side]}
            onChange={(event) => update(side, event.target.value)}
          />
        </label>
      ))}
      <datalist id="top-units">
        {meta.units?.map((unitName) => (
          <option key={unitName} value={`0${unitName}`} />
        ))}
      </datalist>
      <datalist id="right-units">
        {meta.units?.map((unitName) => (
          <option key={unitName} value={`0${unitName}`} />
        ))}
      </datalist>
      <datalist id="bottom-units">
        {meta.units?.map((unitName) => (
          <option key={unitName} value={`0${unitName}`} />
        ))}
      </datalist>
      <datalist id="left-units">
        {meta.units?.map((unitName) => (
          <option key={unitName} value={`0${unitName}`} />
        ))}
      </datalist>
    </div>
  );
}

const COMMON_CSS_PROPERTIES = [
  "display",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "gap",
  "flex",
  "flexWrap",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
  "color",
  "backgroundColor",
  "background",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "border",
  "borderWidth",
  "borderStyle",
  "borderColor",
  "borderRadius",
  "boxShadow",
  "opacity",
  "overflow",
  "cursor",
  "transform",
  "transition",
];

interface StyleEntry {
  id: string;
  key: string;
  value: string;
}

function objectToStyleEntries(obj: unknown): StyleEntry[] {
  if (!isRecord(obj)) return [];
  return Object.entries(obj).map(([key, val]) => ({
    id: `${key}-${Math.random().toString(36).slice(2, 7)}`,
    key,
    value: typeof val === "string" || typeof val === "number" ? String(val) : JSON.stringify(val),
  }));
}

function styleEntriesToRecord(entries: StyleEntry[]): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {};
  for (const entry of entries) {
    const trimmedKey = entry.key.trim();
    if (trimmedKey) {
      result[trimmedKey] = entry.value;
    }
  }
  return result;
}

function KeyValueControl({ meta, value, onChange }: ControlProps) {
  const [entries, setEntries] = useState<StyleEntry[]>(() => objectToStyleEntries(value));

  useEffect(() => {
    const currentRecord = styleEntriesToRecord(entries);
    const incomingRecord = isRecord(value) ? value : {};
    const currentKeys = Object.keys(currentRecord);
    const incomingKeys = Object.keys(incomingRecord);
    const isDifferent =
      currentKeys.length !== incomingKeys.length ||
      incomingKeys.some((k) => stringValue(incomingRecord[k]) !== stringValue(currentRecord[k]));
    if (isDifferent) {
      setEntries(objectToStyleEntries(value));
    }
  }, [value]);

  const updateEntry = (id: string, field: "key" | "value", newValue: string) => {
    const next = entries.map((entry) =>
      entry.id === id ? { ...entry, [field]: newValue } : entry,
    );
    setEntries(next);
    onChange(styleEntriesToRecord(next));
  };

  const removeEntry = (id: string) => {
    const next = entries.filter((entry) => entry.id !== id);
    setEntries(next);
    onChange(styleEntriesToRecord(next));
  };

  const addEntry = () => {
    const newEntry: StyleEntry = {
      id: `kv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      key: "",
      value: "",
    };
    setEntries((prev) => [...prev, newEntry]);
  };

  const keyPlaceholder = meta.placeholder ?? "key";
  const keywords =
    meta.keywords && meta.keywords.length > 0 ? meta.keywords : COMMON_CSS_PROPERTIES;

  return (
    <div className="grid gap-2">
      <datalist id="common-kv-props">
        {keywords.map((prop) => (
          <option key={prop} value={prop} />
        ))}
      </datalist>
      {entries.length > 0 ? (
        <div className="grid gap-1.5">
          <div className="grid grid-cols-[1fr_1fr_28px] items-center gap-1.5 px-0.5 text-[10px] font-medium text-muted-foreground">
            <span>属性 (Key)</span>
            <span>值 (Value)</span>
            <span />
          </div>
          {entries.map((entry) => (
            <div key={entry.id} className="grid grid-cols-[1fr_1fr_28px] items-center gap-1.5">
              <input
                className={cn(inputClassName, "font-mono text-[11px] placeholder:font-sans")}
                placeholder={keyPlaceholder}
                list="common-kv-props"
                value={entry.key}
                onChange={(e) => updateEntry(entry.id, "key", e.target.value)}
              />
              <input
                className={cn(inputClassName, "font-mono text-[11px] placeholder:font-sans")}
                placeholder="value"
                value={entry.value}
                onChange={(e) => updateEntry(entry.id, "value", e.target.value)}
              />
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition hover:border-border hover:bg-muted hover:text-destructive focus-visible:outline-none"
                onClick={() => removeEntry(entry.id)}
                title="删除属性"
                aria-label="Delete property"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/80 px-3 py-2 text-center text-[11px] text-muted-foreground">
          暂无属性
        </div>
      )}
      <button
        type="button"
        className="flex h-7.5 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/80 bg-muted/20 px-2.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:bg-muted/50 hover:text-foreground focus-visible:outline-none"
        onClick={addEntry}
      >
        <Plus className="size-3.5" />
        <span>添加属性</span>
      </button>
    </div>
  );
}

function JsonControl({ meta, value, onChange }: ControlProps) {
  const [text, setText] = useState(() =>
    JSON.stringify(value ?? (meta.control === "array" ? [] : {}), null, 2),
  );
  const [error, setError] = useState(false);
  return (
    <div className="grid gap-1">
      <textarea
        className={textareaClassName}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          try {
            const parsed: unknown = JSON.parse(event.target.value);
            if (parsed === null || typeof parsed !== "object") throw new Error("not object");
            setError(false);
            onChange(parsed as JsonValue);
          } catch {
            setError(true);
          }
        }}
      />
      {error && <span className="text-[10px] text-destructive">JSON 格式暂时无效</span>}
    </div>
  );
}
type OpenApiDocSummary = {
  id: string;
  appId: string;
  name: string;
  isDefault: boolean;
};

type OpenApiDocClient = {
  GET: (
    path: string,
    options: unknown,
  ) => Promise<{
    data?: unknown;
    error?: unknown;
    response: Response;
  }>;
};

const EMBEDDED_DOC = "__embedded__";

function isOpenApiValue(value: JsonValue | undefined): value is OpenApiValue {
  return (
    isRecord(value) &&
    isRecord(value.json) &&
    typeof value.path === "string" &&
    typeof value.method === "string"
  );
}

function getPaths(json: Record<string, JsonValue> | undefined) {
  if (!isRecord(json)) return undefined;
  const paths = json.paths;
  return isRecord(paths) ? paths : undefined;
}

function firstAvailableMethod(
  pathItem: Record<string, JsonValue> | undefined,
): OpenApiMethod | undefined {
  if (!isRecord(pathItem)) return undefined;
  return openApiMethods.find((method) => method in pathItem);
}

function buildInitialValue(json: Record<string, JsonValue>): OpenApiValue | undefined {
  const paths = getPaths(json);
  if (!paths) return undefined;
  const firstPath = Object.keys(paths)[0];
  if (!firstPath) return undefined;
  const pathItem = isRecord(paths[firstPath]) ? paths[firstPath] : undefined;
  const method = firstAvailableMethod(pathItem);
  if (!method) return undefined;
  return { json, path: firstPath, method, params: {} };
}

type OpenApiParam = {
  name: string;
  in: string;
  required?: boolean;
  schema?: { type?: string };
};

function mergedOperationParams(
  pathItem: Record<string, JsonValue> | undefined,
  operation: Record<string, JsonValue> | undefined,
): OpenApiParam[] {
  const byKey = new Map<string, OpenApiParam>();
  const addParams = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      if (!isRecord(entry)) continue;
      const name = entry.name;
      const location = entry.in;
      if (typeof name !== "string" || typeof location !== "string") continue;
      const schema = isRecord(entry.schema) ? entry.schema : undefined;
      byKey.set(`${location}:${name}`, {
        name,
        in: location,
        required: entry.required === true,
        schema: schema
          ? { type: typeof schema.type === "string" ? schema.type : undefined }
          : undefined,
      });
    }
  };
  addParams(isRecord(pathItem) ? pathItem.parameters : undefined);
  addParams(isRecord(operation) ? operation.parameters : undefined);
  return [...byKey.values()];
}

function pruneParams(
  params: OpenApiRequestParams | undefined,
  pathItem: Record<string, JsonValue> | undefined,
  operation: Record<string, JsonValue> | undefined,
): OpenApiRequestParams | undefined {
  const merged = mergedOperationParams(pathItem, operation);
  const pathKeys = new Set(merged.filter((p) => p.in === "path").map((p) => p.name));
  const queryKeys = new Set(merged.filter((p) => p.in === "query").map((p) => p.name));
  const next: OpenApiRequestParams = {};
  if (params?.path) {
    const path: Record<string, string> = {};
    for (const [key, item] of Object.entries(params.path)) {
      if (pathKeys.has(key)) path[key] = item;
    }
    if (Object.keys(path).length > 0) next.path = path;
  }
  if (params?.query) {
    const query: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(params.query)) {
      if (queryKeys.has(key)) query[key] = item;
    }
    if (Object.keys(query).length > 0) next.query = query;
  }
  if (
    isRecord(operation) &&
    "requestBody" in operation &&
    params?.body !== undefined &&
    next.body === undefined
  ) {
    next.body = params.body;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function OpenApiControl({ value, onChange }: ControlProps) {
  const { LL } = useI18n();
  const session = useMemo(() => {
    const query = useQueryStore.getState();
    if (!query.serverUrl || !query.sessionId || !query.token) return null;
    if (query.sessionId === LOCAL_TEST_SESSION_ID) return null;
    return {
      baseUrl: query.serverUrl.replace(/\/$/, ""),
      sessionId: query.sessionId,
      token: query.token,
    };
  }, []);
  const client = useMemo<OpenApiDocClient | null>(() => {
    if (!session) return null;
    return createOpenSceneClient({
      baseUrl: session.baseUrl,
      headers: { "x-openscene-session-token": session.token },
    }) as unknown as OpenApiDocClient;
  }, [session]);
  const [embeddedJson] = useState<Record<string, JsonValue> | null>(() =>
    isRecord(value) && getPaths(isRecord(value.json) ? value.json : undefined)
      ? (value as OpenApiValue).json
      : null,
  );
  const [docJson, setDocJson] = useState<Record<string, JsonValue> | undefined>(
    () => embeddedJson ?? undefined,
  );
  const [activeDocId, setActiveDocId] = useState<string | null>(() =>
    embeddedJson ? EMBEDDED_DOC : null,
  );
  const [docs, setDocs] = useState<OpenApiDocSummary[] | null>(null);
  const [docsError, setDocsError] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [bodyText, setBodyText] = useState(() => {
    if (isOpenApiValue(value) && isRecord(value.params) && value.params.body !== undefined) {
      try {
        return JSON.stringify(value.params.body, null, 2);
      } catch {
        return "";
      }
    }
    return "";
  });
  const [bodyError, setBodyError] = useState(false);

  useEffect(() => {
    if (!client || !session) return;
    let cancelled = false;
    void client
      .GET(`/api/v1/studio-sessions/${session.sessionId}/openapi-docs`, {})
      .then((result) => {
        if (cancelled) return;
        if (result.error || !Array.isArray(result.data)) {
          setDocsError(true);
          return;
        }
        setDocs(result.data as OpenApiDocSummary[]);
      });
    return () => {
      cancelled = true;
    };
  }, [client, session]);

  const loadDoc = useMemo(
    () => async (docId: string) => {
      if (!client || !session) return;
      setDocLoading(true);
      try {
        const result = await client.GET(
          `/api/v1/studio-sessions/${session.sessionId}/openapi-docs/${docId}`,
          {},
        );
        const data = isRecord(result.data) ? result.data : undefined;
        const json = isRecord(data?.json) ? (data.json as Record<string, JsonValue>) : undefined;
        if (result.error || !json) {
          setDocsError(true);
          return;
        }
        const initial = buildInitialValue(json);
        if (initial) onChange(initial);
        setDocJson(json);
        setActiveDocId(docId);
      } finally {
        setDocLoading(false);
      }
    },
    [client, session, onChange],
  );

  useEffect(() => {
    if (!session || !docs || docs.length === 0 || docJson) return;
    const target = docs.find((doc) => doc.isDefault) ?? docs[0];
    if (!target) return;
    void loadDoc(target.id);
  }, [docs, docJson, session, loadDoc]);

  const current = isOpenApiValue(value) ? value : undefined;
  const paths = getPaths(docJson);
  const pathKeys = paths ? Object.keys(paths) : [];
  const activePath =
    paths && current && typeof current.path === "string" && current.path in paths
      ? current.path
      : pathKeys[0];
  const pathItem = activePath
    ? isRecord(paths?.[activePath])
      ? (paths[activePath] as Record<string, JsonValue>)
      : undefined
    : undefined;
  const pathMethods = pathItem ? openApiMethods.filter((method) => method in pathItem) : [];
  const activeMethod =
    current && pathMethods.includes(current.method) ? current.method : pathMethods[0];
  const operation =
    pathItem && activeMethod && isRecord(pathItem[activeMethod])
      ? (pathItem[activeMethod] as Record<string, JsonValue>)
      : undefined;
  const mergedParams = mergedOperationParams(pathItem, operation);
  const pathParams = mergedParams.filter((param) => param.in === "path");
  const queryParams = mergedParams.filter((param) => param.in === "query");
  const hasRequestBody = isRecord(operation) && "requestBody" in operation;
  const noDocsVisible = !docsError && !docLoading && !docJson && (docs?.length ?? 0) === 0;

  const selectPath = (path: string) => {
    const item = isRecord(paths?.[path]) ? (paths[path] as Record<string, JsonValue>) : undefined;
    const method = firstAvailableMethod(item);
    if (!method) return;
    const op =
      item && isRecord(item[method]) ? (item[method] as Record<string, JsonValue>) : undefined;
    const next: OpenApiValue = {
      json: docJson ?? {},
      path,
      method,
      params: pruneParams(current?.params, item, op),
    };
    onChange(next);
  };
  const selectMethod = (method: OpenApiMethod) => {
    const op =
      pathItem && isRecord(pathItem[method])
        ? (pathItem[method] as Record<string, JsonValue>)
        : undefined;
    const next: OpenApiValue = {
      json: docJson ?? {},
      path: activePath,
      method,
      params: pruneParams(current?.params, pathItem, op),
    };
    onChange(next);
  };
  const setPathParam = (name: string, next: string) => {
    const updated: OpenApiValue = {
      json: docJson ?? {},
      path: activePath,
      method: activeMethod ?? "get",
      params: {
        ...current?.params,
        path: { ...current?.params?.path, [name]: next },
      },
    };
    onChange(updated);
  };
  const setQueryParam = (name: string, next: JsonValue) => {
    const updated: OpenApiValue = {
      json: docJson ?? {},
      path: activePath,
      method: activeMethod ?? "get",
      params: {
        ...current?.params,
        query: { ...current?.params?.query, [name]: next },
      },
    };
    onChange(updated);
  };
  const setBody = (text: string) => {
    setBodyText(text);
    try {
      const parsed: unknown = JSON.parse(text);
      setBodyError(false);
      const updated: OpenApiValue = {
        json: docJson ?? {},
        path: activePath,
        method: activeMethod ?? "get",
        params: { ...current?.params, body: parsed as JsonValue },
      };
      onChange(updated);
    } catch {
      setBodyError(true);
    }
  };

  return (
    <div className="grid gap-2">
      {docs !== null && (embeddedJson !== null || (docs?.length ?? 0) > 0) ? (
        <label className="grid gap-1">
          <span className="text-[10px] text-muted-foreground">{LL.properties.openapi.docs()}</span>
          <select
            className={inputClassName}
            value={activeDocId ?? ""}
            onChange={(event) => {
              if (event.target.value === EMBEDDED_DOC) return;
              void loadDoc(event.target.value);
            }}
          >
            {embeddedJson !== null && (
              <option value={EMBEDDED_DOC}>{LL.properties.openapi.embedded()}</option>
            )}
            {(docs ?? []).map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {docLoading ? (
        <span className="text-[10px] text-muted-foreground">{LL.properties.openapi.loading()}</span>
      ) : docsError && !docJson ? (
        <span className="text-[10px] text-destructive">{LL.properties.openapi.loadFailed()}</span>
      ) : noDocsVisible ? (
        <span className="text-[10px] text-muted-foreground">{LL.properties.openapi.noDocs()}</span>
      ) : (
        pathKeys.length > 0 && (
          <>
            <label className="grid gap-1">
              <span className="text-[10px] text-muted-foreground">
                {LL.properties.openapi.operation()}
              </span>
              <select
                className={inputClassName}
                value={activePath}
                onChange={(event) => selectPath(event.target.value)}
              >
                {pathKeys.map((path) => {
                  const item = isRecord(paths?.[path])
                    ? (paths[path] as Record<string, JsonValue>)
                    : undefined;
                  const op =
                    item && isRecord(item[openApiMethods.find((method) => method in item) ?? "get"])
                      ? (item[openApiMethods.find((method) => method in item) ?? "get"] as Record<
                          string,
                          JsonValue
                        >)
                      : undefined;
                  const summary = typeof op?.summary === "string" ? op.summary : undefined;
                  const operationId =
                    typeof op?.operationId === "string" ? op.operationId : undefined;
                  const label = [path, summary ?? operationId].filter(Boolean).join(" — ");
                  return (
                    <option key={path} value={path}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] text-muted-foreground">
                {LL.properties.openapi.method()}
              </span>
              <select
                className={inputClassName}
                value={activeMethod}
                onChange={(event) => selectMethod(event.target.value as OpenApiMethod)}
              >
                {pathMethods.map((method) => (
                  <option key={method} value={method}>
                    {method.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            {pathParams.length > 0 && (
              <div className="grid gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {LL.properties.openapi.pathParams()}
                </span>
                {pathParams.map((param) => (
                  <label key={`${param.in}:${param.name}`} className="grid gap-1">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {param.name}
                      {param.required ? " *" : ""}
                    </span>
                    <input
                      className={inputClassName}
                      value={current?.params?.path?.[param.name] ?? ""}
                      onChange={(event) => setPathParam(param.name, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}
            {queryParams.length > 0 && (
              <div className="grid gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {LL.properties.openapi.queryParams()}
                </span>
                {queryParams.map((param) => {
                  const type = param.schema?.type ?? "string";
                  const value = current?.params?.query?.[param.name];
                  return (
                    <label key={`${param.in}:${param.name}`} className="grid gap-1">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {param.name}
                        {param.required ? " *" : ""}
                      </span>
                      {type === "integer" || type === "number" ? (
                        <input
                          className={inputClassName}
                          type="number"
                          value={typeof value === "number" ? value : ""}
                          onChange={(event) => {
                            if (event.target.value === "") {
                              setQueryParam(param.name, "");
                              return;
                            }
                            const next = Number(event.target.value);
                            if (Number.isFinite(next)) setQueryParam(param.name, next);
                          }}
                        />
                      ) : type === "boolean" ? (
                        <input
                          type="checkbox"
                          checked={value === true}
                          onChange={(event) => setQueryParam(param.name, event.target.checked)}
                        />
                      ) : (
                        <input
                          className={inputClassName}
                          value={typeof value === "string" ? value : value === null ? "" : ""}
                          onChange={(event) => setQueryParam(param.name, event.target.value)}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            {hasRequestBody && (
              <label className="grid gap-1">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {LL.properties.openapi.body()}
                </span>
                <textarea
                  className={textareaClassName}
                  value={bodyText}
                  onChange={(event) => setBody(event.target.value)}
                />
                {bodyError && (
                  <span className="text-[10px] text-destructive">
                    {LL.properties.openapi.invalidJson()}
                  </span>
                )}
              </label>
            )}
          </>
        )
      )}
    </div>
  );
}

function ActionControl({ meta }: ControlProps) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-2.5 py-2 text-[11px] leading-5 text-muted-foreground">
      {meta.placeholder ?? "动作由事件 Meta 声明，当前画布仅展示 JSON 结构。"}
    </div>
  );
}
export const controlRegistry: Record<string, ControlRenderer> = {
  text: TextControl,
  textarea: TextareaControl,
  number: NumberControl,
  integer: NumberControl,
  select: SelectControl,
  boolean: BooleanControl,
  color: ColorControl,
  unit: UnitControl,
  spacing: SpacingControl,
  style: KeyValueControl,
  "key-value": KeyValueControl,
  keyvalue: KeyValueControl,
  keyValue: KeyValueControl,
  object: JsonControl,
  array: JsonControl,
  class: TextControl,
  action: ActionControl,
  openapi: OpenApiControl,
};

/**
 * Resolves a property editor component from a control type string.
 * Handles string normalization (e.g. "key-value", "keyValue", "key_value", "style").
 */
export function resolveControlRenderer(controlName?: string): ControlRenderer {
  if (!controlName || typeof controlName !== "string") return TextControl;
  const trimmed = controlName.trim();
  if (controlRegistry[trimmed]) return controlRegistry[trimmed];

  const normalized = trimmed.toLowerCase().replace(/[_-]/g, "");
  switch (normalized) {
    case "keyvalue":
    case "style":
      return KeyValueControl;
    case "text":
    case "string":
    case "class":
      return TextControl;
    case "textarea":
    case "multiline":
      return TextareaControl;
    case "number":
    case "integer":
    case "int":
    case "float":
      return NumberControl;
    case "select":
    case "enum":
      return SelectControl;
    case "boolean":
    case "bool":
      return BooleanControl;
    case "color":
      return ColorControl;
    case "unit":
      return UnitControl;
    case "spacing":
      return SpacingControl;
    case "object":
    case "array":
    case "json":
      return JsonControl;
    case "action":
      return ActionControl;
    case "openapi":
      return OpenApiControl;
    default:
      return controlRegistry[trimmed.toLowerCase()] ?? controlRegistry[normalized] ?? TextControl;
  }
}

function DynamicValueControl({
  propMeta,
  componentType,
  value,
  onChange,
  statePaths,
}: {
  propMeta: PropMeta;
  componentType: string;
  value: JsonValue | undefined;
  onChange: (value: JsonValue) => void;
  statePaths: string[];
}) {
  const meta = propMeta.editor;
  const supportedModes = propMeta.dynamic ?? [
    getBindingType(componentType, propMeta.title),
    "template",
  ];
  const dynamicModes = propMeta.translatable
    ? [...supportedModes, "i18n" as const]
    : supportedModes;
  const mode = dynamicMode(value);
  const activeMode = mode && dynamicModes.includes(mode) ? mode : "literal";
  const [literalValue, setLiteralValue] = useState<JsonValue | undefined>(
    activeMode === "literal" ? value : propMeta.default,
  );

  useEffect(() => {
    if (activeMode === "literal" && !isDynamicValue(value)) setLiteralValue(value);
  }, [activeMode, value]);

  const control = resolveControlRenderer(meta.control);
  const updateLiteral = (next: JsonValue) => {
    setLiteralValue(next);
    onChange(next);
  };

  return (
    <div className="grid gap-1.5">
      {activeMode === "literal" ? (
        control({ meta, value: literalValue, onChange: updateLiteral })
      ) : activeMode === "state" || activeMode === "bindState" ? (
        <div className="grid gap-1">
          <input
            className={inputClassName}
            list={`state-paths-${propMeta.title.replace(/\W/g, "-")}`}
            value={isDynamicValue(value) ? dynamicValueText(value) : ""}
            placeholder="/user/name"
            onChange={(event) => onChange(dynamicValue(activeMode, event.target.value))}
          />
          <datalist id={`state-paths-${propMeta.title.replace(/\W/g, "-")}`}>
            {statePaths.map((path) => (
              <option key={path} value={path} />
            ))}
          </datalist>
        </div>
      ) : (
        <input
          className={inputClassName}
          value={isDynamicValue(value) ? dynamicValueText(value) : ""}
          placeholder={activeMode === "i18n" ? "heroTitle" : "{{/user/name}}"}
          onChange={(event) => onChange(dynamicValue(activeMode, event.target.value))}
        />
      )}
      <select
        className="h-7 rounded-lg border border-input bg-background px-2 text-[10px] text-muted-foreground"
        value={activeMode}
        onChange={(event) => {
          const nextMode = event.target.value as DynamicMode | "literal";
          if (nextMode === "literal") {
            onChange(literalValue ?? "");
            return;
          }
          onChange(dynamicValue(nextMode, isDynamicValue(value) ? dynamicValueText(value) : ""));
        }}
      >
        <option value="literal">Literal</option>
        {dynamicModes.includes("state") && <option value="state">State read</option>}
        {dynamicModes.includes("bindState") && <option value="bindState">Two-way bind</option>}
        {dynamicModes.includes("template") && <option value="template">Template</option>}
        {dynamicModes.includes("i18n") && <option value="i18n">i18n key</option>}
      </select>
    </div>
  );
}

export interface PropertyEditorProps {
  meta: ComponentMeta;
  componentType: string;
  elementId: string;
  props: Record<string, JsonValue>;
  state: Record<string, JsonValue> | undefined;
  onChange: (name: string, value: JsonValue) => void;
}

export function PropertyEditor({
  meta,
  componentType,
  elementId,
  props,
  state,
  onChange,
}: PropertyEditorProps) {
  const statePaths = useMemo(() => getEditableStatePaths(state), [state]);
  return (
    <div className="grid gap-3">
      {Object.entries(meta.props).map(([name, prop]) => (
        <fieldset key={name} className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-medium text-foreground">{prop.title}</label>
            <span className="font-mono text-[9px] text-muted-foreground">{name}</span>
          </div>
          <DynamicValueControl
            key={`${elementId}:${name}`}
            propMeta={prop}
            componentType={componentType}
            value={props[name] ?? prop.default}
            onChange={(value) => onChange(name, value)}
            statePaths={statePaths}
          />
          {prop.description && (
            <p className="text-[10px] leading-4 text-muted-foreground">{prop.description}</p>
          )}
        </fieldset>
      ))}
      {meta.events &&
        Object.entries(meta.events).map(([name, event]) => (
          <fieldset key={name} className="grid gap-1.5 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-medium">{event.title}</label>
              <span className="font-mono text-[9px] text-muted-foreground">on.{name}</span>
            </div>
            <ActionControl
              meta={{ control: "action", placeholder: event.description }}
              value={undefined}
              onChange={() => undefined}
            />
            {event.allowedActions && (
              <p className="text-[10px] text-muted-foreground">
                可用动作：{event.allowedActions.join(" · ")}
              </p>
            )}
          </fieldset>
        ))}
    </div>
  );
}

export function normalizeEditorPath(value: string) {
  return normalizeStatePath(value);
}
