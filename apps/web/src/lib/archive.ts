export const ARCHIVE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isDelivered(status?: string) {
  return status === "DELIVERED";
}

export function archiveDeadline(deliveredAt?: string) {
  if (!deliveredAt) return null;
  const start = new Date(deliveredAt).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(start + ARCHIVE_DAYS * DAY_MS);
}

export function isArchiveExpired(order: { currentStatus: string; deliveredAt?: string; trackingCode?: string }) {
  if (!isDelivered(order.currentStatus)) return false;
  const end = archiveDeadline(order.deliveredAt);
  if (!end) return false;
  return Date.now() > end.getTime();
}

export function daysLeftInArchive(deliveredAt?: string) {
  const end = archiveDeadline(deliveredAt);
  if (!end) return ARCHIVE_DAYS;
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY_MS));
}

export function normalizeTrackingCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}
