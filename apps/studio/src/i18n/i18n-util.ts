import type { BaseLocale, Locales, TranslationFunctions } from "./i18n-types";
import type { BaseTranslation } from "typesafe-i18n";

export const baseLocale: BaseLocale = "zh-CN";

export const locales: Locales[] = ["zh-CN", "en-US"];

export function isLocale(locale: string): locale is Locales {
  return locales.includes(locale as Locales);
}

function interpolate(template: string, args?: Record<string, unknown>): string {
  if (!args) return template;
  return template.replace(/\{(\w+)(?::\w+)?\}/g, (_, key) => {
    const val = args[key];
    if (val === undefined || val === null) return `{${key}}`;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      return String(val);
    }
    return JSON.stringify(val);
  });
}

function createTranslationFunctions(translation: BaseTranslation): TranslationFunctions {
  const transform = (obj: unknown): unknown => {
    if (typeof obj === "string") {
      return (args?: Record<string, unknown>) => interpolate(obj, args);
    }
    if (typeof obj === "object" && obj !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = transform(value);
      }
      return result;
    }
    return obj;
  };

  return transform(translation) as TranslationFunctions;
}

export { createTranslationFunctions };
