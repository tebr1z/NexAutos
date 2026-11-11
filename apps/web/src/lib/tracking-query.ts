/** Normalize a complete tracking code, VIN or auction lot without fuzzy matching. */
export function normalizeTrackingQuery(raw: string) {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(raw)) return "";
  const value = raw.trim().toUpperCase().replace(/\s+/g, "");
  return value.length <= 100 ? value : "";
}

export function trackingSearchPath(raw: string) {
  const query = normalizeTrackingQuery(raw);
  return query ? `/track/${encodeURIComponent(query)}` : "/track";
}

/** A VIN is a public alias, so it must never select private browser order data. */
export function isFullVinQuery(raw: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(normalizeTrackingQuery(raw));
}
