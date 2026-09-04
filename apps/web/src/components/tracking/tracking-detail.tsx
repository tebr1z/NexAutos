"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
      <div className="mx-auto max-w-2xl px-5 pt-32 pb-24">
        <p className="text-muted">{error}</p>
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
    <div className="mx-auto max-w-3xl px-5 pt-32 pb-24 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-sm text-royal">{data.trackingCode}</p>
          <h1 className="font-display mt-2 text-4xl md:text-5xl">
            {data.year} {data.make} {data.model}
          </h1>
          <p className="mt-2 text-muted">VIN {data.vin}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <QRCodeSVG value={`${SITE.url}/track/${data.trackingCode}`} size={96} bgColor="transparent" fgColor="currentColor" />
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-2 flex justify-between text-sm">
          <span>{t.track.status}</span>
          <span className="text-royal">{currentLabel}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-fg/10">
          <div className="h-full royal-gradient" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ShippingNotice className="mt-8" />

      {(route || location || vessel || data.containerNumber || data.eta) && (
        <div className="mt-8 space-y-2 text-sm">
          {route && <p>{route}</p>}
          {location && <p className="text-muted">{t.track.location}: {location}</p>}
          {vessel && <p className="text-muted">{vessel}</p>}
          {data.containerNumber && (
            <p className="font-mono text-muted">
              {t.track.container} {data.containerNumber}
            </p>
          )}
          {data.eta && (
            <p className="text-muted">
              {t.track.eta}: {formatDate(data.eta)}
            </p>
          )}
          {aisPending && <p className="text-muted">IMO üzrə AIS mövqeyi axtarılır…</p>}
        </div>
      )}

      {data.lat != null && data.lng != null && (
        <iframe
          title={data.vesselName ?? t.track.location}
          className="mt-8 h-[280px] w-full rounded-2xl border-0"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${data.lng - 2.2}%2C${data.lat - 1.3}%2C${data.lng + 2.2}%2C${data.lat + 1.3}&layer=mapnik&marker=${data.lat}%2C${data.lng}`}
        />
      )}

      <ol className="mt-14 space-y-0">
        {items.map((item, i) => {
          const event = item.kind === "step" ? data.events.find((e) => e.status === item.key) : undefined;
          const when = item.kind === "transit" ? item.occurredAt : event?.occurredAt;
          const done = i <= cursor;
          const current = i === cursor;
          return (
            <li key={item.id} className="grid grid-cols-[28px_1fr] gap-4">
              <div className="flex flex-col items-center">
                <span className={`h-3 w-3 rounded-full ${done ? "bg-royal" : "bg-fg/20"} ${current ? "ring-4 ring-royal/25" : ""}`} />
                {i < items.length - 1 && <span className={`w-px flex-1 ${done ? "bg-royal/50" : "bg-line"}`} />}
              </div>
              <div className="pb-8">
                <p className={current ? "text-fg" : done ? "text-fg/80" : "text-muted"}>{item.label}</p>
                {when ? (
                  <p className="mt-1 text-xs text-muted">{formatDate(when)}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {groupPhotos(data.photos).map((group) => (
        <div key={group.key} className="mt-10">
          <h2 className="text-sm uppercase tracking-widest text-muted">{t.photoCats[group.key] ?? t.track.photos}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
        </div>
      ))}
    </div>
  );
}
