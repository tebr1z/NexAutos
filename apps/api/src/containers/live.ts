export type LiveOcean = {
  vesselName?: string;
  voyageNumber?: string;
  originPort?: string;
  destinationPort?: string;
  currentPort?: string;
  currentCountry?: string;
  eta?: string;
  containerStatus?: string;
  lat?: number;
  lng?: number;
  source: "live";
};

const SEALINE: Record<string, string> = {
  MSC: "MSC",
  MAERSK: "MAEU",
  CMA: "CMDU",
  COSCO: "COSU",
  OOCL: "OOLU",
  HAPAG: "HLCU",
  ONE: "ONEY",
  EVERGREEN: "EGLV",
  YML: "YMLU",
  HMM: "HDMU",
  ZIM: "ZIMU",
  WANHAI: "WHLC",
  PIL: "PILU",
  ARKAS: "ARKU",
  TURKON: "TRKU",
};

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

function pickPin(v: unknown): { lat?: number; lng?: number } {
  if (Array.isArray(v) && v.length >= 2) {
    const a = num(v[0]);
    const b = num(v[1]);
    if (a != null && b != null) return { lat: a, lng: b };
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const lat = num(o.lat ?? o.latitude);
    const lng = num(o.lng ?? o.lon ?? o.longitude);
    return { lat, lng };
  }
  return {};
}

async function timedFetch(url: string, init?: RequestInit, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseSearates(raw: unknown): LiveOcean | null {
  const root = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const locations = Array.isArray(data.locations) ? (data.locations as Record<string, unknown>[]) : [];
  const locName = (id: unknown) => {
    const row = locations.find((l) => l.id === id || l.location === id);
    return str(row?.name);
  };

  const vessels = Array.isArray(data.vessels) ? (data.vessels as Record<string, unknown>[]) : [];
  const route = (data.route && typeof data.route === "object" ? data.route : {}) as Record<string, unknown>;
  const aisBlock = (route.ais ?? data.ais) as Record<string, unknown> | undefined;
  const aisData = (aisBlock?.data && typeof aisBlock.data === "object" ? aisBlock.data : aisBlock) as
    | Record<string, unknown>
    | undefined;
  const aisVessel = (aisData?.vessel ?? vessels[vessels.length - 1]) as Record<string, unknown> | undefined;

  const containers = Array.isArray(data.containers) ? (data.containers as Record<string, unknown>[]) : [];
  const box = containers[0] ?? {};
  const events = Array.isArray(box.events) ? (box.events as Record<string, unknown>[]) : [];
  const lastEvent = [...events].reverse().find((e) => e.actual) ?? events[events.length - 1];

  const pol = route.pol as Record<string, unknown> | undefined;
  const pod = route.pod as Record<string, unknown> | undefined;
  const pin = pickPin(route.pin ?? aisData?.location ?? aisData?.coordinates ?? data.pin);

  const vesselName = str(aisVessel?.name) ?? str(vessels[vessels.length - 1]?.name);
  const voyage =
    str((aisData?.last_event as Record<string, unknown> | undefined)?.voyage) ?? str(lastEvent?.voyage);

  if (!vesselName && !pin.lat && !str(box.status)) return null;

  const origin = locName(pol?.location) ?? str(pol?.name);
  const dest = locName(pod?.location) ?? str(pod?.name);
  const current =
    locName(lastEvent?.location) ??
    str((aisData?.discharge_port as Record<string, unknown> | undefined)?.name) ??
    dest;

  const etaRaw = str(pod?.date) ?? str((aisData?.discharge_port as Record<string, unknown> | undefined)?.date);
  const eta = etaRaw ? new Date(etaRaw.replace(" ", "T") + (etaRaw.endsWith("Z") ? "" : "Z")).toISOString() : undefined;

  return {
    source: "live",
    vesselName,
    voyageNumber: voyage,
    originPort: origin,
    destinationPort: dest,
    currentPort: current,
    containerStatus: str(box.status) ?? str(lastEvent?.description),
    eta: eta && !Number.isNaN(Date.parse(eta)) ? eta : undefined,
    lat: pin.lat,
    lng: pin.lng,
  };
}

function parseShipsgo(raw: unknown): LiveOcean | null {
  const root = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const msg = (root.Message ?? root.message ?? root.data ?? root) as Record<string, unknown>;
  if (!msg || typeof msg !== "object") return null;
  const vesselName = str(msg.Vessel ?? msg.vessel ?? msg.VesselName ?? msg.vesselName);
  const voyage = str(msg.Voyage ?? msg.voyage ?? msg.VoyageNo);
  const origin = str(msg.Pol ?? msg.pol ?? msg.PortOfLoading);
  const dest = str(msg.Pod ?? msg.pod ?? msg.PortOfDischarge);
  const current = str(msg.LastLocation ?? msg.lastLocation ?? msg.TSPort ?? msg.Location);
  const lat = num(msg.Latitude ?? msg.latitude ?? msg.lat);
  const lng = num(msg.Longitude ?? msg.longitude ?? msg.lng);
  const status = str(msg.Status ?? msg.status ?? msg.ContainerStatus);
  const etaRaw = str(msg.ETA ?? msg.eta ?? msg.ArrivalDate);
  if (!vesselName && lat == null) return null;
  return {
    source: "live",
    vesselName,
    voyageNumber: voyage,
    originPort: origin,
    destinationPort: dest,
    currentPort: current ?? dest,
    containerStatus: status,
    eta: etaRaw && !Number.isNaN(Date.parse(etaRaw)) ? new Date(etaRaw).toISOString() : undefined,
    lat,
    lng,
  };
}

async function trySearates(number: string, key: string, carrierCode?: string): Promise<LiveOcean | null> {
  const url = new URL("https://tracking.searates.com/tracking");
  url.searchParams.set("api_key", key);
  url.searchParams.set("number", number);
  url.searchParams.set("type", "CT");
  url.searchParams.set("route", "true");
  url.searchParams.set("ais", "true");
  const sealine = carrierCode ? SEALINE[carrierCode] : undefined;
  if (sealine) url.searchParams.set("sealine", sealine);
  const res = await timedFetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return parseSearates(json);
}

async function tryShipsgo(number: string, key: string): Promise<LiveOcean | null> {
  const url = new URL("https://shipsgo.com/api/ContainerService/GetContainerInfo/");
  url.searchParams.set("authCode", key);
  url.searchParams.set("requestId", number);
  url.searchParams.set("mapPoint", "true");
  const res = await timedFetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return parseShipsgo(json);
}

export async function fetchLiveOcean(container: string, carrierCode?: string): Promise<LiveOcean | null> {
  const number = container.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const searates = process.env.SEARATES_API_KEY;
  const shipsgo = process.env.SHIPSGO_API_KEY ?? process.env.SHIPSGO_AUTH_CODE;
  try {
    if (searates) {
      const hit = await trySearates(number, searates, carrierCode);
      if (hit) return hit;
    }
  } catch {
    /* live feed optional */
  }
  try {
    if (shipsgo) {
      const hit = await tryShipsgo(number, shipsgo);
      if (hit) return hit;
    }
  } catch {
    /* live feed optional */
  }
  return null;
}
