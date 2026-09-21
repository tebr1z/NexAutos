"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { dutyUsd, fetchCustomsDuty, type CustomsDuty } from "@/lib/customs-duty";

const inp =
  "w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500";

type Quote = Awaited<ReturnType<typeof api.shippingQuote>>;

function bandLabel(band: { min: number; max: number }) {
  const max = band.max >= 1_000_000 ? "+" : `–${band.max.toLocaleString("en-US")}`;
  return `$${band.min.toLocaleString("en-US")}${max === "+" ? "+" : max}`;
}

function moneyAzn(n: number) {
  return `${n.toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AZN`;
}

export default function ShippingRatesAdminPage() {
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("4500");
  const [auction, setAuction] = useState("");
  const [titleKind, setTitleKind] = useState("SALVAGE");
  const [tirUsd, setTirUsd] = useState("200");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [learn, setLearn] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dutyBusy, setDutyBusy] = useState(false);
  const [duty, setDuty] = useState<(CustomsDuty & { engineName?: string }) | null>(null);

  useEffect(() => {
    api
      .shippingRates()
      .then((row) => setTirUsd(String(row.tirUsd ?? 200)))
      .catch(() => undefined);
  }, []);

  async function loadQuote() {
    const next = await api.shippingQuote({
      url: url.trim(),
      priceUsd: Number(price),
      auction: auction || undefined,
      titleKind,
    });
    setQuote(next);
    return next;
  }

  async function lookup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setLearn("");
    setDuty(null);
    try {
      const next = await loadQuote();
      if (next.missing) {
        setNotice(
          `$${Number(price).toLocaleString("en-US")} ${bandLabel(next.band)} aralığına düşür (${next.auction} · ${next.yard || next.lot?.location}, ${next.state}). Bu yard üçün yol pulu yaddaşda yoxdur — bir dəfə yazın, növbəti eyni yard avtomatik olacaq.`,
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
        `${quote.auction} · ${quote.yard || quote.lot?.location}, ${quote.state} · ${bandLabel(quote.band)} üçün $${ocean.toLocaleString("en-US")} yadda saxlanıldı. Eyni yard bir daha soruşulmayacaq.`,
      );
      setLearn("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yadda saxlanılmadı.");
    }
    setBusy(false);
  }

  async function calcDuty() {
    setDutyBusy(true);
    setError("");
    setDuty(null);
    try {
      const next = quote ?? (await loadQuote());
      const year = next.year || next.lot?.year || 0;
      const engineCc = next.engineCc || next.lot?.engineCc || 0;
      const invoiceUsd = next.invoiceUsd ?? next.priceUsd + (next.auctionFeeUsd ?? 0);
      const freightUsd = next.freightUsd;
      if (next.missing || freightUsd == null || freightUsd <= 0) {
        setError("Əvvəl bu yard üçün ABŞ yol pulunu yadda saxlayın, sonra gömrük hesablanar.");
      } else if (!year || (engineCc <= 0 && next.dgkEngineCode !== "12")) {
        setError("Bid.cars-dan il və mühərrik oxunmadı. Lotda bu məlumat olmalıdır.");
      } else {
        const nextDuty = await fetchCustomsDuty({
          locale: "az",
          invoiceUsd,
          freightUsd,
          year,
          engineCc,
          fuelCode: next.dgkEngineCode,
        });
        setDuty(nextDuty);
        setNotice(
          `Gömrük DGK: invoys $${invoiceUsd.toLocaleString("en-US")} (hərrac + auction fee) · ${year} · ${engineCc || "EV"} cm³ · ${next.fuel || nextDuty.engineName || "yanacaq"}.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gömrük hesablanmadı.");
    }
    setDutyBusy(false);
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
        Bid.cars linki və hərrac qiyməti kifayətdir. Yol pulu ştata görə yox, konkret yard-a görə saxlanır: CA Sun Valley ilə CA Los Angeles ayrıdır. Gömrük hesabla Bid.cars il / mühərrik / yanacaq və auction fee invoys ilə DGK API-yə gedir.
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
        <label className="block text-xs text-zinc-500">
          Title
          <select value={titleKind} onChange={(e) => setTitleKind(e.target.value)} className={`${inp} mt-1 bg-[#111]`}>
            <option value="SALVAGE">Salvage / non-clean</option>
            <option value="CLEAN">Clean title</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50">
            {busy ? "…" : "Yard-ı oxu və aralığı tap"}
          </button>
          <button
            type="button"
            disabled={busy || dutyBusy}
            onClick={() => void calcDuty()}
            className="rounded-xl border border-white/20 px-5 py-3 text-sm text-white disabled:opacity-50"
          >
            {dutyBusy ? "…" : "Gömrük hesabla"}
          </button>
        </div>
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
            {[quote.lot?.location || quote.yard, quote.state, quote.auction, quote.year && String(quote.year), quote.engineCc && `${quote.engineCc} cm³`, quote.fuel, duty?.engineName]
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
                  ? ` (${quote.auctionFee.titleKind === "CLEAN" ? "clean" : "salvage"} · buyer ${quote.auctionFee.buyerUsd} + live ${quote.auctionFee.virtualUsd} + gate ${quote.auctionFee.gateUsd}${quote.auctionFee.envUsd ? ` + env ${quote.auctionFee.envUsd}` : ""}${quote.auctionFee.titleUsd ? ` + title ${quote.auctionFee.titleUsd}` : ""})`
                  : ""}
                . Ştat auction fee-ni dəyişmir. Yol pulu yard-adır.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Hərrac ${quote.priceUsd.toLocaleString("en-US")} + fee ${(quote.auctionFeeUsd ?? 0).toLocaleString("en-US")} + US yol pulu $
                {quote.oceanUsd?.toLocaleString("en-US")} + TIR ${quote.tirUsd.toLocaleString("en-US")}
              </p>
              <button
                type="button"
                disabled={dutyBusy}
                onClick={() => void calcDuty()}
                className="mt-4 rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
              >
                {dutyBusy ? "…" : "Gömrük hesabla"}
              </button>
              {duty ? (
                <div className="mt-5 space-y-2 text-sm">
                  <p className="text-white">
                    Gömrük ${dutyUsd(duty).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {moneyAzn(duty.total?.value ?? 0)}
                    {duty.engineName ? ` · ${duty.engineName}` : ""}
                  </p>
                  {duty.duties.map((row) => (
                    <div key={row.code} className="flex justify-between gap-4 border-b border-white/10 py-2 text-zinc-400">
                      <span>{row.name}</span>
                      <span>{moneyAzn(row.value)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <form className="space-y-3" onSubmit={remember}>
              <label className="block text-xs text-zinc-500">
                {quote.auction} · {quote.yard || quote.lot?.location}, {quote.state} · {bandLabel(quote.band)} üçün ABŞ yol pulu (USD)
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
                Bu yard-ı yadda saxla
              </button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
