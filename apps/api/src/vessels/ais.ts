const HTTP_TIMEOUT_MS = 12_000;
const AISSTREAM_WAIT_MS = 22_000;
const VESSEL_CACHE_TTL_MS = 180_000;
const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const DIGITRAFFIC_HOST = 'meri.digitraffic.fi';

const NAV_STATUS: Record<number, string> = {
  0: 'Under way using engine',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted manoeuvrability',
  4: 'Constrained by her draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Engaged in fishing',
  8: 'Under way sailing',
  9: 'Reserved (HSC)',
  10: 'Reserved (WIG)',
  11: 'Power-driven towing astern',
  12: 'Power-driven pushing / towing alongside',
  13: 'Reserved',
  14: 'AIS-SART / MOB / EPIRB',
  15: 'Undefined',
};

export type VesselHit = {
  name: string;
  mmsi: number | null;
  imo: number | null;
  callSign: string | null;
  destination: string | null;
  shipType: number | null;
};

export type VesselPosition = {
  source: string;
  name: string | null;
  imo: number | null;
  mmsi: number;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  course: number | null;
  heading: number | null;
  destination: string | null;
  lastUpdate: string | null;
  aisStatus: string | null;
  navStat: number | null;
  hasCoordinates: boolean;
};

export class AisError extends Error {
  status: number;
  fallback?: boolean;
  constructor(message: string, status = 502, fallback = false) {
    super(message);
    this.status = status;
    this.fallback = fallback;
  }
}

type DigitraffficVessel = {
  name?: string;
  mmsi?: number;
  imo?: number;
  callSign?: string;
  destination?: string;
  shipType?: number;
};

let vesselCache: { at: number; rows: DigitraffficVessel[] } = { at: 0, rows: [] };
let aisstreamDownUntil = 0;

function nonempty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t === '' ? null : t;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function headingOrNull(value: unknown): number | null {
  const h = numOrNull(value);
  return h !== null && h >= 0 && h < 360 ? Math.round(h) : null;
}

function wsDataToString(data: unknown): string {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  }
  return String(data);
}

async function httpsGetJson(url: string): Promise<any> {
  const host = new URL(url).hostname.toLowerCase();
  if (host !== DIGITRAFFIC_HOST) {
    throw new AisError('This AIS host is not allowed.', 500);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AutoNex/1.0',
      },
    });
    if (res.status === 404) throw new AisError('No AIS record for this vessel.', 404);
    if (res.status === 429) throw new AisError('AIS rate limit reached. Try again shortly.', 429);
    if (!res.ok) throw new AisError(`AIS API error (HTTP ${res.status}).`, 502);
    return await res.json();
  } catch (err) {
    if (err instanceof AisError) throw err;
    if ((err as Error).name === 'AbortError') throw new AisError('AIS service timed out.', 504);
    throw new AisError('Could not reach AIS service.', 502);
  } finally {
    clearTimeout(timer);
  }
}

async function digitrafficVessels(): Promise<DigitraffficVessel[]> {
  if (vesselCache.rows.length && Date.now() - vesselCache.at < VESSEL_CACHE_TTL_MS) {
    return vesselCache.rows;
  }
  const data = await httpsGetJson('https://meri.digitraffic.fi/api/ais/v1/vessels');
  if (!Array.isArray(data)) throw new AisError('AIS vessel list could not be read.', 502);
  vesselCache = { at: Date.now(), rows: data };
  return data;
}

export async function searchVesselsByName(name: string): Promise<VesselHit[]> {
  const q = name.toUpperCase();
  const hits: VesselHit[] = [];
  for (const row of await digitrafficVessels()) {
    const shipName = String(row?.name || '').trim();
    if (!shipName || !shipName.toUpperCase().includes(q)) continue;
    hits.push({
      name: shipName,
      mmsi: row.mmsi ? Number(row.mmsi) : null,
      imo: row.imo ? Number(row.imo) : null,
      callSign: row.callSign || null,
      destination: nonempty(row.destination),
      shipType: row.shipType ?? null,
    });
    if (hits.length >= 25) break;
  }
  hits.sort((a, b) => a.name.length - b.name.length);
  return hits;
}

export async function searchVesselsByImo(imo: string): Promise<VesselHit[]> {
  const n = Number(String(imo).replace(/\D/g, ''));
  if (!Number.isFinite(n) || n <= 0) return [];
  const hits: VesselHit[] = [];
  for (const row of await digitrafficVessels()) {
    if (Number(row?.imo) !== n) continue;
    hits.push({
      name: String(row.name || '').trim(),
      mmsi: row.mmsi ? Number(row.mmsi) : null,
      imo: row.imo ? Number(row.imo) : null,
      callSign: row.callSign || null,
      destination: nonempty(row.destination),
      shipType: row.shipType ?? null,
    });
  }
  return hits;
}

export async function positionDigitraffic(mmsi: string): Promise<VesselPosition> {
  const vessels = await digitrafficVessels();
  const meta = vessels.find((row) => String(row?.mmsi || '') === String(mmsi)) || {};
  const json = await httpsGetJson(
    `https://meri.digitraffic.fi/api/ais/v1/locations?mmsi=${encodeURIComponent(mmsi)}`,
  );
  const feature = json?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  const props = feature?.properties || {};
  const lon = Array.isArray(coords) ? numOrNull(coords[0]) : null;
  const lat = Array.isArray(coords) ? numOrNull(coords[1]) : null;
  const nav = props.navStat === undefined ? null : Number(props.navStat);
  const updated = props.timestampExternal ? Number(props.timestampExternal) : null;
  return {
    source: 'digitraffic',
    name: nonempty(meta.name),
    imo: meta.imo ? Number(meta.imo) : null,
    mmsi: Number(mmsi),
    latitude: lat,
    longitude: lon,
    speed: numOrNull(props.sog),
    course: numOrNull(props.cog),
    heading: headingOrNull(props.heading),
    destination: nonempty(meta.destination),
    lastUpdate: updated
      ? new Date(Math.floor(updated / 1000) * 1000).toISOString()
      : nonempty(json?.dataUpdatedTime),
    aisStatus: nav === null || Number.isNaN(nav) ? null : NAV_STATUS[nav] || `AIS status ${nav}`,
    navStat: Number.isNaN(nav) ? null : nav,
    hasCoordinates: lat !== null && lon !== null,
  };
}

function mergeAis(base: VesselPosition, incoming: Partial<VesselPosition>): VesselPosition {
  const next = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== null && value !== undefined && value !== '') {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  next.hasCoordinates = next.latitude !== null && next.longitude !== null;
  return next;
}

function parseAisStream(msg: any): { kind: string } & Partial<VesselPosition> {
  const type = msg?.MessageType;
  if (!type) return { kind: 'ignore' };
  if (type === 'SubscriptionConfirmation') return { kind: 'confirm' };
  if (type === 'Error') return { kind: 'error' };
  const meta = msg.MetaData || {};
  const body = msg.Message?.[type] || {};
  const lat = numOrNull(meta.latitude ?? meta.Latitude ?? body.Latitude);
  const lon = numOrNull(meta.longitude ?? meta.Longitude ?? body.Longitude);
  const mmsi = numOrNull(meta.MMSI ?? body.UserID);
  const name = nonempty(meta.ShipName || meta.shipName || body.Name);

  if (
    type === 'PositionReport' ||
    type === 'StandardClassBPositionReport' ||
    type === 'ExtendedClassBPositionReport'
  ) {
    const nav = body.NavigationalStatus;
    return {
      kind: 'position',
      source: 'aisstream',
      name,
      mmsi: mmsi ?? undefined,
      latitude: lat,
      longitude: lon,
      speed: numOrNull(body.Sog),
      course: numOrNull(body.Cog),
      heading: headingOrNull(body.TrueHeading),
      lastUpdate: nonempty(meta.time_utc || meta.TimeUTC) || new Date().toISOString(),
      aisStatus: nav === undefined || nav === null ? null : NAV_STATUS[nav] || `AIS status ${nav}`,
      navStat: nav ?? null,
      hasCoordinates: lat !== null && lon !== null,
    };
  }

  if (type === 'ShipStaticData' || type === 'StaticDataReport') {
    const staticBody = body.ReportA || body;
    return {
      kind: 'static',
      name: nonempty(staticBody.Name || name),
      imo: numOrNull(staticBody.ImoNumber || body.ImoNumber),
      mmsi: mmsi ?? undefined,
      destination: nonempty(staticBody.Destination || body.Destination),
    };
  }

  return { kind: 'ignore' };
}

function positionFromAisStream(mmsi: string, apiKey: string): Promise<VesselPosition> {
  if (typeof WebSocket === 'undefined') {
    return Promise.reject(new AisError('WebSocket is not available in this Node runtime.', 500));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let acc: VesselPosition = {
      source: 'aisstream',
      name: null,
      imo: null,
      mmsi: Number(mmsi),
      latitude: null,
      longitude: null,
      speed: null,
      course: null,
      heading: null,
      destination: null,
      lastUpdate: null,
      aisStatus: null,
      navStat: null,
      hasCoordinates: false,
    };

    const finish = (err: AisError | null, data?: VesselPosition) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (err) reject(err);
      else resolve(data as VesselPosition);
    };

    const timer = setTimeout(() => {
      if (acc.hasCoordinates) finish(null, acc);
      else finish(new AisError('No AISStream position yet. The vessel may not be transmitting.', 504, true));
    }, AISSTREAM_WAIT_MS);

    const ws = new WebSocket(AISSTREAM_URL);

    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: [
            [
              [-90, -180],
              [90, 180],
            ],
          ],
          FiltersShipMMSI: [String(mmsi)],
          FilterMessageTypes: [
            'PositionReport',
            'StandardClassBPositionReport',
            'ExtendedClassBPositionReport',
            'ShipStaticData',
            'StaticDataReport',
          ],
        }),
      );
    });

    ws.addEventListener('message', (event) => {
      let msg: any;
      try {
        msg = JSON.parse(wsDataToString(event.data));
      } catch {
        return;
      }
      if (typeof msg?.error === 'string') {
        const invalid = /key|auth|unauthor/i.test(msg.error);
        finish(new AisError(invalid ? 'AISStream API key is invalid.' : msg.error, invalid ? 401 : 502));
        return;
      }
      const parsed = parseAisStream(msg);
      if (parsed.kind === 'error') {
        finish(new AisError('AISStream subscription was rejected.', 401));
        return;
      }
      if (parsed.kind === 'confirm' || parsed.kind === 'ignore') return;
      if (parsed.kind === 'static') {
        acc = mergeAis(acc, parsed);
        return;
      }
      if (parsed.kind === 'position') {
        acc = mergeAis(acc, parsed);
        if (acc.hasCoordinates) finish(null, acc);
      }
    });

    ws.addEventListener('error', () => {
      finish(new AisError('AISStream WebSocket error.', 502, true));
    });

    ws.addEventListener('close', () => {
      if (settled) return;
      if (acc.hasCoordinates) finish(null, acc);
      else finish(new AisError('AISStream connection closed.', 502, true));
    });
  });
}

export async function fetchVesselPosition(mmsi: string, aisstreamKey?: string): Promise<VesselPosition> {
  const fallback = await positionDigitraffic(mmsi).catch(() => null);
  if (fallback?.hasCoordinates) return fallback;

  const key = aisstreamKey?.trim();
  if (key && Date.now() > aisstreamDownUntil) {
    try {
      return await positionFromAisStream(mmsi, key);
    } catch (err) {
      const aisErr = err as AisError;
      if (aisErr.status === 401) throw aisErr;
      if (aisErr.fallback) aisstreamDownUntil = Date.now() + 5 * 60_000;
      if (fallback) {
        fallback.source = 'digitraffic (AISStream fallback)';
        return fallback;
      }
      throw aisErr;
    }
  }

  if (fallback) return fallback;
  throw new AisError('No AIS record for this vessel.', 404);
}
