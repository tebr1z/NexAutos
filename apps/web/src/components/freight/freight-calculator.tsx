"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/providers/i18n-provider";

const inp =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg placeholder:text-muted";

type Quote = Awaited<ReturnType<typeof api.shippingQuote>>;

function customsHref(quote: Quote) {
  const params = new URLSearchParams();
  const year = quote.year ?? quote.lot?.year;
  const engine = quote.engineCc ?? quote.lot?.engineCc;
  const fuel = quote.fuel ?? quote.lot?.fuel;
  if (year) params.set("year", String(year));
  if (engine) params.set("engine", String(engine));
  if (fuel) params.set("fuel", fuel);
  if (quote.dgkEngineCode) params.set("fuelCode", quote.dgkEngineCode);
  params.set("price", String(quote.priceUsd));
  if (quote.totalUsd) params.set("freight", String(quote.totalUsd));
  if (quote.year && quote.engineCc) params.set("auto", "1");
  return `/customs?${params.toString()}`;
}

export function FreightCalculator() {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("5000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = await api.shippingQuote({ url: url.trim() || undefined, priceUsd: Number(price) });
      setQuote(next);
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : t.pages.freightFail);
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-7xl px-5 pt-32 pb-24 md:px-8">
      <h1 className="font-display text-5xl">{t.pages.freightTitle}</h1>
      <p className="mt-4 max-w-2xl text-muted">{t.pages.freightSubtitle}</p>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <form className="space-y-4 rounded-3xl border border-line bg-card p-6" onSubmit={submit}>
          <label className="block text-xs text-muted">
            {t.pages.freightLink}
            <input
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://bid.cars/en/lot/…"
              className={`${inp} mt-1 font-mono text-xs`}
            />
          </label>
          <label className="block text-xs text-muted">
            {t.pages.freightBid}
            <input required type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className={`${inp} mt-1`} />
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <button disabled={busy} className="w-full rounded-xl bg-fg py-3 text-sm font-medium text-bg disabled:opacity-50">
            {busy ? "…" : t.pages.freightCalc}
          </button>
        </form>

        <div className="rounded-3xl border border-line bg-card p-6">
          {!quote ? (
            <p className="text-sm text-muted">{t.pages.freightEmpty}</p>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">{quote.lot?.title || quote.stateName}</p>
              <p className="mt-2 text-sm text-muted">
                {[quote.lot?.location || quote.lot?.shippingFrom, quote.stateName || quote.state, quote.auction].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {[quote.year && `${quote.year}`, quote.engineCc && `${quote.engineCc} cm³`, quote.fuel].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t.pages.freightBand}: ${quote.band.min.toLocaleString()}–{quote.band.max >= 1_000_000 ? "∞" : quote.band.max.toLocaleString()}
              </p>
              {quote.missing ? (
                <p className="mt-6 text-sm text-muted">{t.pages.freightMissing}</p>
              ) : (
                <>
                  <h2 className="mt-6 text-lg font-medium">{t.pages.freightTotal}</h2>
                  <p className="font-display mt-2 text-3xl text-royal">${quote.totalUsd?.toLocaleString("en-US")}</p>
                  <p className="mt-3 text-xs text-muted">
                    {t.pages.freightOcean}: ${quote.oceanUsd?.toLocaleString("en-US")} · {t.pages.freightTir}: ${quote.tirUsd.toLocaleString("en-US")}
                  </p>
                </>
              )}
              <Link href={customsHref(quote)} className="mt-6 inline-flex rounded-full bg-fg px-5 py-2.5 text-sm text-bg">
                {t.pages.freightCustoms}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
