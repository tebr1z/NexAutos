"use strict";

const DEFAULTS = {
  apiBase: "https://nex.autos/api/v1",
  autoCalculate: false,
};

const BUNDLED_RATE_FILES = [
  "data/caucasus-copart-rates-2026-10-09.json",
  "data/caucasus-iaai-rates-2026-10-10.json",
];
const DIRECTION_WORDS = new Set(["north", "south", "east", "west", "central"]);
let bundledRatesPromise;

function rateSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function comparableRateSlug(value) {
  return rateSlug(value)
    .split("-")
    .map((part) => (part === "ft" ? "fort" : part))
    .filter(Boolean)
    .join("-");
}

function baseRateSlug(value) {
  return comparableRateSlug(value)
    .split("-")
    .filter((part) => !DIRECTION_WORDS.has(part))
    .join("-");
}

async function bundledRates() {
  if (!bundledRatesPromise) {
    bundledRatesPromise = Promise.all(
      BUNDLED_RATE_FILES.map(async (file) => {
        const response = await fetch(chrome.runtime.getURL(file));
        if (!response.ok) throw new Error(`Bundled tarif oxunmadı: ${file}`);
        return response.json();
      }),
    ).then((files) =>
      files.flatMap((file) =>
        (file.rates || []).map(([state, yard, baseUsd]) => ({
          auction: String(file.auction || "").toUpperCase(),
          state: String(state || "").toUpperCase(),
          yard: String(yard || ""),
          slug: rateSlug(yard),
          baseUsd: Number(baseUsd),
        })),
      ),
    );
  }
  return bundledRatesPromise;
}

async function applyBundledRate(quote, requestBody) {
  if (!quote?.missing) return quote;
  const auction = String(requestBody?.auction || quote.auction || "").toUpperCase();
  const state = String(requestBody?.state || quote.state || "").toUpperCase();
  const requestedYard = String(requestBody?.yard || quote.yard || "");
  const requestedSlug = rateSlug(requestedYard);
  if (!requestedSlug || !/^(COPART|IAAI)$/.test(auction) || !/^[A-Z]{2}$/.test(state)) return quote;
  const band = quote.band?.id || (Number(requestBody?.priceUsd) <= 3000 ? "a" : Number(requestBody?.priceUsd) <= 7000 ? "b" : "c");
  const localKey = `${state}:${auction}:${requestedSlug}:${band}`;
  const local = await chrome.storage.local.get({ localRateCells: {} });
  const localRate = Number(local.localRateCells?.[localKey]);
  if (Number.isFinite(localRate) && localRate > 0) {
    const tirUsd = Number(quote.tirUsd) >= 0 ? Number(quote.tirUsd) : 200;
    const freightUsd = localRate + tirUsd;
    return {
      ...quote,
      oceanUsd: localRate,
      tirUsd,
      freightUsd,
      totalUsd: freightUsd + (Number(quote.auctionFeeUsd) || 0),
      missing: false,
      rateSource: "local",
      matchedYard: requestedYard,
      matchedYardSlug: requestedSlug,
    };
  }

  const candidates = (await bundledRates()).filter((row) => row.auction === auction && row.state === state);
  const comparable = comparableRateSlug(requestedSlug);
  const base = baseRateSlug(requestedSlug);
  const match =
    candidates.find((row) => row.slug === requestedSlug) ||
    candidates.find((row) => comparableRateSlug(row.slug) === comparable) ||
    candidates.find((row) => comparableRateSlug(row.slug) === base) ||
    (() => {
      const rows = candidates.filter((row) => baseRateSlug(row.slug) === base);
      return rows.length === 1 ? rows[0] : null;
    })();
  if (!match || !Number.isFinite(match.baseUsd) || match.baseUsd <= 0) return quote;

  const oceanUsd = Math.round(match.baseUsd + (band === "b" ? 50 : band === "c" ? 200 : 0));
  const tirUsd = Number(quote.tirUsd) >= 0 ? Number(quote.tirUsd) : 200;
  const freightUsd = oceanUsd + tirUsd;
  return {
    ...quote,
    oceanUsd,
    tirUsd,
    freightUsd,
    totalUsd: freightUsd + (Number(quote.auctionFeeUsd) || 0),
    missing: false,
    rateSource: "bundled",
    matchedYard: match.yard,
    matchedYardSlug: match.slug,
  };
}

const API_ROUTES = new Set([
  "/health",
  "/health/db",
  "/shipping/quote",
  "/shipping/rates",
  "/auth/login",
  "/auth/refresh",
  "/customs/auto-options?lang=az",
  "/customs/auto-duty?lang=az",
]);

function normalizeApiBase(value) {
  const raw = String(value || DEFAULTS.apiBase).trim().replace(/\/+$/, "");
  const parsed = new URL(raw);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("API ünvanı http və ya https olmalıdır.");
  return raw;
}

async function settings() {
  return chrome.storage.sync.get(DEFAULTS);
}

async function apiRequest(path, init = {}) {
  if (!API_ROUTES.has(path) && !/^\/vins\/[A-HJ-NPR-Z0-9]{17}$/.test(path)) {
    throw new Error("Bu API əməliyyatına icazə yoxdur.");
  }
  const current = await settings();
  const base = normalizeApiBase(current.apiBase);
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method: init.method || "GET",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      credentials: "omit",
    });
  } catch {
    throw new Error("nex.autos API-yə qoşulmaq alınmadı. Production backend-də Chrome extension icazəsi aktiv olmalıdır.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const raw = body && body.message;
    const message = Array.isArray(raw) ? raw.join(" ") : raw;
    const error = new Error(message || `Auto Nex API ${response.status} xətası verdi.`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function refreshSession() {
  const auth = await chrome.storage.local.get({ refreshToken: "" });
  if (!auth.refreshToken) throw new Error("Əvvəl admin hesabı ilə daxil olun.");
  try {
    const data = await apiRequest("/auth/refresh", {
      method: "POST",
      body: { refreshToken: auth.refreshToken },
    });
    await chrome.storage.local.set({ authToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  } catch {
    await chrome.storage.local.remove(["authToken", "refreshToken"]);
    throw new Error("Sessiya bitib. Admin hesabı ilə yenidən daxil olun.");
  }
}

async function staffRequest(path, init = {}) {
  const auth = await chrome.storage.local.get({ authToken: "", refreshToken: "" });
  let accessToken = auth.authToken || (auth.refreshToken ? await refreshSession() : "");
  if (!accessToken) throw new Error("Yol pulunu görmək üçün əvvəl admin hesabı ilə daxil olun.");
  try {
    return await apiRequest(path, { ...init, token: accessToken });
  } catch (error) {
    if (error?.status !== 401 || !auth.refreshToken) throw error;
    accessToken = await refreshSession();
    return apiRequest(path, { ...init, token: accessToken });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(DEFAULTS);
  await chrome.storage.sync.set({
    apiBase: current.apiBase || DEFAULTS.apiBase,
    autoCalculate: false,
  });
});

function isBidCarsUrl(value) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && (url.hostname === "bid.cars" || url.hostname === "www.bid.cars");
  } catch {
    return false;
  }
}

function isCaucasusUrl(value) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && url.hostname === "login.caucasusauto.com";
  } catch {
    return false;
  }
}

function notifyTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "ANX_OPEN_CALCULATOR" }, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(response);
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(response);
    });
  });
}

async function showActionError(error) {
  console.warn("Auto Nex paneli açıla bilmədi:", error instanceof Error ? error.message : String(error));
  await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
  await chrome.action.setBadgeText({ text: "ERR" });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" }).catch(() => {});
  }, 2200);
}

async function handleActionClick(tab) {
  if (tab.id && isCaucasusUrl(tab.url)) {
    try {
      await sendTabMessage(tab.id, { type: "ANX_OPEN_CAUCASUS_SCANNER" });
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["caucasus.js"] });
      await sendTabMessage(tab.id, { type: "ANX_OPEN_CAUCASUS_SCANNER" });
    }
    return;
  }

  if (!tab.id || !isBidCarsUrl(tab.url)) {
    await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
    await chrome.action.setBadgeText({ text: "BID" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2200);
    return;
  }

  try {
    await notifyTab(tab.id);
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["parser.js", "content.js"],
    });
    await notifyTab(tab.id);
  }
}

chrome.action.onClicked.addListener((tab) => {
  void handleActionClick(tab).catch((error) => {
    void showActionError(error).catch(() => {});
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;

  (async () => {
    if (message.type === "ANX_GET_SETTINGS") {
      const auth = await chrome.storage.local.get({ authToken: "", refreshToken: "", authEmail: "" });
      return { ok: true, data: { ...(await settings()), authenticated: Boolean(auth.authToken || auth.refreshToken), authEmail: auth.authEmail } };
    }
    if (message.type === "ANX_SAVE_SETTINGS") {
      const apiBase = normalizeApiBase(message.apiBase);
      const next = { apiBase, autoCalculate: message.autoCalculate !== false };
      await chrome.storage.sync.set(next);
      return { ok: true, data: next };
    }
    if (message.type === "ANX_API") {
      const request = message.path === "/shipping/quote" ? staffRequest : apiRequest;
      const data = await request(message.path, { method: message.method, body: message.body });
      return {
        ok: true,
        data: message.path === "/shipping/quote" ? await applyBundledRate(data, message.body) : data,
      };
    }
    if (message.type === "ANX_LOGIN") {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: { email: String(message.email || "").trim(), password: String(message.password || "") },
      });
      const staff = ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "FREIGHT_USER"];
      if (!data?.accessToken || !staff.includes(data.user?.role)) throw new Error("Yol tarifini yazmaq üçün admin və ya işçi hesabı lazımdır.");
      await chrome.storage.local.set({ authToken: data.accessToken, refreshToken: data.refreshToken, authEmail: data.user.email });
      return { ok: true, data: { email: data.user.email, role: data.user.role } };
    }
    if (message.type === "ANX_LOGOUT") {
      await chrome.storage.local.remove(["authToken", "refreshToken", "authEmail"]);
      return { ok: true, data: { loggedOut: true } };
    }
    if (message.type === "ANX_SAVE_RATE_SMART") {
      const cellKey = String(message.cellKey || "").trim();
      const rateUsd = Math.round(Number(message.rateUsd));
      const tirUsd = Number(message.tirUsd);
      if (!/^[A-Z]{2}:(COPART|IAAI):[a-z0-9-]+:[abc]$/.test(cellKey) || !Number.isFinite(rateUsd) || rateUsd <= 0) {
        throw new Error("Yol pulunu düzgün yazın.");
      }

      const local = await chrome.storage.local.get({ localRateCells: {}, authToken: "", refreshToken: "" });
      await chrome.storage.local.set({ localRateCells: { ...local.localRateCells, [cellKey]: rateUsd } });
      let accessToken = local.authToken || "";
      if (!accessToken && local.refreshToken) {
        try {
          accessToken = await refreshSession();
        } catch {
          accessToken = "";
        }
      }
      if (!accessToken) return { ok: true, data: { saved: true, synced: false, rateUsd } };

      const payload = {
        tirUsd: Number.isFinite(tirUsd) && tirUsd >= 0 ? tirUsd : undefined,
        cells: { [cellKey]: rateUsd },
      };
      try {
        await apiRequest("/shipping/rates", { method: "PUT", token: accessToken, body: payload });
        return { ok: true, data: { saved: true, synced: true, rateUsd } };
      } catch (error) {
        if (error?.status === 401 && local.refreshToken) {
          try {
            accessToken = await refreshSession();
            await apiRequest("/shipping/rates", { method: "PUT", token: accessToken, body: payload });
            return { ok: true, data: { saved: true, synced: true, rateUsd } };
          } catch {
            /* local rate remains available */
          }
        }
        return { ok: true, data: { saved: true, synced: false, rateUsd } };
      }
    }
    if (message.type === "ANX_SAVE_RATE") {
      const auth = await chrome.storage.local.get({ authToken: "", refreshToken: "" });
      let accessToken = auth.authToken || (auth.refreshToken ? await refreshSession() : "");
      if (!accessToken) throw new Error("Əvvəl admin e-poçtu və şifrəsi ilə daxil olun.");
      const cellKey = String(message.cellKey || "").trim();
      const rateUsd = Number(message.rateUsd);
      const tirUsd = Number(message.tirUsd);
      if (!cellKey || !Number.isFinite(rateUsd) || rateUsd <= 0) throw new Error("Yol pulunu düzgün yazın.");
      const payload = { tirUsd: Number.isFinite(tirUsd) && tirUsd >= 0 ? tirUsd : undefined, cells: { [cellKey]: rateUsd } };
      let data;
      try {
        data = await apiRequest("/shipping/rates", { method: "PUT", token: accessToken, body: payload });
      } catch (error) {
        if (error?.status !== 401) throw error;
        accessToken = await refreshSession();
        data = await apiRequest("/shipping/rates", { method: "PUT", token: accessToken, body: payload });
      }
      return { ok: true, data };
    }
    if (message.type === "ANX_SAVE_RATES") {
      const auth = await chrome.storage.local.get({ authToken: "", refreshToken: "" });
      let accessToken = auth.authToken || (auth.refreshToken ? await refreshSession() : "");
      if (!accessToken) throw new Error("Əvvəl BidCars panelində admin hesabı ilə daxil olun.");
      const sourceCells = message.cells && typeof message.cells === "object" ? message.cells : {};
      const cells = {};
      for (const [key, value] of Object.entries(sourceCells)) {
        const rate = Number(value);
        if (/^[A-Z]{2}:(COPART|IAAI):[a-z0-9-]+:[abc]$/.test(key) && Number.isFinite(rate) && rate > 0) {
          cells[key] = Math.round(rate);
        }
      }
      if (!Object.keys(cells).length) throw new Error("DB-yə yazılacaq düzgün tarif tapılmadı.");
      const payload = { tirUsd: 200, cells };
      let data;
      try {
        data = await apiRequest("/shipping/rates", { method: "PUT", token: accessToken, body: payload });
      } catch (error) {
        if (error?.status !== 401) throw error;
        accessToken = await refreshSession();
        data = await apiRequest("/shipping/rates", { method: "PUT", token: accessToken, body: payload });
      }
      return { ok: true, data: { saved: Object.keys(cells).length, rates: data } };
    }
    throw new Error("Naməlum Auto Nex əməliyyatı.");
  })()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));

  return true;
});
