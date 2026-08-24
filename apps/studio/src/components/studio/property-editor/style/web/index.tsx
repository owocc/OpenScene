import { useEffect, useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDynamicValue, isRecord, type JsonValue } from "@/core/document";
import { DynamicValueInput } from "../../../dynamic-value-input";
import type { StyleControlProps, StyleEntry } from "../types";
import {
  camelToKebab,
  getAllWebCssProperties,
  getCssValueSuggestions,
  isColorProperty,
  loadMdnData,
} from "./properties";

const inputClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

function objectToStyleEntries(obj: unknown): StyleEntry[] {
  if (!isRecord(obj) || isDynamicValue(obj)) return [];
  return Object.entries(obj).map(([key, val]) => {
    const normalizedKey = camelToKebab(key.trim());
    return {
      id: `${normalizedKey}-${Math.random().toString(36).slice(2, 7)}`,
      key: normalizedKey,
      value: val as JsonValue,
    };
  });
}

function styleEntriesToRecord(entries: StyleEntry[]): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {};
  for (const entry of entries) {
    const trimmedKey = entry.key.trim();
    if (trimmedKey) {
      const normalizedKey = camelToKebab(trimmedKey);
      result[normalizedKey] = entry.value;
    }
  }
  return result;
}

export function WebStyleControl({ meta, value, onChange }: StyleControlProps) {
  const keyDatalistId = useId();
  const valDatalistPrefix = useId();
  const [entries, setEntries] = useState<StyleEntry[]>(() => objectToStyleEntries(value));
  const [cssProperties, setCssProperties] = useState<string[]>(() => getAllWebCssProperties());

  useEffect(() => {
    // Lazily load full MDN property catalog in the background
    void loadMdnData().then(() => {
      setCssProperties(getAllWebCssProperties());
    });
  }, []);

  useEffect(() => {
    if (isDynamicValue(value)) return;
    const currentRecord = styleEntriesToRecord(entries);
    const incomingRecord = isRecord(value) ? value : {};
    const currentKeys = Object.keys(currentRecord);
    const incomingKeys = Object.keys(incomingRecord);
    const isDifferent =
      currentKeys.length !== incomingKeys.length ||
      incomingKeys.some(
        (k) => JSON.stringify(incomingRecord[k]) !== JSON.stringify(currentRecord[k]),
      );
    if (isDifferent) {
      setEntries(objectToStyleEntries(value));
    }
  }, [value]);
  const updateEntry = (id: string, field: "key" | "value", newValue: JsonValue) => {
    const formattedValue =
      field === "key" && typeof newValue === "string" ? camelToKebab(newValue) : newValue;
    const next = entries.map((entry) =>
      entry.id === id ? { ...entry, [field]: formattedValue } : entry,
    );
    setEntries(next);
    onChange(styleEntriesToRecord(next));
  };

  const handleKeyBlur = (id: string, rawKey: string) => {
    const normalizedKey = camelToKebab(rawKey.trim());
    if (normalizedKey !== rawKey) {
      const next = entries.map((entry) =>
        entry.id === id ? { ...entry, key: normalizedKey } : entry,
      );
      setEntries(next);
      onChange(styleEntriesToRecord(next));
    }
  };

  const removeEntry = (id: string) => {
    const next = entries.filter((entry) => entry.id !== id);
    setEntries(next);
    onChange(styleEntriesToRecord(next));
  };

  const addEntry = () => {
    const newEntry: StyleEntry = {
      id: `style-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      key: "",
      value: "",
    };
    setEntries((prev) => [...prev, newEntry]);
  };

  const keyPlaceholder = meta.placeholder ?? "css-property";

  return (
    <div className="grid gap-2">
      {/* Property Key suggestions datalist */}
      <datalist id={keyDatalistId}>
        {cssProperties.map((prop) => (
          <option key={prop} value={prop} />
        ))}
      </datalist>

      {entries.length > 0 ? (
        <div className="grid gap-1.5">
          <div className="grid grid-cols-[1fr_1fr_28px] items-center gap-1.5 px-0.5 text-[10px] font-medium text-muted-foreground">
            <span>CSS 属性 (Key)</span>
            <span>属性值 (Value)</span>
            <span />
          </div>
          {entries.map((entry) => {
            const valueSuggestions = getCssValueSuggestions(entry.key);
            const valListId = `${valDatalistPrefix}-${entry.id}`;
            const isColor = isColorProperty(entry.key);

            return (
              <div key={entry.id} className="grid grid-cols-[1fr_1fr_28px] items-center gap-1.5">
                {/* Key Input */}
                <input
                  className={cn(inputClassName, "font-mono text-[11px] placeholder:font-sans")}
                  placeholder={keyPlaceholder}
                  list={keyDatalistId}
                  value={entry.key}
                  onChange={(e) => updateEntry(entry.id, "key", e.target.value)}
                  onBlur={(e) => handleKeyBlur(entry.id, e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />

                {/* Value Input with suggestions and optional color picker */}
                {/* Value Input with dynamic mode support, suggestions, and optional color picker */}
                <DynamicValueInput
                  className="h-8"
                  inputClassName="font-mono text-[11px]"
                  placeholder={valueSuggestions.length > 0 ? "value (select / type)" : "value"}
                  value={entry.value}
                  suggestions={valueSuggestions}
                  datalistId={valListId}
                  prefix={
                    isColor ? (
                      <input
                        type="color"
                        aria-label="Pick color"
                        className="size-4 cursor-pointer appearance-none rounded border border-border bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-xs [&::-webkit-color-swatch]:border-none"
                        value={
                          typeof entry.value === "string" &&
                          /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(entry.value.trim())
                            ? entry.value.trim()
                            : "#000000"
                        }
                        onChange={(e) => updateEntry(entry.id, "value", e.target.value)}
                      />
                    ) : undefined
                  }
                  onChange={(val) => updateEntry(entry.id, "value", val)}
                />
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition hover:border-border hover:bg-muted hover:text-destructive focus-visible:outline-none"
                  onClick={() => removeEntry(entry.id)}
                  title="删除属性"
                  aria-label="Delete CSS property"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/80 px-3 py-2 text-center text-[11px] text-muted-foreground">
          暂无样式配置
        </div>
      )}

      <button
        type="button"
        className="flex h-7.5 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/80 bg-muted/20 px-2.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:bg-muted/50 hover:text-foreground focus-visible:outline-none"
        onClick={addEntry}
      >
        <Plus className="size-3.5" />
        <span>添加样式属性</span>
      </button>
    </div>
  );
}
