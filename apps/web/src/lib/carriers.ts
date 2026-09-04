export type CarrierKind = "line" | "lessor";

export type Carrier = {
  code: string;
  name: string;
  kind: CarrierKind;
  trackingUrl: (container: string) => string;
};

export type ContainerIntel = {
  containerNumber: string;
  validFormat: boolean;
  checkDigitOk: boolean | null;
  prefix: string;
  carrier?: Carrier;
  trackingUrl?: string;
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
  source: "prefix" | "live" | "demo";
  note?: string;
};

const PORTS: { keys: string[]; name: string; country: string; lat: number; lng: number }[] = [
  { keys: ["POTI"], name: "Poti", country: "Georgia", lat: 42.155, lng: 41.672 },
  { keys: ["BATUMI"], name: "Batumi", country: "Georgia", lat: 41.649, lng: 41.639 },
  { keys: ["BAKU", "BAKI"], name: "Baku", country: "Azerbaijan", lat: 40.373, lng: 49.893 },
  { keys: ["SAVANNAH"], name: "Savannah", country: "United States", lat: 32.081, lng: -81.091 },
  { keys: ["BRUNSWICK"], name: "Brunswick", country: "United States", lat: 31.15, lng: -81.491 },
  { keys: ["JACKSONVILLE"], name: "Jacksonville", country: "United States", lat: 30.396, lng: -81.43 },
  { keys: ["HOUSTON"], name: "Houston", country: "United States", lat: 29.743, lng: -95.021 },
  { keys: ["BALTIMORE"], name: "Baltimore", country: "United States", lat: 39.266, lng: -76.58 },
  { keys: ["NEWARK", "NYNJ", "NEW YORK"], name: "Newark", country: "United States", lat: 40.689, lng: -74.141 },
  { keys: ["CHARLESTON"], name: "Charleston", country: "United States", lat: 32.787, lng: -79.925 },
  { keys: ["LOS ANGELES", "LAX", "LONG BEACH"], name: "Los Angeles", country: "United States", lat: 33.74, lng: -118.265 },
  { keys: ["BUSAN", "PUSAN"], name: "Busan", country: "South Korea", lat: 35.103, lng: 129.04 },
  { keys: ["INCHEON"], name: "Incheon", country: "South Korea", lat: 37.46, lng: 126.6 },
  { keys: ["SHANGHAI"], name: "Shanghai", country: "China", lat: 31.366, lng: 121.615 },
  { keys: ["TIANJIN", "XINGANG"], name: "Tianjin", country: "China", lat: 38.983, lng: 117.745 },
  { keys: ["QINGDAO"], name: "Qingdao", country: "China", lat: 36.083, lng: 120.32 },
  { keys: ["MERSIN"], name: "Mersin", country: "Turkey", lat: 36.8, lng: 34.64 },
  { keys: ["AMBARLI", "ISTANBUL"], name: "Ambarli", country: "Turkey", lat: 40.958, lng: 28.688 },
  { keys: ["CONSTANTA", "CONSTANTA"], name: "Constanta", country: "Romania", lat: 44.16, lng: 28.65 },
  { keys: ["NOVOROSSIYSK"], name: "Novorossiysk", country: "Russia", lat: 44.724, lng: 37.778 },
  { keys: ["JEBEL ALI", "DUBAI"], name: "Jebel Ali", country: "UAE", lat: 24.985, lng: 55.027 },
  { keys: ["PIRAEUS"], name: "Piraeus", country: "Greece", lat: 37.948, lng: 23.637 },
];

export function findPortCoords(label?: string) {
  if (!label) return undefined;
  const hay = label.toUpperCase();
  return PORTS.find((p) => p.keys.some((k) => hay.includes(k)));
}

export function attachPortCoords(intel: ContainerIntel): ContainerIntel {
  if (intel.lat != null && intel.lng != null) return intel;
  const hit = findPortCoords(intel.currentPort) ?? findPortCoords(intel.destinationPort) ?? findPortCoords(intel.originPort);
  if (!hit) return intel;
  return {
    ...intel,
    lat: hit.lat,
    lng: hit.lng,
    currentCountry: intel.currentCountry || hit.country,
  };
}

const LINES: Record<string, Omit<Carrier, "trackingUrl"> & { track: string }> = {
  MSC: { code: "MSC", name: "Mediterranean Shipping Company", kind: "line", track: "https://www.msc.com/en/track-a-shipment" },
  MAERSK: { code: "MAERSK", name: "Maersk", kind: "line", track: "https://www.maersk.com/tracking/" },
  CMA: { code: "CMA", name: "CMA CGM", kind: "line", track: "https://www.cma-cgm.com/ebusiness/tracking/search" },
  COSCO: { code: "COSCO", name: "COSCO Shipping", kind: "line", track: "https://elines.coscoshipping.com/ebusiness/cargoTracking" },
  OOCL: { code: "OOCL", name: "OOCL", kind: "line", track: "https://www.oocl.com/eng/ourservices/eservices/cargotracking/" },
  HAPAG: { code: "HAPAG", name: "Hapag-Lloyd", kind: "line", track: "https://www.hapag-lloyd.com/en/online-business/track/track-by-container.html" },
  ONE: { code: "ONE", name: "Ocean Network Express", kind: "line", track: "https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking" },
  EVERGREEN: { code: "EVERGREEN", name: "Evergreen Line", kind: "line", track: "https://www.shipmentlink.com/servlet/TDB1_CargoTracking.do" },
  YML: { code: "YML", name: "Yang Ming", kind: "line", track: "https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx" },
  HMM: { code: "HMM", name: "HMM", kind: "line", track: "https://www.hmm21.com/e-service/general/trackNTrace/TrackNTrace.do" },
  ZIM: { code: "ZIM", name: "ZIM", kind: "line", track: "https://www.zim.com/tools/track-a-shipment" },
  WANHAI: { code: "WANHAI", name: "Wan Hai Lines", kind: "line", track: "https://www.wanhai.com/views/cargoTrack/CargoTrack.xhtml" },
  PIL: { code: "PIL", name: "Pacific International Lines", kind: "line", track: "https://www.pilship.com/" },
  KMTC: { code: "KMTC", name: "KMTC", kind: "line", track: "https://www.ekmtc.com/cargo/tracking" },
  ARKAS: { code: "ARKAS", name: "Arkas Line", kind: "line", track: "https://www.arkasline.com.tr/en/online-services/container-tracking" },
  FESCO: { code: "FESCO", name: "FESCO", kind: "line", track: "https://www.fesco.ru/en/clients/tracking/" },
  TURKON: { code: "TURKON", name: "Turkon Line", kind: "line", track: "https://www.turkon.com/en/track-trace" },
  SITC: { code: "SITC", name: "SITC", kind: "line", track: "https://www.sitcline.com/" },
  TS: { code: "TS", name: "TS Lines", kind: "line", track: "https://www.tslines.com/" },
  RCL: { code: "RCL", name: "RCL", kind: "line", track: "https://www.rclgroup.com/" },
  TEXTAINER: { code: "TEXTAINER", name: "Textainer (leasing)", kind: "lessor", track: "" },
  TRITON: { code: "TRITON", name: "Triton (leasing)", kind: "lessor", track: "" },
  FLORENS: { code: "FLORENS", name: "Florens (leasing)", kind: "lessor", track: "" },
  CAI: { code: "CAI", name: "CAI / Beacon (leasing)", kind: "lessor", track: "" },
};

const PREFIX: Record<string, keyof typeof LINES> = {
  MSC: "MSC", MSM: "MSC", MED: "MSC",
  MSK: "MAERSK", MRK: "MAERSK", MAE: "MAERSK", MWU: "MAERSK", SUD: "MAERSK", PON: "MAERSK", SEA: "MAERSK",
  CMA: "CMA", CGM: "CMA", CNC: "CMA", ANL: "CMA",
  COS: "COSCO", CBH: "COSCO",
  OOL: "OOCL",
  HLC: "HAPAG", HLX: "HAPAG",
  ONE: "ONE", NYK: "ONE", MOL: "ONE", KKT: "ONE",
  EIS: "EVERGREEN", EGH: "EVERGREEN", EGL: "EVERGREEN", EIT: "EVERGREEN",
  YML: "YML",
  HDM: "HMM", HMM: "HMM",
  ZIM: "ZIM",
  WHL: "WANHAI",
  PCI: "PIL", PIL: "PIL",
  KMT: "KMTC",
  ARK: "ARKAS",
  FES: "FESCO",
  TRK: "TURKON",
  SIT: "SITC",
  TSL: "TS",
  RCL: "RCL",
  TEX: "TEXTAINER", TEM: "TEXTAINER", TGH: "TEXTAINER", TCK: "TEXTAINER",
  TCN: "TRITON",
  FCI: "FLORENS",
  CAI: "CAI", BMO: "CAI", GAT: "CAI",
};

function makeCarrier(key: keyof typeof LINES): Carrier {
  const row = LINES[key];
  return {
    code: row.code,
    name: row.name,
    kind: row.kind,
    trackingUrl: (container: string) => {
      if (key === "MAERSK") return `${row.track}${container}`;
      if (key === "HAPAG") return `${row.track}?container=${container}`;
      if (!row.track) return "";
      return `${row.track}${row.track.includes("?") ? "&" : "?"}number=${container}`;
    },
  };
}

export function normalizeContainer(raw: string) {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function isContainerFormat(value: string) {
  return /^[A-Z]{4}\d{7}$/.test(value);
}

export function checkDigitValid(value: string) {
  if (!isContainerFormat(value)) return false;
  const map: Record<string, number> = {};
  let n = 10;
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (n % 11 === 0) n += 1;
    map[letter] = n;
    n += 1;
  }
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = value[i];
    const val = /[A-Z]/.test(ch) ? map[ch] : Number(ch);
    sum += val * 2 ** i;
  }
  const check = sum % 11 % 10;
  return check === Number(value[10]);
}

export function lookupCarrier(raw: string): ContainerIntel {
  const containerNumber = normalizeContainer(raw);
  const validFormat = isContainerFormat(containerNumber);
  const prefix = containerNumber.slice(0, 3);
  const owner = PREFIX[prefix];
  const carrier = owner ? makeCarrier(owner) : undefined;
  const trackingUrl = carrier && validFormat ? carrier.trackingUrl(containerNumber) : carrier?.trackingUrl(containerNumber);

  let note: string | undefined;
  if (carrier?.kind === "lessor") {
    note = "This prefix belongs to a leasing company. The operating ocean line may be different — confirm on the B/L.";
  } else if (validFormat && !carrier) {
    note = "Prefix not in the Auto Nex line list. You can still save the number and attach a carrier manually.";
  }

  return {
    containerNumber,
    validFormat,
    checkDigitOk: validFormat ? checkDigitValid(containerNumber) : null,
    prefix,
    carrier,
    trackingUrl,
    source: "prefix",
    note,
  };
}

export function formatContainer(raw: string) {
  const value = normalizeContainer(raw);
  if (value.length === 11) return `${value.slice(0, 4)} ${value.slice(4)}`;
  return value;
}

export function oceanFields(intel: ContainerIntel) {
  return {
    containerNumber: intel.validFormat ? formatContainer(intel.containerNumber) : intel.containerNumber,
    carrierCode: intel.carrier?.code,
    carrierName: intel.carrier?.name,
    vesselName: intel.vesselName,
    voyageNumber: intel.voyageNumber,
    carrierTrackingUrl: intel.trackingUrl,
    containerStatus: intel.containerStatus,
    originPort: intel.originPort,
    destinationPort: intel.destinationPort,
    currentPort: intel.currentPort,
    currentCountry: intel.currentCountry,
    eta: intel.eta,
    lat: intel.lat,
    lng: intel.lng,
  };
}

export function enrichKnownContainer(intel: ContainerIntel): ContainerIntel {
  if (intel.containerNumber === "MSCU4829137") {
    return attachPortCoords({
      ...intel,
      source: "demo",
      vesselName: "MSC MIRJANA",
      voyageNumber: "UA624A",
      originPort: "Savannah, GA",
      destinationPort: "Poti",
      currentPort: "Poti",
      currentCountry: "Georgia",
      lat: 42.155,
      lng: 41.672,
      eta: "2026-09-18T10:00:00.000Z",
      containerStatus: "Discharged / transshipment",
      note: undefined,
    });
  }
  return attachPortCoords(intel);
}

