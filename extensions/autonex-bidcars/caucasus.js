(function mountCaucasusScanner() {
  "use strict";

  if (document.getElementById("anx-caucasus-scanner")) return;
  if (location.hostname !== "login.caucasusauto.com") return;

  const STORAGE_KEY = "caucasusScannerStateV1";
  const PRICE_USD = 1500;
  const REQUEST_DELAY_MS = 2400;
  const BAND_OFFSETS = { a: 0, b: 50, c: 200 };
  const SOURCE_AUCTIONS = [
    { value: "Copart", code: "COPART" },
    { value: "IAAI", code: "IAAI" },
  ];

  const host = document.createElement("div");
  host.id = "anx-caucasus-scanner";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host{position:fixed;z-index:2147483646;right:18px;bottom:18px;width:min(390px,calc(100vw - 28px));font-family:Inter,Arial,sans-serif;color:#e5e7eb}
      :host([hidden]){display:none!important}*{box-sizing:border-box}.card{border:1px solid #334155;border-radius:15px;background:#0b1220;box-shadow:0 18px 50px rgba(0,0,0,.38);overflow:hidden}.head{display:flex;justify-content:space-between;align-items:center;padding:13px 14px;background:linear-gradient(135deg,#071426,#17335d);border-bottom:1px solid #334155}.brand{font-weight:900;font-size:14px}.sub{margin-top:2px;color:#9db0c9;font-size:10px;font-weight:500}.body{padding:13px 14px}.rule{padding:9px 10px;border:1px solid #2f4667;border-radius:9px;background:#101c30;color:#bfdbfe;font-size:11px;line-height:1.5}.progress{margin-top:10px;color:#dbeafe;font-size:12px;font-weight:700}.status{min-height:34px;margin-top:7px;color:#91a5bf;font-size:11px;line-height:1.45;white-space:pre-wrap}.status.error{color:#fca5a5}.bar{height:7px;margin-top:8px;border-radius:99px;background:#1e293b;overflow:hidden}.bar i{display:block;height:100%;width:0;background:#22c55e;transition:width .2s}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}button{border:1px solid #3a4a62;border-radius:9px;background:#172033;color:#e5e7eb;padding:9px 8px;font:800 11px inherit;cursor:pointer}.primary{background:#2563eb;border-color:#2563eb;color:#fff}.danger{background:#7f1d1d;border-color:#991b1b}.close{border:0;background:transparent;padding:3px 7px;font-size:16px}.note{margin-top:9px;color:#6f86a4;font-size:9px;line-height:1.4}
    </style>
    <section class="card">
      <header class="head"><div><div class="brand">AN · Yol tarifi toplayıcısı</div><div class="sub">Caucasus Auto → Auto Nex</div></div><button class="close" id="close">×</button></header>
      <div class="body">
        <div class="rule">0–3000: saytdan oxunur<br>3001–7000: əsas + $50<br>7001–150000: orta qrup + $150 (əsas + $200)<br>Poti–Bakı: ayrıca $200</div>
        <div class="progress" id="progress">Hazırdır</div><div class="bar"><i id="bar"></i></div>
        <div class="status" id="status">Başlat düyməsi Copart və IAAI şəhərlərini gecikmə ilə oxuyacaq. Invoice yaradılmır.</div>
        <div class="actions"><button class="primary" id="start">Başlat</button><button id="pause">Dayandır</button><button id="json">JSON yüklə</button><button id="save">DB-yə yaz</button></div>
        <div class="actions"><button class="danger" id="reset">Nəticəni sıfırla</button><button id="hide">Paneli gizlət</button></div>
        <div class="note">Skan dayanarsa səhifəni yeniləyib extension ikonuna vurun və Başlat seçin. Qaldığı yerdən davam edəcək.</div>
      </div>
    </section>`;
  document.documentElement.appendChild(host);

  const $ = (id) => shadow.getElementById(id);
  const refs = { progress: $("progress"), status: $("status"), bar: $("bar"), start: $("start"), pause: $("pause"), json: $("json"), save: $("save"), reset: $("reset"), close: $("close"), hide: $("hide") };
  let running = false;
  let paused = false;
  let scannerState = null;

  function send(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.ok) return reject(new Error(response?.error || "Auto Nex əlavəsi cavab vermədi."));
        resolve(response.data);
      });
    });
  }

  function sleep(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
  function options(id) {
    const element = document.getElementById(id);
    return element ? [...element.options].map((option) => ({ value: option.value, label: option.textContent.trim() })).filter((option) => option.value) : [];
  }
  function select(id, value) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`${id} sahəsi tapılmadı.`);
    element.value = String(value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function setInput(id, value) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`${id} sahəsi tapılmadı.`);
    element.value = String(value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
  async function waitForOptions(id, timeoutMs = 18000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (paused) throw new Error("Skan dayandırıldı.");
      const rows = options(id);
      if (rows.length) return rows;
      await sleep(300);
    }
    throw new Error(`${id} siyahısı gecikdi.`);
  }
  async function chooseAndWait(sourceId, value, targetId) {
    const target = document.getElementById(targetId);
    if (target) target.innerHTML = target.options?.[0]?.outerHTML || "";
    select(sourceId, value);
    const rows = await waitForOptions(targetId);
    await sleep(REQUEST_DELAY_MS);
    return rows;
  }
  function slug(value) {
    return String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function cellKey(state, auction, yard, band) { return `${state}:${auction}:${slug(yard)}:${band}`; }
  function freshState() {
    return { version: 1, source: location.href, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), rule: { sourceBand: "0-3000", sourcePriceUsd: PRICE_USD, offsetsUsd: BAND_OFFSETS, tirUsd: 200 }, cursor: { auction: "", state: "", city: "" }, rates: [], cells: {}, failures: [] };
  }
  async function loadState() {
    const stored = await chrome.storage.local.get({ [STORAGE_KEY]: null });
    scannerState = stored[STORAGE_KEY] || freshState();
    updateUi();
  }
  async function persist() {
    scannerState.updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ [STORAGE_KEY]: scannerState });
    updateUi();
  }
  function updateUi(message) {
    const count = scannerState?.rates?.length || 0;
    const failed = scannerState?.failures?.length || 0;
    refs.progress.textContent = `${running ? "Oxunur" : paused ? "Dayanıb" : "Hazırdır"} · ${count} şəhər · ${Object.keys(scannerState?.cells || {}).length} tarif · ${failed} xəta`;
    refs.bar.style.width = `${Math.min(100, (count / 650) * 100)}%`;
    if (message) refs.status.textContent = message;
    refs.start.disabled = running;
  }
  async function calculateBaseRate() {
    select("price_range", "1");
    setInput("car_price", PRICE_USD);
    if (document.getElementById("engine_volume")) select("engine_volume", "2000");
    const row = document.getElementById("row_data");
    if (row) row.innerHTML = "";
    const button = document.getElementById("count");
    if (!button) throw new Error("калькуляция düyməsi tapılmadı.");
    button.click();
    const started = Date.now();
    while (Date.now() - started < 22000) {
      if (paused) throw new Error("Skan dayandırıldı.");
      const total = Number(document.getElementById("total_car_price")?.value);
      if (Number.isFinite(total) && total > PRICE_USD) return Math.round(total - PRICE_USD);
      await sleep(350);
    }
    throw new Error("Tarif nəticəsi vaxtında gəlmədi.");
  }
  function alreadyDone(auction, state, city) {
    return scannerState.rates.some((row) => row.auction === auction && row.state === state && row.yard === city);
  }
  async function scan() {
    if (running) return;
    running = true;
    paused = false;
    updateUi("Skan başlayır…");
    try {
      for (const auction of SOURCE_AUCTIONS) {
        if (paused) break;
        const states = await chooseAndWait("auction", auction.value, "state");
        for (const state of states.filter((row) => /^[A-Z]{2}$/.test(row.value))) {
          if (paused) break;
          let cities;
          try { cities = await chooseAndWait("state", state.value, "citi"); }
          catch (error) {
            scannerState.failures.push({ auction: auction.code, state: state.value, error: error.message });
            await persist();
            continue;
          }
          for (const city of cities) {
            if (paused) break;
            if (alreadyDone(auction.code, state.value, city.label)) continue;
            scannerState.cursor = { auction: auction.code, state: state.value, city: city.label };
            updateUi(`${auction.code} · ${state.value} · ${city.label} oxunur…`);
            try {
              const ports = await chooseAndWait("citi", city.value, "loading_port");
              const port = ports[0];
              if (!port) throw new Error("Yükləmə limanı tapılmadı.");
              select("loading_port", port.value);
              await sleep(REQUEST_DELAY_MS);
              const baseUsd = await calculateBaseRate();
              const cells = {
                [cellKey(state.value, auction.code, city.label, "a")]: baseUsd,
                [cellKey(state.value, auction.code, city.label, "b")]: baseUsd + BAND_OFFSETS.b,
                [cellKey(state.value, auction.code, city.label, "c")]: baseUsd + BAND_OFFSETS.c,
              };
              Object.assign(scannerState.cells, cells);
              scannerState.rates.push({ auction: auction.code, state: state.value, yard: city.label, port: port.value, baseUsd, bands: { a: baseUsd, b: baseUsd + 50, c: baseUsd + 200 } });
            } catch (error) {
              scannerState.failures.push({ auction: auction.code, state: state.value, yard: city.label, error: error instanceof Error ? error.message : String(error) });
            }
            await persist();
            await sleep(REQUEST_DELAY_MS);
          }
        }
      }
      if (!paused) updateUi(`Skan tamamlandı. ${scannerState.rates.length} şəhər hazırdır. JSON-u yükləyin, sonra DB-yə yazın.`);
    } catch (error) {
      refs.status.className = "status error";
      updateUi(error instanceof Error ? error.message : String(error));
    } finally {
      running = false;
      updateUi();
    }
  }
  function downloadJson() {
    if (!scannerState) return;
    const blob = new Blob([JSON.stringify(scannerState, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `autonex-caucasus-rates-${new Date().toISOString().slice(0, 10)}.json`;
    document.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    updateUi("JSON ehtiyat nüsxəsi yükləndi.");
  }
  async function saveDb() {
    const count = Object.keys(scannerState?.cells || {}).length;
    if (!count) return updateUi("Əvvəl tarifləri oxudun.");
    refs.save.disabled = true;
    refs.status.className = "status";
    updateUi(`${count} tarif Auto Nex DB-yə yazılır…`);
    try {
      const result = await send({ type: "ANX_SAVE_RATES", cells: scannerState.cells });
      updateUi(`${result.saved} tarif DB-də yadda saxlandı. Poti–Bakı $200 ayrıca qalır.`);
    } catch (error) {
      refs.status.className = "status error";
      updateUi(error instanceof Error ? error.message : String(error));
    } finally { refs.save.disabled = false; }
  }

  refs.start.addEventListener("click", () => void scan());
  refs.pause.addEventListener("click", () => { paused = true; updateUi("Dayandırılır; hazırkı sorğunun bitməsi gözlənilir…"); });
  refs.json.addEventListener("click", downloadJson);
  refs.save.addEventListener("click", () => void saveDb());
  refs.reset.addEventListener("click", async () => { paused = true; scannerState = freshState(); await chrome.storage.local.set({ [STORAGE_KEY]: scannerState }); updateUi("Yadda saxlanmış skan nəticəsi sıfırlandı."); });
  refs.close.addEventListener("click", () => { host.hidden = true; });
  refs.hide.addEventListener("click", () => { host.hidden = true; });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "ANX_OPEN_CAUCASUS_SCANNER") return false;
    host.hidden = false;
    updateUi();
    sendResponse({ ok: true });
    return false;
  });
  void loadState();
})();
