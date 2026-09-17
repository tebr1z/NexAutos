"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import type { Locale } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/providers/i18n-provider";

const inp =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg placeholder:text-muted [color-scheme:dark]";

type EngineRow = { code: string; name: string; abbreviation2: string };
type CategoryRow = { code: string; name: string };

type Options = {
  AutoEngineTypes: EngineRow[];
  AutoCategories: CategoryRow[];
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

function engineKey(row: EngineRow) {
  return `${row.code}:${row.abbreviation2}`;
}

function sortEngines(rows: EngineRow[]) {
  return [...rows].sort((a, b) => Number(a.code) - Number(b.code) || a.name.localeCompare(b.name, "az"));
}

function monthLabel(month: number, locale: Locale) {
  const tag = locale === "az" ? "az-AZ" : locale === "ru" ? "ru-RU" : locale === "tr" ? "tr-TR" : "en-US";
  const raw = new Intl.DateTimeFormat(tag, { month: "long" }).format(new Date(2020, month - 1, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function FieldSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((row) => row.value === value);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative mt-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(inp, "flex items-center justify-between gap-3 text-left")}
      >
        <span className={cn("truncate", current ? "text-fg" : "text-muted")}>{current?.label ?? placeholder ?? "—"}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-muted transition", open && "rotate-180")} />
      </button>
      {open ? (
        <ul className="absolute z-40 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-line bg-card p-1.5 shadow-glass">
          {options.map((row) => (
            <li key={row.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(row.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-fg/10",
                  row.value === value ? "bg-fg/10 text-fg" : "text-fg",
                )}
              >
                <span>{row.label}</span>
                {row.value === value ? <Check size={14} className="shrink-0 text-royal" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DateField({
  value,
  onChange,
  locale,
}: {
  value: string;
  onChange: (iso: string) => void;
  locale: Locale;
}) {
  const [year, month, day] = value.split("-").map((part) => Number(part) || 0);
  const now = new Date().getFullYear();
  const years = Array.from({ length: 45 }, (_, i) => String(now - i));
  const months = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    return { value: String(n).padStart(2, "0"), label: monthLabel(n, locale) };
  });
  const dim = year && month ? new Date(year, month, 0).getDate() : 31;
  const days = Array.from({ length: dim }, (_, i) => String(i + 1).padStart(2, "0"));
  const safeDay = Math.min(day || 1, dim);

  function patch(next: { y?: number; m?: number; d?: number }) {
    const y = next.y ?? year;
    const m = next.m ?? month;
    const last = new Date(y, m, 0).getDate();
    const d = Math.min(next.d ?? safeDay, last);
    onChange(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  return (
    <div className="mt-1 grid grid-cols-3 gap-2">
      <FieldSelect
        value={String(safeDay).padStart(2, "0")}
        onChange={(d) => patch({ d: Number(d) })}
        options={days.map((d) => ({ value: d, label: d }))}
      />
      <FieldSelect value={String(month).padStart(2, "0")} onChange={(m) => patch({ m: Number(m) })} options={months} />
      <FieldSelect value={String(year)} onChange={(y) => patch({ y: Number(y) })} options={years.map((y) => ({ value: y, label: y }))} />
    </div>
  );
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

  const engines = sortEngines(options?.AutoEngineTypes ?? []);
  const categories = options?.AutoCategories ?? [];

  useEffect(() => {
    api
      .customsOptions(locale)
      .then((data) => {
        const list = sortEngines(data.AutoEngineTypes ?? []);
        setOptions({ ...data, AutoEngineTypes: list });
        setAutoType((current) => current || data.AutoCategories[0]?.code || "");
        setEngineType((current) => {
          if (current && list.some((row) => engineKey(row) === current)) return current;
          const benzine = list.find((row) => row.code === "1") ?? list[0];
          return benzine ? engineKey(benzine) : "";
        });
      })
      .catch(() => setError(t.pages.customsFail));
  }, [locale, t.pages.customsFail]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const picked = engines.find((row) => engineKey(row) === engineType);
    if (!picked || !autoType) return;
    setBusy(true);
    setError("");
    try {
      const data = await api.customsAutoDuty(
        {
          autoType,
          engineType: picked.abbreviation2,
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
          <div className="block text-xs text-muted">
            {t.pages.customsType}
            <FieldSelect
              value={autoType}
              onChange={setAutoType}
              options={categories.map((row) => ({ value: row.code, label: row.name }))}
            />
          </div>
          <div className="block text-xs text-muted">
            {t.pages.customsFuel}
            <FieldSelect
              value={engineType}
              onChange={setEngineType}
              options={engines.map((row) => ({ value: engineKey(row), label: row.name }))}
            />
          </div>
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
          <div className="block text-xs text-muted">
            {t.pages.customsDate}
            <DateField value={issueDate} onChange={setIssueDate} locale={locale} />
          </div>
          <fieldset className="space-y-2 text-sm text-fg">
            <legend className="text-xs text-muted">{t.pages.customsOrigin}</legend>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="commerce"
                checked={commerceType === "nonFree"}
                onChange={() => setCommerceType("nonFree")}
                className="accent-royal"
              />
              {t.pages.customsOther}
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="commerce"
                checked={commerceType === "free"}
                onChange={() => setCommerceType("free")}
                className="accent-royal"
              />
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
