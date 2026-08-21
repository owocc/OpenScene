import { createTranslationFunctions, isLocale } from "./i18n-util";
import type { Locales, Translation, TranslationFunctions } from "./i18n-types";

import en_US from "./en-US";
import zh_CN from "./zh-CN";

const translations: Record<Locales, Translation> = {
  "en-US": en_US,
  "zh-CN": zh_CN,
};

const instances: Partial<Record<Locales, TranslationFunctions>> = {};

export function loadLocale(locale: Locales): void {
  if (instances[locale]) return;
  instances[locale] = createTranslationFunctions(translations[locale] ?? zh_CN);
}

export function loadAllLocales(): void {
  loadLocale("zh-CN");
  loadLocale("en-US");
}

export function i18n(locale?: string): TranslationFunctions {
  const resolvedLocale: Locales = isLocale(locale ?? "") ? (locale as Locales) : "zh-CN";
  if (!instances[resolvedLocale]) {
    loadLocale(resolvedLocale);
  }
  return instances[resolvedLocale]!;
}
