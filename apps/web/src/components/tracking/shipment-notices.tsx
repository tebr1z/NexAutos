"use client";

import { Banknote, CheckCircle2, Container, ExternalLink, FileSignature, MessageCircle, Receipt, TriangleAlert } from "lucide-react";
import { SITE } from "@/lib/constants";
import type { TrackingShipment } from "@/lib/types";

export function safeCarrierUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function ShipmentNotices({ shipment }: { shipment: TrackingShipment }) {
  const freight = shipment.freightPaymentStatus || "UNPAID";
  const usa = shipment.originCountry === "USA";
  const method = usa ? "SIGNIFY" : shipment.documentMethod;
  const documentComplete = shipment.documentStatus === "COMPLETED" && (!usa || shipment.documentMethod === "SIGNIFY");
  const needsDocument = method === "SIGNIFY" || method === "POWER_OF_ATTORNEY";
  const managerUrl = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(`Salam, ${shipment.trackingCode} nömrəli sifarişim (${shipment.vin}) üzrə ${method === "SIGNIFY" ? "Signify imzası" : "sənədlər və ödəniş"} ilə bağlı kömək istəyirəm.`)}`;
  const freightText = freight === "PAID" ? "Yol pulu ödənilib" : freight === "PARTIAL" ? "Yol pulu qismən ödənilib" : "Yol pulu ödənilməyib";

  return (
    <section className="mt-6 rounded-3xl border border-line bg-card p-5 sm:p-6" aria-labelledby="shipment-obligations">
      <h2 id="shipment-obligations" className="text-lg font-semibold">Ödəniş və sənəd qeydləri</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className={`rounded-2xl border p-4 ${freight === "PAID" ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          <div className="flex items-center gap-2 text-sm font-medium"><Banknote size={19} className="shrink-0" />{freightText}</div>
          <p className="mt-2 text-xs leading-5 text-muted">{freight === "PAID" ? "Daşınma ödənişi şirkət tərəfindən təsdiqlənib." : "Qalıq məbləğ və ödəniş rekvizitləri üçün menecerinizlə əlaqə saxlayın."}</p>
        </div>
        {needsDocument ? <div className={`rounded-2xl border p-4 ${documentComplete ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          <div className="flex items-center gap-2 text-sm font-medium">{documentComplete ? <CheckCircle2 size={19} className="shrink-0" /> : <FileSignature size={19} className="shrink-0" />}{method === "SIGNIFY" ? (documentComplete ? "Signify imzası tamamlanıb" : "Zəhmət olmasa Signify ilə imzalayın") : (documentComplete ? "Etibarnamə təqdim edilib" : "Etibarnamə təqdim edilməyib")}</div>
          <p className="mt-2 text-xs leading-5 text-muted">{method === "SIGNIFY" ? "ABŞ-dan daşınma üçün etibarnamə əvəzinə Signify imzası istifadə olunur. İmza linki və kömək üçün menecerə müraciət edin." : "Tələb olunan etibarnamənin hazırlanması və təqdim edilməsi üçün menecerinizlə əlaqə saxlayın."}</p>
        </div> : <div className="rounded-2xl border border-line bg-bg p-4"><div className="flex items-center gap-2 text-sm font-medium"><FileSignature size={19} />Sənədlər dəqiqləşdirilir</div><p className="mt-2 text-xs leading-5 text-muted">Sənədləşmə üsulu təyin edildikdə burada göstəriləcək.</p></div>}
      </div>
      {(shipment.purchasePaymentPercent != null || shipment.commissionUsd != null) && <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {shipment.purchasePaymentPercent != null && <div className="flex items-start gap-3 rounded-2xl bg-bg p-4"><Receipt size={19} className="mt-0.5 shrink-0 text-royal" /><div><p className="text-sm font-medium">{shipment.purchasePaymentPercent === 100 ? "Avtomobil tam ödənişlə alınıb" : `Avtomobil ${shipment.purchasePaymentPercent}% ilkin ödənişlə alınıb`}</p><p className="mt-1 text-xs text-muted">Alış üzrə admin tərəfindən qeyd olunub.</p></div></div>}
        {shipment.commissionUsd != null && <div className="flex items-start gap-3 rounded-2xl bg-bg p-4"><Receipt size={19} className="mt-0.5 shrink-0 text-royal" /><div><p className="text-sm font-medium">${Number(shipment.commissionUsd).toLocaleString("en-US", { maximumFractionDigits: 2 })} toplam komissiya tətbiq olunub</p><p className="mt-1 text-xs text-muted">Bu sifariş üzrə qeydə alınmış komissiya.</p></div></div>}
      </div>}
      {(freight !== "PAID" || !documentComplete) && <a href={managerUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-royal hover:bg-royal/5"><MessageCircle size={18} />Menecerdən kömək alın<ExternalLink size={14} /></a>}
    </section>
  );
}

export function CarrierDetails({ shipment }: { shipment: TrackingShipment }) {
  const url = safeCarrierUrl(shipment.carrierTrackingUrl);
  const opening = shipment.containerOpeningDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!shipment.containerNumber && !url && !opening) return null;
  return <section className="mt-6 rounded-3xl border border-line bg-card p-5 sm:p-6" aria-labelledby="shipment-carrier">
    <div className="flex items-center gap-3"><Container className="shrink-0 text-royal" size={23} /><div><h2 id="shipment-carrier" className="font-semibold">Konteyner və daşıyıcı</h2><p className="mt-1 text-xs text-muted">Məlumatlar daşınma planı təsdiqləndikcə əlavə olunur.</p></div></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
      <div>{shipment.containerNumber && <p className="break-all font-mono text-lg font-semibold">{shipment.containerNumber}</p>}{shipment.carrierName && <p className="mt-1 text-sm text-muted">{shipment.carrierName}</p>}</div>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-royal px-5 py-3 text-sm font-medium text-white">Daşıyıcının saytında izlə<ExternalLink size={16} /></a>}
    </div>
    {url && <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted"><TriangleAlert size={15} className="mt-0.5 shrink-0" />Keçid daşıyıcının xarici saytını açır. Yenilənən mövqe və tarixləri həmin səhifədən yoxlayın.</p>}
    {opening && <p className="mt-4 rounded-xl bg-royal/5 px-4 py-3 text-sm"><span className="text-muted">Konteynerin açılma tarixi: </span><span className="font-semibold">{opening[3]}.{opening[2]}.{opening[1]}</span></p>}
  </section>;
}
