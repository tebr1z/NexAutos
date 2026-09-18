const HTTP_TIMEOUT_MS = 8_000;
const AISSTREAM_WAIT_MS = 22_000;
const VESSEL_CACHE_TTL_MS = 180_000;
const POSITION_CACHE_TTL_MS = 15 * 60_000;
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

export function resetAisstreamBackoff() {
  aisstreamDownUntil = 0;
}

export function probeAisKey(apiKey: string, waitMs = 12_000): Promise<{ ok: boolean; message: string }> {
  const Socket = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  const key = apiKey.trim().replace(/^["']|["']$/g, '');
  if (!Socket) return Promise.resolve({ ok: false, message: 'Bu serverdə WebSocket yoxdur.' });
  if (!key) return Promise.resolve({ ok: false, message: 'AIS açarı yazılmayıb.' });

  return new Promise((resolve) => {
    let settled = false;
    let opened = false;
    const done = (ok: boolean, message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve({ ok, message });
    };

    const timer = setTimeout(() => {
      if (!opened) {
        done(false, 'Server AISStream-ə çıxa bilmədi (wss://stream.aisstream.io). Firewall/DNS yoxlanılmalıdır.');
      } else {
        done(false, 'Qoşuldu, amma AIS mesajı gəlmədi. Açarı aisstream.io/apikeys-də yenidən kopyalayın.');
      }
    }, waitMs);

    const ws = new Socket(AISSTREAM_URL);

    const subscribe = () => {
      opened = true;
      try {
        ws.send(
          JSON.stringify({
            APIKey: key,
            BoundingBoxes: [
              [
                [-90, -180],
                [90, 180],
              ],
            ],
          }),
        );
      } catch {
        done(false, 'AISStream abunə mesajı göndərilmədi.');
      }
    };

    ws.addEventListener('open', subscribe);

    ws.addEventListener('message', (event) => {
      void (async () => {
        const msg = await readWsJson((event as MessageEvent).data);
        if (!msg || settled) return;
        const errText =
          typeof msg.error === 'string' ? msg.error : typeof msg.Error === 'string' ? msg.Error : '';
        if (errText || msg.MessageType === 'Error') {
          const invalid = /key|auth|unauthor|invalid/i.test(errText || '');
          done(
            false,
            invalid
              ? 'Açar etibarsızdır. aisstream.io/apikeys-dən yeni açar kopyalayın.'
              : errText || 'AISStream açarı rədd edildi.',
          );
          return;
        }
        done(true, 'AISStream qoşuldu — açar işləyir.');
      })();
    });

    ws.addEventListener('error', () => done(false, 'AISStream WebSocket xətası. Serverdən internet/wss çıxışı olmalıdır.'));
    ws.addEventListener('close', () => {
      if (!settled) {
        done(false, opened ? 'AISStream bağlantısı bağlandı — açar rədd edilmiş ola bilər.' : 'AISStream-ə qoşulmadı.');
      }
    });
  });
}

const positionCache = new Map<string, { at: number; pos: VesselPosition }>();
const inflight = new Map<string, Promise<VesselPosition>>();

export function emptyPosition(mmsi: number, extra?: Partial<VesselPosition>): VesselPosition {
  return {
    source: extra?.source ?? 'imo',
    name: extra?.name ?? null,
    imo: extra?.imo ?? null,
    mmsi,
    latitude: extra?.latitude ?? null,
    longitude: extra?.longitude ?? null,
    speed: extra?.speed ?? null,
    course: extra?.course ?? null,
    heading: extra?.heading ?? null,
    destination: extra?.destination ?? null,
    lastUpdate: extra?.lastUpdate ?? null,
    aisStatus: extra?.aisStatus ?? null,
    navStat: extra?.navStat ?? null,
    hasCoordinates: extra?.latitude != null && extra?.longitude != null,
  };
}

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
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  }
  return '';
}

async function readWsJson(data: unknown): Promise<any | null> {
  try {
    let text = wsDataToString(data);
    if (!text && data && typeof data === 'object' && 'text' in data && typeof (data as { text: () => Promise<string> }).text === 'function') {
      text = await (data as { text: () => Promise<string> }).text();
    }
    if (!text?.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
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

function positionFromAisStream(
  mmsi: string,
  apiKey: string,
  waitMs = AISSTREAM_WAIT_MS,
  boxes?: number[][][],
): Promise<VesselPosition> {
  const Socket = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!Socket) {
    return Promise.reject(new AisError('WebSocket is not available in this Node runtime.', 500));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let acc: VesselPosition = emptyPosition(Number(mmsi), { source: 'aisstream' });

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
    }, waitMs);

    const ws = new Socket(AISSTREAM_URL);

    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: boxes?.length ? boxes : WORLD_BOX,
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

    ws.addEventListener('message', async (event) => {
      const msg = await readWsJson(event.data);
      if (!msg) return;
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

const WORLD_BOX: number[][][] = [
  [
    [-90, -180],
    [90, 180],
  ],
];

const TRADE_BOXES: number[][][] = [
  [
    [24, -98],
    [42, -68],
  ],
  [
    [18, -80],
    [48, -6],
  ],
  [
    [30, -6],
    [47, 42],
  ],
];

function boxAround(lat: number, lng: number, span = 5): number[][] {
  return [
    [Math.max(-90, lat - span), Math.max(-180, lng - span)],
    [Math.min(90, lat + span), Math.min(180, lng + span)],
  ];
}

export async function discoverImoOnAis(
  imo: string,
  apiKey: string,
  hint?: { lat: number; lng: number },
  waitMs = 18_000,
): Promise<{ mmsi: string; name: string | null; pos: VesselPosition | null } | null> {
  const Socket = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!Socket || !apiKey.trim()) return null;
  const want = Number(imo);

  return new Promise((resolve) => {
    let settled = false;
    let mmsi = '';
    let name: string | null = null;
    let pos: VesselPosition | null = null;
    const boxes =
      hint?.lat != null && hint?.lng != null ? [boxAround(hint.lat, hint.lng, 8), ...TRADE_BOXES] : TRADE_BOXES;

    const done = (value: { mmsi: string; name: string | null; pos: VesselPosition | null } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(value);
    };

    const timer = setTimeout(() => done(mmsi ? { mmsi, name, pos } : null), waitMs);
    const ws = new Socket(AISSTREAM_URL);

    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: boxes,
          FilterMessageTypes: ['PositionReport', 'ShipStaticData', 'StaticDataReport'],
        }),
      );
    });

    ws.addEventListener('message', async (event) => {
      const msg = await readWsJson(event.data);
      if (!msg) return;
      const parsed = parseAisStream(msg);
      const msgImo =
        parsed.imo ??
        numOrNull(msg?.Message?.ShipStaticData?.ImoNumber ?? msg?.Message?.StaticDataReport?.ReportA?.ImoNumber);
      const msgMmsi = parsed.mmsi != null ? String(parsed.mmsi) : '';
      if (msgImo === want && msgMmsi.length === 9) {
        mmsi = msgMmsi;
        name = parsed.name ?? name;
      }
      if (mmsi && parsed.kind === 'position' && String(parsed.mmsi) === mmsi && parsed.hasCoordinates) {
        pos = {
          ...emptyPosition(Number(mmsi), parsed),
          source: 'aisstream',
          imo: want,
          name: parsed.name ?? name,
          hasCoordinates: true,
          latitude: parsed.latitude ?? null,
          longitude: parsed.longitude ?? null,
        };
        done({ mmsi, name, pos });
      }
    });

    ws.addEventListener('error', () => done(mmsi ? { mmsi, name, pos } : null));
    ws.addEventListener('close', () => {
      if (!settled) done(mmsi ? { mmsi, name, pos } : null);
    });
  });
}

export function peekVesselPosition(mmsi: string): VesselPosition | null {
  const cached = positionCache.get(mmsi);
  if (cached && Date.now() - cached.at < POSITION_CACHE_TTL_MS && cached.pos.hasCoordinates) {
    return cached.pos;
  }
  return null;
}

function rememberPosition(mmsi: string, pos: VesselPosition) {
  if (pos.hasCoordinates) positionCache.set(mmsi, { at: Date.now(), pos });
  return pos;
}

async function resolveLivePosition(mmsi: string, aisstreamKey?: string, waitMs = 22_000): Promise<VesselPosition> {
  const key = aisstreamKey?.trim();
  if (key && Date.now() > aisstreamDownUntil) {
    try {
      return rememberPosition(mmsi, await positionFromAisStream(mmsi, key, waitMs, WORLD_BOX));
    } catch (err) {
      const aisErr = err as AisError;
      if (aisErr.status === 401) throw aisErr;
      if (aisErr.status === 502) aisstreamDownUntil = Date.now() + 60_000;
    }
  }

  const fallback = await positionDigitraffic(mmsi).catch(() => null);
  if (fallback?.hasCoordinates) return rememberPosition(mmsi, fallback);
  const cached = peekVesselPosition(mmsi);
  if (cached) return cached;
  if (fallback) return fallback;
  return emptyPosition(Number(mmsi), { source: 'ais' });
}

/** HTTP-ni 90s saxlama — AIS arxada doldurulur, növbəti sorğu keşdən gəlir. */
export function warmVesselPosition(mmsi: string, aisstreamKey?: string) {
  if (!mmsi || peekVesselPosition(mmsi) || inflight.has(mmsi)) return;
  const job = resolveLivePosition(mmsi, aisstreamKey).finally(() => inflight.delete(mmsi));
  inflight.set(mmsi, job);
}

export async function awaitVesselPosition(mmsi: string, aisstreamKey?: string, waitMs = 24_000): Promise<VesselPosition> {
  const cached = peekVesselPosition(mmsi);
  if (cached) return cached;
  if (!inflight.has(mmsi)) {
    const job = resolveLivePosition(mmsi, aisstreamKey, Math.max(8_000, waitMs - 1_000)).finally(() => inflight.delete(mmsi));
    inflight.set(mmsi, job);
  }
  const pending = inflight.get(mmsi)!;
  const raced = await Promise.race([
    pending,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
  ]);
  return peekVesselPosition(mmsi) ?? raced ?? emptyPosition(Number(mmsi), { source: 'ais-pending' });
}

export async function fetchVesselPosition(mmsi: string, aisstreamKey?: string): Promise<VesselPosition> {
  return awaitVesselPosition(mmsi, aisstreamKey, 8_000);
}
