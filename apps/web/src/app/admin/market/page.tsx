"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { api, type MarketSale, type MarketSalesResponse } from "@/lib/api";
import { fetchCustomsDuty } from "@/lib/customs-duty";

const input = "w-full rounded-xl border border-white/10 bg-[#0d0d0f] px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/60";
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function unique<T>(values: (T | null | undefined)[]) {
  return [...new Set(values.filter((value): value is T => value !== null && value !== undefined && value !== ""))].sort();
}

function median(rows: MarketSale[]) {
  const values = rows.map((row) => row.finalBidUsd).sort((a, b) => a - b);
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) / 2);
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const point = (sorted.length - 1) * ratio;
  const low = Math.floor(point), high = Math.ceil(point);
  return Math.round(sorted[low] + (sorted[high] - sorted[low]) * (point - low));
}

function fuelCode(fuel?: string | null) {
  const value = String(fuel || "").toLowerCase();
  if (/plug/.test(value)) return "8";
  if (/hybrid/.test(value)) return "6";
  if (/electric/.test(value)) return "12";
  if (/diesel/.test(value)) return "2";
  if (/lpg|cng/.test(value)) return "3";
  return "1";
}

export default function MarketSalesAdminPage() {
  const [data, setData] = useState<MarketSalesResponse | null>(null);
  const [filters, setFilters] = useState({ make: "", model: "", trim: "", fuel: "", auction: "", year: "", engineCc: "", days: "30" });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [deliveryById, setDeliveryById] = useState<Record<string, number>>({});
  const [deliveryNote, setDeliveryNote] = useState("");
  const deliveryRun = useRef(0);

  async function load(next = filters) {
    deliveryRun.current += 1;
    setDeliveryBusy(false);
    setBusy(true); setError("");
    try {
      const response = await api.marketSales(next);
      setData(response); setDeliveryById({}); setDeliveryNote("");
      if (next.make && next.model) void calculateDelivery(response.rows);
    }
    catch (err) { setError(err instanceof Error ? err.message : "Bazar məlumatları yüklənmədi."); }
    setBusy(false);
  }

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function calculateOne(row: MarketSale) {
    if (!row.year || (!row.engineCc && row.fuel !== "Electric") || !row.auction || !row.location) return null;
    const quote = await api.shippingQuote({
      url: row.sourceUrl, priceUsd: row.finalBidUsd, auction: row.auction,
      state: row.state || undefined, yard: row.location, titleKind: "SALVAGE",
    });
    if (quote.missing || !quote.freightUsd) return null;
    const invoiceUsd = row.finalBidUsd + Number(quote.auctionFeeUsd || 0);
    const duty = await fetchCustomsDuty({ locale: "az", invoiceUsd, freightUsd: Number(quote.freightUsd), year: row.year, engineCc: Number(row.engineCc || 0), fuelCode: fuelCode(row.fuel) });
    const rate = Number(duty.usdCourse || 0);
    if (!rate) return null;
    return Math.round((invoiceUsd + Number(quote.freightUsd)) * rate + Number(duty.total?.value || 0) + 800);
  }

  async function calculateDelivery(rows: MarketSale[]) {
    const run = ++deliveryRun.current;
    const sample = rows.slice(0, 25);
    if (!sample.length) { setDeliveryBusy(false); return; }
    setDeliveryBusy(true); setDeliveryById({}); setDeliveryNote("");
    const result: Record<string, number> = {};
    for (let index = 0; index < sample.length; index += 5) {
      const group = sample.slice(index, index + 5);
      const values = await Promise.all(group.map(async (row) => {
        try { return await calculateOne(row); } catch { return null; }
      }));
      if (run !== deliveryRun.current) return;
      group.forEach((row, offset) => { if (values[offset]) result[row.id] = values[offset] as number; });
      setDeliveryById({ ...result });
    }
    if (run !== deliveryRun.current) return;
    setDeliveryNote(Object.keys(result).length ? `${Object.keys(result).length} uyğun satışın final + auction fee + yol + gömrük + 800 AZN DYP nəticəsi hesablandı.` : "Bakı təhvil üçün location, yol tarifi, il və mühərrik məlumatı olan nəticə tapılmadı.");
    setDeliveryBusy(false);
  }

  const facets = data?.facets || [];
  const makes = unique(facets.map((row) => row.make));
  const models = unique(facets.filter((row) => !filters.make || row.make === filters.make).map((row) => row.model));
  const trims = unique(facets.filter((row) => (!filters.make || row.make === filters.make) && (!filters.model || row.model === filters.model)).map((row) => row.trim));
  const engines = unique(facets.map((row) => row.engineCc));
  const years = unique(facets.map((row) => row.year)).sort((a, b) => b - a);
  const stats = useMemo(() => {
    const rows = data?.rows || [];
    const avg = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.finalBidUsd, 0) / rows.length) : 0;
    return { avg, median: median(rows), min: rows.length ? Math.min(...rows.map((r) => r.finalBidUsd)) : 0, max: rows.length ? Math.max(...rows.map((r) => r.finalBidUsd)) : 0 };
  }, [data]);
  const deliveryStats = useMemo(() => {
    const values = Object.values(deliveryById);
    return { count: values.length, average: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0, median: percentile(values, .5), low: percentile(values, .25), high: percentile(values, .75) };
  }, [deliveryById]);

  const set = (name: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [name]: value }));
  const select = (label: string, name: keyof typeof filters, values: (string | number)[]) => (
    <label className="text-xs text-zinc-500">{label}<select className={`${input} mt-1`} value={filters[name]} onChange={(e) => set(name, e.target.value)}><option value="">Hamısı</option>{values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
  );

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="font-display text-3xl">BidCars bazar analizi</h1><p className="mt-2 text-sm text-zinc-400">Extension-un PostgreSQL-ə yazdığı final satışlar. Filtrlər serverdə tətbiq olunur.</p></div>
        <button onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm disabled:opacity-50"><RefreshCw size={15} className={busy ? "animate-spin" : ""}/>Yenilə</button>
      </div>
      {error ? <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}

      <div className="mt-7 grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {select("Marka", "make", makes)}{select("Model", "model", models)}{select("Komplektasiya", "trim", trims)}
        {select("Mühərrik, cm³", "engineCc", engines)}{select("İl", "year", years)}
        {select("Yanacaq", "fuel", unique(facets.map((r) => r.fuel)))}{select("Hərrac", "auction", unique(facets.map((r) => r.auction)))}
        <label className="text-xs text-zinc-500">Dövr<select className={`${input} mt-1`} value={filters.days} onChange={(e) => set("days", e.target.value)}><option value="7">7 gün</option><option value="30">30 gün</option><option value="90">90 gün</option><option value="365">1 il</option></select></label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button onClick={() => void load()} className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black">Filtrlə</button><button onClick={() => { const next = { make: "", model: "", trim: "", fuel: "", auction: "", year: "", engineCc: "", days: "30" }; setFilters(next); void load(next); }} className="rounded-xl border border-white/15 px-5 py-2.5 text-sm">Təmizlə</button></div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["Nəticə", data?.total || 0], ["Median", money(stats.median)], ["Orta", money(stats.avg)], ["Minimum", money(stats.min)], ["Maksimum", money(stats.max)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}
      </div>

      <div className="mt-5 rounded-2xl border border-sky-500/25 bg-sky-500/[.07] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-sky-300">Bakı təhvil ortalaması</p>{deliveryStats.count ? <><p className="mt-2 text-3xl font-semibold text-white">{deliveryStats.average.toLocaleString("az-AZ")} AZN</p><p className="mt-1 text-sm text-zinc-400">Real aralıq: {deliveryStats.low.toLocaleString("az-AZ")}–{deliveryStats.high.toLocaleString("az-AZ")} AZN · median {deliveryStats.median.toLocaleString("az-AZ")} AZN · {deliveryStats.count} satış</p></> : <p className="mt-2 text-sm text-zinc-400">Marka və modeli seçib “Filtrlə” basın; uyğun nəticələrin Bakı təhvil qiyməti avtomatik hesablanacaq.</p>}</div><button disabled={deliveryBusy || !data?.rows.length} onClick={() => void calculateDelivery(data?.rows || [])} className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{deliveryBusy ? "Bakı təhvil hesablanır…" : "Yenidən hesabla"}</button></div>
        {deliveryNote ? <p className="mt-3 text-xs text-zinc-500">{deliveryNote}</p> : null}
        <p className="mt-2 text-xs text-zinc-500">Yürüşü 300 000 km-dən çox olan avtomobillər nəticəyə və ortalamaya daxil edilmir.</p>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-[1180px] w-full text-left text-sm"><thead className="bg-white/[.04] text-xs text-zinc-500"><tr>{["Avtomobil", "Komplektasiya", "İl", "Mühərrik", "Yanacaq", "Yürüş", "Rəng", "Hərrac", "Final", "Bakı təhvil", "Tarix"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{(data?.rows || []).map((row) => <tr key={row.id} className="border-t border-white/10 text-zinc-300"><td className="px-4 py-3"><a className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200" href={row.sourceUrl} target="_blank" rel="noreferrer">{row.make || "—"} {row.model || ""}<ExternalLink size={12}/></a><p className="mt-1 text-[11px] text-zinc-600">{row.vin || row.lotNumber || row.sourceKey}</p></td><td className="px-4 py-3">{row.trim || "—"}</td><td className="px-4 py-3">{row.year || "—"}</td><td className="px-4 py-3">{row.engineCc ? `${row.engineCc} cm³` : row.engineLabel || "—"}</td><td className="px-4 py-3">{row.fuel || "—"}</td><td className="px-4 py-3">{row.mileageKm ? `${row.mileageKm.toLocaleString("en-US")} km` : "—"}</td><td className="px-4 py-3">{row.color || "—"}</td><td className="px-4 py-3">{row.auction || "—"}</td><td className="px-4 py-3 font-semibold text-emerald-300">{money(row.finalBidUsd)}</td><td className="px-4 py-3 font-semibold text-sky-300">{deliveryById[row.id] ? `${deliveryById[row.id].toLocaleString("az-AZ")} AZN` : deliveryBusy ? "…" : "—"}</td><td className="px-4 py-3 text-xs text-zinc-500">{new Date(row.saleDate || row.observedAt).toLocaleDateString("az-AZ")}</td></tr>)}</tbody></table>
        {!busy && !data?.rows.length ? <p className="p-10 text-center text-sm text-zinc-500">Bu filtrlərə uyğun final satış yoxdur.</p> : null}
      </div>
    </div>
  );
}
