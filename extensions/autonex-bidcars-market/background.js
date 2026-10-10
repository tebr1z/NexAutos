"use strict";

const DEFAULT_API = "https://nex.autos/api/v1";
const ALLOWED = new Set(["/shipping/quote", "/customs/auto-options?lang=az", "/customs/auto-duty?lang=az"]);

async function api(path, method = "GET", body) {
  if (!ALLOWED.has(path)) throw new Error("Bu API əməliyyatına icazə yoxdur.");
  const settings = await chrome.storage.sync.get({ apiBase: DEFAULT_API });
  const base = String(settings.apiBase || DEFAULT_API).replace(/\/+$/, "");
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    credentials: "omit"
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Auto Nex API ${response.status} xətası verdi.`);
  return data;
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get({ apiBase: DEFAULT_API });
  await chrome.storage.sync.set({ apiBase: current.apiBase || DEFAULT_API });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ANM_API") return false;
  api(message.path, message.method, message.body).then((data) => sendResponse({ ok: true, data })).catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https:\/\/(?:www\.)?bid\.cars\//i.test(tab.url || "")) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "ANM_TOGGLE" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["parser.js", "content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "ANM_TOGGLE" });
  }
});
