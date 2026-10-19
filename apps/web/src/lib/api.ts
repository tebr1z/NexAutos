import { browserApiBase, nestApiBase } from "./nest-url";
import type { TrackingShipment, VinRecord, AuthUser } from "./types";

export type CatalogCar = {
  id: string;
  title: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  auction?: string | null;
  color?: string | null;
  priceUsd?: number | null;
  priceLabel?: string | null;
  imageUrl: string;
  description?: string | null;
  published: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
};

export type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export type ContractNotify = {
  whatsapp?: { sent: boolean; channel?: string; error?: string };
  email?: { sent: boolean; error?: string };
  publicUrl?: string;
  waMe?: string;
};

export type ContractRecord = {
  id: string;
  number: string;
  token: string;
  kind?: "SERVICE" | "INSURANCE" | string;
  status: "DRAFT" | "SENT" | "PHONE_VERIFIED" | "READ" | "SIGNED" | "VOID";
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerIdNumber?: string | null;
  trackingCode?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  origin?: string | null;
  amountUsd?: string | null;
  amountAzn?: string | null;
  paymentNote?: string | null;
  extraTerms?: string | null;
  phoneVerifiedAt?: string | null;
  readAt?: string | null;
  signedAt?: string | null;
  documentHash?: string | null;
  signerIp?: string | null;
  signerUserAgent?: string | null;
  signaturePng?: string | null;
  lastOtpPreview?: string | null;
  sentWhatsappAt?: string | null;
  sentEmailAt?: string | null;
  notifyMeta?: ContractNotify | null;
  createdAt: string;
  publicUrl: string;
  hasPdf?: boolean;
};

export type ContractBody = {
  kicker: string;
  title: string;
  intro: string;
  sections: { id: string; title: string; paragraphs: string[]; facts?: { label: string; value: string }[] }[];
};

export type PublicContract = {
  id: string;
  number: string;
  kind?: string;
  locale?: string;
  status: ContractRecord["status"];
  customerName: string;
  customerIdNumber?: string | null;
  maskedPhone: string;
  hasEmail: boolean;
  trackingCode?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  phoneVerified: boolean;
  readAt?: string | null;
  signedAt?: string | null;
  documentHash?: string | null;
  signaturePng?: string | null;
  body: ContractBody | null;
  sessionToken?: string;
  step: "otp" | "read" | "sign" | "done" | "void";
};

const API = typeof window === "undefined" ? nestApiBase() : browserApiBase();
let refreshPromise: Promise<string | null> | null = null;

async function refreshBrowserToken() {
  if (typeof window === "undefined") return null;
  if (refreshPromise) return refreshPromise;
  const refreshToken = localStorage.getItem("anx_refresh_token");
  if (!refreshToken) return null;
  refreshPromise = fetch(`${API}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  }).then(async (response) => {
    if (!response.ok) throw new Error("Sessiya yenilənmədi.");
    const data = await response.json() as { accessToken: string; refreshToken: string };
    localStorage.setItem("anx_token", data.accessToken);
    localStorage.setItem("anx_refresh_token", data.refreshToken);
    return data.accessToken;
  }).catch(() => {
    localStorage.removeItem("anx_token");
    localStorage.removeItem("anx_refresh_token");
    return null;
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export type VesselHit = {
  name: string;
  mmsi: number | null;
  imo: number | null;
  callSign?: string | null;
  destination?: string | null;
  shipType?: number | null;
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

export type OceanLookup = {
  containerNumber: string;
  validFormat: boolean;
  checkDigitOk: boolean | null;
  carrierCode?: string;
  carrierName?: string;
  carrierKind?: string;
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
  source: string;
  note?: string;
  formatted: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("anx_token") : null;
  const run = (accessToken: string | null) => fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  let res = await run(token);
  if (res.status === 401 && typeof window !== "undefined" && !["/auth/login", "/auth/register", "/auth/refresh"].includes(path)) {
    const renewed = await refreshBrowserToken();
    if (renewed) res = await run(renewed);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const raw = (body as { message?: string | string[] }).message;
    const message = Array.isArray(raw) ? raw.join(" ") : raw;
    throw new Error(message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function requestLocal<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const raw = (body as { message?: string | string[] }).message;
    const message = Array.isArray(raw) ? raw.join(" ") : raw;
    throw new Error(message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function requestWithLocal<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await request<T>(path, init);
  } catch {
    return requestLocal<T>(path, init);
  }
}

export type MarketSale = {
  id: string;
  sourceKey: string;
  sourceUrl: string;
  lotNumber?: string | null;
  vin?: string | null;
  auction?: string | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  year?: number | null;
  engineCc?: number | null;
  engineLabel?: string | null;
  fuel?: string | null;
  color?: string | null;
  location?: string | null;
  state?: string | null;
  mileageMi?: number | null;
  mileageKm?: number | null;
  finalBidUsd: number;
  saleDate?: string | null;
  observedAt: string;
};

export type MarketSalesResponse = {
  rows: MarketSale[];
  total: number;
  days: number;
  facets: Pick<MarketSale, "make" | "model" | "trim" | "fuel" | "auction" | "year" | "engineCc">[];
};

export type CalculatorProfile = {
  monthlyLimit: number | null; used: number; remaining: number | null; month: string;
  allowSelfPricing: boolean; discountAUsd: number; discountBUsd: number; discountCUsd: number; potiBakuUsd: number | null;
};
export type CalculatorReport = { id: string; message: string; pageUrl?: string; version?: string; status: string; createdAt: string; user: { name: string; email: string } };
export type AccessUser = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF" | "FREIGHT_USER";
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
};

export const api = {
  calculatorProfile: (userId?: string) => request<CalculatorProfile>(userId ? `/calculator/users/${encodeURIComponent(userId)}` : '/calculator/me'),
  saveCalculatorProfile: (payload: Partial<CalculatorProfile>, userId?: string) => request<CalculatorProfile>(userId ? `/calculator/users/${encodeURIComponent(userId)}` : '/calculator/me', { method: 'PATCH', body: JSON.stringify(payload) }),
  calculatorReports: () => request<CalculatorReport[]>('/calculator/reports'),
  resolveCalculatorReport: (id: string, status: string) => request(`/calculator/reports/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  track: (code: string) =>
    request<TrackingShipment>(`/tracking/${encodeURIComponent(code)}`, {
      signal: AbortSignal.timeout(20_000),
    }),
  vin: (vin: string) => request<VinRecord>(`/vins/${encodeURIComponent(vin)}`),
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: { name: string; email: string; password: string; phone?: string }) =>
    request<{ accessToken: string; refreshToken: string; user: AuthUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => request<AuthUser>("/auth/me"),
  accessUsers: () => request<AccessUser[]>("/access-users"),
  createAccessUser: (payload: { name: string; email: string; password: string; role: AccessUser["role"] }) =>
    request<AccessUser>("/access-users", { method: "POST", body: JSON.stringify(payload) }),
  updateAccessUser: (id: string, payload: { name?: string; password?: string; isActive?: boolean; role?: AccessUser["role"] }) =>
    request<AccessUser>(`/access-users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  stats: () =>
    request<{
      totalOrders: number;
      activeShipments: number;
      revenue: number;
      pendingPayments: number;
      delivered: number;
    }>("/stats"),
  orders: () => request<TrackingShipment[]>("/orders"),
  myOrders: () => request<TrackingShipment[]>("/orders/mine"),
  createOrder: (payload: Record<string, unknown>) =>
    request<TrackingShipment>("/orders", { method: "POST", body: JSON.stringify(payload) }),
  updateOrderStatus: (id: string, status: string, note?: string, currentTransitIndex?: number, phone?: string) =>
    request<TrackingShipment & { notify?: { sent: boolean; channel?: string; error?: string } }>(
      `/orders/${id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status, note, currentTransitIndex, phone }),
      },
    ),
  updateVoyage: (id: string, payload: Record<string, unknown>) =>
    request<TrackingShipment>(`/orders/${id}/voyage`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  insurance: (code: string) =>
    request<{
      trackingCode: string;
      make?: string;
      model?: string;
      year?: number;
      vinHint?: string;
      firstName?: string;
      lastName?: string;
      docSeries?: string;
      trustee?: string;
      amountUsd?: string;
      amountAzn?: string;
      status: string;
      signRequired?: boolean;
      signUrl?: string;
      notifiedAt?: string;
      paidOutAt?: string;
      receiptUrl?: string;
    }>(`/insurance/${encodeURIComponent(code)}`),
  createInsurance: (payload: {
    firstName: string;
    lastName?: string;
    phone: string;
    docSeries?: string;
    trustee?: string;
    amountUsd?: string;
    vin?: string;
    make?: string;
    model?: string;
    year?: number;
  }) => request<TrackingShipment>("/insurance", { method: "POST", body: JSON.stringify(payload) }),
  insuranceReceipt: (token: string) =>
    request<{
      trackingCode: string;
      customerName: string;
      docSeries?: string;
      trustee?: string;
      make?: string;
      model?: string;
      year?: number;
      amountUsd?: string;
      amountAzn?: string;
      vinHint?: string;
      paidOutAt: string;
      message: string;
    }>(`/insurance/receipt/${encodeURIComponent(token)}`),
  confirmInsurancePayout: (id: string) =>
    request<TrackingShipment & { notify?: { sent: boolean; channel?: string; error?: string }; receiptUrl: string }>(
      `/orders/${id}/insurance/payout`,
      { method: "POST" },
    ),
  sendCustomerSms: (id: string, payload: { kind?: string; text?: string; phone?: string }) =>
    request<TrackingShipment & { notify?: { sent: boolean; channel?: string; error?: string } }>(
      `/orders/${id}/sms`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  updateInsurance: (
    id: string,
    payload: {
      firstName?: string;
      lastName?: string;
      docSeries?: string;
      trustee?: string;
      amountUsd?: string;
      vin?: string;
      make?: string;
      model?: string;
      year?: number;
      status?: string;
      notify?: boolean;
    },
  ) =>
    request<TrackingShipment & { notify?: { sent: boolean; channel?: string; error?: string } }>(
      `/orders/${id}/insurance`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),
  pruneOrderPhotos: (id: string, keepIds: string[], keepUrls: string[] = []) =>
    request<TrackingShipment>(`/orders/${id}/photos`, {
      method: "PUT",
      body: JSON.stringify({ keepIds, keepUrls }),
    }),
  addOrderPhoto: (id: string, payload: { url: string; category?: string; caption?: string }) =>
    request<TrackingShipment>(`/orders/${id}/photos`, {
      method: "POST",
      body: JSON.stringify({
        url: payload.url,
        category: payload.category || "auction",
        caption: payload.caption || "",
      }),
    }),
  testimonials: () =>
    request<{ name: string; role?: string; rating: number; body: string; avatarUrl?: string }[]>(
      "/testimonials",
    ),
  rates: () => request<Record<string, number>>("/currency/rates"),
  lookupContainer: (number: string) => request<OceanLookup>(`/containers/${encodeURIComponent(number)}`),
  lookupOcean: async (number: string) => {
    try {
      return await request<OceanLookup>(`/containers/${encodeURIComponent(number)}`);
    } catch {
      const res = await fetch(`/api/ocean/${encodeURIComponent(number.replace(/[^A-Za-z0-9]/g, ""))}`);
      if (!res.ok) throw new Error("ocean lookup failed");
      return res.json() as Promise<OceanLookup>;
    }
  },
  searchVessels: (name: string) =>
    request<{ results: VesselHit[] }>(`/vessels?name=${encodeURIComponent(name)}`),
  vesselPosition: (mmsi: string) => request<VesselPosition>(`/vessels?mmsi=${encodeURIComponent(mmsi)}`),
  vesselByImo: async (imo: string, near?: { lat?: number; lng?: number; mmsi?: string; name?: string }) => {
    const digits = imo.replace(/\D/g, "");
    const q = new URLSearchParams({ imo: digits });
    if (near?.lat != null && Number.isFinite(near.lat)) q.set("nearLat", String(near.lat));
    if (near?.lng != null && Number.isFinite(near.lng)) q.set("nearLng", String(near.lng));
    const mmsi = near?.mmsi?.replace(/\D/g, "") ?? "";
    if (mmsi.length === 9) q.set("mmsi", mmsi);
    if (near?.name?.trim()) q.set("hintName", near.name.trim());
    try {
      return await request<VesselPosition>(`/vessels?${q.toString()}`);
    } catch {
      const res = await fetch(`/api/vessels?${q.toString()}`);
      if (!res.ok) throw new Error("IMO lookup failed");
      return res.json() as Promise<VesselPosition>;
    }
  },
  attachContainer: (id: string, containerNumber: string) =>
    request<TrackingShipment>(`/orders/${id}/container`, {
      method: "POST",
      body: JSON.stringify({ containerNumber }),
    }),
  createInquiry: async (payload: { name: string; email?: string; phone?: string; body: string }) => {
    try {
      return await request<Inquiry>("/inquiries", { method: "POST", body: JSON.stringify(payload) });
    } catch {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("inquiry failed");
      return res.json() as Promise<Inquiry>;
    }
  },
  inquiries: async () => {
    try {
      return await request<Inquiry[]>("/inquiries");
    } catch {
      const res = await fetch("/api/inquiries");
      if (!res.ok) throw new Error("inquiries failed");
      return res.json() as Promise<Inquiry[]>;
    }
  },
  contracts: () => requestWithLocal<ContractRecord[]>("/contracts"),
  createContract: (payload: Record<string, unknown>) =>
    requestWithLocal<ContractRecord & { notify?: ContractNotify; publicUrl: string }>("/contracts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resendContract: (id: string) =>
    requestWithLocal<ContractRecord & { notify?: ContractNotify; publicUrl: string }>(`/contracts/${id}/resend`, {
      method: "POST",
    }),
  voidContract: (id: string) => requestWithLocal<ContractRecord>(`/contracts/${id}/void`, { method: "POST" }),
  assignContract: (id: string, payload: Record<string, unknown>) =>
    requestWithLocal<ContractRecord>(`/contracts/${id}/assign`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  contractPdf: async (id: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("anx_token") : null;
    let res = await fetch(`${API}/contracts/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      res = await fetch(`/api/contracts/${id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    }
    if (!res.ok) throw new Error("PDF yüklənmədi");
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("pdf") && !type.includes("octet-stream")) {
      throw new Error("PDF yüklənmədi");
    }
    return res.blob();
  },
  publicContract: (token: string, session?: string, lang?: string) =>
    requestWithLocal<PublicContract>(
      `/contracts/public/${encodeURIComponent(token)}${(() => {
        const q = new URLSearchParams();
        if (session) q.set("session", session);
        if (lang) q.set("lang", lang);
        const s = q.toString();
        return s ? `?${s}` : "";
      })()}`,
    ),
  publicContractOtp: (token: string, payload: { purpose: "PHONE_VERIFY" | "SIGN_CONFIRM"; sessionToken?: string }) =>
    requestWithLocal<{ sent: boolean; channel?: string; error?: string; cooldownSec: number; expiresMin: number; devCode?: string | null }>(
      `/contracts/public/${encodeURIComponent(token)}/otp`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  publicContractVerify: (token: string, payload: { purpose: "PHONE_VERIFY" | "SIGN_CONFIRM"; code: string }) =>
    requestWithLocal<{ ok: boolean; sessionToken?: string; purpose: string }>(
      `/contracts/public/${encodeURIComponent(token)}/otp/verify`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  publicContractRead: (token: string, sessionToken: string) =>
    requestWithLocal<{ ok: boolean; status: string }>(`/contracts/public/${encodeURIComponent(token)}/read`, {
      method: "POST",
      body: JSON.stringify({ sessionToken }),
    }),
  publicContractSign: (
    token: string,
    payload: {
      sessionToken: string;
      code: string;
      signaturePng: string;
      readFully: boolean;
      acceptedEsign: boolean;
      acceptedTerms: boolean;
      locale?: string;
    },
  ) =>
    requestWithLocal<{ ok: boolean; status: string; signedAt: string; documentHash: string; publicUrl: string }>(
      `/contracts/public/${encodeURIComponent(token)}/sign`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  publicContractPdfUrl: (token: string) => `/api/contracts/public/${encodeURIComponent(token)}/pdf`,
  catalog: () => request<CatalogCar[]>("/catalog"),
  marketSales: (filters?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    return request<MarketSalesResponse>(`/market-sales/manage${query.size ? `?${query.toString()}` : ""}`);
  },
  customsOptions: (lang: string) =>
    request<{
      AutoEngineTypes: { code: string; name: string; abbreviation2: string }[];
      AutoCategories: { code: string; name: string }[];
    }>(`/customs/auto-options?lang=${encodeURIComponent(lang)}`),
  customsAutoDuty: (payload: Record<string, unknown>, lang: string) =>
    request<{
      usdCourse?: string;
      autoDuty?: {
        duties: { code: string; name: string; value: number }[];
        total: { name: string; value: number };
        customsCost: number;
        usdCourse: number;
      };
    }>(`/customs/auto-duty?lang=${encodeURIComponent(lang)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  shippingQuote: (payload: { url?: string; priceUsd: number; auctionFeeUsd?: number; state?: string; auction?: string; titleKind?: string; yard?: string }) =>
    request<{
      lot?: {
        title?: string;
        vin?: string;
        location?: string;
        shippingFrom?: string;
        state?: string;
        auction?: string;
        year?: number;
        engineCc?: number;
        engineLabel?: string;
        fuel?: string;
        yard?: string;
        yardSlug?: string;
      } | null;
      state: string;
      stateName?: string;
      yard?: string;
      yardSlug?: string;
      matchedYard?: string | null;
      matchedYardSlug?: string | null;
      auction: string;
      band: { id: string; min: number; max: number };
      priceUsd: number;
      auctionFeeUsd?: number;
      auctionFeeSource?: "provided" | "calculated";
      auctionFee?: {
        titleKind?: string;
        buyerUsd: number;
        virtualUsd: number;
        gateUsd: number;
        envUsd: number;
        titleUsd: number;
        totalUsd: number;
      };
      invoiceUsd?: number;
      bandBasisUsd?: number;
      discountUsd?: number;
      baseOceanUsd?: number;
      baseTirUsd?: number;
      usage?: { used: number; monthlyLimit: number | null; remaining: number | null; month: string };
      year?: number;
      engineCc?: number;
      fuel?: string;
      dgkEngineCode?: string;
      oceanUsd: number | null;
      tirUsd: number;
      freightUsd?: number | null;
      totalUsd: number | null;
      missing: boolean;
      rateSource?: "yard" | "yard-alias" | "state" | null;
      cellKey: string;
    }>("/shipping/quote", { method: "POST", body: JSON.stringify(payload) }),
  shippingMeta: () =>
    request<{
      bands: { id: string; min: number; max: number }[];
      auctions: string[];
      states: { code: string; name: string }[];
    }>("/shipping/meta"),
  shippingCatalog: (filters?: { auction?: string; state?: string }) => {
    const query = new URLSearchParams();
    if (filters?.auction) query.set("auction", filters.auction);
    if (filters?.state) query.set("state", filters.state);
    const suffix = query.toString();
    return request<{
      tirUsd: number;
      bands: { id: "a" | "b" | "c"; min: number; max: number }[];
      auctions: string[];
      seedVersion?: string;
      rows: {
        auction: "COPART" | "IAAI";
        state: string;
        stateName?: string;
        yard: string;
        yardSlug: string;
        rates: Record<"a" | "b" | "c", number | null>;
      }[];
    }>(`/shipping/catalog${suffix ? `?${suffix}` : ""}`);
  },
  shippingRates: () =>
    request<{ tirUsd: number; cells: Record<string, number | null> }>("/shipping/rates"),
  saveShippingRates: (payload: { tirUsd: number; cells: Record<string, number | null> }) =>
    request<{ tirUsd: number; cells: Record<string, number | null> }>("/shipping/rates", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  aisSettings: () =>
    request<{ configured: boolean; preview: string | null; source: "admin" | "env" | "none" }>("/settings/ais"),
  saveAisKey: (key: string) =>
    request<{ configured: boolean; preview: string | null; source: "admin" | "env" | "none" }>("/settings/ais", {
      method: "PUT",
      body: JSON.stringify({ key }),
    }),
  testAisKey: (key?: string) =>
    request<{ ok: boolean; message: string }>("/settings/ais/test", {
      method: "POST",
      body: JSON.stringify({ key: key ?? "" }),
    }),
  cloudinarySettings: () =>
    request<{
      configured: boolean;
      source: "admin" | "env" | "none";
      cloudName: string;
      apiKeyPreview: string;
      apiSecretPreview: string;
    }>("/settings/cloudinary"),
  saveCloudinarySettings: (payload: Record<string, unknown>) =>
    request<{
      configured: boolean;
      source: "admin" | "env" | "none";
      cloudName: string;
      apiKeyPreview: string;
      apiSecretPreview: string;
    }>("/settings/cloudinary", { method: "PUT", body: JSON.stringify(payload) }),
  testCloudinarySettings: (payload: Record<string, unknown>) =>
    request<{ ok: boolean; message: string }>("/settings/cloudinary/test", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  catalogManage: () => request<CatalogCar[]>("/catalog/manage"),
  createCatalogCar: (payload: Record<string, unknown>) =>
    request<CatalogCar>("/catalog", { method: "POST", body: JSON.stringify(payload) }),
  updateCatalogCar: (id: string, payload: Record<string, unknown>) =>
    request<CatalogCar>(`/catalog/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCatalogCar: (id: string) => request<{ ok: boolean; id: string }>(`/catalog/${id}`, { method: "DELETE" }),
  markInquiryRead: async (id: string) => {
    try {
      return await request<Inquiry>(`/inquiries/${id}/read`, { method: "PATCH" });
    } catch {
      const res = await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("mark read failed");
      return res.json() as Promise<{ ok: boolean }>;
    }
  },
};
