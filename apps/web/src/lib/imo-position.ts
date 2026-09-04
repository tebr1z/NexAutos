import type { VesselPosition } from "@/lib/api";

function nonempty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function mmsiFromWikidata(imo: string): Promise<string | null> {
  const query = `SELECT ?mmsi WHERE { ?ship wdt:P458 "${imo}". OPTIONAL { ?ship wdt:P587 ?mmsi. } } LIMIT 5`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "AutoNex/1.0 (shipment tracking)",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: { bindings?: Array<{ mmsi?: { value?: string } }> };
  };
  for (const row of json.results?.bindings ?? []) {
    const raw = String(row.mmsi?.value || "").replace(/\D/g, "");
    if (raw.length === 9) return raw;
  }
  return null;
}

async function positionDigitraffic(mmsi: string): Promise<VesselPosition | null> {
  const res = await fetch(`https://meri.digitraffic.fi/api/ais/v1/locations?mmsi=${encodeURIComponent(mmsi)}`, {
    headers: { Accept: "application/json", "User-Agent": "AutoNex/1.0" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json();
  const feature = json?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  const props = feature?.properties || {};
  const lon = Array.isArray(coords) ? num(coords[0]) : null;
  const lat = Array.isArray(coords) ? num(coords[1]) : null;
  if (lat == null || lon == null) return null;
  return {
    source: "digitraffic",
    name: nonempty(props.name),
    imo: null,
    mmsi: Number(mmsi),
    latitude: lat,
    longitude: lon,
    speed: num(props.sog),
    course: num(props.cog),
    heading: num(props.heading),
    destination: nonempty(props.destination),
    lastUpdate: json?.dataUpdatedTime ?? null,
    aisStatus: null,
    navStat: num(props.navStat),
    hasCoordinates: true,
  };
}

export async function lookupPositionByImo(imo: string): Promise<VesselPosition | null> {
  const digits = imo.replace(/\D/g, "");
  if (digits.length !== 7) return null;
  const mmsi = await mmsiFromWikidata(digits);
  if (!mmsi) return null;
  return positionDigitraffic(mmsi);
}
