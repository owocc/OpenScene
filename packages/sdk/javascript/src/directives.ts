import { defineDirective, getByPath, type DirectiveDefinition } from "@json-render/core";
import { z } from "zod";

const pageDirective = defineDirective({
  name: "$page",
  description: "Read a field from the current OpenScene page metadata.",
  schema: z.object({ $page: z.string().min(1) }),
  resolve(value, context) {
    const pageInfo = (context.stateModel.__scene as { pageInfo?: unknown } | undefined)?.pageInfo;
    if (!pageInfo || typeof pageInfo !== "object") return undefined;
    return getByPath(pageInfo, value.$page.startsWith("/") ? value.$page : `/${value.$page}`);
  },
});

function translationValue(
  translations: Record<string, unknown>,
  locale: string,
  key: string,
): unknown {
  const localized = translations[locale];
  if (localized && typeof localized === "object") {
    const result = getByPath(localized, key.startsWith("/") ? key : `/${key}`);
    if (result !== undefined) return result;
  }
  const direct = getByPath(translations, key.startsWith("/") ? key : `/${key}`);
  return direct === undefined ? key : direct;
}

const translationDirective = defineDirective({
  name: "$t",
  description: "Read a translation using the runtime language and page i18n config.",
  schema: z.object({ $t: z.string().min(1) }),
  resolve(value, context) {
    const scene = context.stateModel.__scene;
    const sceneRecord =
      scene && typeof scene === "object" ? (scene as Record<string, unknown>) : {};
    const globalConfig = sceneRecord.globalConfig;
    const globalRecord =
      globalConfig && typeof globalConfig === "object"
        ? (globalConfig as Record<string, unknown>)
        : {};
    const configured = globalRecord.i18n;
    const i18n =
      configured && typeof configured === "object" ? (configured as Record<string, unknown>) : {};
    const pageInfo = sceneRecord.pageInfo;
    const pageLocale =
      pageInfo && typeof pageInfo === "object"
        ? (pageInfo as Record<string, unknown>).locale
        : undefined;
    const locale =
      typeof context.stateModel.lang === "string"
        ? context.stateModel.lang
        : typeof i18n.defaultLocale === "string"
          ? i18n.defaultLocale
          : typeof pageLocale === "string"
            ? pageLocale
            : "en-US";
    const source =
      i18n.translations && typeof i18n.translations === "object"
        ? (i18n.translations as Record<string, unknown>)
        : i18n;
    return translationValue(source, locale, value.$t);
  },
});

export const openSceneDirectives: readonly DirectiveDefinition[] = Object.freeze([
  pageDirective,
  translationDirective,
]);
export const directives = openSceneDirectives;
export { pageDirective, translationDirective };
