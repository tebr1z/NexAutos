const WIKIDATA = 'https://query.wikidata.org/sparql';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const UA = 'AutoNex/1.0 (shipment tracking; https://nex.autos)';

const imoCache = new Map<string, { at: number; hit: { mmsi: string; name: string | null } | null }>();
const IMO_CACHE_MS = 24 * 60 * 60_000;

function nineDigit(raw: unknown): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length === 9 ? digits : null;
}

async function timedJson(url: string, headers: Record<string, string>, ms = 12_000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mmsiFromSparql(imo: string): Promise<{ mmsi: string; name: string | null } | null> {
  const query = `SELECT ?mmsi ?shipLabel WHERE {
    ?ship wdt:P458 "${imo}".
    OPTIONAL { ?ship wdt:P587 ?mmsi. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } LIMIT 5`;
  const url = `${WIKIDATA}?format=json&query=${encodeURIComponent(query)}`;
  const json = (await timedJson(url, {
    Accept: 'application/sparql-results+json',
    'User-Agent': UA,
  })) as { results?: { bindings?: Array<{ mmsi?: { value?: string }; shipLabel?: { value?: string } }> } } | null;
  const rows = json?.results?.bindings ?? [];
  for (const row of rows) {
    const mmsi = nineDigit(row.mmsi?.value);
    if (mmsi) return { mmsi, name: row.shipLabel?.value?.trim() || null };
  }
  const name = rows[0]?.shipLabel?.value?.trim() || null;
  return name ? { mmsi: '', name } : null;
}

async function mmsiFromWikidataApi(imo: string): Promise<{ mmsi: string; name: string | null } | null> {
  const searchUrl =
    `${WIKIDATA_API}?action=query&format=json&list=search&srlimit=5` +
    `&srsearch=${encodeURIComponent(`haswbstatement:P458=${imo}`)}`;
  const search = (await timedJson(searchUrl, { Accept: 'application/json', 'User-Agent': UA })) as {
    query?: { search?: Array<{ title?: string }> };
  } | null;
  const ids = (search?.query?.search ?? []).map((row) => row.title).filter(Boolean) as string[];
  if (!ids.length) return null;
  const getUrl =
    `${WIKIDATA_API}?action=wbgetentities&format=json&props=labels|claims&languages=en&ids=${ids.slice(0, 3).join('|')}`;
  const entities = (await timedJson(getUrl, { Accept: 'application/json', 'User-Agent': UA })) as {
    entities?: Record<string, { labels?: { en?: { value?: string } }; claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> }>;
  } | null;
  for (const entity of Object.values(entities?.entities ?? {})) {
    const imoClaim = entity.claims?.P458?.[0]?.mainsnak?.datavalue?.value;
    if (String(imoClaim || '').replace(/\D/g, '') !== imo) continue;
    const mmsi = nineDigit(entity.claims?.P587?.[0]?.mainsnak?.datavalue?.value);
    const name = entity.labels?.en?.value?.trim() || null;
    if (mmsi) return { mmsi, name };
    if (name) return { mmsi: '', name };
  }
  return null;
}

export async function mmsiFromWikidata(imo: string): Promise<{ mmsi: string; name: string | null } | null> {
  const digits = String(imo).replace(/\D/g, '');
  if (digits.length !== 7) return null;
  const cached = imoCache.get(digits);
  if (cached && Date.now() - cached.at < IMO_CACHE_MS) return cached.hit;

  const hit = (await mmsiFromSparql(digits)) ?? (await mmsiFromWikidataApi(digits));
  imoCache.set(digits, { at: Date.now(), hit });
  return hit;
}
