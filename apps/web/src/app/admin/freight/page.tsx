"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";

const inp =
  "w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500";

type Quote = Awaited<ReturnType<typeof api.shippingQuote>>;

function bandLabel(band: { min: number; max: number }) {
  const max = band.max >= 1_000_000 ? "+" : `–${band.max.toLocaleString("en-US")}`;
  return `$${band.min.toLocaleString("en-US")}${max === "+" ? "+" : max}`;
}

export default function ShippingRatesAdminPage() {
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("4500");
  const [auction, setAuction] = useState("");
  const [tirUsd, setTirUsd] = useState("200");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [learn, setLearn] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .shippingRates()
      .then((row) => setTirUsd(String(row.tirUsd ?? 200)))
      .catch(() => undefined);
  }, []);

  async function lookup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setLearn("");
    try {
      const next = await api.shippingQuote({ url: url.trim(), priceUsd: Number(price), auction: auction || undefined });
      setQuote(next);
      if (next.missing) {
        setNotice(
          `$${Number(price).toLocaleString("en-US")} ${bandLabel(next.band)} aralığına düşür (${next.auction} · ${next.stateName || next.state}). Bu aralıq üçün yol pulu yaddaşda yoxdur — bir dəfə yazın, növbəti eyni aralıq avtomatik olacaq.`,
        );
      }
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : "Lot oxunmadı.");
    }
    setBusy(false);
  }

  async function remember(e: FormEvent) {
    e.preventDefault();
    if (!quote?.cellKey) return;
    const ocean = Number(learn);
    if (!Number.isFinite(ocean) || ocean <= 0) {
      setError("Yol pulu müsbət rəqəm olmalıdır.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.saveShippingRates({
        tirUsd: Number(tirUsd) || 0,
        cells: { [quote.cellKey]: ocean },
      });
      const total = ocean + (Number(tirUsd) || 0) + (quote.auctionFeeUsd ?? 0);
      setQuote({ ...quote, oceanUsd: ocean, totalUsd: total, freightUsd: ocean + (Number(tirUsd) || 0), missing: false, tirUsd: Number(tirUsd) || 0 });
      setNotice(
        `${quote.auction} · ${quote.stateName || quote.state} · ${bandLabel(quote.band)} üçün $${ocean.toLocaleString("en-US")} yadda saxlanıldı. Eyni aralıq bir daha soruşulmayacaq.`,
      );
      setLearn("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yadda saxlanılmadı.");
    }
    setBusy(false);
  }

  async function saveTir() {
    setBusy(true);
    try {
      await api.saveShippingRates({ tirUsd: Number(tirUsd) || 0, cells: {} });
      setNotice("Gürcüstan–Bakı TIR yadda saxlanıldı.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "TIR yazılmadı.");
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl">Yol pulu</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Bid.cars linki və hərrac qiyməti kifayətdir. 4500 → $3,001–7,000. Tarif yoxdursa bir dəfə yazırsız, baza yadda saxlayır.
      </p>
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {notice ? <p className="mt-4 text-sm text-emerald-400">{notice}</p> : null}

      <form className="mt-8 space-y-4 rounded-2xl border border-white/10 p-5" onSubmit={lookup}>
        <label className="block text-xs text-zinc-500">
          Bid.cars lot linki
          <input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://bid.cars/en/lot/…" className={`${inp} mt-1 font-mono text-xs`} />
        </label>
        <label className="block text-xs text-zinc-500">
          Hərrac qiyməti (USD)
          <input required type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className={`${inp} mt-1`} />
        </label>
        <label className="block text-xs text-zinc-500">
          Hərrac (əgər link oxunmasa)
          <select value={auction} onChange={(e) => setAuction(e.target.value)} className={`${inp} mt-1 bg-[#111]`}>
            <option value="">Avtomatik</option>
            <option value="COPART">Copart</option>
            <option value="IAAI">IAAI</option>
          </select>
        </label>
        <button disabled={busy} className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50">
          {busy ? "…" : "Ştatı oxu və aralığı tap"}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block text-xs text-zinc-500">
          Gürcüstan → Bakı (TIR), USD
          <input value={tirUsd} onChange={(e) => setTirUsd(e.target.value.replace(/[^\d.]/g, ""))} className={`${inp} mt-1 w-40`} />
        </label>
        <button type="button" onClick={() => void saveTir()} className="rounded-xl border border-white/15 px-4 py-3 text-xs text-zinc-300">
          TIR-ı yadda saxla
        </button>
      </div>

      {quote ? (
        <div className="mt-8 space-y-4 rounded-2xl border border-white/10 p-5">
          <p className="text-sm text-white">{quote.lot?.title || quote.stateName}</p>
          <p className="text-xs text-zinc-500">
            {[quote.lot?.location, quote.stateName, quote.auction, quote.year && String(quote.year), quote.engineCc && `${quote.engineCc} cm³`, quote.fuel]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-sm text-sky-300">
            Qiymət ${quote.priceUsd.toLocaleString("en-US")} → aralıq {bandLabel(quote.band)}
          </p>
          {!quote.missing && quote.totalUsd != null ? (
            <div>
              <p className="font-display text-3xl text-white">${quote.totalUsd.toLocaleString("en-US")}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {quote.auction} auction fee ${(quote.auctionFeeUsd ?? 0).toLocaleString("en-US")}
                {quote.auctionFee
                  ? ` (buyer ${quote.auctionFee.buyerUsd} + live ${quote.auctionFee.virtualUsd} + gate ${quote.auctionFee.gateUsd}${quote.auctionFee.envUsd ? ` + env ${quote.auctionFee.envUsd}` : ""}${quote.auctionFee.titleUsd ? ` + title ${quote.auctionFee.titleUsd}` : ""})`
                  : ""}
                . Ştat buyer fee-ni dəyişmir.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Hərrac ${quote.priceUsd.toLocaleString("en-US")} + fee ${(quote.auctionFeeUsd ?? 0).toLocaleString("en-US")} + US yol pulu $
                {quote.oceanUsd?.toLocaleString("en-US")} + TIR ${quote.tirUsd.toLocaleString("en-US")}
              </p>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={remember}>
              <label className="block text-xs text-zinc-500">
                {quote.auction} · {quote.stateName || quote.state} · {bandLabel(quote.band)} üçün ABŞ yol pulu (USD)
                <input
                  required
                  inputMode="numeric"
                  value={learn}
                  onChange={(e) => setLearn(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="məs. 1850"
                  className={`${inp} mt-1`}
                />
              </label>
              <button disabled={busy} className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50">
                Bu aralığı yadda saxla
              </button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
