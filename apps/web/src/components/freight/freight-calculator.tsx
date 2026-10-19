"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { dutyUsd, fetchCustomsDuty, type CustomsDuty } from "@/lib/customs-duty";
import { useI18n } from "@/providers/i18n-provider";

const inp =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg placeholder:text-muted";

type Quote = Awaited<ReturnType<typeof api.shippingQuote>>;
type ShippingCatalog = Awaited<ReturnType<typeof api.shippingCatalog>>;

function moneyAzn(n: number) {
  return `${n.toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AZN`;
}

function moneyUsd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FreightCalculator() {
  const { t, locale } = useI18n();
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("5000");
  const [auction, setAuction] = useState("");
  const [titleKind, setTitleKind] = useState("SALVAGE");
  const [year, setYear] = useState("");
  const [engine, setEngine] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [duty, setDuty] = useState<(CustomsDuty & { engineName?: string }) | null>(null);
  const [dutyNote, setDutyNote] = useState("");
  const [dutyBusy, setDutyBusy] = useState(false);
  const [catalog, setCatalog] = useState<ShippingCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [browseAuction, setBrowseAuction] = useState<"COPART" | "IAAI">("COPART");
  const [browseState, setBrowseState] = useState("GA");

  useEffect(() => {
    api
      .shippingCatalog()
      .then(setCatalog)
      .catch((err) => setCatalogError(err instanceof Error ? err.message : "Tarif siyahısı yüklənmədi."));
  }, []);

  const catalogStates = useMemo(() => {
    if (!catalog) return [];
    const names = new Map<string, string>();
    for (const row of catalog.rows) {
      if (row.auction === browseAuction) names.set(row.state, row.stateName || row.state);
    }
    return [...names.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [browseAuction, catalog]);

  const catalogRows = useMemo(
    () =>
      (catalog?.rows ?? []).filter(
        (row) => row.auction === browseAuction && (!browseState || row.state === browseState),
      ),
    [browseAuction, browseState, catalog],
  );

  async function loadQuote() {
    const next = await api.shippingQuote({
      url: url.trim() || undefined,
      priceUsd: Number(price),
      auction: auction || undefined,
      titleKind,
    });
    setQuote(next);
    if (next.year || next.lot?.year) setYear(String(next.year || next.lot?.year));
    if (next.engineCc || next.lot?.engineCc) setEngine(String(next.engineCc || next.lot?.engineCc));
    return next;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDuty(null);
    setDutyNote("");
    try {
      await loadQuote();
    } catch (err) {
      setQuote(null);
      setDuty(null);
      setError(err instanceof Error ? err.message : t.pages.freightFail);
    }
    setBusy(false);
  }

  async function calcDuty() {
    setDutyBusy(true);
    setError("");
    setDuty(null);
    setDutyNote("");
    try {
      const next = quote ?? (await loadQuote());
      const lotYear = next.year || next.lot?.year || 0;
      const lotEngine = next.engineCc || next.lot?.engineCc || 0;
      const resolvedYear = lotYear || Number(year) || 0;
      const resolvedEngine = lotEngine || Number(engine) || 0;
      if (lotYear) setYear(String(lotYear));
      if (lotEngine) setEngine(String(lotEngine));

      const invoiceUsd = next.invoiceUsd ?? next.priceUsd + (next.auctionFeeUsd ?? 0);
      const freightUsd = next.freightUsd;
      if (next.missing || freightUsd == null || freightUsd < 0) {
        setDutyNote(t.pages.freightMissing);
      } else if (!resolvedYear || (resolvedEngine <= 0 && next.dgkEngineCode !== "12")) {
        setDutyNote(t.pages.freightNeedSpecs);
      } else {
        const nextDuty = await fetchCustomsDuty({
          locale,
          invoiceUsd,
          freightUsd,
          year: resolvedYear,
          engineCc: resolvedEngine,
          fuelCode: next.dgkEngineCode,
        });
        setDuty(nextDuty);
      }
    } catch (err) {
      setDutyNote(err instanceof Error ? err.message : t.pages.customsFail);
    }
    setDutyBusy(false);
  }

  const invoiceUsd = quote ? (quote.invoiceUsd ?? quote.priceUsd + (quote.auctionFeeUsd ?? 0)) : 0;
  const freightUsd = quote?.freightUsd ?? 0;
  const customsUsd = duty ? dutyUsd(duty) : 0;
  const landedUsd = quote && !quote.missing && duty ? invoiceUsd + freightUsd + customsUsd : null;

  return (
    <div className="mx-auto max-w-7xl px-5 pt-32 pb-24 md:px-8">
      <h1 className="font-display text-5xl">{t.pages.freightTitle}</h1>
      <p className="mt-4 max-w-2xl text-muted">{t.pages.freightSubtitle}</p>

      <section className="mt-10 rounded-3xl border border-line bg-card p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">ABŞ–Poti tarif siyahısı</p>
            <h2 className="mt-2 font-display text-2xl">State və yard seçərək yol puluna baxın</h2>
            <p className="mt-2 text-sm text-muted">
              Poti–Bakı üçün əlavə {moneyUsd(catalog?.tirUsd ?? 200)} yekun hesablamada avtomatik artırılır.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:min-w-[420px]">
            <label className="block text-xs text-muted">
              Hərrac
              <select
                value={browseAuction}
                onChange={(e) => {
                  setBrowseAuction(e.target.value as "COPART" | "IAAI");
                  setBrowseState("GA");
                }}
                className={`${inp} mt-1`}
              >
                <option value="COPART">Copart</option>
                <option value="IAAI">IAAI</option>
              </select>
            </label>
            <label className="block text-xs text-muted">
              State
              <select value={browseState} onChange={(e) => setBrowseState(e.target.value)} className={`${inp} mt-1`}>
                <option value="">Bütün state-lər</option>
                {catalogStates.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} — {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {catalogError ? <p className="mt-5 text-sm text-red-500">{catalogError}</p> : null}
        {!catalog && !catalogError ? <p className="mt-5 text-sm text-muted">Tariflər yüklənir…</p> : null}
        {catalog ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-3">State</th>
                  <th className="px-3 py-3">Yard / şəhər</th>
                  <th className="px-3 py-3">$0–3,000</th>
                  <th className="px-3 py-3">$3,001–7,000</th>
                  <th className="px-3 py-3">$7,001–150,000</th>
                </tr>
              </thead>
              <tbody>
                {catalogRows.map((row) => (
                  <tr key={`${row.auction}:${row.state}:${row.yardSlug}`} className="border-b border-line/70">
                    <td className="px-3 py-3 font-medium">{row.state}</td>
                    <td className="px-3 py-3">{row.yard}</td>
                    <td className="px-3 py-3">{row.rates.a ? moneyUsd(row.rates.a) : "—"}</td>
                    <td className="px-3 py-3">{row.rates.b ? moneyUsd(row.rates.b) : "—"}</td>
                    <td className="px-3 py-3">{row.rates.c ? moneyUsd(row.rates.c) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!catalogRows.length ? <p className="py-6 text-sm text-muted">Bu seçim üçün tarif tapılmadı.</p> : null}
          </div>
        ) : null}
      </section>

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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted">
              {t.pages.freightYear}
              <input
                type="number"
                min={1980}
                max={new Date().getFullYear() + 1}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Bid.cars"
                className={`${inp} mt-1`}
              />
            </label>
            <label className="block text-xs text-muted">
              {t.pages.freightEngine}
              <input
                type="number"
                min={0}
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
                placeholder="Bid.cars"
                className={`${inp} mt-1`}
              />
            </label>
          </div>
          <label className="block text-xs text-muted">
            {t.pages.freightAuction}
            <select value={auction} onChange={(e) => setAuction(e.target.value)} className={`${inp} mt-1`}>
              <option value="">{t.pages.freightAuctionAuto}</option>
              <option value="COPART">Copart</option>
              <option value="IAAI">IAAI</option>
            </select>
          </label>
          <label className="block text-xs text-muted">
            {t.pages.freightTitleKind}
            <select value={titleKind} onChange={(e) => setTitleKind(e.target.value)} className={`${inp} mt-1`}>
              <option value="SALVAGE">{t.pages.freightTitleSalvage}</option>
              <option value="CLEAN">{t.pages.freightTitleClean}</option>
            </select>
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <p className="text-xs text-muted">{t.pages.freightDutyFromLot}</p>
          <button disabled={busy} className="w-full rounded-xl bg-fg py-3 text-sm font-medium text-bg disabled:opacity-50">
            {busy ? "…" : t.pages.freightCalc}
          </button>
          <button
            type="button"
            disabled={busy || dutyBusy}
            onClick={() => void calcDuty()}
            className="w-full rounded-xl border border-line py-3 text-sm font-medium text-fg disabled:opacity-50"
          >
            {dutyBusy ? "…" : t.pages.freightDutyCalc}
          </button>
        </form>

        <div className="rounded-3xl border border-line bg-card p-6">
          {!quote ? (
            <p className="text-sm text-muted">{t.pages.freightEmpty}</p>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">{quote.lot?.title || quote.yard || quote.stateName}</p>
              <p className="mt-2 text-sm text-muted">
                {[quote.yard || quote.lot?.location || quote.lot?.shippingFrom, quote.state, quote.auction].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {[
                  quote.year && `${quote.year}`,
                  quote.engineCc && `${quote.engineCc} cm³`,
                  quote.fuel,
                  duty?.engineName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t.pages.freightBand}: ${quote.band.min.toLocaleString()}–{quote.band.max >= 1_000_000 ? "∞" : quote.band.max.toLocaleString()}
              </p>
              {quote.missing ? (
                <p className="mt-6 text-sm text-muted">{t.pages.freightMissing}</p>
              ) : (
                <>
                  <h2 className="mt-6 text-lg font-medium">{landedUsd != null ? t.pages.freightLanded : t.pages.freightTotal}</h2>
                  <p className="font-display mt-2 text-3xl text-royal">
                    {landedUsd != null ? moneyUsd(landedUsd) : moneyUsd(quote.totalUsd ?? 0)}
                  </p>
                  <div className="mt-5 space-y-2 text-sm">
                    <div className="flex justify-between gap-4 border-b border-line py-2">
                      <span className="text-muted">{t.pages.freightBid}</span>
                      <span>{moneyUsd(quote.priceUsd)}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-line py-2">
                      <span className="text-muted">{t.pages.freightAuctionFee}</span>
                      <span>{moneyUsd(quote.auctionFeeUsd ?? 0)}</span>
                    </div>
                    <p className="text-xs text-muted">
                      {quote.auctionFee
                        ? `${quote.auction} · ${quote.auctionFee.titleKind === "CLEAN" ? "clean" : "salvage"} · buyer $${quote.auctionFee.buyerUsd} + live $${quote.auctionFee.virtualUsd} + gate $${quote.auctionFee.gateUsd}${quote.auctionFee.envUsd ? ` + env $${quote.auctionFee.envUsd}` : ""}${quote.auctionFee.titleUsd ? ` + title $${quote.auctionFee.titleUsd}` : ""}`
                        : ""}
                    </p>
                    <div className="flex justify-between gap-4 border-b border-line py-2">
                      <span className="text-muted">{t.pages.freightInvoice}</span>
                      <span>{moneyUsd(invoiceUsd)}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-line py-2">
                      <span className="text-muted">{t.pages.freightOcean}</span>
                      <span>{moneyUsd(quote.oceanUsd ?? 0)}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-line py-2">
                      <span className="text-muted">{t.pages.freightTir}</span>
                      <span>{moneyUsd(quote.tirUsd)}</span>
                    </div>
                    {duty ? (
                      <div className="flex justify-between gap-4 border-b border-line py-2">
                        <span className="text-muted">{t.pages.freightDuty}</span>
                        <span>
                          {moneyUsd(customsUsd)}
                          <span className="ml-2 text-xs text-muted">({moneyAzn(duty.total?.value ?? 0)})</span>
                        </span>
                      </div>
                    ) : null}
                  </div>
                  {duty ? (
                    <div className="mt-6">
                      <h3 className="text-sm font-medium">{duty.total?.name || t.pages.customsTotal}</h3>
                      <p className="mt-1 text-xs text-muted">
                        USD = {duty.usdCourse} AZN · {t.pages.customsHint}
                      </p>
                      <div className="mt-3 space-y-2">
                        {duty.duties.map((row) => (
                          <div key={row.code} className="flex justify-between gap-4 border-b border-line py-2 text-sm">
                            <span className="text-muted">{row.name}</span>
                            <span className="shrink-0">{moneyAzn(row.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : dutyNote ? (
                    <p className="mt-4 text-sm text-muted">{dutyNote}</p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || dutyBusy}
                    onClick={() => void calcDuty()}
                    className="mt-5 w-full rounded-xl bg-fg py-3 text-sm font-medium text-bg disabled:opacity-50"
                  >
                    {dutyBusy ? "…" : t.pages.freightDutyCalc}
                  </button>
                </>
              )}
              <a
                href="https://e.customs.gov.az/for-individuals/calculator"
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex text-sm text-royal underline"
              >
                {t.pages.freightCustoms} ↗
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
