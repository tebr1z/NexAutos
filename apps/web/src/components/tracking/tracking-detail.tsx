"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { getLocalOrder, overlayLocal } from "@/lib/local-orders";
import { SITE } from "@/lib/constants";
import type { TrackingShipment } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { findPortCoords } from "@/lib/carriers";
import { useI18n } from "@/providers/i18n-provider";
import { groupPhotos } from "@/lib/photo-categories";
import { journeyPosition, normalizeTransits } from "@/lib/journey";
import { ShippingNotice } from "@/components/layout/shipping-notice";
import {
  ArrowRight,
  CalendarClock,
  CarFront,
  Check,
  Container,
  Download,
  FileText,
  MapPin,
  Navigation,
  Ship,
} from "lucide-react";

async function pinFromImo(shipment: TrackingShipment): Promise<TrackingShipment> {
  const imo = shipment.vesselImo?.replace(/\D/g, "") ?? "";
  if (imo.length !== 7) return shipment;
  try {
    const pos = await api.vesselByImo(imo);
    if (!pos?.hasCoordinates || pos.latitude == null || pos.longitude == null) {
      return { ...shipment, vesselName: shipment.vesselName || pos?.name || undefined };
    }
    return {
      ...shipment,
      lat: pos.latitude,
      lng: pos.longitude,
      vesselName: shipment.vesselName || pos.name || undefined,
      vesselImo: shipment.vesselImo || (pos.imo ? String(pos.imo) : imo),
    };
  } catch {
    return shipment;
  }
}

async function pinFromPorts(shipment: TrackingShipment): Promise<TrackingShipment> {
  if (shipment.lat != null && shipment.lng != null) return shipment;
  const hit =
    findPortCoords(shipment.currentPort) ??
    findPortCoords(shipment.destinationPort) ??
    findPortCoords(shipment.originPort);
  if (hit) {
    return {
      ...shipment,
      lat: hit.lat,
      lng: hit.lng,
      currentCountry: shipment.currentCountry || hit.country,
    };
  }
  const label = shipment.currentPort || shipment.destinationPort || shipment.originPort;
  if (!label) return shipment;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${label} port`)}`,
      { headers: { Accept: "application/json" } },
    );
    const rows = (await res.json()) as { lat?: string; lon?: string }[];
    const lat = Number(rows?.[0]?.lat);
    const lng = Number(rows?.[0]?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { ...shipment, lat, lng };
  } catch {
    /* geocode optional */
  }
  return shipment;
}

async function locateShipment(shipment: TrackingShipment) {
  return pinFromPorts(await pinFromImo(shipment));
}

function seedShipment(code: string) {
  return getLocalOrder(code);
}

function keepLocalRoute(prev: TrackingShipment, ocean: Partial<TrackingShipment>): TrackingShipment {
  return {
    ...prev,
    vesselName: prev.vesselName || ocean.vesselName,
    voyageNumber: prev.voyageNumber || ocean.voyageNumber,
    carrierName: prev.carrierName || ocean.carrierName,
    carrierCode: prev.carrierCode || ocean.carrierCode,
    currentPort: prev.currentPort || ocean.currentPort,
    currentCountry: prev.currentCountry || ocean.currentCountry,
    originPort: prev.originPort || ocean.originPort,
    destinationPort: prev.destinationPort || ocean.destinationPort,
    containerStatus: prev.containerStatus || ocean.containerStatus,
    eta: prev.eta || ocean.eta,
    lat: prev.lat ?? ocean.lat,
    lng: prev.lng ?? ocean.lng,
  };
}

export function TrackingDetail({ code }: { code: string }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<TrackingShipment | null>(() => seedShipment(code));
  const [error, setError] = useState("");
  const [aisPending, setAisPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const seed = seedShipment(code);
    if (seed) {
      setData(seed);
      setError("");
    } else {
      setData(null);
    }

    api
      .track(code)
      .then(async (shipment) => {
        if (cancelled) return;
        const merged = overlayLocal(shipment, code);
        setData(merged);
        if (merged.vesselImo) setAisPending(true);
        const withImo = await locateShipment(merged);
        if (cancelled) return;
        setAisPending(false);
        setData(withImo);
        if (!withImo.containerNumber) return;
        try {
          const ocean = await api.lookupOcean(withImo.containerNumber);
          if (cancelled) return;
          setData((prev) => (prev ? keepLocalRoute(prev, ocean) : prev));
        } catch {
          /* keep merged shipment */
        }
      })
      .catch(async () => {
        if (seed) {
          if (cancelled) return;
          if (seed.vesselImo) setAisPending(true);
          const withImo = await locateShipment(seed);
          if (cancelled) return;
          setAisPending(false);
          setData(withImo);
          return;
        }
        if (!cancelled) setError(t.track.notFound);
      });

    return () => {
      cancelled = true;
    };
  }, [code, t.track.notFound]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-5 pt-32 pb-24 text-center">
        <div className="rounded-3xl border border-line bg-card px-6 py-14">
          <MapPin className="mx-auto text-muted" size={30} />
          <h1 className="font-display mt-5 text-3xl">Göndəriş tapılmadı</h1>
          <p className="mt-3 text-muted">{error}</p>
          <Link href="/track" className="mt-7 inline-flex rounded-full bg-fg px-6 py-3 text-sm text-bg">Yenidən axtar</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="px-5 pt-32 pb-24 text-muted">{t.common.loading}…</div>;
  }

  const stops = normalizeTransits(data.transitPorts);
  const { items, cursor, progress } = journeyPosition(
    data.currentStatus,
    stops,
    data.currentTransitIndex,
    locale,
  );
  const currentLabel = items[cursor]?.label ?? data.currentStatus;
  const route = [data.originPort, ...stops.map((s) => s.place), data.destinationPort].filter(Boolean).join(" → ");
  const location = [data.currentPort, data.currentCountry].filter(Boolean).join(", ");
  const vessel = [data.vesselName, data.vesselImo ? `IMO ${data.vesselImo}` : ""].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-7xl px-5 pt-32 pb-24 md:px-8 md:pt-36">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-royal">{data.trackingCode}</p>
            <span className="rounded-full bg-royal/10 px-3 py-1 text-xs font-medium text-royal">{currentLabel}</span>
          </div>
          <h1 className="font-display mt-2 text-4xl md:text-5xl">
            {[data.year, data.make, data.model].filter(Boolean).join(" ") || "Avtomobiliniz"}
          </h1>
          <p className="mt-2 font-mono text-sm text-muted">VIN {data.vin}</p>
        </div>
        <div className="glass hidden items-center gap-4 rounded-2xl p-3 sm:flex">
          <div className="pl-2 text-right"><p className="text-xs text-muted">Telefonda aç</p><p className="mt-1 text-sm">QR kodu oxudun</p></div>
          <QRCodeSVG value={`${SITE.url}/track/${data.trackingCode}`} size={72} bgColor="transparent" fgColor="currentColor" />
        </div>
      </div>

      <div className="mt-10 rounded-3xl border border-line bg-card p-5 sm:p-7">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-muted">Ümumi irəliləyiş</span>
          <span className="font-medium text-royal">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-fg/10">
          <div className="h-full royal-gradient" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-royal text-white"><Navigation size={13} /></span><span>{currentLabel}</span></div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={MapPin} label="Hazırkı yer" value={location || "Dəqiqləşdirilir"} />
        <InfoCard icon={Ship} label="Gəmi" value={data.vesselName || "Təyin edilməyib"} detail={data.vesselImo ? `IMO ${data.vesselImo}` : undefined} />
        <InfoCard icon={Container} label="Konteyner" value={data.containerNumber || "Təyin edilməyib"} detail={data.carrierName} mono />
        <InfoCard icon={CalendarClock} label="Təxmini çatma" value={data.eta ? formatDate(data.eta) : "Dəqiqləşdirilir"} />
      </div>

      <ShippingNotice className="mt-6" />

      {(route || location || vessel || data.containerNumber || data.eta) && (
        <div className="mt-8 rounded-3xl border border-line bg-card p-6">
          <div className="flex items-center gap-3"><Navigation size={19} className="text-royal" /><div><h2 className="font-medium">Daşınma marşrutu</h2><p className="mt-1 text-xs text-muted">Başlanğıcdan təyinat nöqtəsinə qədər</p></div></div>
          {route ? <p className="mt-6 flex flex-wrap items-center gap-2 text-sm">{[data.originPort, ...stops.map((s) => s.place), data.destinationPort].filter(Boolean).map((place, index, all) => <span key={`${place}-${index}`} className="contents"><span className="rounded-full bg-bg px-3 py-2">{place}</span>{index < all.length - 1 && <ArrowRight size={14} className="text-muted" />}</span>)}</p> : <p className="mt-5 text-sm text-muted">Marşrut məlumatı hazırlanır.</p>}
          {aisPending && <p className="text-muted">IMO üzrə AIS mövqeyi axtarılır…</p>}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
        <section className="rounded-3xl border border-line bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3"><CarFront size={20} className="text-royal" /><div><h2 className="text-xl font-medium">Göndəriş mərhələləri</h2><p className="mt-1 text-xs text-muted">Tam status ardıcıllığı</p></div></div>
      <ol className="mt-8 space-y-0">
        {items.map((item, i) => {
          const event = item.kind === "step" ? data.events.find((e) => e.status === item.key) : undefined;
          const when = item.kind === "transit" ? item.occurredAt : event?.occurredAt;
          const done = i <= cursor;
          const current = i === cursor;
          return (
            <li key={item.id} className="grid grid-cols-[28px_1fr] gap-4">
              <div className="flex flex-col items-center">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${done ? "bg-royal text-white" : "bg-fg/10 text-muted"} ${current ? "ring-4 ring-royal/20" : ""}`}>{done ? <Check size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>
                {i < items.length - 1 && <span className={`w-px flex-1 ${done ? "bg-royal/50" : "bg-line"}`} />}
              </div>
              <div className="pb-7">
                <p className={current ? "font-medium text-royal" : done ? "text-fg/80" : "text-muted"}>{item.label}</p>
                {when ? (
                  <p className="mt-1 text-xs text-muted">{formatDate(when)}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
        </section>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-3xl border border-line bg-card">
            <div className="flex items-center justify-between p-5"><div><h2 className="font-medium">Canlı mövqe</h2><p className="mt-1 text-xs text-muted">{location || vessel || "Mövqe gözlənilir"}</p></div><MapPin size={20} className="text-royal" /></div>
            {data.lat != null && data.lng != null ? <iframe title={data.vesselName ?? t.track.location} className="h-[320px] w-full border-0" src={`https://www.openstreetmap.org/export/embed.html?bbox=${data.lng - 2.2}%2C${data.lat - 1.3}%2C${data.lng + 2.2}%2C${data.lat + 1.3}&layer=mapnik&marker=${data.lat}%2C${data.lng}`} /> : <div className="flex h-52 items-center justify-center bg-bg text-sm text-muted">Koordinatlar yenilənir</div>}
          </section>

          {(data.invoice || data.documents.length > 0) && <section className="rounded-3xl border border-line bg-card p-6"><div className="flex items-center gap-3"><FileText size={19} className="text-royal" /><h2 className="font-medium">Sənədlər və ödəniş</h2></div>{data.invoice && <div className="mt-5 rounded-2xl bg-bg p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-muted">Faktura {data.invoice.number}</span><span className="font-medium">${data.invoice.amountUsd.toLocaleString()}</span></div><p className="mt-2 text-xs text-royal">{data.invoice.status}</p></div>}<div className="mt-3 space-y-2">{data.documents.map((doc) => <a key={doc.url} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm transition hover:bg-bg"><span>{doc.title}</span><Download size={15} className="text-muted" /></a>)}</div></section>}
        </div>
      </div>

      {data.events.length > 0 && <section className="mt-8 rounded-3xl border border-line bg-card p-6 sm:p-8"><h2 className="text-xl font-medium">Yenilənmə tarixçəsi</h2><div className="mt-6 grid gap-3 md:grid-cols-2">{[...data.events].reverse().map((event, index) => <div key={`${event.occurredAt}-${index}`} className="rounded-2xl bg-bg p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{event.title}</p><time className="shrink-0 text-xs text-muted">{formatDate(event.occurredAt)}</time></div>{event.description && <p className="mt-2 text-sm leading-6 text-muted">{event.description}</p>}{(event.port || event.country) && <p className="mt-2 text-xs text-royal">{[event.port, event.country].filter(Boolean).join(", ")}</p>}</div>)}</div></section>}

      {groupPhotos(data.photos).map((group) => (
        <section key={group.key} className="mt-8 rounded-3xl border border-line bg-card p-6 sm:p-8">
          <h2 className="text-lg font-medium">{t.photoCats[group.key] ?? t.track.photos}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((p) => (
              <div key={p.url} className="relative aspect-[16/10] overflow-hidden rounded-2xl">
                {p.url.startsWith("data:") || p.url.startsWith("blob:") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={p.caption ?? ""} className="h-full w-full object-cover" />
                ) : (
                  <Image src={p.url} alt={p.caption ?? ""} fill className="object-cover" />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, detail, mono = false }: { icon: typeof MapPin; label: string; value: string; detail?: string; mono?: boolean }) {
  return <div className="rounded-3xl border border-line bg-card p-5"><div className="flex items-center gap-2 text-xs text-muted"><Icon size={16} className="text-royal" />{label}</div><p className={`mt-4 truncate text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p>{detail && <p className="mt-1 truncate text-xs text-muted">{detail}</p>}</div>;
}
