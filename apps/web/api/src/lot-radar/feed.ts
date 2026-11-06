import { documentKind, type RadarFilters, type RadarLot, safeLotUrl } from './lot';
// Server-side adapter for an inventory source the operator is authorized to use.
// Credentials and URL never come from a customer's request.
export function parseRadarFeed(raw: unknown): RadarLot[] {
  const body = raw as { complete?: boolean; lots?: unknown[] };
  if (!body || body.complete !== true || !Array.isArray(body.lots) || body.lots.length > 200) throw new Error('Inventar mənbəsi tam və etibarlı nəticə qaytarmadı.');
  return body.lots.map(value => {
    const v = value as Record<string, unknown>;
    const url = safeLotUrl(String(v?.url || ''));
    if (!url || !['title','make','model'].every(k => typeof v[k] === 'string' && String(v[k]).length > 0 && String(v[k]).length <= 200) || !Number.isInteger(v.year) || Number(v.year) < 1950 || Number(v.year) > 2100 || typeof v.active !== 'boolean') throw new Error('Inventar lotunun əsas məlumatı düzgün deyil.');
    const engine = v.engineCc == null ? null : Number(v.engineCc);
    if (engine != null && (!Number.isInteger(engine) || engine < 0 || engine > 20000)) throw new Error('Inventarda mühərrik həcmi düzgün deyil.');
    let auctionAt: string | undefined;
    if (v.auctionAt) {
      if (typeof v.auctionAt !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(v.auctionAt) || !Number.isFinite(Date.parse(v.auctionAt))) throw new Error('Hərrac vaxtının saat qurşağı göstərilməyib.');
      auctionAt = new Date(v.auctionAt).toISOString();
    }
    const document = String(v.document || '').slice(0, 150);
    return { key: url.match(/\/lot\/([01]-\d+)/)![1], url, title: String(v.title), make: String(v.make), model: String(v.model), year: Number(v.year), engineCc: engine, primaryDamage: String(v.primaryDamage || '').slice(0, 100), secondaryDamage: String(v.secondaryDamage || '').slice(0, 100), document, documentKind: documentKind(document), active: v.active, auctionAt, auctionTimeText: String(v.auctionTimeText || '').slice(0, 120) || undefined };
  });
}
export async function fetchRadarFeed(filters: RadarFilters) {
  const endpoint = new URL(process.env.LOT_RADAR_FEED_URL!);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error('İnventar mənbə ünvanı HTTPS olmalıdır.');
  const response = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25000), headers: { 'Content-Type': 'application/json', ...(process.env.LOT_RADAR_FEED_TOKEN ? { Authorization: `Bearer ${process.env.LOT_RADAR_FEED_TOKEN}` } : {}) }, body: JSON.stringify({ filters, limit: 200 }) });
  if (!response.ok) throw new Error(`İnventar mənbəsi cavab vermədi (${response.status}).`);
  return parseRadarFeed(await response.json());
}
