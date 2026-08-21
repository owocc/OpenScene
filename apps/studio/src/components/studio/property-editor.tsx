import { useEffect, useMemo, useState, type ReactNode } from "react";

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
import type { ComponentMeta, EditorMeta, PropMeta } from "@/core/meta";

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

function StyleControl({ value, onChange }: ControlProps) {
  const style = isRecord(value) ? value : {};
  const fields = [
    "display",
    "position",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "textAlign",
    "color",
    "background",
    "borderRadius",
    "boxShadow",
  ];
  return (
    <div className="grid gap-1.5">
      {fields.map((field) => (
        <label
          key={field}
          className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-[10px] text-muted-foreground"
        >
          <span className="font-mono">{field}</span>
          <input
            className={inputClassName}
            value={stringValue(style[field])}
            onChange={(event) => onChange({ ...style, [field]: event.target.value })}
          />
        </label>
      ))}
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

function ActionControl({ meta }: ControlProps) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-2.5 py-2 text-[11px] leading-5 text-muted-foreground">
      {meta.placeholder ?? "动作由事件 Meta 声明，当前画布仅展示 JSON 结构。"}
    </div>
  );
}

const controlRegistry: Record<string, ControlRenderer> = {
  text: TextControl,
  textarea: TextareaControl,
  number: NumberControl,
  integer: NumberControl,
  select: SelectControl,
  boolean: BooleanControl,
  color: ColorControl,
  unit: UnitControl,
  spacing: SpacingControl,
  style: StyleControl,
  object: JsonControl,
  array: JsonControl,
  class: TextControl,
  action: ActionControl,
};

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

  const control = controlRegistry[meta.control] ?? TextControl;
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
