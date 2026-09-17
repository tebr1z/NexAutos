"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Currency } from "@/lib/constants";
import { api } from "@/lib/api";

type CurrencyContextValue = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  convert: (usd: number) => number;
  rates: Record<string, number>;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const FALLBACK_RATES: Record<string, number> = { USD: 1, AZN: 1.7, EUR: 0.92, TRY: 34.2 };

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD");
  const [rates, setRates] = useState(FALLBACK_RATES);

  useEffect(() => {
    const stored = window.localStorage.getItem("anx_currency") as Currency | null;
    if (stored) setCurrencyState(stored);
    api
      .rates()
      .then((data) => {
        if (data && typeof data.USD === "number") {
          setRates({
            USD: 1,
            AZN: data.AZN ?? 1.7,
            EUR: data.EUR ?? 0.92,
            TRY: data.TRY ?? 34.2,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    window.localStorage.setItem("anx_currency", c);
  };

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      rates,
      convert: (usd: number) => usd * (rates[currency] ?? 1),
    }),
    [currency, rates],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
