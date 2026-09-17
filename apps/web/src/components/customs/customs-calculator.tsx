"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/providers/i18n-provider";

const inp =
  "w-full rounded-xl border border-line bg-transparent px-4 py-3 text-sm text-fg placeholder:text-muted";

type Options = {
  AutoEngineTypes: { code: string; name: string; abbreviation2: string }[];
  AutoCategories: { code: string; name: string }[];
};

type Duty = {
  duties: { code: string; name: string; value: number }[];
  total: { name: string; value: number };
  customsCost: number;
  usdCourse: number;
};

function money(n: number) {
  return `${n.toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AZN`;
}

export function CustomsCalculator() {
  const { t, locale } = useI18n();
  const [options, setOptions] = useState<Options | null>(null);
  const [autoType, setAutoType] = useState("");
  const [engineType, setEngineType] = useState("");
  const [engine, setEngine] = useState("2000");
  const [price, setPrice] = useState("12000");
  const [freight, setFreight] = useState("2500");
  const [other, setOther] = useState("0");
  const [issueDate, setIssueDate] = useState("2018-03-15");
  const [commerceType, setCommerceType] = useState<"nonFree" | "free">("nonFree");
  const [result, setResult] = useState<Duty | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .customsOptions(locale)
      .then((data) => {
        setOptions(data);
        setAutoType((current) => current || data.AutoCategories[0]?.code || "");
        setEngineType((current) => current || `${data.AutoEngineTypes[0]?.code}-${data.AutoEngineTypes[0]?.abbreviation2}`);
      })
      .catch(() => setError(t.pages.customsFail));
  }, [locale, t.pages.customsFail]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api.customsAutoDuty(
        {
          autoType,
          engineType: engineType.split("-")[1] || engineType,
          engine: Number(engine),
          commerceType,
          issueDate,
          price: Number(price),
          transportExpenses: Number(freight),
          otherExpenses: Number(other || 0),
        },
        locale,
      );
      setResult(data.autoDuty ?? null);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : t.pages.customsFail);
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-7xl px-5 pt-32 pb-24 md:px-8">
      <h1 className="font-display text-5xl">{t.pages.customsTitle}</h1>
      <p className="mt-4 max-w-2xl text-muted">{t.pages.customsSubtitle}</p>
      <a
        href="https://e.customs.gov.az/for-individuals/calculator"
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block text-sm text-royal underline"
      >
        {t.pages.customsOfficial} ↗
      </a>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <form className="space-y-4 rounded-3xl border border-line bg-card p-6" onSubmit={submit}>
          <label className="block text-xs text-muted">
            {t.pages.customsType}
            <select required value={autoType} onChange={(e) => setAutoType(e.target.value)} className={`${inp} mt-1`}>
              {(options?.AutoCategories ?? []).map((row) => (
                <option key={row.code} value={row.code}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            {t.pages.customsFuel}
            <select required value={engineType} onChange={(e) => setEngineType(e.target.value)} className={`${inp} mt-1`}>
              {(options?.AutoEngineTypes ?? []).map((row) => (
                <option key={`${row.code}-${row.abbreviation2}`} value={`${row.code}-${row.abbreviation2}`}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted">
              {t.pages.customsInvoice}
              <input required type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className={`${inp} mt-1`} />
            </label>
            <label className="block text-xs text-muted">
              {t.pages.customsFreight}
              <input required type="number" min={1} value={freight} onChange={(e) => setFreight(e.target.value)} className={`${inp} mt-1`} />
            </label>
            <label className="block text-xs text-muted">
              {t.pages.customsOtherCost}
              <input type="number" min={0} value={other} onChange={(e) => setOther(e.target.value)} className={`${inp} mt-1`} />
            </label>
            <label className="block text-xs text-muted">
              {t.pages.customsEngine}
              <input required type="number" min={0} value={engine} onChange={(e) => setEngine(e.target.value)} className={`${inp} mt-1`} />
            </label>
          </div>
          <label className="block text-xs text-muted">
            {t.pages.customsDate}
            <input required type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={`${inp} mt-1`} />
          </label>
          <fieldset className="space-y-2 text-sm">
            <legend className="text-xs text-muted">{t.pages.customsOrigin}</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="commerce" checked={commerceType === "nonFree"} onChange={() => setCommerceType("nonFree")} />
              {t.pages.customsOther}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="commerce" checked={commerceType === "free"} onChange={() => setCommerceType("free")} />
              {t.pages.customsFta}
            </label>
          </fieldset>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <button disabled={busy || !options} className="w-full rounded-xl bg-fg py-3 text-sm font-medium text-bg disabled:opacity-50">
            {busy ? "…" : t.pages.customsCalc}
          </button>
        </form>

        <div className="rounded-3xl border border-line bg-card p-6">
          {!result ? (
            <p className="text-sm text-muted">{t.pages.customsEmpty}</p>
          ) : (
            <>
              <h2 className="text-lg font-medium">{result.total?.name || t.pages.customsTotal}</h2>
              <p className="font-display mt-2 text-3xl text-royal">{money(result.total?.value ?? 0)}</p>
              <p className="mt-2 text-xs text-muted">
                USD = {result.usdCourse} AZN · {t.pages.customsHint}
              </p>
              <p className="mt-1 text-xs text-muted">{money(result.customsCost)}</p>
              <div className="mt-6 space-y-3">
                {result.duties.map((row) => (
                  <div key={row.code} className="flex justify-between gap-4 border-b border-line py-2 text-sm">
                    <span className="text-muted">{row.name}</span>
                    <span className="shrink-0 font-medium">{money(row.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
