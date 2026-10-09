"use strict";

const DEFAULTS = {
  apiBase: "https://nex.autos/api/v1",
  autoCalculate: false,
};

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
  if (!API_ROUTES.has(path)) throw new Error("Bu API əməliyyatına icazə yoxdur.");
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

function notifyTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "ANX_OPEN_CALCULATOR" }, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(response);
    });
  });
}

chrome.action.onClicked.addListener(async (tab) => {
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
      return {
        ok: true,
        data: await apiRequest(message.path, { method: message.method, body: message.body }),
      };
    }
    if (message.type === "ANX_LOGIN") {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: { email: String(message.email || "").trim(), password: String(message.password || "") },
      });
      const staff = ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"];
      if (!data?.accessToken || !staff.includes(data.user?.role)) throw new Error("Yol tarifini yazmaq üçün admin və ya işçi hesabı lazımdır.");
      await chrome.storage.local.set({ authToken: data.accessToken, refreshToken: data.refreshToken, authEmail: data.user.email });
      return { ok: true, data: { email: data.user.email, role: data.user.role } };
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
    throw new Error("Naməlum Auto Nex əməliyyatı.");
  })()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));

  return true;
});
