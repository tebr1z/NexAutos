import { generateTrackingCode } from "./tracking-code";

export { generateTrackingCode };

export function parseTransitRoute(value: unknown): {
  stops: { place: string; occurredAt?: string }[];
  currentIndex: number;
} {
  function asStop(item: unknown): { place: string; occurredAt?: string } | null {
    if (typeof item === 'string') {
      const place = item.trim();
      return place ? { place } : null;
    }
    if (item && typeof item === 'object') {
      const row = item as { place?: unknown; name?: unknown; occurredAt?: unknown };
      const place = String(row.place ?? row.name ?? '').trim();
      if (!place) return null;
      const occurredAt =
        typeof row.occurredAt === 'string' && row.occurredAt.trim() ? row.occurredAt : undefined;
      return { place, occurredAt };
    }
    return null;
  }

  function stopsOf(raw: unknown) {
    if (!Array.isArray(raw)) return [];
    return raw.map(asStop).filter((row): row is { place: string; occurredAt?: string } => !!row);
  }

  if (Array.isArray(value)) {
    return { stops: stopsOf(value), currentIndex: -1 };
  }
  if (value && typeof value === 'object') {
    const row = value as { stops?: unknown; currentIndex?: unknown };
    const currentIndex = Number(row.currentIndex);
    return {
      stops: stopsOf(row.stops),
      currentIndex: Number.isFinite(currentIndex) ? currentIndex : -1,
    };
  }
  return { stops: [], currentIndex: -1 };
}

export function mapOrder(order: {
  id?: string;
  trackingCode: string;
  vin: string;
  auctionHouse: string;
  containerNumber: string | null;
  carrierCode?: string | null;
  carrierName?: string | null;
  vesselName?: string | null;
  vesselImo?: string | null;
  voyageNumber?: string | null;
  carrierTrackingUrl?: string | null;
  containerStatus?: string | null;
  originPort: string | null;
  destinationPort: string | null;
  currentCountry: string | null;
  currentPort: string | null;
  mapLat?: number | null;
  mapLng?: number | null;
  transitPorts?: unknown;
  eta: Date | null;
  currentStatus: string;
  deliveredAt?: Date | null;
  adminNotes: string | null;
  customer: { name: string; phone?: string | null };
  vehicle: { make: string | null; model: string | null; year: number | null } | null;
  events: {
    status: string;
    title: string;
    description: string | null;
    country: string | null;
    port: string | null;
    occurredAt: Date;
  }[];
  documents: { title: string; type: string; url: string }[];
  photos: { id?: string; url: string; caption: string | null; category?: string | null }[];
  invoices: { number: string; amountUsd: unknown; status: string }[];
  insuranceFirstName?: string | null;
  insuranceLastName?: string | null;
  insuranceDocSeries?: string | null;
  insuranceTrustee?: string | null;
  insuranceStatus?: string | null;
  insuranceNotifiedAt?: Date | null;
}) {
  const invoice = order.invoices[0];
  return {
    id: order.id,
    trackingCode: order.trackingCode,
    vin: order.vin,
    make: order.vehicle?.make,
    model: order.vehicle?.model,
    year: order.vehicle?.year,
    auctionHouse: order.auctionHouse,
    containerNumber: order.containerNumber,
    carrierCode: order.carrierCode ?? undefined,
    carrierName: order.carrierName ?? undefined,
    vesselName: order.vesselName ?? undefined,
    vesselImo: order.vesselImo ?? undefined,
    voyageNumber: order.voyageNumber ?? undefined,
    carrierTrackingUrl: order.carrierTrackingUrl ?? undefined,
    containerStatus: order.containerStatus ?? undefined,
    originPort: order.originPort,
    destinationPort: order.destinationPort,
    currentCountry: order.currentCountry,
    currentPort: order.currentPort,
    mapLat: order.mapLat ?? undefined,
    mapLng: order.mapLng ?? undefined,
    lat: order.mapLat ?? undefined,
    lng: order.mapLng ?? undefined,
    transitPorts: parseTransitRoute(order.transitPorts).stops,
    currentTransitIndex: parseTransitRoute(order.transitPorts).currentIndex,
    eta: order.eta?.toISOString(),
    currentStatus: order.currentStatus,
    deliveredAt: order.deliveredAt?.toISOString(),
    customerName: order.customer.name,
    customerPhone: order.customer.phone || undefined,
    adminNotes: order.adminNotes,
    events: order.events.map((e) => ({
      status: e.status,
      title: e.title,
      description: e.description,
      country: e.country,
      port: e.port,
      occurredAt: e.occurredAt.toISOString(),
    })),
    documents: order.documents,
    photos: order.photos.map((p) => {
      const id = "id" in p ? String((p as { id: string }).id) : "";
      const raw = String(p.url || "");
      return {
        id: id || undefined,
        url: id && (raw.startsWith("data:image/") || raw.startsWith("r2:"))
          ? `/api/v1/media/photos/${id}`
          : raw,
        caption: p.caption,
        category: p.category ?? undefined,
      };
    }),
    invoice: invoice
      ? { number: invoice.number, amountUsd: Number(invoice.amountUsd), status: invoice.status }
      : undefined,
    insurance: {
      firstName: order.insuranceFirstName || undefined,
      lastName: order.insuranceLastName || undefined,
      docSeries: order.insuranceDocSeries || undefined,
      trustee: order.insuranceTrustee || undefined,
      status: order.insuranceStatus || undefined,
      notifiedAt: order.insuranceNotifiedAt?.toISOString(),
    },
  };
}

export const ORDER_INCLUDE = {
  customer: true,
  vehicle: true,
  events: { orderBy: { occurredAt: 'asc' as const } },
  documents: true,
  photos: true,
  invoices: true,
};
