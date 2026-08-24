export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z0-9])/g, (_, g) => g.toUpperCase());
}

export function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Top high-frequency CSS properties prioritized in autocomplete.
 */
export const COMMON_CSS_PROPERTIES: string[] = [
  // Layout
  "display",
  "flex-direction",
  "justify-content",
  "align-items",
  "align-content",
  "align-self",
  "flex-wrap",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "flex",
  "gap",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "grid-template-rows",
  "grid-column",
  "grid-row",

  // Sizing & Box Model
  "width",
  "height",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
  "box-sizing",

  // Spacing
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "padding-inline",
  "padding-block",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-inline",
  "margin-block",

  // Position & Layering
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "inset",

  // Typography
  "color",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-decoration",
  "text-transform",
  "text-overflow",
  "white-space",
  "word-break",
  "font-family",
  "font-style",

  // Background & Appearance
  "background-color",
  "background",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "opacity",
  "visibility",
  "overflow",
  "overflow-x",
  "overflow-y",
  "cursor",
  "pointer-events",
  "user-select",

  // Borders & Outline
  "border",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "outline",
  "outline-width",
  "outline-color",
  "outline-offset",

  // Effects & Transforms
  "box-shadow",
  "transform",
  "transform-origin",
  "transition",
  "transition-property",
  "transition-duration",
  "transition-timing-function",
  "transition-delay",
  "animation",
  "filter",
  "backdrop-filter",
  "object-fit",
  "object-position",
];

/**
 * Common high-frequency CSS value presets for instant autocomplete.
 */
export const COMMON_CSS_VALUES: Record<string, string[]> = {
  display: [
    "flex",
    "grid",
    "block",
    "inline",
    "inline-flex",
    "inline-grid",
    "inline-block",
    "none",
    "contents",
  ],
  flexDirection: ["row", "column", "row-reverse", "column-reverse"],
  flexWrap: ["nowrap", "wrap", "wrap-reverse"],
  justifyContent: [
    "flex-start",
    "center",
    "flex-end",
    "space-between",
    "space-around",
    "space-evenly",
    "stretch",
    "start",
    "end",
  ],
  alignItems: ["stretch", "center", "flex-start", "flex-end", "baseline", "start", "end"],
  alignSelf: ["auto", "stretch", "center", "flex-start", "flex-end", "baseline"],
  alignContent: [
    "stretch",
    "center",
    "flex-start",
    "flex-end",
    "space-between",
    "space-around",
    "space-evenly",
  ],
  position: ["relative", "absolute", "fixed", "sticky", "static"],
  boxSizing: ["border-box", "content-box"],
  overflow: ["visible", "hidden", "scroll", "auto", "clip"],
  overflowX: ["visible", "hidden", "scroll", "auto", "clip"],
  overflowY: ["visible", "hidden", "scroll", "auto", "clip"],
  textAlign: ["left", "center", "right", "justify", "start", "end"],
  fontWeight: [
    "normal",
    "bold",
    "lighter",
    "bolder",
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900",
  ],
  fontStyle: ["normal", "italic", "oblique"],
  textTransform: ["none", "capitalize", "uppercase", "lowercase"],
  textDecoration: ["none", "underline", "line-through", "overline"],
  textOverflow: ["clip", "ellipsis"],
  whiteSpace: ["normal", "nowrap", "pre", "pre-wrap", "pre-line"],
  wordBreak: ["normal", "break-all", "keep-all", "break-word"],
  visibility: ["visible", "hidden", "collapse"],
  cursor: [
    "pointer",
    "default",
    "auto",
    "text",
    "move",
    "not-allowed",
    "grab",
    "grabbing",
    "crosshair",
    "zoom-in",
    "zoom-out",
  ],
  pointerEvents: ["auto", "none"],
  userSelect: ["auto", "none", "text", "all"],
  borderStyle: ["solid", "dashed", "dotted", "double", "none", "hidden", "groove", "ridge"],
};

// Also index kebab-case variants for value presets
for (const [key, values] of Object.entries(COMMON_CSS_VALUES)) {
  const kebab = camelToKebab(key);
  if (kebab !== key) {
    COMMON_CSS_VALUES[kebab] = values;
  }
}

const COLOR_PROPERTY_SET = new Set([
  "color",
  "backgroundColor",
  "background-color",
  "borderColor",
  "border-color",
  "borderTopColor",
  "border-top-color",
  "borderRightColor",
  "border-right-color",
  "borderBottomColor",
  "border-bottom-color",
  "borderLeftColor",
  "border-left-color",
  "outlineColor",
  "outline-color",
  "textDecorationColor",
  "text-decoration-color",
  "caretColor",
  "caret-color",
  "accentColor",
  "accent-color",
]);

export function isColorProperty(propertyName: string): boolean {
  const normalized = propertyName.trim();
  if (COLOR_PROPERTY_SET.has(normalized)) return true;
  return /color$/i.test(normalized);
}

// --------------------------------------------------------------------------
// Lazy-loaded MDN Data Module
// --------------------------------------------------------------------------

type MdnProperties = Record<string, { syntax?: string }>;
type MdnSyntaxes = Record<string, { syntax?: string }>;

let mdnLoaded = false;
let mdnLoadingPromise: Promise<void> | null = null;
let mdnProperties: MdnProperties = {};
let mdnSyntaxes: MdnSyntaxes = {};
let mdnTypes: MdnSyntaxes = {};
let allPropertiesCache: string[] = [...COMMON_CSS_PROPERTIES];
const valueKeywordsCache: Record<string, string[]> = { ...COMMON_CSS_VALUES };

function extractKeywordsFromSyntax(syntaxStr?: string, visited = new Set<string>()): string[] {
  if (!syntaxStr) return [];
  const keywords = new Set<string>();

  // Resolve nested syntax types e.g. <display-outside>
  const typeMatches = syntaxStr.match(/<([a-zA-Z0-9_-]+)(?:\([^)]*\))?[^>]*>/g) || [];
  for (const match of typeMatches) {
    const typeName = match.replace(/^<|>$/g, "").split(" ")[0].split("(")[0];
    if (!visited.has(typeName)) {
      visited.add(typeName);
      const subSyntax = mdnSyntaxes[typeName]?.syntax || mdnTypes[typeName]?.syntax;
      if (subSyntax) {
        for (const kw of extractKeywordsFromSyntax(subSyntax, visited)) {
          keywords.add(kw);
        }
      }
    }
  }

  // Extract raw literal tokens
  const cleaned = syntaxStr
    .replace(/<[^>]+>/g, " ")
    .replace(/[[\]|?+*!#,]/g, " ")
    .replace(/\b(inherit|initial|revert|revert-layer|unset)\b/g, "");

  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => /^[a-z][a-z0-9-]*$/i.test(t));

  for (const t of tokens) {
    keywords.add(t);
  }

  return Array.from(keywords);
}

/**
 * Asynchronously loads mdn-data in the background to provide exhaustive CSS support.
 */
export async function loadMdnData(): Promise<void> {
  if (mdnLoaded) return;
  if (mdnLoadingPromise) return mdnLoadingPromise;

  mdnLoadingPromise = (async () => {
    try {
      const [propsMod, syntaxesMod, typesMod] = await Promise.all([
        import("mdn-data/css/properties.json"),
        import("mdn-data/css/syntaxes.json"),
        import("mdn-data/css/types.json"),
      ]);

      mdnProperties = (propsMod.default || propsMod) as unknown as MdnProperties;
      mdnSyntaxes = (syntaxesMod.default || syntaxesMod) as unknown as MdnSyntaxes;
      mdnTypes = (typesMod.default || typesMod) as unknown as MdnSyntaxes;

      const commonSet = new Set(COMMON_CSS_PROPERTIES);
      const standardSet = new Set<string>();
      const fullList: string[] = [...COMMON_CSS_PROPERTIES];

      for (const raw of Object.keys(mdnProperties)) {
        if (!raw || raw.startsWith("-")) continue;
        const kebab = camelToKebab(raw);
        if (!commonSet.has(kebab) && !standardSet.has(kebab)) {
          standardSet.add(kebab);
          fullList.push(kebab);
        }
      }

      allPropertiesCache = fullList;
      mdnLoaded = true;
    } catch {
      // Fall back to COMMON_CSS_PROPERTIES if dynamic import fails
    }
  })();

  return mdnLoadingPromise;
}

// Trigger initial background load
if (typeof window !== "undefined") {
  void loadMdnData();
}

/**
 * Returns all available CSS properties (common first, then full MDN catalog).
 */
export function getAllWebCssProperties(): string[] {
  return allPropertiesCache;
}

/**
 * Gets value suggestions for a given CSS property.
 * Prioritizes common high-frequency values first, then appends any other values parsed from MDN data.
 */
export function getCssValueSuggestions(propertyName: string): string[] {
  const trimmed = propertyName.trim();
  if (!trimmed) return [];

  const camelKey = kebabToCamel(trimmed);
  const kebabKey = camelToKebab(trimmed);

  if (valueKeywordsCache[camelKey]) {
    return valueKeywordsCache[camelKey];
  }
  if (valueKeywordsCache[kebabKey]) {
    return valueKeywordsCache[kebabKey];
  }

  // Look up in mdn-data
  const propData = mdnProperties[kebabKey] || mdnProperties[trimmed];
  if (propData?.syntax) {
    const extracted = extractKeywordsFromSyntax(propData.syntax);
    if (extracted.length > 0) {
      valueKeywordsCache[camelKey] = extracted;
      valueKeywordsCache[kebabKey] = extracted;
      return extracted;
    }
  }

  return [];
}

/**
 * Searches CSS properties matching the given query.
 * Matches both camelCase (e.g. `backgroundColor`) and kebab-case (e.g. `background-color`).
 */
export function searchCssProperties(query: string, limit = 50): string[] {
  const trimmed = query.trim().toLowerCase();
  const all = getAllWebCssProperties();
  if (!trimmed) {
    return all.slice(0, limit);
  }

  const normalizedQuery = trimmed.replace(/-/g, "");

  const exactMatches: string[] = [];
  const prefixMatches: string[] = [];
  const containsMatches: string[] = [];

  for (const prop of all) {
    const lowerProp = prop.toLowerCase();
    const camelProp = kebabToCamel(prop).toLowerCase();
    const normalizedProp = lowerProp.replace(/-/g, "");

    if (lowerProp === trimmed || camelProp === trimmed || normalizedProp === normalizedQuery) {
      exactMatches.push(prop);
    } else if (
      lowerProp.startsWith(trimmed) ||
      camelProp.startsWith(trimmed) ||
      normalizedProp.startsWith(normalizedQuery)
    ) {
      prefixMatches.push(prop);
    } else if (
      lowerProp.includes(trimmed) ||
      camelProp.includes(trimmed) ||
      normalizedProp.includes(normalizedQuery)
    ) {
      containsMatches.push(prop);
    }
    if (exactMatches.length + prefixMatches.length + containsMatches.length >= limit * 2) {
      break;
    }
  }

  return [...exactMatches, ...prefixMatches, ...containsMatches].slice(0, limit);
}
