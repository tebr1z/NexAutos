import { isArchiveExpired } from "./archive";
import { normalizeTransits } from "./journey";
import type { TrackingShipment, TransitStop } from "./types";

const KEY = "anx_local_orders";

export function listLocalOrders(): TrackingShipment[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) ?? "[]") as TrackingShipment[];
    const kept = rows.filter((row) => !isArchiveExpired(row));
    const normalized = kept.map((row) => ({ ...row, transitPorts: normalizeTransits(row.transitPorts) }));
    if (kept.length !== rows.length) localStorage.setItem(KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

function pickTransits(local?: TransitStop[], remote?: TransitStop[]) {
  const localTransits = normalizeTransits(local);
  const remoteTransits = normalizeTransits(remote);
  const useLocal = localTransits.length >= remoteTransits.length;
  return {
    transitPorts: useLocal ? localTransits : remoteTransits,
    useLocal,
  };
}

/** Remote list fetch: keep local transits/photos if the API has none. */
export function mergeRemotePreserveLocal(
  local: TrackingShipment | undefined,
  remote: TrackingShipment,
): TrackingShipment {
  if (!local) return remote;
  const picked = pickTransits(local.transitPorts, remote.transitPorts);
  return {
    ...local,
    ...remote,
    id: remote.id ?? local.id,
    photos: local.photos?.length ? local.photos : remote.photos,
    transitPorts: picked.transitPorts,
    currentTransitIndex: picked.useLocal
      ? (local.currentTransitIndex ?? -1)
      : (remote.currentTransitIndex ?? local.currentTransitIndex ?? -1),
    customerPhone: remote.customerPhone || local.customerPhone,
    events: (local.events?.length ?? 0) >= (remote.events?.length ?? 0) ? local.events : remote.events,
  };
}

/** Track page: local admin edits (especially transits) win over an empty API row. */
export function overlayLocal(remote: TrackingShipment, code: string): TrackingShipment {
  const local = getLocalOrder(code);
  if (!local) return { ...remote, transitPorts: normalizeTransits(remote.transitPorts) };
  const picked = pickTransits(local.transitPorts, remote.transitPorts);
  return {
    ...remote,
    ...local,
    id: remote.id ?? local.id,
    photos: local.photos?.length ? local.photos : remote.photos,
    transitPorts: picked.transitPorts,
    currentTransitIndex: picked.useLocal
      ? (local.currentTransitIndex ?? -1)
      : (remote.currentTransitIndex ?? local.currentTransitIndex),
    events: (local.events?.length ?? 0) >= (remote.events?.length ?? 0) ? local.events : remote.events,
  };
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
