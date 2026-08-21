import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useQueryStore } from "@/stores/query-store";
import type { Locales, TranslationFunctions } from "./i18n-types";
import { i18n, loadLocale } from "./i18n-util.sync";
import { isLocale } from "./i18n-util";

export interface I18nContextType {
  LL: TranslationFunctions;
  locale: Locales;
  setLocale: (locale: Locales) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

export interface TypesafeI18nProps {
  children: ReactNode;
  locale?: string;
}

export function TypesafeI18n({ children, locale: propLocale }: TypesafeI18nProps) {
  const storeLocale = useQueryStore((s) => s.locale);
  const activeLocaleString = propLocale ?? storeLocale ?? "zh-CN";

  const locale: Locales = useMemo(() => {
    return isLocale(activeLocaleString) ? activeLocaleString : "zh-CN";
  }, [activeLocaleString]);

  const LL = useMemo(() => {
    loadLocale(locale);
    return i18n(locale);
  }, [locale]);

  const setLocale = (nextLocale: Locales) => {
    useQueryStore.getState().setLocale(nextLocale);
  };

  const value = useMemo(
    () => ({
      LL,
      locale,
      setLocale,
    }),
    [LL, locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18nContext(): I18nContextType {
  const context = useContext(I18nContext);
  if (context) return context;

  // Fallback to query store if used outside provider
  const storeLocale = useQueryStore.getState().locale ?? "zh-CN";
  const locale: Locales = isLocale(storeLocale) ? storeLocale : "zh-CN";
  return {
    LL: i18n(locale),
    locale,
    setLocale: (nextLocale: Locales) => useQueryStore.getState().setLocale(nextLocale),
  };
}

export { useI18nContext as useI18n };
