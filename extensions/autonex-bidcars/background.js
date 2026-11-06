"use strict";

importScripts("parser.js");
const pageParser = globalThis.AutoNexBidCarsParser;

const DEFAULTS = {
  apiBase: "https://nex.autos/api/v1",
  autoCalculate: false,
};


const API_ROUTES = new Set([
  "/calculator/me",
  "/calculator/reports",
  "/health",
  "/health/db",
  "/shipping/quote",
  "/shipping/rates",
  "/auth/login",
  "/auth/refresh",
  "/customs/auto-options?lang=az",
  "/customs/auto-duty?lang=az",
]);

async function settings() {
  const current = await chrome.storage.sync.get({ autoCalculate: DEFAULTS.autoCalculate });
  return { apiBase: DEFAULTS.apiBase, autoCalculate: current.autoCalculate === true };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, init, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => null);
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

async function apiRequest(path, init = {}) {
  if (!API_ROUTES.has(path) && !/^\/vins\/[A-HJ-NPR-Z0-9]{17}$/.test(path)) {
    throw new Error("Bu API əməliyyatına icazə yoxdur.");
  }
  const base = DEFAULTS.apiBase;
  const isCustoms = path.startsWith('/customs/');
  const customsMessage = 'Gömrüklə bağlı müvəqqəti problem var. Zəhmət olmasa bir az sonra yenidən yoxlayın.';
  const validCustomsBody = body => path.includes('auto-options')
    ? Array.isArray(body?.AutoCategories) && body.AutoCategories.length > 0 && Array.isArray(body?.AutoEngineTypes) && body.AutoEngineTypes.length > 0
    : body?.autoDuty?.total?.value != null && Number.isFinite(Number(body.autoDuty.total.value)) && Number(body.autoDuty.total.value) >= 0 && Number(body.autoDuty.usdCourse) > 0;
  const attempts = isCustoms ? 3 : 2;
  let response, body;
  const request = {
    method: init.method || "GET",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    credentials: "omit",
  };
  let lastNetworkError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    response = null; body = null;
    try {
      const result = await fetchWithTimeout(`${base}${path}`, request);
      response = result.response; body = result.body;
      const temporary = (isCustoms ? [408, 429, 500, 502, 503, 504] : [502, 503, 504]).includes(response.status) || (isCustoms && response.ok && !validCustomsBody(body));
      if (!temporary || attempt === attempts - 1) break;
    } catch (error) {
      lastNetworkError = error;
      if (attempt === attempts - 1) break;
    }
    await delay(isCustoms ? 1500 * (attempt + 1) : 450);
  }
  if (!response) {
    if (isCustoms) throw new Error(customsMessage);
    const timedOut = lastNetworkError?.name === "AbortError";
    const detail = timedOut ? "sorğunun vaxtı bitdi" : "şəbəkə bağlantısı alınmadı";
    throw new Error(`nex.autos API-yə qoşulmaq alınmadı (${detail}). İnterneti yoxlayıb yenidən Hesabla basın.`);
  }
  if (!response.ok || (isCustoms && !validCustomsBody(body))) {
    const raw = body && body.message;
    const message = Array.isArray(raw) ? raw.join(" ") : raw;
    const unavailable = isCustoms && (response.ok || response.status >= 500 || [408, 429].includes(response.status));
    const error = new Error(unavailable ? customsMessage : message || `Auto Nex API ${response.status} xətası verdi.`);
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
  } catch (error) {
    if ([400, 401, 403].includes(error?.status)) {
      await chrome.storage.local.remove(["authToken", "refreshToken", "authEmail"]);
      throw new Error("Sessiya bitib. Hesabınızla yenidən daxil olun.");
    }
    throw error;
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
  await chrome.storage.sync.set({
    apiBase: DEFAULTS.apiBase,
    autoCalculate: false,
  });
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.storage.sync.set({ apiBase: DEFAULTS.apiBase });
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

  if (!tab.id || !isBidCarsUrl(tab.url) || !pageParser.isBidCarsLotUrl(tab.url)) {
    await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
    await chrome.action.setBadgeText({ text: "BID" });
    await chrome.action.setTitle({ title: pageParser.LOT_PAGE_NOTICE });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2200);
    return;
  }

  try {
    await chrome.action.setTitle({ title: "BidCars səhifəsini Auto Nex ilə hesabla" });
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
    if (message.type === "ANX_OPEN_ACTIVE_TAB") {
      if (_sender.tab || _sender.url !== chrome.runtime.getURL("popup.html")) throw new Error("Bu əməliyyat yalnız extension ikonundan açılır.");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || (!pageParser.isBidCarsLotUrl(tab.url) && !isCaucasusUrl(tab.url))) throw new Error(pageParser.LOT_PAGE_NOTICE);
      await handleActionClick(tab);
      return { ok: true, data: { opened: true } };
    }
    if (message.type === "ANX_GET_SETTINGS") {
      const auth = await chrome.storage.local.get({ authToken: "", refreshToken: "", authEmail: "" });
      return { ok: true, data: { ...(await settings()), authenticated: Boolean(auth.authToken || auth.refreshToken), authEmail: auth.authEmail } };
    }
    if (message.type === "ANX_SAVE_SETTINGS") {
      const next = { apiBase: DEFAULTS.apiBase, autoCalculate: message.autoCalculate !== false };
      await chrome.storage.sync.set(next);
      return { ok: true, data: next };
    }
    if (message.type === "ANX_API") {
      if (message.path === "/shipping/quote" && (!pageParser.isBidCarsLotUrl(message.body?.url) || (_sender.tab && !pageParser.isBidCarsLotUrl(_sender.tab.url)))) throw new Error(pageParser.LOT_PAGE_NOTICE);
      const request = message.path === "/shipping/quote" || message.path.startsWith("/calculator/") ? staffRequest : apiRequest;
      const data = await request(message.path, { method: message.method, body: message.body });
      if (message.path === "/shipping/quote" && !data.pricingApplied) throw new Error("Server yenilənməlidir. Admin yeni kalkulyator versiyasını deploy etməlidir.");
      return {
        ok: true,
        data,
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
      await staffRequest("/shipping/rates", { method: "PUT", body: { cells: { [String(message.cellKey)]: Number(message.rateUsd) } } });
      return { ok: true, data: { saved: true, synced: true } };
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
