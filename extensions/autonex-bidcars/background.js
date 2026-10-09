"use strict";

const DEFAULTS = {
  apiBase: "https://nex.autos/api/v1",
  autoCalculate: false,
};

const API_ROUTES = new Set([
  "/health",
  "/health/db",
  "/shipping/quote",
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
  const response = await fetch(`${base}${path}`, {
    method: init.method || "GET",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    credentials: "omit",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const raw = body && body.message;
    const message = Array.isArray(raw) ? raw.join(" ") : raw;
    throw new Error(message || `Auto Nex API ${response.status} xətası verdi.`);
  }
  return body;
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
      return { ok: true, data: await settings() };
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
    throw new Error("Naməlum Auto Nex əməliyyatı.");
  })()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));

  return true;
});
