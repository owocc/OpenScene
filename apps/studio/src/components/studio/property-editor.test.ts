import { describe, expect, it, vi } from "vite-plus/test";
import {
  resolveControlRenderer,
  controlRegistry,
  DynamicValueInput,
  VariableCombobox,
  TemplateMentionInput,
  MODE_CONFIGS,
  findMentionMatch,
  applyMention,
} from "./property-editor";
import {
  dynamicMode,
  dynamicValue,
  normalizeStatePath,
  readStatePath,
  resolveDynamicValue,
} from "@/core/document";
import {
  searchCssProperties,
  getCssValueSuggestions,
  isColorProperty,
  getAllWebCssProperties,
  COMMON_CSS_PROPERTIES,
  loadMdnData,
  camelToKebab,
} from "./property-editor/style/web/properties";
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

  it("supports searching CSS properties from full list", async () => {
    expect(COMMON_CSS_PROPERTIES.length).toBeGreaterThan(50);
    await loadMdnData();
    expect(getAllWebCssProperties().length).toBeGreaterThan(100);
    const bgMatches = searchCssProperties("background");
    expect(bgMatches).toContain("background-color");
    expect(bgMatches).toContain("background");
    const flexMatches = searchCssProperties("flexDirection");
    expect(flexMatches).toContain("flex-direction");
  });
  it("provides value suggestions for common enum properties", () => {
    const displayValues = getCssValueSuggestions("display");
    expect(displayValues).toContain("flex");
    expect(displayValues).toContain("grid");
    expect(displayValues).toContain("block");
    expect(displayValues).toContain("none");

    const flexDirValues = getCssValueSuggestions("flexDirection");
    expect(flexDirValues).toContain("row");
    expect(flexDirValues).toContain("column");

    const positionValues = getCssValueSuggestions("position");
    expect(positionValues).toContain("relative");
    expect(positionValues).toContain("absolute");
    expect(positionValues).toContain("fixed");
  });

  it("identifies color properties correctly", () => {
    expect(isColorProperty("color")).toBe(true);
    expect(isColorProperty("backgroundColor")).toBe(true);
    expect(isColorProperty("background-color")).toBe(true);
    expect(isColorProperty("borderColor")).toBe(true);
    expect(isColorProperty("display")).toBe(false);
    expect(isColorProperty("width")).toBe(false);
  });

  it("converts camelCase to kebab-case correctly", () => {
    expect(camelToKebab("backgroundColor")).toBe("background-color");
    expect(camelToKebab("fontSize")).toBe("font-size");
    expect(camelToKebab("borderTopLeftRadius")).toBe("border-top-left-radius");
    expect(camelToKebab("display")).toBe("display");
    expect(camelToKebab("background-color")).toBe("background-color");
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

describe("Dynamic mode and path handling", () => {
  it("normalizes state paths safely without root '/' returning full object", () => {
    // Empty string normalization should NOT produce "/"
    expect(normalizeStatePath("")).toBe("");
    expect(normalizeStatePath("/")).toBe("");
    expect(normalizeStatePath("counter")).toBe("/counter");
    expect(normalizeStatePath("/user/name")).toBe("/user/name");

    // readStatePath with empty path returns undefined, NOT the entire state object
    const mockState = { counter: 42, user: { name: "Alice" } };
    expect(readStatePath(mockState, "")).toBeUndefined();
    expect(readStatePath(mockState, "/")).toBeUndefined();
    expect(readStatePath(mockState, "/counter")).toBe(42);
    expect(readStatePath(mockState, "/user/name")).toBe("Alice");

    // dynamicValue generation
    expect(dynamicValue("state", "counter")).toEqual({ $state: "/counter" });
    expect(dynamicValue("state", "")).toEqual({ $state: "" });
    expect(dynamicValue("bindState", "userInput")).toEqual({ $bindState: "/userInput" });
    expect(dynamicValue("template", "Hello {{name}}")).toEqual({ $template: "Hello {{name}}" });
    expect(dynamicValue("i18n", "title")).toEqual({ $t: "/i18n/$lang/title" });

    // dynamicMode identification
    expect(dynamicMode({ $state: "/counter" })).toBe("state");
    expect(dynamicMode({ $bindState: "/userInput" })).toBe("bindState");
    expect(dynamicMode({ $template: "Hi" })).toBe("template");
    expect(dynamicMode({ $t: "key" })).toBe("i18n");
    expect(dynamicMode("raw string")).toBeUndefined();
    expect(dynamicMode(123)).toBeUndefined();
  });

  it("handles style control when value is a dynamic value ($state)", () => {
    const StyleComp = resolveControlRenderer("style");
    expect(StyleComp).toBeDefined();

    // Dynamic value should be identified as dynamicMode "state"
    const dynamicVal = { $state: "/theme/cardStyle" };
    expect(dynamicMode(dynamicVal)).toBe("state");
  });

  it("provides DynamicValueInput and MODE_CONFIGS for headless inline dynamic values", () => {
    expect(DynamicValueInput).toBeDefined();
    expect(MODE_CONFIGS.literal.shortLabel).toBe("Value");
    expect(MODE_CONFIGS.state.shortLabel).toBe("State");
    expect(MODE_CONFIGS.bindState.shortLabel).toBe("Bind");
    expect(MODE_CONFIGS.template.shortLabel).toBe("Tpl");
    expect(MODE_CONFIGS.i18n.shortLabel).toBe("i18n");
  });

  it("resolves template dynamic values correctly with {{}} and ${} and paths with/without slash", () => {
    const state = { hei: 100, name: "Card" };
    expect(resolveDynamicValue({ $template: "{{/hei}}px" }, state, "en-US")).toBe("100px");
    expect(resolveDynamicValue({ $template: "{{hei}}px" }, state, "en-US")).toBe("100px");
    expect(resolveDynamicValue({ $template: "${/hei}px" }, state, "en-US")).toBe("100px");
    expect(resolveDynamicValue({ $template: "Hello, {{ name }}!" }, state, "en-US")).toBe(
      "Hello, Card!",
    );
  });

  it("supports visibility and dynamic state evaluation", () => {
    const state = { isVisible: true, isHidden: false };
    expect(resolveDynamicValue({ $state: "/isVisible" }, state, "en-US")).toBe(true);
    expect(resolveDynamicValue({ $state: "/isHidden" }, state, "en-US")).toBe(false);
  });

  it("detects and filters @mention variables in template strings", () => {
    const variables = [
      { key: "counter", path: "/counter", type: "number", value: 42 },
      { key: "userName", path: "/userName", type: "string", value: "Alice" },
      { key: "theme", path: "/theme", type: "string", value: "dark" },
    ];

    // No mention active
    const matchNone = findMentionMatch("Hello world", 11, variables);
    expect(matchNone.isMentioning).toBe(false);
    expect(matchNone.matches.length).toBe(0);

    // Trailing '@' trigger
    const matchAll = findMentionMatch("Hello @", 7, variables);
    expect(matchAll.isMentioning).toBe(true);
    expect(matchAll.query).toBe("");
    expect(matchAll.matches.length).toBe(3);
    expect(matchAll.matchStart).toBe(6);
    expect(matchAll.matchEnd).toBe(7);

    // Filtered query '@cou'
    const matchFilter = findMentionMatch("Count is @cou", 13, variables);
    expect(matchFilter.isMentioning).toBe(true);
    expect(matchFilter.query).toBe("cou");
    expect(matchFilter.matches.length).toBe(1);
    expect(matchFilter.matches[0].key).toBe("counter");
    expect(matchFilter.matchStart).toBe(9);
    expect(matchFilter.matchEnd).toBe(13);
  });

  it("applies @mention variable into ${/varName} template syntax", () => {
    const variable = { key: "counter", path: "/counter", type: "number", value: 42 };
    const original = "Current: @cou items";
    // '@cou' is from index 9 to 13
    const result = applyMention(original, 9, 13, variable);
    expect(result.nextText).toBe("Current: ${/counter} items");
    expect(result.nextCursor).toBe(9 + "${/counter}".length);
  });

  it("exports VariableCombobox and TemplateMentionInput components", () => {
    expect(VariableCombobox).toBeDefined();
    expect(TemplateMentionInput).toBeDefined();
  });
  it("resolves AssetControl for asset, resource, image, audio, video controls", () => {
    const assetRenderer = resolveControlRenderer("asset");
    expect(assetRenderer).toBeDefined();
    expect(resolveControlRenderer("resource")).toBe(assetRenderer);
    expect(resolveControlRenderer("image")).toBe(assetRenderer);
    expect(resolveControlRenderer("audio")).toBe(assetRenderer);
    expect(resolveControlRenderer("video")).toBe(assetRenderer);
    expect(resolveControlRenderer("file")).toBe(assetRenderer);
  });
});
