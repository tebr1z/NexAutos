import { isArchiveExpired } from "./archive";
import { normalizeTransits } from "./journey";
import type { TrackingShipment } from "./types";

const KEY = "anx_local_orders";

export function listLocalOrders(): TrackingShipment[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const rows = parsed.filter((row): row is TrackingShipment => !!row && typeof row === "object" && typeof row.trackingCode === "string" && !!row.trackingCode.trim() && typeof row.vin === "string");
    const kept = rows.filter((row) => !isArchiveExpired(row));
    const normalized = kept.map((row) => ({ ...row, transitPorts: normalizeTransits(row.transitPorts) }));
    if (kept.length !== rows.length) localStorage.setItem(KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

/** Empty string means admin cleared IMO; otherwise keep a 7-digit code. */
export function pickImo(preferred?: string | null, fallback?: string | null) {
  if (preferred === "") return undefined;
  const a = (preferred ?? "").replace(/\D/g, "");
  const b = (fallback ?? "").replace(/\D/g, "");
  if (a.length === 7) return a;
  if (b.length === 7) return b;
  return a || b || undefined;
}

/** Persisted API fields are authoritative, including deliberately cleared arrays. */
export function mergeRemotePreserveLocal(
  local: TrackingShipment | undefined,
  remote: TrackingShipment,
): TrackingShipment {
  if (!local) return remote;
  return {
    ...remote,
    id: remote.id ?? local.id,
    photos: remote.photos ?? local.photos,
    transitPorts: normalizeTransits(remote.transitPorts ?? local.transitPorts),
    currentTransitIndex: remote.currentTransitIndex ?? -1,
    events: remote.events ?? local.events,
  };
}

/** A successful public fetch must never be overwritten by stale admin browser data. */
export function overlayLocal(remote: TrackingShipment, code: string): TrackingShipment {
  void code;
  return { ...remote, transitPorts: normalizeTransits(remote.transitPorts) };
}

export function getLocalOrder(code: string) {
  const raw = code.toUpperCase();
  const hit = listLocalOrders().find((o) => o.trackingCode.toUpperCase() === raw) ?? null;
  if (hit && isArchiveExpired(hit)) return null;
  return hit;
}

export function saveLocalOrder(order: TrackingShipment) {
  const next = [order, ...listLocalOrders().filter((o) => o.trackingCode !== order.trackingCode)];
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function replaceLocalOrder(oldCode: string, order: TrackingShipment) {
  const next = [
    order,
    ...listLocalOrders().filter((o) => o.trackingCode !== oldCode && o.trackingCode !== order.trackingCode),
  ];
  localStorage.setItem(KEY, JSON.stringify(next));
  return order;
}

export function updateLocalOrder(code: string, patch: Partial<TrackingShipment>) {
  const current = getLocalOrder(code);
  if (!current) return null;
  const next = { ...current, ...patch };
  if (patch.trackingCode && patch.trackingCode !== current.trackingCode) {
    return replaceLocalOrder(current.trackingCode, next);
  }
  saveLocalOrder(next);
  return next;
}
