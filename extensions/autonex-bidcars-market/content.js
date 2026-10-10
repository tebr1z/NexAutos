(function initAutoNexMarket() {
  "use strict";
  if (window.__autoNexMarketLoaded) return;
  window.__autoNexMarketLoaded = true;

  const parser = window.AutoNexMarketParser;
  const STORAGE_KEY = "marketRecordsV1";
  const DAY = 86400000;
  const CUTOFF = 30 * DAY;
  let records = [];
  let targets = [];
  let panel;
  let shadow;
  let scanTimer;
  let bakuToken = 0;
  let customsOptions;
  let dbStatus = "DB sinxronizasiya yoxlanılır…";
  let dbStatusError = false;
  let collectorConfigured = false;

  const money = (value) => Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const azn = (value) => `${Number(value || 0).toLocaleString("az-AZ", { maximumFractionDigits: 0 })} AZN`;
  const esc = (value) => String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function send(message) {
    return new Promise((resolve, reject) => chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      response?.ok ? resolve(response.data) : reject(new Error(response?.error || "API xətası"));
    }));
  }

  function snapshot(root, url) {
    const heading = root.querySelector("h1,h2,h3,h4,h5,a[href*='/lot/']")?.textContent || document.querySelector("h1")?.textContent || document.title;
    const labels = [...root.querySelectorAll("img[alt]")].map((img) => img.alt).join(" ");
    const link = root.querySelector("a[href*='/lot/']")?.href || url;
    const auctionNode = [...root.querySelectorAll("a,span,div")].find((node) => /^(Copart|IAAI|IAA)$/i.test(parser.clean(node.textContent)));
    const specRows = [...root.querySelectorAll("tr,li,div")];
    const spec = (name) => {
      const rows = specRows
        .map((node) => ({ node, value: parser.clean(node.innerText) }))
        .filter((row) => new RegExp(`^${name}\\s*:?`, "i").test(row.value) && row.value.length <= 220)
        .sort((a, b) => a.value.length - b.value.length);
      return rows[0] ? rows[0].value.replace(new RegExp(`^${name}\\s*:?`, "i"), "").slice(0, 120) : "";
    };
    return {
      text: root.innerText, title: heading, imageAlts: labels, url: link,
      auction: auctionNode?.textContent || "", engineLabel: spec("Engine"), fuel: spec("Fuel Type"), color: spec("Exterior color"),
      observedAt: new Date().toISOString()
    };
  }

  function collectPageRecords() {
    const found = [];
    const roots = [...document.querySelectorAll("[id]")].filter((node) => /^[01]-\d{5,}$/.test(node.id) && /final bid/i.test(node.innerText || ""));
    for (const root of roots) {
      const record = parser.parseRecordSnapshot(snapshot(root, location.href));
      if (record) found.push(record);
    }
    if (/\/lot\//i.test(location.pathname) && /final bid/i.test(document.body.innerText)) {
      const record = parser.parseRecordSnapshot(snapshot(document.body, location.href));
      if (record) found.push(record);
    }
    return found;
  }

  function activeCutoff(row) {
    const date = new Date(row.saleDate || row.observedAt).getTime();
    return Number.isFinite(date) && date >= Date.now() - CUTOFF;
  }

  async function saveFound(found) {
    const stored = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
    const map = new Map((stored[STORAGE_KEY] || []).filter(activeCutoff).map((row) => [row.key, row]));
    for (const row of found) map.set(row.key, { ...map.get(row.key), ...row, observedAt: new Date().toISOString() });
    records = [...map.values()].filter(activeCutoff).sort((a, b) => new Date(b.saleDate || b.observedAt) - new Date(a.saleDate || a.observedAt));
    await chrome.storage.local.set({ [STORAGE_KEY]: records });
  }

  async function syncToDb(found) {
    const [synced, local] = await Promise.all([
      chrome.storage.sync.get({ collectorKey: "" }),
      chrome.storage.local.get({ collectorKey: "" }),
    ]);
    const collectorKey = local.collectorKey || synced.collectorKey || "";
    collectorConfigured = Boolean(collectorKey);
    if (!found.length) return;
    if (!collectorKey) {
      dbStatus = "DB bağlı deyil — collector açarını bir dəfə yazın.";
      dbStatusError = false;
      return;
    }
    try {
      const short = (value, max) => value ? String(value).trim().slice(0, max) || undefined : undefined;
      const payload = found.slice(0, 50).map((row) => ({
        key: short(row.key, 128), url: short(row.url, 1000), lot: short(row.lot, 32), vin: short(row.vin, 32),
        auction: short(row.auction, 16), make: short(row.make, 80), model: short(row.model, 120),
        trim: short(row.trim, 120), year: row.year || undefined, engineCc: row.engineCc || undefined,
        engineLabel: short(row.engineLabel, 120), fuel: short(row.fuel, 80), color: short(row.color, 80),
        location: short(row.location, 180), state: short(row.state, 8), mileageMi: row.mileageMi || undefined,
        mileageKm: row.mileageKm || undefined, finalBidUsd: row.finalBidUsd,
        saleDate: row.saleDate || undefined, observedAt: row.observedAt
      }));
      const result = await send({ type: "ANM_API", path: "/market-sales/ingest", method: "POST", body: { records: payload } });
      dbStatus = `PostgreSQL yeniləndi: ${result.accepted || 0} final satış.`;
      dbStatusError = false;
    } catch (error) {
      dbStatus = `DB sinxronizasiya xətası: ${error.message}`;
      dbStatusError = true;
    }
  }

  function buildPanel() {
    if (panel) return;
    panel = document.createElement("div");
    panel.id = "autonex-market-host";
    Object.assign(panel.style, { position: "fixed", right: "14px", top: "92px", zIndex: "2147483646" });
    shadow = panel.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      :host([hidden]){display:none!important} *{box-sizing:border-box} .box{width:370px;max-height:calc(100vh - 110px);overflow:auto;background:#071426;color:#eef6ff;border:1px solid #25466f;border-radius:18px;box-shadow:0 18px 55px #0007;font:13px/1.35 Inter,Arial,sans-serif}.head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:13px 14px;background:#0b1c33;border-bottom:1px solid #263b59}.logo{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:#0d1e36;border:1px solid #315991}.logo svg{width:31px;height:31px}.title{font-size:16px;font-weight:900}.sub{font-size:11px;color:#92afd3}.icon{margin-left:auto;background:#142740;color:#fff;border:1px solid #345070;border-radius:9px;padding:7px 10px;cursor:pointer}.body{padding:12px}.hero{padding:12px;border:1px solid #285590;background:linear-gradient(135deg,#102951,#0b1b34);border-radius:14px}.hero small{color:#9db7d8}.hero strong{display:block;font-size:21px;margin:4px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.metric{padding:9px;background:#0b1b31;border:1px solid #273f60;border-radius:11px}.metric span{display:block;color:#91a8c8;font-size:10px;text-transform:uppercase;font-weight:800}.metric b{font-size:15px}.filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}label{font-size:10px;color:#91a8c8;font-weight:800;text-transform:uppercase}select,input{width:100%;margin-top:4px;background:#0d1b30;color:#fff;border:1px solid #324967;border-radius:9px;padding:8px;font:inherit}.wide{grid-column:1/-1}.actions{display:flex;gap:7px;margin-top:10px}button{border:0;border-radius:10px;padding:9px 11px;font-weight:800;cursor:pointer}.primary{flex:1;background:#16a34a;color:#fff}.secondary{background:#172a45;color:#dcecff;border:1px solid #315073}.danger{background:#4b1820;color:#ffb4bd;border:1px solid #81303d}.note{margin-top:9px;color:#91a8c8;font-size:11px}.error{color:#ff9aa7}.baku{margin-top:10px;padding:12px;text-align:center;background:#10274d;border:1px solid #2864b2;border-radius:13px}.baku strong{display:block;font-size:22px}.list{margin-top:10px;border-top:1px solid #263b59}.row{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #1d304c}.row span{color:#9bb0cf}.hidden{display:none!important}.empty{padding:18px;text-align:center;color:#9bb0cf}@media(max-width:600px){.box{width:min(360px,calc(100vw - 20px))}}
    </style><section class="box"><header class="head"><div class="logo"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 40c2-7 7-11 14-12l6-10h15l8 10c5 1 8 5 9 12h-7c-1-4-4-6-8-6s-7 2-8 6H27c-1-4-4-6-8-6s-7 2-8 6z" fill="#2f7cff"/><circle cx="19" cy="41" r="6" fill="none" stroke="white" stroke-width="3"/><circle cx="47" cy="41" r="6" fill="none" stroke="white" stroke-width="3"/><path d="M16 15h9l5-6 6 12 6-8 7 7" fill="none" stroke="#65f0c1" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div><div class="title">Bazar Analizi</div><div class="sub">Final satışlar · son 30 gün</div></div><button class="icon" id="close">✕</button></header><main class="body"><div id="view" class="empty">Final satışlar oxunur…</div></main></section>`;
    document.documentElement.appendChild(panel);
    shadow.getElementById("close").onclick = () => { panel.hidden = true; };
  }

  function options(values, selected) {
    return [`<option value="">Hamısı</option>`, ...[...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))]
      .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
      .map((value) => `<option value="${esc(value)}" ${String(value) === String(selected) ? "selected" : ""}>${esc(value)}</option>`)].join("");
  }

  function render() {
    buildPanel();
    const view = shadow.getElementById("view");
    if (!records.length) {
      view.className = "empty";
      view.innerHTML = "Bu səhifədə son 30 günə aid Final bid tapılmadı.<br>Arxiv səhifələrini açdıqca məlumat avtomatik yığılacaq.";
      return;
    }
    const valid = records.filter((row) => row.make && row.model && parser.acceptableMileage(row));
    if (!valid.length) {
      view.className = "empty";
      view.innerHTML = "Analizə uyğun satış tapılmadı.<br>Yürüşü 300 000 km-dən çox olan avtomobillər hesablanmır.";
      return;
    }
    const pageTarget = targets.find((row) => row.make && row.model && parser.acceptableMileage(row)) || valid[0];
    const read = (id, fallback = "") => shadow.getElementById(id)?.value ?? fallback;
    const previous = {
      make: read("make", pageTarget.make || ""), model: read("model", pageTarget.model || ""),
      trim: read("trim", pageTarget.trim === "Naməlum" ? "" : pageTarget.trim || ""), engineCc: read("engineCc", pageTarget.engineCc || ""),
      year: read("year", ""), auction: read("auction", ""), fuel: read("fuel", pageTarget.fuel === "Naməlum" ? "" : pageTarget.fuel || ""), color: read("color", "")
    };
    const byMake = valid.filter((row) => !previous.make || row.make === previous.make);
    if (previous.model && !byMake.some((row) => row.model === previous.model)) previous.model = "";
    const byModel = byMake.filter((row) => !previous.model || row.model === previous.model);
    if (previous.trim && !byModel.some((row) => row.trim === previous.trim)) previous.trim = "";
    const byTrim = byModel.filter((row) => !previous.trim || row.trim === previous.trim);
    if (previous.engineCc && !byTrim.some((row) => String(row.engineCc || "") === String(previous.engineCc))) previous.engineCc = "";
    const filtered = byTrim.filter((row) =>
      (!previous.engineCc || String(row.engineCc || "") === String(previous.engineCc)) &&
      (!previous.year || String(row.year || "") === String(previous.year)) &&
      (!previous.auction || row.auction === previous.auction) && (!previous.fuel || row.fuel === previous.fuel) &&
      (!previous.color || row.color === previous.color));
    const target = filtered[0] || pageTarget;
    const stat = parser.statistics(filtered);
    view.className = "";
    view.innerHTML = `<div class="hero"><small>Seçilmiş kombinasiya · ${stat?.count || 0} satış${stat && stat.count < 3 ? " · zəif nümunə" : ""}</small><strong>${stat ? `${money(stat.q1)} – ${money(stat.q3)}` : "Uyğun satış tapılmadı"}</strong><div>${esc(previous.make || "Marka")} ${esc(previous.model || "Model")} · ${esc(previous.trim || "Komplektasiya")} · ${previous.engineCc ? `${esc(previous.engineCc)} cm³` : "mühərrik"}</div><div class="grid"><div class="metric"><span>Median final</span><b>${stat ? money(stat.median) : "—"}</b></div><div class="metric"><span>Orta final</span><b>${stat ? money(stat.average) : "—"}</b></div></div></div>
      <div class="filters"><label>Marka<select id="make">${options(valid.map((r) => r.make), previous.make)}</select></label><label>Model<select id="model">${options(byMake.map((r) => r.model), previous.model)}</select></label><label>Komplektasiya<select id="trim">${options(byModel.map((r) => r.trim).filter((v) => v !== "Naməlum"), previous.trim)}</select></label><label>Mühərrik<select id="engineCc">${options(byTrim.map((r) => r.engineCc), previous.engineCc)}</select></label><label>İl<select id="year">${options(byTrim.map((r) => r.year), previous.year)}</select></label><label>Yanacaq<select id="fuel">${options(byTrim.map((r) => r.fuel), previous.fuel)}</select></label><label>Hərrac<select id="auction">${options(byTrim.map((r) => r.auction), previous.auction)}</select></label><label>Rəng<select id="color">${options(byTrim.map((r) => r.color).filter((v) => v !== "Naməlum"), previous.color)}</select></label></div>
      <div class="actions"><button class="primary" id="baku">Bakı təhvil hesabla</button><button class="secondary" id="rescan">↻ Oxu</button><button class="danger" id="reset">30 günü sıfırla</button></div><div id="bakuResult"></div>
      <div class="list"><div class="row"><span>Uyğun nəticə</span><b>${filtered.length} / ${valid.length}</b></div><div class="row"><span>Komplektasiya</span><b>${esc(previous.trim || "Hamısı")}</b></div><div class="row"><span>Mühərrik / yanacaq</span><b>${previous.engineCc ? `${esc(previous.engineCc)} cm³` : "Hamısı"} · ${esc(previous.fuel || "Hamısı")}</b></div></div><p id="dbStatus" class="note ${dbStatusError ? "error" : ""}">${esc(dbStatus)}</p><details ${collectorConfigured ? "" : "open"}><summary class="note" style="cursor:pointer">DB bağlantısı · ${collectorConfigured ? "yadda saxlanılıb" : "açar tələb olunur"}</summary><div class="actions"><input id="collectorKey" type="password" autocomplete="off" placeholder="${collectorConfigured ? "Yeni açar yazın" : "MARKET_COLLECTOR_KEY"}"><button id="saveKey" class="secondary">${collectorConfigured ? "Açarı dəyiş" : "Açarı saxla"}</button></div><p class="note">Açar bu Chrome profilində müddətsiz saxlanılır.</p></details><p class="note">Aralıq 25–75 faiz diapazonudur. Yürüşü 300 000 km-dən çox olan avtomobillər analizə daxil edilmir.</p>`;
    ["make", "model", "trim", "engineCc", "year", "auction", "fuel", "color"].forEach((id) => shadow.getElementById(id).onchange = render);
    shadow.getElementById("rescan").onclick = () => scheduleScan(0);
    shadow.getElementById("baku").disabled = !stat;
    shadow.getElementById("baku").onclick = () => void calculateBaku(target, stat);
    shadow.getElementById("saveKey").onclick = async () => {
      const key = shadow.getElementById("collectorKey").value.trim();
      if (!key) return;
      await Promise.all([
        chrome.storage.local.set({ collectorKey: key }),
        chrome.storage.sync.set({ collectorKey: key }),
      ]);
      collectorConfigured = true;
      dbStatus = "Açar saxlanıldı, PostgreSQL-ə göndərilir…"; dbStatusError = false; render();
      await syncToDb(targets.length ? targets : records.slice(0, 50)); render();
    };
    shadow.getElementById("reset").onclick = async () => {
      if (!confirm("Auto Nex Market-in topladığı son 30 günlük final satış məlumatları silinsin?")) return;
      await chrome.storage.local.remove(STORAGE_KEY); records = []; targets = []; render();
    };
  }

  function fuelCode(fuel) {
    if (/plug/i.test(fuel)) return "8";
    if (/hybrid/i.test(fuel)) return "6";
    if (/electric/i.test(fuel)) return "12";
    if (/diesel/i.test(fuel)) return "2";
    if (/lpg/i.test(fuel)) return "3";
    return "1";
  }

  async function oneBaku(price, target) {
    const quote = await send({ type: "ANM_API", path: "/shipping/quote", method: "POST", body: { url: target.url, priceUsd: price, auction: target.auction, yard: target.location, state: target.state, titleKind: "SALVAGE" } });
    if (quote.missing || !Number(quote.freightUsd)) throw new Error("Bu location üçün yol tarifi tapılmadı.");
    customsOptions ||= await send({ type: "ANM_API", path: "/customs/auto-options?lang=az" });
    const code = fuelCode(target.fuel);
    const engine = customsOptions.AutoEngineTypes?.find((row) => row.code === code) || customsOptions.AutoEngineTypes?.[0];
    const autoType = customsOptions.AutoCategories?.[0]?.code;
    if (!engine || !autoType || !target.year || (!target.engineCc && target.fuel !== "Electric")) throw new Error("İl, mühərrik və ya yanacaq məlumatı çatmır.");
    const invoice = price + Number(quote.auctionFeeUsd || 0);
    const duty = await send({ type: "ANM_API", path: "/customs/auto-duty?lang=az", method: "POST", body: { autoType, engineType: engine.abbreviation2, engine: Number(target.engineCc || 0), commerceType: "nonFree", issueDate: `${target.year}-06-01`, price: invoice, transportExpenses: Number(quote.freightUsd), otherExpenses: 0 } });
    const rate = Number(duty.autoDuty?.usdCourse || 0);
    if (!rate) throw new Error("DGK məzənnə qaytarmadı.");
    const customsAzn = Number(duty.autoDuty?.total?.value || 0);
    const totalAzn = (invoice + Number(quote.freightUsd)) * rate + customsAzn + 800;
    return { totalAzn, rate, auctionFeeUsd: Number(quote.auctionFeeUsd || 0), freightUsd: Number(quote.freightUsd), customsAzn };
  }

  async function calculateBaku(target, stat) {
    const box = shadow.getElementById("bakuResult");
    if (!target || !stat) return;
    const token = ++bakuToken;
    box.innerHTML = `<div class="baku">Hesablanır…</div>`;
    try {
      const prices = stat.count > 1 ? [stat.q1, stat.median, stat.q3] : [stat.median, stat.median, stat.median];
      const [low, mid, high] = await Promise.all(prices.map((price) => oneBaku(price, target)));
      if (token !== bakuToken) return;
      box.innerHTML = `<div class="baku"><small>Bakı təhvil təxmini · DYP daxil</small><strong>${azn(low.totalAzn)} – ${azn(high.totalAzn)}</strong><div>Median ssenari: ${azn(mid.totalAzn)}</div></div><div class="list"><div class="row"><span>Final qiymət</span><b>${money(stat.median)}</b></div><div class="row"><span>Auction fee</span><b>${money(mid.auctionFeeUsd)}</b></div><div class="row"><span>Yol</span><b>${money(mid.freightUsd)}</b></div><div class="row"><span>Gömrük</span><b>${azn(mid.customsAzn)}</b></div><div class="row"><span>DYP</span><b>800 AZN</b></div></div>`;
    } catch (error) {
      box.innerHTML = `<p class="note error">Bakı təhvil hesablanmadı: ${esc(error.message)}</p>`;
    }
  }

  async function scan() {
    const found = collectPageRecords();
    targets = found.filter(activeCutoff);
    await saveFound(found);
    await syncToDb(targets);
    render();
  }

  function scheduleScan(delay = 900) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => void scan(), delay);
  }

  buildPanel();
  scheduleScan(300);
  new MutationObserver((mutations) => {
    const externalChange = mutations.some((mutation) => !panel.contains(mutation.target));
    if (externalChange) scheduleScan();
  }).observe(document.body, { childList: true, subtree: true });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "ANM_TOGGLE") {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) scheduleScan(0);
      sendResponse({ ok: true });
    }
  });
})();
