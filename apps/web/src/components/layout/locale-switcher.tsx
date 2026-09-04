"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { CURRENCIES, LOCALES, type Currency } from "@/lib/constants";
import { useI18n } from "@/providers/i18n-provider";
import { useCurrency } from "@/providers/currency-provider";
import { cn } from "@/lib/utils";

type Tone = "hero" | "bar";

export function LocaleSwitcher({ compact = false, tone = "bar" }: { compact?: boolean; tone?: Tone }) {
  const { locale, setLocale, t } = useI18n();
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <Menu
      tone={tone}
      label={
        <>
          <Globe size={14} className="opacity-70" />
          <span className="font-medium tracking-[0.14em]">{current.label}</span>
          {!compact && <span className="hidden text-muted opacity-80 xl:inline">{current.name}</span>}
        </>
      }
      ariaLabel={t.pages.language}
    >
      <p className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.22em] text-muted">{t.pages.language}</p>
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          className={cn(
            "flex w-full items-center justify-between gap-6 rounded-lg px-3 py-2.5 text-left text-[13px] transition hover:bg-fg/10",
            l.code === locale ? "text-fg" : "text-muted",
          )}
        >
          <span className="flex items-center gap-3">
            <span className="w-7 font-medium tracking-[0.16em] text-fg">{l.label}</span>
            <span>{l.name}</span>
          </span>
          {l.code === locale && <Check size={14} className="text-royal" />}
        </button>
      ))}
    </Menu>
  );
}

export function CurrencySwitcher({ tone = "bar" }: { tone?: Tone }) {
  const { currency, setCurrency } = useCurrency();
  const { t } = useI18n();

  return (
    <Menu tone={tone} label={<span className="tabular-nums">{currency}</span>} ariaLabel={t.pages.currency}>
      <p className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.22em] text-muted">{t.pages.currency}</p>
      {CURRENCIES.map((c) => (
        <button
          key={c.code}
          type="button"
          onClick={() => setCurrency(c.code as Currency)}
          className={cn(
            "flex w-full items-center justify-between gap-6 rounded-lg px-3 py-2.5 text-left text-[13px] transition hover:bg-fg/10",
            c.code === currency ? "text-fg" : "text-muted",
          )}
        >
          <span>
            {c.symbol} {c.code}
          </span>
          {c.code === currency && <Check size={14} className="text-royal" />}
        </button>
      ))}
    </Menu>
  );
}

function Menu({
  label,
  ariaLabel,
  children,
  tone,
}: {
  label: React.ReactNode;
  ariaLabel: string;
  children: React.ReactNode;
  tone: Tone;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] tracking-wide backdrop-blur-md transition",
          tone === "hero"
            ? "border-white/25 bg-white/10 text-white hover:bg-white/20"
            : "border-line bg-fg/5 text-fg hover:bg-fg/10",
        )}
      >
        {label}
        <ChevronDown size={12} className={cn("opacity-60 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+10px)] right-0 z-50 min-w-[200px] rounded-2xl border border-line bg-card p-1.5 text-fg shadow-glass">
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}
