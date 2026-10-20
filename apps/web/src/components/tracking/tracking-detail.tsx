"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { SITE, TRACKING_STEPS, isLiveVesselMapStatus } from "@/lib/constants";
import type { TrackingShipment } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { findPortCoords } from "@/lib/carriers";
import { isValidImo } from "@/lib/imo";
import { useI18n } from "@/providers/i18n-provider";
import { getLocalOrder, overlayLocal } from "@/lib/local-orders";
import { PhotoCatalog } from "@/components/tracking/photo-catalog";
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

function withManualPin(shipment: TrackingShipment): TrackingShipment {
  if (shipment.lat != null && shipment.lng != null) return shipment;
  if (shipment.mapLat != null && shipment.mapLng != null) {
    return { ...shipment, lat: shipment.mapLat, lng: shipment.mapLng };
  }
  return shipment;
}

async function pinFromImo(shipment: TrackingShipment): Promise<TrackingShipment> {
  const imo = isValidImo(shipment.vesselImo);
  if (!imo) return withManualPin(shipment);
  try {
    const pos = await api.vesselByImo(imo, {
      lat: shipment.lat ?? shipment.mapLat,
      lng: shipment.lng ?? shipment.mapLng,
    });
    const name = pos?.name?.trim() || shipment.vesselName;
    if (!pos?.hasCoordinates || pos.latitude == null || pos.longitude == null) {
      return withManualPin({ ...shipment, vesselName: name, vesselImo: shipment.vesselImo || imo });
    }
    return {
      ...shipment,
      lat: pos.latitude,
      lng: pos.longitude,
      vesselName: name,
      vesselImo: shipment.vesselImo || (pos.imo ? String(pos.imo) : imo),
    };
  } catch {
    return withManualPin(shipment);
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
  const seeded = withManualPin(shipment);
  if (isValidImo(seeded.vesselImo) && isLiveVesselMapStatus(seeded.currentStatus)) {
    const live = await pinFromImo(seeded);
    if (live.lat != null && live.lng != null) return live;
    return pinFromPorts(withManualPin(live));
  }
  if (seeded.mapLat != null && seeded.mapLng != null) return seeded;
  return pinFromPorts({ ...seeded, lat: undefined, lng: undefined });
}

async function refreshImoUntilPinned(
  shipment: TrackingShipment,
  onUpdate: (next: TrackingShipment) => void,
  cancelled: () => boolean,
) {
  let current = withManualPin(shipment);
  if (cancelled()) return current;
  onUpdate(current);
  current = await locateShipment(current);
  if (cancelled()) return current;
  onUpdate(current);
  const waitingAis =
    Boolean(isValidImo(current.vesselImo)) &&
    isLiveVesselMapStatus(current.currentStatus) &&
    current.mapLat != null &&
    current.lat === current.mapLat;
  if (!isValidImo(current.vesselImo) || !isLiveVesselMapStatus(current.currentStatus)) return current;
  if (current.lat != null && !waitingAis) return current;
  for (let i = 0; i < 12 && !cancelled(); i++) {
    await new Promise((r) => setTimeout(r, 5000));
    if (cancelled()) return current;
    const next = await pinFromImo(current);
    if (next.lat != null && next.lng != null) {
      current = next;
      onUpdate(current);
      if (current.mapLat == null || current.lat !== current.mapLat) break;
    }
  }
  return withManualPin(current);
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
    lat:
      prev.vesselImo && isLiveVesselMapStatus(prev.currentStatus)
        ? (prev.lat ?? prev.mapLat)
        : (prev.lat ?? ocean.lat),
    lng:
      prev.vesselImo && isLiveVesselMapStatus(prev.currentStatus)
        ? (prev.lng ?? prev.mapLng)
        : (prev.lng ?? ocean.lng),
  };
}

function arrivalText(shipment: TrackingShipment, pending: string, locale: "az" | "en" | "ru" | "tr") {
  if (shipment.currentStatus === "DELIVERED") {
    return TRACKING_STEPS.find((step) => step.key === "DELIVERED")?.[locale] ?? pending;
  }
  return shipment.eta ? formatDate(shipment.eta) : pending;
}

export function TrackingDetail({ code }: { code: string }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<TrackingShipment | null>(null);
  const [error, setError] = useState("");
  const [aisPending, setAisPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");

    api
      .track(code)
      .catch(() => {
        const local = getLocalOrder(code);
        if (!local) throw new Error("not-found");
        return local;
      })
      .then(async (shipment) => {
        if (cancelled) return;
        const merged = withManualPin(overlayLocal(shipment, code));
        setData(merged);
        setError("");
        if (merged.vesselImo && isLiveVesselMapStatus(merged.currentStatus) && merged.mapLat == null) {
          setAisPending(true);
        }
        const withImo = await refreshImoUntilPinned(merged, (next) => setData(next), () => cancelled);
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
      .catch(() => {
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
          <h1 className="font-display mt-5 text-3xl">{t.track.notFoundTitle}</h1>
          <p className="mt-3 text-muted">{error}</p>
          <Link href="/track" className="mt-7 inline-flex rounded-full bg-fg px-6 py-3 text-sm text-bg">{t.track.searchAgain}</Link>
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
    data.destinationPort,
  );
  const currentLabel = items[cursor]?.label ?? data.currentStatus;
  const route = [data.originPort, ...stops.map((s) => s.place), data.destinationPort].filter(Boolean).join(" → ");
  const location = [data.currentPort, data.currentCountry].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 pb-16 sm:px-6 md:px-8 md:pt-36">
      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1 text-sm" aria-label={t.track.title}>
        <a href="#shipment-status" className="shrink-0 rounded-full bg-royal px-4 py-3 font-medium text-white">{t.track.status}</a>
        {data.photos?.length ? <a href="#shipment-photos" className="shrink-0 rounded-full border border-line px-4 py-3">{t.track.photos} · {data.photos.length}</a> : null}
        <a href="#shipment-route" className="shrink-0 rounded-full border border-line px-4 py-3">{t.track.progress}</a>
        {(data.invoice || data.documents.length > 0) ? <a href="#shipment-documents" className="shrink-0 rounded-full border border-line px-4 py-3">{t.track.documents}</a> : null}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-royal">{data.trackingCode}</p>
            <span className="rounded-full bg-royal/10 px-3 py-1 text-xs font-medium text-royal">{currentLabel}</span>
            {data.contract?.status && data.contract.status !== "NONE" ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  data.contract.signed ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-800"
                }`}
              >
                {data.contract.signed ? t.track.contractSigned : t.track.contractUnsigned}
              </span>
            ) : null}
          </div>
          <h1 className="font-display mt-3 text-2xl leading-tight sm:text-4xl md:text-5xl">
            {[data.year, data.make, data.model].filter(Boolean).join(" ") || t.track.yourCar}
            {data.hasInsurance || data.insurance?.status ? (
              <Link href={`/insurance/${data.trackingCode}`} className="ml-3 text-sm font-normal text-royal">
                {t.track.insurance}
              </Link>
            ) : null}
          </h1>
          <p className="mt-2 break-all font-mono text-xs text-muted sm:text-sm">VIN {data.vin}</p>
        </div>
        <div className="glass hidden items-center gap-4 rounded-2xl p-3 sm:flex">
          <div className="pl-2 text-right"><p className="text-xs text-muted">{t.track.openPhone}</p><p className="mt-1 text-sm">{t.track.scanQr}</p></div>
          <QRCodeSVG value={`${SITE.url}/track/${data.trackingCode}`} size={72} bgColor="transparent" fgColor="currentColor" />
        </div>
      </div>

      <section id="shipment-status" className="mt-6 scroll-mt-28 rounded-3xl border border-royal/25 bg-card p-5 sm:p-7">
        <div className="mb-5 flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-royal/10 text-royal"><CarFront size={23} /></span><div className="min-w-0"><p className="text-xs text-muted">{t.track.status}</p><h2 className="mt-1 text-xl font-semibold text-royal">{currentLabel}</h2><p className="mt-1 text-sm text-muted">{location || t.track.pending}</p></div></div>
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-muted">{t.track.progressLabel}</span>
          <span className="font-medium text-royal">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-fg/10">
          <div className="h-full royal-gradient" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <div><p className="flex items-center gap-2 text-xs text-muted"><CalendarClock size={16} />{t.track.eta}</p><p className="mt-2 text-xl font-semibold">{arrivalText(data, t.track.pending, locale)}</p>{data.currentStatus !== 'DELIVERED' && <p className="mt-2 text-xs leading-5 text-muted">{t.track.etaHint}</p>}</div>
          <div><p className="text-xs text-muted">{t.track.destination}</p><p className="mt-2 font-medium">{data.destinationPort || t.track.pending}</p>{items[cursor + 1] && <p className="mt-2 flex items-center gap-2 text-sm text-muted"><ArrowRight size={15} className="shrink-0" />{items[cursor + 1].label}</p>}</div>
        </div>
      </section>

      <div id="shipment-photos" className="scroll-mt-28">
        <PhotoCatalog photos={data.photos ?? []} />
      </div>

        <div id="shipment-route" className="mt-6 scroll-mt-28 rounded-3xl border border-line bg-card p-5 sm:p-6">
          <div className="flex items-center gap-3"><Navigation size={19} className="text-royal" /><div><h2 className="font-medium">{t.track.routeTitle}</h2><p className="mt-1 text-xs text-muted">{t.track.routeSub}</p></div></div>
          {route ? <p className="mt-6 flex flex-wrap items-center gap-2 text-sm">{[data.originPort, ...stops.map((s) => s.place), data.destinationPort].filter(Boolean).map((place, index, all) => <span key={`${place}-${index}`} className="contents"><span className="rounded-full bg-bg px-3 py-2">{place}</span>{index < all.length - 1 && <ArrowRight size={14} className="text-muted" />}</span>)}</p> : <p className="mt-5 text-sm text-muted">{t.track.routePending}</p>}
          {aisPending && <p className="mt-3 text-sm text-muted">{t.track.aisPending}</p>}
        </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <section className="min-w-0 rounded-3xl border border-line bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-3 font-semibold"><CarFront size={20} className="text-royal" />{t.track.stagesTitle}</h2>
          <ol className="mt-5 space-y-3">{items.slice(Math.max(0, cursor - 1), cursor + 2).map((item) => {
            const index = items.indexOf(item);
            return <li key={item.id} className={`flex items-center gap-3 rounded-xl p-3 text-sm ${index === cursor ? 'bg-royal/10 font-semibold text-royal' : 'bg-bg text-muted'}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current">{index < cursor ? <Check size={15} /> : index === cursor ? <Navigation size={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>{item.label}</li>;
          })}</ol>
          <details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer py-2 text-sm font-medium text-royal">{t.track.stagesSub}</summary>
      <ol className="mt-5 space-y-0">
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
          </details>
        </section>

        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-3xl border border-line bg-card">
            <div className="flex items-center justify-between p-5"><div><h2 className="font-medium">{t.track.liveTitle}</h2><p className="mt-1 text-xs text-muted">{location || t.track.livePending}</p></div><MapPin size={20} className="text-royal" /></div>
            {data.lat != null && data.lng != null ? <iframe loading="lazy" title={data.vesselName ?? t.track.location} className="h-[240px] w-full border-0 sm:h-[300px]" src={`https://www.openstreetmap.org/export/embed.html?bbox=${data.lng - 2.2}%2C${data.lat - 1.3}%2C${data.lng + 2.2}%2C${data.lat + 1.3}&layer=mapnik&marker=${data.lat}%2C${data.lng}`} /> : <p className="px-5 pb-5 text-sm text-muted">{t.track.coordsPending}</p>}
            {(data.vesselName || data.containerNumber || data.vesselImo) && <details className="border-t border-line p-5"><summary className="cursor-pointer text-sm text-royal">{t.track.vessel} · {t.track.container}</summary><div className="mt-4 space-y-3 text-sm">{data.vesselName && <p className="flex items-center gap-2 break-words"><Ship size={16} className="shrink-0 text-muted" />{data.vesselName}</p>}{data.containerNumber && <p className="flex items-center gap-2 break-all font-mono"><Container size={16} className="shrink-0 text-muted" />{data.containerNumber}</p>}{data.vesselImo && <p className="text-xs text-muted">IMO {data.vesselImo}</p>}{data.carrierName && <p className="text-muted">{data.carrierName}</p>}</div></details>}
          </section>

          {(data.invoice || data.documents.length > 0) && <section id="shipment-documents" className="scroll-mt-28 rounded-3xl border border-line bg-card p-5"><div className="flex items-center gap-3"><FileText size={19} className="text-royal" /><h2 className="font-medium">{t.track.docsTitle}</h2></div>{data.invoice && <div className="mt-5 rounded-2xl bg-bg p-4 text-sm"><div className="flex flex-wrap justify-between gap-3"><span className="break-all text-muted">{t.track.invoice} {data.invoice.number}</span><span className="font-medium">${data.invoice.amountUsd.toLocaleString()}</span></div><p className="mt-2 text-xs text-royal">{data.invoice.status}</p></div>}<div className="mt-3 space-y-2">{data.documents.map((doc) => <a key={doc.url} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-4 text-sm transition hover:bg-bg"><span className="min-w-0 break-words">{doc.title}</span><Download size={17} className="shrink-0 text-muted" /></a>)}</div></section>}
        </div>
      </div>

      <details className="mt-6 rounded-2xl border border-line p-4"><summary className="cursor-pointer text-sm text-muted">{t.track.etaHint}</summary><ShippingNotice className="mt-4" /></details>
    </div>
  );
}
