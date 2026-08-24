import { describe, expect, it, vi } from "vite-plus/test";
import { resolveControlRenderer, controlRegistry } from "./property-editor";

describe("StyleControl & KV mode", () => {
  function objectToStyleEntries(obj: unknown): Array<{ id: string; key: string; value: string }> {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
    return Object.entries(obj).map(([key, val]) => ({
      id: `${key}-1`,
      key,
      value: typeof val === "string" || typeof val === "number" ? String(val) : JSON.stringify(val),
    }));
  }

  function styleEntriesToRecord(
    entries: Array<{ id: string; key: string; value: string }>,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const entry of entries) {
      const trimmedKey = entry.key.trim();
      if (trimmedKey) {
        result[trimmedKey] = entry.value;
      }
    }
    return result;
  }

  it("converts initial style record into KV entries", () => {
    const style = {
      color: "red",
      fontSize: "14px",
      display: "flex",
    };
    const entries = objectToStyleEntries(style);
    expect(entries).toHaveLength(3);
    expect(entries[0].key).toBe("color");
    expect(entries[0].value).toBe("red");
    expect(entries[1].key).toBe("fontSize");
    expect(entries[1].value).toBe("14px");
  });

  it("converts KV entries back to record omitting empty keys", () => {
    const entries = [
      { id: "1", key: "color", value: "#000" },
      { id: "2", key: "  ", value: "should-be-ignored" },
      { id: "3", key: "backgroundColor", value: "blue" },
    ];
    const record = styleEntriesToRecord(entries);
    expect(record).toEqual({
      color: "#000",
      backgroundColor: "blue",
    });
  });

  it("handles adding, updating, and removing KV entries", () => {
    let entries = objectToStyleEntries({ color: "black" });
    const onChange = vi.fn();

    // 1. Add new entry
    entries = [...entries, { id: "2", key: "padding", value: "8px" }];
    onChange(styleEntriesToRecord(entries));
    expect(onChange).toHaveBeenLastCalledWith({
      color: "black",
      padding: "8px",
    });

    // 2. Update value
    entries = entries.map((e) => (e.id === "2" ? { ...e, value: "16px" } : e));
    onChange(styleEntriesToRecord(entries));
    expect(onChange).toHaveBeenLastCalledWith({
      color: "black",
      padding: "16px",
    });

    // 3. Update key
    entries = entries.map((e) => (e.key === "color" ? { ...e, key: "border" } : e));
    onChange(styleEntriesToRecord(entries));
    expect(onChange).toHaveBeenLastCalledWith({
      border: "black",
      padding: "16px",
    });

    // 4. Remove entry
    entries = entries.filter((e) => e.key !== "border");
    onChange(styleEntriesToRecord(entries));
    expect(onChange).toHaveBeenLastCalledWith({
      padding: "16px",
    });
  });
});

describe("resolveControlRenderer string parsing", () => {
  it("resolves key-value and style string variants to KeyValueControl", () => {
    const kv = resolveControlRenderer("key-value");
    const keyValue = resolveControlRenderer("keyValue");
    const style = resolveControlRenderer("style");
    const key_value = resolveControlRenderer("key_value");

    expect(kv).toBe(controlRegistry["key-value"]);
    expect(keyValue).toBe(controlRegistry["key-value"]);
    expect(style).toBe(controlRegistry["style"]);
    expect(key_value).toBe(controlRegistry["key-value"]);
  });

  it("resolves basic and structured control types by string", () => {
    expect(resolveControlRenderer("text")).toBe(controlRegistry.text);
    expect(resolveControlRenderer("textarea")).toBe(controlRegistry.textarea);
    expect(resolveControlRenderer("number")).toBe(controlRegistry.number);
    expect(resolveControlRenderer("select")).toBe(controlRegistry.select);
    expect(resolveControlRenderer("boolean")).toBe(controlRegistry.boolean);
    expect(resolveControlRenderer("color")).toBe(controlRegistry.color);
    expect(resolveControlRenderer("unit")).toBe(controlRegistry.unit);
    expect(resolveControlRenderer("spacing")).toBe(controlRegistry.spacing);
    expect(resolveControlRenderer("object")).toBe(controlRegistry.object);
    expect(resolveControlRenderer("openapi")).toBe(controlRegistry.openapi);
  });

  it("falls back to text control for unknown strings or empty values", () => {
    expect(resolveControlRenderer("unknown_custom_control")).toBe(controlRegistry.text);
    expect(resolveControlRenderer("")).toBe(controlRegistry.text);
    expect(resolveControlRenderer(undefined)).toBe(controlRegistry.text);
  });
});
