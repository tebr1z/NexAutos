"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const parser = require("./parser.js");
const source = name => fs.readFileSync(path.join(__dirname, name), "utf8");
const lotUrl = "https://bid.cars/en/lot/1-78515965/2021-KIA-K5-5XXG64J23MG033163";
const invalidUrls = ["https://bid.cars/", "https://bid.cars/en/", "https://bid.cars/en/search/results?search-type=filters", "https://bid.cars/en/user/personal-information", "https://bid.cars/en/user/increase-power", "https://example.com/", "https://bid.cars.evil.example/en/lot/1-123/car", "http://bid.cars/en/lot/1-123/car", "https://bid.cars/en/lot/not-a-lot", "chrome://extensions/", ""];
const tick = () => new Promise(resolve => setImmediate(resolve));

function fakeTextRoot(parts) {
  const nodes = parts.map(([tag, text, extension]) => ({ nodeValue: text, parentElement: { extension, closest: () => /^(script|style|noscript|template|svg|canvas|iframe|object)$/.test(tag) ? {} : null } }));
  return { ownerDocument: { createTreeWalker: () => { let index = -1; return { nextNode() { return ++index < nodes.length; }, get currentNode() { return nodes[index]; } }; } } };
}
test("only real HTTPS BidCars lot routes are accepted, never home/search/profile/other sites", () => {
  for (const url of invalidUrls) {
    assert.equal(parser.isBidCarsLotUrl(url), false, url);
    if (url) assert.equal(parser.parseSnapshot({ url, text: "Location: location.href='https://bid.cars/en/user/increase-power'; Current Bid $999" }), null, url);
  }
  for (const url of [lotUrl, `${lotUrl}?language=en#bid`, "https://www.bid.cars/pl/lot/0-123/Car", "https://bid.cars/lot/1-123", "https://bid.cars/en/lot/1-123/", "https://bid.cars/en/vehicles/archive/lot/0-38985660/2017-Nissan-370Z/details"]) assert.equal(parser.isBidCarsLotUrl(url), true, url);
});
test("document reader excludes source code and the calculator, but keeps hidden specifications", () => {
  const root = fakeTextRoot([
    ["script", "location.href='https://bid.cars/en/user/personal-information'; Engine Electric Fuel Type Diesel Location: wrong"],
    ["style", ".thing { color:red; }"], ["noscript", "JavaScript disabled"], ["svg", "Icon text"],
    ["div", "Location: Savannah (GA) Shipping from: Savannah (GA)"],
    ["div", "Engine 1.6L, 4 cyl. Transmission Automatic Fuel Type Hybrid Drive Type FWD"],
    ["div", "Current Bid $2,200 USD"], ["div", "Auto Nex Location: Fake (NY)", true],
  ]);
  const text = parser.readDocumentText(root, { contains: element => element.extension });
  assert.doesNotMatch(text, /location\.href|wrong|JavaScript disabled|color:red|Fake/);
  const parsed = parser.parseSnapshot({ url: lotUrl, title: "2021 KIA K5 Copart", text });
  assert.equal(parsed.priceUsd, 2200);
  assert.equal(parsed.engineCc, 1600);
  assert.equal(parsed.fuel, "Hybrid");
  assert.equal(parsed.location, "Savannah (GA)");
});

function backgroundFixture(url, fetchMock) {
  const calls = { tabMessages: [], injections: [], fetches: [], titles: [] };
  let onMessage;
  const context = vm.createContext({ URL, console, setTimeout: (fn, ms) => { if (ms < 10000) queueMicrotask(fn); return 1; }, clearTimeout() {}, AbortController,
    fetch: async (...args) => { calls.fetches.push(args); if (fetchMock) return fetchMock(...args); throw new Error("No real network in tests"); },
    chrome: {
      runtime: { getURL: file => `chrome-extension://test/${file}`, onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { onMessage = fn; } } },
      action: { onClicked: { addListener() {} }, setBadgeBackgroundColor: async () => {}, setBadgeText: async () => {}, setTitle: async value => calls.titles.push(value) },
      storage: { sync: { get: async defaults => defaults, set: async () => {} }, local: { get: async defaults => defaults } },
      tabs: { query: async () => [{ id: 7, url }], sendMessage: (id, message, done) => { calls.tabMessages.push({ id, message }); done({ ok: true }); } },
      scripting: { executeScript: async value => calls.injections.push(value) },
    },
  });
  context.importScripts = file => vm.runInContext(source(file), context);
  vm.runInContext(source("background.js"), context);
  return { context, calls, message: (message, sender = {}) => new Promise(resolve => onMessage(message, sender, resolve)) };
}
test("background never injects or fetches a quotation from an unsupported page", async () => {
  for (const url of invalidUrls) {
    const app = backgroundFixture(url);
    await app.context.handleActionClick({ id: 7, url });
    assert.equal(app.calls.tabMessages.length, 0, url);
    assert.equal(app.calls.injections.length, 0, url);
    const response = await app.message({ type: "ANX_API", path: "/shipping/quote", body: { url } }, { tab: { id: 7, url } });
    assert.equal(response.ok, false, url);
    assert.match(response.error, /lot səhifəsini/);
    assert.equal(app.calls.fetches.length, 0);
  }
});
test("popup open messages use the actual active tab and cannot be triggered by a content script", async () => {
  const app = backgroundFixture(lotUrl);
  const response = await app.message({ type: "ANX_OPEN_ACTIVE_TAB" }, { url: "chrome-extension://test/popup.html" });
  assert.equal(response.ok, true);
  assert.equal(app.calls.tabMessages[0].message.type, "ANX_OPEN_CALCULATOR");
  const denied = await app.message({ type: "ANX_OPEN_ACTIVE_TAB" }, { url: lotUrl, tab: { id: 7, url: lotUrl } });
  assert.equal(denied.ok, false);
  const home = backgroundFixture("https://bid.cars/en/");
  assert.equal((await home.message({ type: "ANX_OPEN_ACTIVE_TAB" }, { url: "chrome-extension://test/popup.html" })).ok, false);
  assert.equal(home.calls.tabMessages.length, 0);
});
test("DGK alone gets three attempts for delayed/errors/invalid responses and a friendly final message", async () => {
  let count = 0;
  const body = { AutoCategories: [{ code: '1' }], AutoEngineTypes: [{ code: '1' }] };
  const recovered = backgroundFixture(lotUrl, async () => { count++; return { ok: count >= 3, status: count >= 3 ? 200 : 502, json: async () => count >= 3 ? body : { message: 'DGK is slow' } }; });
  const answer = await recovered.message({ type: 'ANX_API', path: '/customs/auto-options?lang=az' });
  assert.equal(answer.ok, true); assert.equal(count, 3);
  const malformed = backgroundFixture(lotUrl, async () => ({ ok: true, status: 200, json: async () => ({ autoDuty: null }) }));
  const failed = await malformed.message({ type: 'ANX_API', path: '/customs/auto-duty?lang=az' });
  assert.equal(malformed.calls.fetches.length, 3); assert.equal(failed.ok, false); assert.match(failed.error, /Gömrüklə bağlı müvəqqəti problem/);
  const rejected = backgroundFixture(lotUrl, async () => ({ ok: false, status: 400, json: async () => ({ message: 'Mühərrik lazımdır' }) }));
  assert.equal((await rejected.message({ type: 'ANX_API', path: '/customs/auto-duty?lang=az' })).ok, false);
  assert.equal(rejected.calls.fetches.length, 1);
});

async function popupFixture(url, fail = false) {
  const elements = Object.fromEntries(["notice", "retry", "openBidCars"].map(id => [id, { hidden: false, textContent: "", addEventListener() {} }]));
  let sent = 0, closed = 0;
  const context = vm.createContext({ URL, console, AutoNexBidCarsParser: parser, document: { getElementById: id => elements[id] }, window: { close: () => { closed++; } },
    chrome: { tabs: { query: async () => [{ id: 7, url }] }, runtime: { sendMessage: async () => { sent++; return fail ? { ok: false, error: typeof fail === "string" ? fail : "Ctrl+R ilə yeniləyin" } : { ok: true }; } } },
  });
  vm.runInContext(source("popup.js"), context); await tick();
  return { elements, sent, closed };
}
test("popup displays a polite notice without reading on home/search/foreign/restricted tabs", async () => {
  for (const url of invalidUrls) {
    const popup = await popupFixture(url);
    assert.equal(popup.sent, 0, url);
    assert.equal(popup.closed, 0);
    assert.match(popup.elements.notice.textContent, /Zəhmət olmasa BidCars/);
    assert.equal(popup.elements.openBidCars.hidden, false);
  }
});
test("valid lots still open the calculator; Caucasus scanner and retry feedback are preserved", async () => {
  for (const url of [lotUrl, "https://login.caucasusauto.com/admin.php?cat=invoice&action=add"]) {
    const popup = await popupFixture(url);
    assert.equal(popup.sent, 1); assert.equal(popup.closed, 1);
  }
  const failed = await popupFixture(lotUrl, true);
  assert.equal(failed.closed, 0); assert.equal(failed.elements.retry.hidden, false);
  const staleContext = await popupFixture(lotUrl, "Could not establish connection. Receiving end does not exist.");
  assert.match(staleContext.elements.notice.textContent, /Ctrl\+R/);
});

function contentFixture(initialUrl) {
  const elements = {}, calls = { walks: 0, parsed: 0, messages: [] }, timers = new Map();
  let onMessage, mutation, nextTimer = 0, quoteCallback;
  function element(id) {
    if (elements[id]) return elements[id];
    const node = { id, value: "", textContent: "", hidden: false, disabled: false, events: {}, classList: { add() {}, toggle() {} }, addEventListener(event, fn) { this.events[event] = fn; }, querySelector: query => element(`${id}:${query}`), get selectedOptions() { return [{ disabled: false }]; } };
    elements[id] = node; return node;
  }
  const shadow = { getElementById: element, querySelector: () => element("card") };
  const host = { id: "", hidden: true, attachShadow: () => shadow, contains: () => false };
  const body = fakeTextRoot([["script", "Location: location.href='https://bid.cars/en/user/increase-power';"], ["div", "Current Bid $2,200 USD Location: Savannah (GA) Shipping from: Savannah (GA) Engine 1.6L Transmission Automatic Fuel Type Hybrid Drive Type FWD"]]);
  const oldWalker = body.ownerDocument.createTreeWalker;
  body.ownerDocument.createTreeWalker = (...args) => { calls.walks++; return oldWalker(...args); };
  const location = { href: initialUrl };
  const context = vm.createContext({ URL, console, location, AutoNexBidCarsParser: { ...parser, parseSnapshot(snapshot) { calls.parsed++; return parser.parseSnapshot(snapshot); } },
    document: { body, title: "2021 KIA K5 Copart", getElementById: () => null, createElement: () => host, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, documentElement: { appendChild(node) { node.parentElement = this; } } },
    window: { clearTimeout: id => timers.delete(id), setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; } },
    MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} },
    chrome: { runtime: { id: "test", onMessage: { addListener(fn) { onMessage = fn; } }, sendMessage(message, callback) {
      calls.messages.push(message);
      if (message.type === "ANX_GET_SETTINGS") callback({ ok: true, data: { authenticated: true, authEmail: "test@example.com" } });
      else if (message.path === "/calculator/me") callback({ ok: true, data: { expired: false, brandName: "Auto Nex" } });
      else if (message.path === "/shipping/quote") quoteCallback = callback;
      else callback({ ok: true, data: {} });
    } } },
  });
  vm.runInContext(source("content.js"), context);
  return { elements, calls, location, host, open: () => onMessage({ type: "ANX_OPEN_CALCULATOR" }, {}, () => {}), mutate() { mutation(); const queued = [...timers.values()]; timers.clear(); queued.forEach(fn => fn()); }, finishQuote() { quoteCallback?.({ ok: true, data: { freightUsd: 2000, auctionFeeUsd: 600 } }); } };
}
test("content script never scans non-lot DOM, including forced refresh and Calculate", async () => {
  for (const url of invalidUrls.filter(url => url.startsWith("https://bid.cars/"))) {
    const app = contentFixture(url); await tick(); app.open(); await tick();
    app.elements.refresh.events.click(); app.elements.calculate.events.click(); await tick();
    assert.equal(app.calls.walks, 0, url);
    assert.equal(app.calls.parsed, 0, url);
    assert.equal(app.elements.pageNotice.hidden, false);
    assert.equal(app.elements.calculatorContent.hidden, true);
    assert.equal(app.elements.refresh.disabled, true);
    assert.equal(app.calls.messages.filter(message => message.type === "ANX_API").length, 0);
    assert.doesNotMatch(app.elements.status.textContent, /location\.href/);
  }
});
test("lot navigation clears stale fields/results and ignores an in-flight quote after leaving the lot", async () => {
  const app = contentFixture(lotUrl); await tick();
  assert.ok(app.calls.parsed > 0);
  assert.equal(app.elements.price.value, "2200");
  assert.equal(app.elements.location.value, "Savannah (GA)");
  app.elements.calculate.events.click(); await tick();
  assert.equal(app.calls.messages.filter(message => message.path === "/shipping/quote").length, 1);
  app.location.href = "https://bid.cars/en/search/results"; app.mutate();
  const scans = app.calls.parsed;
  app.finishQuote(); await tick();
  assert.equal(app.elements.location.value, ""); assert.equal(app.elements.price.value, "");
  assert.equal(app.elements.result.hidden, true); assert.equal(app.elements.rateEditor.hidden, true);
  assert.equal(app.elements.pageNotice.hidden, false); assert.equal(app.elements.calculatorContent.hidden, true);
  app.elements.refresh.events.click(); await tick();
  assert.equal(app.calls.parsed, scans);
  app.location.href = lotUrl; app.mutate(); await tick();
  assert.equal(app.elements.pageNotice.hidden, true);
  assert.equal(app.elements.calculatorContent.hidden, false);
  assert.equal(app.elements.price.value, "2200");
});
