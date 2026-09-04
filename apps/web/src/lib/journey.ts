import { TRACKING_STEPS, type Locale, type ShipmentStatus } from "@/lib/constants";
import type { TransitStop } from "@/lib/types";

export type JourneyItem =
  | { id: string; kind: "step"; key: ShipmentStatus; label: string; occurredAt?: string }
  | { id: string; kind: "transit"; index: number; place: string; label: string; occurredAt?: string };

function asStop(item: unknown): TransitStop | null {
  if (typeof item === "string") {
    const place = item.trim();
    return place ? { place } : null;
  }
  if (item && typeof item === "object") {
    const row = item as { place?: unknown; name?: unknown; occurredAt?: unknown };
    const place = String(row.place ?? row.name ?? "").trim();
    if (!place) return null;
    const occurredAt = typeof row.occurredAt === "string" && row.occurredAt.trim() ? row.occurredAt : undefined;
    return { place, occurredAt };
  }
  return null;
}

export function normalizeTransits(value: unknown): TransitStop[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(asStop).filter((row): row is TransitStop => !!row);
  }
  if (typeof value === "object" && Array.isArray((value as { stops?: unknown }).stops)) {
    return normalizeTransits((value as { stops: unknown }).stops);
  }
  return [];
}

export function parseTransitRoute(value: unknown): { stops: TransitStop[]; currentIndex: number } {
  if (Array.isArray(value)) {
    return { stops: normalizeTransits(value), currentIndex: -1 };
  }
  if (value && typeof value === "object") {
    const row = value as { stops?: unknown; currentIndex?: unknown };
    const currentIndex = Number(row.currentIndex);
    return {
      stops: normalizeTransits(row.stops),
      currentIndex: Number.isFinite(currentIndex) ? currentIndex : -1,
    };
  }
  return { stops: [], currentIndex: -1 };
}

export function transitLabel(place: string, locale: string) {
  const p = place.trim();
  if (locale === "en") return `Transit ${p}`;
  if (locale === "ru") return `Транзит ${p}`;
  if (locale === "tr") return `Transit ${p}`;
  return `Tranzit ${p}`;
}

export function buildJourney(transits: unknown, locale: Locale): JourneyItem[] {
  const stops = normalizeTransits(transits);
  const items: JourneyItem[] = [];
  for (const step of TRACKING_STEPS) {
    items.push({ id: `step:${step.key}`, kind: "step", key: step.key, label: step[locale] });
    if (step.key === "IN_TRANSIT") {
      stops.forEach((stop, index) => {
        items.push({
          id: `transit:${index}`,
          kind: "transit",
          index,
          place: stop.place,
          label: transitLabel(stop.place, locale),
          occurredAt: stop.occurredAt,
        });
      });
    }
  }
  return items;
}

export function journeyPosition(
  status: ShipmentStatus,
  transits: unknown,
  currentTransitIndex = -1,
  locale: Locale = "az",
) {
  const items = buildJourney(transits, locale);
  const inTransit = TRACKING_STEPS.findIndex((s) => s.key === "IN_TRANSIT");
  const stepIndex = TRACKING_STEPS.findIndex((s) => s.key === status);
  let cursor = 0;
  if (status === "IN_TRANSIT") {
    const transitPos = items.findIndex(
      (item) => item.kind === "transit" && item.index === Math.max(currentTransitIndex, -1),
    );
    if (currentTransitIndex >= 0 && transitPos >= 0) cursor = transitPos;
    else cursor = items.findIndex((item) => item.kind === "step" && item.key === "IN_TRANSIT");
  } else if (stepIndex > inTransit) {
    cursor = items.findIndex((item) => item.kind === "step" && item.key === status);
  } else {
    cursor = Math.max(stepIndex, 0);
  }
  if (cursor < 0) cursor = 0;
  const progress = items.length ? ((cursor + 1) / items.length) * 100 : 0;
  return { items, cursor, progress };
}

export function selectedJourneyValue(status: ShipmentStatus, currentTransitIndex = -1) {
  if (status === "IN_TRANSIT" && currentTransitIndex >= 0) return `transit:${currentTransitIndex}`;
  return `step:${status}`;
}
