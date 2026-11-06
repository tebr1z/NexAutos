"use client";

import { useEffect, useRef, useState } from "react";
import { Container, Ship, Search, MapPin, Clock3, ArrowRight, RefreshCw } from "lucide-react";
import { api, type OceanLookup } from "@/lib/api";
import { ShipmentMap } from "./shipment-map";
import { checkDigitValid } from "@/lib/carriers";

export function ContainerTracker({ initialNumber = "" }: { initialNumber?: string }) {
  const [number, setNumber] = useState(initialNumber);
  const [data, setData] = useState<OceanLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  async function search(value: string) {
    const normalized = value.replace(/[\s-]/g, "").toUpperCase();
    if (!/^[A-Z]{3}U\d{7}$/.test(normalized)) { setError("Konteyner nömrəsini 4 hərf və 7 rəqəmlə yazın (məsələn, MSCU1234567)."); return; }
    if (!checkDigitValid(normalized)) { setError("Konteyner nömrəsinin yoxlama rəqəmi düzgün deyil. Nömrəni sənəddən yenidən yoxlayın."); return; }
    const id = ++request.current;
    setBusy(true); setError(""); setData(null);
    try { const next = await api.lookupOcean(normalized); if (id === request.current) setData(next); }
    catch { if (id === request.current) setError("İzləmə xidməti cavab vermədi. Bir az sonra yenidən yoxlayın."); }
    finally { if (id === request.current) setBusy(false); }
  }
  useEffect(() => { if (initialNumber) { setNumber(initialNumber); void search(initialNumber); } return () => { request.current++; }; }, [initialNumber]);
  const ais = data?.positionKind === "ais";
  return <section className="overflow-hidden rounded-3xl border border-line bg-card">
    <div className="border-b border-line p-5 sm:p-7">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-royal/10 p-3 text-royal"><Container size={22} /></span><div><h2 className="text-lg font-semibold">Konteyner və gəmi izləmə</h2><p className="mt-1 text-xs text-muted">Konteynerin daşınma məlumatı və gəminin son bildirilən mövqeyi</p></div></div>
      <form onSubmit={e => { e.preventDefault(); void search(number); }} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor={`container-${initialNumber}`}>Konteyner nömrəsi</label>
        <input id={`container-${initialNumber}`} required maxLength={20} value={number} onChange={e => setNumber(e.target.value.toUpperCase())} placeholder="MSCU 1234567" autoCorrect="off" spellCheck={false} className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3.5 font-mono uppercase outline-none focus:border-royal" />
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-royal px-6 py-3.5 text-sm font-medium text-white disabled:opacity-50">{busy ? <RefreshCw size={17} className="animate-spin" /> : <Search size={17} />}{busy ? "Axtarılır…" : "Konteyneri tap"}</button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
    {data ? <>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-royal/[.04] px-5 py-4 sm:px-7"><span className="font-mono font-semibold">{data.formatted}</span><span className={`rounded-full px-3 py-1 text-xs font-medium ${ais ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{ais ? "Son AIS mövqeyi" : data.positionKind === "port" ? "Son məlum liman" : "Mövqe təsdiqlənməyib"}</span></div>
      <div className="grid lg:grid-cols-[1fr_300px]">
        <ShipmentMap lat={data.lat} lng={data.lng} label={`${ais ? "Gəmi" : "Liman"}: ${data.vesselName || data.currentPort || data.containerNumber}`} />
        <div className="space-y-5 p-5 sm:p-7">
          <div><p className="flex items-center gap-2 text-xs text-muted"><Ship size={15} />Gəmi</p><p className="mt-2 text-xl font-semibold">{data.vesselName || "Hələ müəyyən edilməyib"}</p><p className="mt-1 text-xs text-muted">{data.carrierName || "Daşıyıcı gözlənilir"}{data.vesselImo ? ` · IMO ${data.vesselImo}` : ""}</p></div>
          <div className="rounded-xl bg-bg p-4 text-sm"><p>{data.originPort || "Çıxış limanı gözlənilir"}</p><ArrowRight size={16} className="my-2 text-royal" /><p>{data.destinationPort || "Təyinat limanı gözlənilir"}</p></div>
          <div><p className="flex items-center gap-2 text-xs text-muted"><MapPin size={15} />Son hadisə</p><p className="mt-2 text-sm">{data.containerStatus || data.currentPort || "Daşıyıcıdan məlumat gözlənilir"}</p></div>
          <div><p className="flex items-center gap-2 text-xs text-muted"><Clock3 size={15} />Mövqenin vaxtı</p><p className="mt-2 text-sm">{data.positionUpdatedAt ? new Date(data.positionUpdatedAt).toLocaleString("az-AZ", { timeZone: "Asia/Baku" }) : "Vaxt məlumatı yoxdur"}</p><p className="mt-1 text-xs text-muted">{data.positionSource || ""}</p></div>
          {data.eta && <p className="text-sm">Təxmini çatma: {new Date(data.eta).toLocaleDateString("az-AZ")}</p>}
        </div>
      </div>
      <p className="border-t border-line px-5 py-4 text-xs leading-5 text-muted" role="status">{data.trackingMessage || "AIS son qəbul edilən gəmi mövqeyini göstərir; konteynerin ayrıca GPS mövqeyi deyil. Liman nöqtəsi gəminin dəqiq mövqeyi sayılmır."}</p>
    </> : <div className="grid gap-4 p-5 text-sm text-muted sm:grid-cols-3 sm:p-7">{["01 · Konteyner nömrəsini daxil edin", "02 · Daşıyıcı və gəmi müəyyən edilsin", "03 · Son mövqeyi xəritədə görün"].map(text => <p key={text} className="rounded-xl bg-bg p-4">{text}</p>)}</div>}
  </section>;
}
