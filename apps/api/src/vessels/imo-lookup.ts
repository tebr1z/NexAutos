const WIKIDATA = 'https://query.wikidata.org/sparql';

export async function mmsiFromWikidata(imo: string): Promise<{ mmsi: string; name: string | null } | null> {
  const digits = String(imo).replace(/\D/g, '');
  if (digits.length !== 7) return null;

  const query = `SELECT ?mmsi ?shipLabel WHERE {
    ?ship wdt:P458 "${digits}".
    OPTIONAL { ?ship wdt:P587 ?mmsi. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } LIMIT 5`;

  const url = `${WIKIDATA}?format=json&query=${encodeURIComponent(query)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'AutoNex/1.0 (shipment tracking; https://nex.autos)',
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: { bindings?: Array<{ mmsi?: { value?: string }; shipLabel?: { value?: string } }> };
    };
    const rows = json.results?.bindings ?? [];
    for (const row of rows) {
      const raw = String(row.mmsi?.value || '').replace(/\D/g, '');
      if (raw.length === 9) {
        return { mmsi: raw, name: row.shipLabel?.value?.trim() || null };
      }
    }
    const name = rows[0]?.shipLabel?.value?.trim() || null;
    return name ? { mmsi: '', name } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
