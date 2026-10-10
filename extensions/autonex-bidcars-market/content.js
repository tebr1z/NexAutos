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
      const row = specRows.find((node) => new RegExp(`^${name}\\b`, "i").test(parser.clean(node.innerText)));
      return row ? parser.clean(row.innerText).replace(new RegExp(`^${name}\\s*:?`, "i"), "") : "";
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

  function buildPanel() {
    if (panel) return;
    panel = document.createElement("div");
    panel.id = "autonex-market-host";
    Object.assign(panel.style, { position: "fixed", right: "14px", top: "92px", zIndex: "2147483646" });
    shadow = panel.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      *{box-sizing:border-box} .box{width:370px;max-height:calc(100vh - 110px);overflow:auto;background:#071426;color:#eef6ff;border:1px solid #25466f;border-radius:18px;box-shadow:0 18px 55px #0007;font:13px/1.35 Inter,Arial,sans-serif}.head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:13px 14px;background:#0b1c33;border-bottom:1px solid #263b59}.logo{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:#2463eb;font-weight:900}.title{font-size:16px;font-weight:900}.sub{font-size:11px;color:#92afd3}.icon{margin-left:auto;background:#142740;color:#fff;border:1px solid #345070;border-radius:9px;padding:7px 10px;cursor:pointer}.body{padding:12px}.hero{padding:12px;border:1px solid #285590;background:linear-gradient(135deg,#102951,#0b1b34);border-radius:14px}.hero small{color:#9db7d8}.hero strong{display:block;font-size:21px;margin:4px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.metric{padding:9px;background:#0b1b31;border:1px solid #273f60;border-radius:11px}.metric span{display:block;color:#91a8c8;font-size:10px;text-transform:uppercase;font-weight:800}.metric b{font-size:15px}.filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}label{font-size:10px;color:#91a8c8;font-weight:800;text-transform:uppercase}select,input{width:100%;margin-top:4px;background:#0d1b30;color:#fff;border:1px solid #324967;border-radius:9px;padding:8px;font:inherit}.wide{grid-column:1/-1}.actions{display:flex;gap:7px;margin-top:10px}button{border:0;border-radius:10px;padding:9px 11px;font-weight:800;cursor:pointer}.primary{flex:1;background:#16a34a;color:#fff}.secondary{background:#172a45;color:#dcecff;border:1px solid #315073}.danger{background:#4b1820;color:#ffb4bd;border:1px solid #81303d}.note{margin-top:9px;color:#91a8c8;font-size:11px}.error{color:#ff9aa7}.baku{margin-top:10px;padding:12px;text-align:center;background:#10274d;border:1px solid #2864b2;border-radius:13px}.baku strong{display:block;font-size:22px}.list{margin-top:10px;border-top:1px solid #263b59}.row{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #1d304c}.row span{color:#9bb0cf}.hidden{display:none!important}.empty{padding:18px;text-align:center;color:#9bb0cf}@media(max-width:600px){.box{width:min(360px,calc(100vw - 20px))}}
    </style><section class="box"><header class="head"><div class="logo">AN</div><div><div class="title">Bazar Analizi</div><div class="sub">Final satışlar · son 30 gün</div></div><button class="icon" id="close">✕</button></header><main class="body"><div id="view" class="empty">Final satışlar oxunur…</div></main></section>`;
    document.documentElement.appendChild(panel);
    shadow.getElementById("close").onclick = () => panel.classList.add("hidden");
  }

  function options(values, selected) {
    return [`<option value="">Hamısı</option>`, ...[...new Set(values.filter(Boolean))].sort().map((value) => `<option ${value === selected ? "selected" : ""}>${esc(value)}</option>`)].join("");
  }

  function currentTarget() {
    const key = shadow.getElementById("target")?.value;
    return records.find((row) => row.key === key) || targets[0] || records[0];
  }

  function render() {
    buildPanel();
    const view = shadow.getElementById("view");
    if (!records.length) {
      view.className = "empty";
      view.innerHTML = "Bu səhifədə son 30 günə aid Final bid tapılmadı.<br>Arxiv səhifələrini açdıqca məlumat avtomatik yığılacaq.";
      return;
    }
    const previous = { target: shadow.getElementById("target")?.value, auction: shadow.getElementById("auction")?.value || "", fuel: shadow.getElementById("fuel")?.value || "", color: shadow.getElementById("color")?.value || "" };
    const target = records.find((row) => row.key === previous.target) || targets[0] || records[0];
    const cohort = parser.chooseCohort(records, target, previous);
    const stat = parser.statistics(cohort.rows);
    view.className = "";
    view.innerHTML = `<div class="hero"><small>${esc(cohort.label)} · ${stat?.count || 0} satış${stat && stat.count < 3 ? " · zəif nümunə" : ""}</small><strong>${stat ? `${money(stat.q1)} – ${money(stat.q3)}` : "Məlumat azdır"}</strong><div>${esc(target.year)} ${esc(target.make)} ${esc(target.model)} · ${esc(target.trim)} · ${esc(target.fuel)}</div><div class="grid"><div class="metric"><span>Median final</span><b>${stat ? money(stat.median) : "—"}</b></div><div class="metric"><span>Orta final</span><b>${stat ? money(stat.average) : "—"}</b></div></div></div>
      <div class="filters"><label class="wide">Analiz edilən maşın<select id="target">${records.map((row) => `<option value="${esc(row.key)}" ${row.key === target.key ? "selected" : ""}>${esc(`${row.year} ${row.make} ${row.model} ${row.trim} · ${money(row.finalBidUsd)}`)}</option>`).join("")}</select></label><label>Hərrac<select id="auction">${options(records.map((r) => r.auction), previous.auction)}</select></label><label>Yanacaq<select id="fuel">${options(records.map((r) => r.fuel), previous.fuel)}</select></label><label class="wide">Rəng<select id="color">${options(records.map((r) => r.color), previous.color)}</select></label></div>
      <div class="actions"><button class="primary" id="baku">Bakı təhvil hesabla</button><button class="secondary" id="rescan">↻ Oxu</button><button class="danger" id="reset">30 günü sıfırla</button></div><div id="bakuResult"></div>
      <div class="list"><div class="row"><span>Komplektasiya</span><b>${esc(target.trim)}</b></div><div class="row"><span>İl / yürüş</span><b>${esc(target.year || "—")} · ${target.mileageKm ? `${Math.round(target.mileageKm / 1000)} min km` : "—"}</b></div><div class="row"><span>Mühərrik / yanacaq</span><b>${target.engineCc ? `${target.engineCc} cm³` : "—"} · ${esc(target.fuel)}</b></div><div class="row"><span>Rəng / hərrac</span><b>${esc(target.color)} · ${esc(target.auction)}</b></div><div class="row"><span>Bazada cəmi</span><b>${records.length} final satış</b></div></div><p class="note">Aralıq 25–75 faiz diapazonudur; qeyri-adi ucuz/bahalı nəticələr ortalamanı pozmasın deyə median əsas götürülür.</p>`;
    ["target", "auction", "fuel", "color"].forEach((id) => shadow.getElementById(id).onchange = render);
    shadow.getElementById("rescan").onclick = () => scheduleScan(0);
    shadow.getElementById("baku").onclick = () => void calculateBaku(currentTarget(), stat);
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
      panel.classList.toggle("hidden");
      if (!panel.classList.contains("hidden")) scheduleScan(0);
      sendResponse({ ok: true });
    }
  });
})();
