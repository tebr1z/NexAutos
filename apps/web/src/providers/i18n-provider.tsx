"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { dictionaries } from "@/lib/i18n";
import type { Locale } from "@/lib/constants";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (typeof dictionaries)["en"];
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("az");

  useEffect(() => {
    const stored = window.localStorage.getItem("anx_locale") as Locale | null;
    if (stored && stored in dictionaries) setLocaleState(stored);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem("anx_locale", next);
    document.documentElement.lang = next;
  };

  const value = useMemo(
    () => ({ locale, setLocale, t: dictionaries[locale] }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
