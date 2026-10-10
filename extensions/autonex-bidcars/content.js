(function mountAutoNexCalculator() {
  "use strict";

  const parser = globalThis.AutoNexBidCarsParser;
  if (!parser || document.getElementById("anx-bidcars-extension")) return;

  const host = document.createElement("div");
  host.id = "anx-bidcars-extension";
  host.hidden = true;
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { display:block; color:#e5e7eb; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      :host([hidden]) { display:none !important; }
      .body [hidden] { display:none !important; }
      * { box-sizing:border-box; }
      .card { overflow:hidden; border:1px solid #273449; border-radius:15px; background:#0b1220; box-shadow:0 18px 45px rgba(3,7,18,.42); }
      .head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:9px 10px; background:linear-gradient(135deg,#071426,#11223c); border-bottom:1px solid #273449; }
      .brand { display:flex; align-items:center; gap:9px; font-weight:800; letter-spacing:-.02em; }
      .mark { display:grid; place-items:center; width:27px; height:27px; border-radius:8px; color:white; background:#0d1e36; border:1px solid #315991; }
      .mark svg { width:22px; height:22px; }
      .sub { color:#8da2bd; font-size:10px; margin-top:1px; font-weight:500; }
      button { font:inherit; }
      .ghost { border:1px solid #334155; border-radius:8px; background:#172033; color:#dbeafe; padding:6px 8px; cursor:pointer; }
      .body { padding:9px 10px 10px; }
      .auth-box { margin-bottom:8px; padding:9px; border:1px solid #2b4668; border-radius:10px; background:#0d1b30; }
      .auth-box.signed-in { padding:6px 8px; }
      .auth-title { color:#f8fafc; font-size:12px; font-weight:800; }
      .auth-copy { margin:2px 0 0; color:#8da2bd; font-size:9px; line-height:1.35; }
      .auth-copy a { color:#60a5fa; text-decoration:underline; }
      .auth-actions { display:grid; grid-template-columns:1fr 1fr auto; gap:6px; margin-top:7px; }
      .auth-actions input { margin:0; min-width:0; padding:8px; font-size:11px; }
      .auth-actions button { border:0; border-radius:9px; background:#2563eb; color:white; padding:8px 11px; font-size:11px; font-weight:800; cursor:pointer; }
      .auth-user { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .auth-user button { border:1px solid #3b4e69; border-radius:7px; background:#172033; color:#dbeafe; padding:5px 8px; font-size:9px; cursor:pointer; }
      .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      label { display:block; color:#8da2bd; font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
      input,select { width:100%; margin-top:5px; border:1px solid #334155; border-radius:9px; background:#111827; color:#f8fafc; padding:9px 10px; outline:none; font:600 13px/1.2 inherit; }
      input:focus,select:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
      .wide { grid-column:1/-1; }
      details.compact { margin-top:10px; border:1px solid #273449; border-radius:10px; background:#0f172a; }
      details.compact > summary { padding:10px 12px; color:#a9bdd6; font-size:11px; font-weight:800; cursor:pointer; list-style:none; }
      details.compact > summary::after { content:"＋"; float:right; color:#60a5fa; }
      details.compact[open] > summary::after { content:"－"; }
      details.compact > .grid, details.compact > .detail-body { padding:0 12px 12px; }
      .actions { display:flex; gap:8px; margin-top:12px; }
      .primary { flex:1; border:0; border-radius:9px; background:#16a34a; color:white; padding:9px 10px; font-weight:800; cursor:pointer; }
      .primary:disabled { opacity:.55; cursor:wait; }
      .status { min-height:18px; margin:10px 0 0; color:#93a4bb; font-size:11px; line-height:1.45; }
      .status.error { color:#fca5a5; }
      .result { margin-top:9px; border-top:1px solid #273449; padding-top:7px; }
      .price-line { padding:6px; border:1px solid #273449; border-radius:8px; background:#0f172a; }
      .price-line span { display:block; margin:0 2px 5px; color:#8da2bd; font-size:9px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; }
      .compact-source { margin:0; padding:7px 9px; font-size:12px; }
      .compact-manual { margin-top:6px; padding:7px 9px; font-size:12px; }
      .fee-strip { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; margin-top:4px; }
      .fee-box { min-width:0; padding:9px 7px; border:1px solid #273449; border-radius:10px; background:#0f172a; text-align:center; }
      .fee-box span { display:block; overflow:hidden; color:#8da2bd; font-size:9px; font-weight:800; letter-spacing:.04em; text-overflow:ellipsis; text-transform:uppercase; white-space:nowrap; }
      .fee-box strong { display:block; margin-top:4px; color:#f8fafc; font-size:13px; }
      .result-details .fee-strip { gap:5px; margin-bottom:7px; }
      .result-details .fee-box { padding:6px 4px; }
      .result-details .fee-box strong { font-size:12px; }
      .row { display:flex; justify-content:space-between; gap:14px; padding:7px 0; border-bottom:1px solid rgba(51,65,85,.6); font-size:12px; }
      .row span:first-child { color:#94a3b8; }
      .row strong { color:#f8fafc; text-align:right; }
      .total { margin-top:11px; padding:12px; border-radius:11px; background:rgba(37,99,235,.16); border:1px solid rgba(59,130,246,.32); }
      .total small { color:#93c5fd; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
      .total div { margin-top:3px; color:#fff; font-size:24px; font-weight:900; }
      .azn-total { margin-top:6px; padding:8px; border:1px solid rgba(59,130,246,.38); border-radius:9px; background:linear-gradient(135deg,rgba(37,99,235,.25),rgba(29,78,216,.1)); text-align:center; }
      .azn-total small { color:#93c5fd; font-size:9px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
      .azn-total strong { display:block; margin-top:2px; color:#fff; font-size:20px; line-height:1.05; }
      .dyp-button { width:100%; margin-top:8px; border:1px solid #475569; border-radius:9px; background:#172033; color:#dbeafe; padding:9px 10px; cursor:pointer; font-size:11px; font-weight:800; }
      .dyp-button.active { border-color:#16a34a; background:rgba(22,163,74,.17); color:#bbf7d0; }
      .dyp-button:disabled { opacity:.45; cursor:not-allowed; }
      .result-details { margin-top:8px !important; }
      .advanced { margin-top:10px; padding:12px; border:1px solid #273449; border-radius:11px; background:#0f172a; }
      .advanced .grid + .grid { margin-top:10px; padding-top:10px; border-top:1px solid #273449; }
      .details-toggle { width:100%; margin-top:8px; }
      .note { margin-top:9px; color:#7890ad; font-size:10px; line-height:1.45; }
      .rate-editor { margin-top:14px; padding:14px; border:1px solid #854d0e; border-radius:13px; background:rgba(120,53,15,.22); }
      .rate-editor h4 { margin:0 0 4px; color:#fde68a; font-size:13px; }
      .rate-editor p { margin:0 0 9px; color:#d6b98b; font-size:10px; line-height:1.45; }
      .rate-editor button { width:100%; margin-top:10px; border:0; border-radius:9px; background:#d97706; color:white; padding:10px; font-weight:800; cursor:pointer; }
      .rate-editor button:disabled { opacity:.55; cursor:wait; }
      .dock { position:fixed; z-index:2147483646; right:12px; top:12px; width:min(330px,calc(100vw - 24px)); max-height:calc(100vh - 24px); overflow:auto; margin:0; scrollbar-width:thin; scrollbar-color:#334155 transparent; }
      @media (max-width:700px) { .dock { right:10px; top:10px; width:calc(100vw - 20px); max-height:calc(100vh - 20px); } }
    </style>
    <section class="card">
      <header class="head">
        <div class="brand"><span class="mark"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 40c2-7 7-11 14-12l6-10h15l8 10c5 1 8 5 9 12h-7c-1-4-4-6-8-6s-7 2-8 6H27c-1-4-4-6-8-6s-7 2-8 6z" fill="#2f7cff"/><circle cx="19" cy="41" r="6" fill="none" stroke="white" stroke-width="3"/><circle cx="47" cy="41" r="6" fill="none" stroke="white" stroke-width="3"/><path d="M31 15h20M41 8v14" stroke="#65f0c1" stroke-width="4" stroke-linecap="round"/></svg></span><div>Auto Nex<div class="sub">BidCars ümumi qiymət hesabı</div></div></div>
        <div><button class="ghost" id="refresh" type="button" title="Səhifədən yenidən oxu">↻ Oxu</button> <button class="ghost" id="close" type="button" title="Bağla">✕</button></div>
      </header>
      <div class="body">
        <section class="auth-box" id="authBox">
          <div id="authGuest">
            <div class="auth-title">Auto Nex hesabına giriş</div>
            <p class="auth-copy">Yol pulu yalnız icazəli istifadəçilər üçündür. Qeydiyyat üçün <a href="https://nex.autos/contact" target="_blank" rel="noreferrer">nex.autos-a müraciət edin</a>.</p>
            <div class="auth-actions"><input id="loginEmail" type="email" autocomplete="username" placeholder="E-poçt"><input id="loginPassword" type="password" autocomplete="current-password" placeholder="Şifrə"><button id="loginButton" type="button">Giriş</button></div>
          </div>
          <div class="auth-user" id="authUser" hidden><div><div class="auth-title">Giriş edildi</div><p class="auth-copy" id="authEmail"></p></div><button id="logoutButton" type="button">Çıxış</button></div>
          <p class="status" id="authStatus"></p>
        </section>
        <div id="calculatorContent" hidden>
        <section class="advanced" id="advancedControls" hidden>
          <div class="grid">
            <label class="wide">Hesablama qiyməti<select id="priceSource"><option value="bidNow">Bid Now / seçilən qiymət</option><option value="currentBid">Current Bid</option><option value="lotPrice">Lot Price</option><option value="manual">Əl ilə yaz</option></select></label>
            <label>Avtomobil qiyməti<input id="price" type="number" min="1" step="50"></label>
            <label>Hesablanan auction fee<input id="auctionFee" type="number" readonly></label>
          </div>
          <div class="grid">
            <label>Hərrac<select id="auction"><option value="">Seçin</option><option value="IAAI">IAAI</option><option value="COPART">Copart</option></select></label>
            <label>Title<select id="titleKind"><option value="SALVAGE">Salvage</option><option value="CLEAN">Clean title</option></select></label>
            <label class="wide">Location / yard<input id="location" type="text" placeholder="Savannah (GA)"></label>
            <label>İl<input id="year" type="number" min="1950" max="2035"></label>
            <label>Mühərrik, cm³<input id="engine" type="number" min="0" step="100"></label>
            <label class="wide">Yanacaq<select id="fuel"><option value="">Tapılmadı</option><option value="Gasoline">Benzin</option><option value="Diesel">Dizel</option><option value="LPG">Qaz / LPG</option><option value="Hybrid">Hibrid</option><option value="Diesel hybrid">Dizel hibrid</option><option value="LPG hybrid">Qaz hibrid</option><option value="Plug-in hybrid">Plug-in hibrid</option><option value="Plug-in diesel hybrid">Plug-in dizel hibrid</option><option value="Mild hybrid">Mild hibrid</option><option value="Mild diesel hybrid">Mild dizel hibrid</option><option value="Mild LPG hybrid">Mild qaz hibrid</option><option value="Electric">Elektrik</option></select></label>
          </div>
        </section>
        <div class="actions"><button class="primary" id="calculate" type="button">Auto Nex ilə hesabla</button></div>
        <p class="status" id="status"></p>
        <div class="result" id="result" hidden></div>
        <button class="ghost details-toggle" id="toggleAdvanced" type="button">Ətraflı</button>
        <section class="rate-editor" id="rateEditor" hidden>
          <h4>Bu marşrutun tarifi bazada yoxdur</h4>
          <p id="rateHint">ABŞ–Poti yol pulunu bir dəfə yazın. Poti–Bakı xərci avtomatik əlavə ediləcək və tarif DB-də qalacaq.</p>
          <div class="grid">
            <label class="wide">ABŞ–Poti tarifi, USD<input id="rateUsd" type="number" min="1" step="10" placeholder="Məsələn: 270"></label>
          </div>
          <button id="saveRate" type="button">Tarifi yadda saxla və hesabla</button>
          <p class="status" id="rateStatus"></p>
        </section>
        <p class="note">Qiymət + auction fee + yol + gömrük hesablanır.</p>
        </div>
      </div>
    </section>`;

  const refs = Object.fromEntries(
    ["authBox", "authGuest", "authUser", "authEmail", "loginEmail", "loginPassword", "loginButton", "logoutButton", "authStatus", "calculatorContent", "priceSource", "price", "auctionFee", "auction", "location", "titleKind", "year", "engine", "fuel", "refresh", "close", "calculate", "status", "result", "toggleAdvanced", "advancedControls", "rateEditor", "rateHint", "rateUsd", "saveRate", "rateStatus"].map((id) => [id, shadow.getElementById(id)]),
  );
  const manual = new Set();
  let lastUrl = location.href;
  let lastAutoSignature = "";
  let calculating = false;
  let recalculateAfterCurrent = false;
  let timer = 0;
  let latestData = null;
  let lastQuote = null;
  let lastCalculation = null;
  let includeDyp = false;
  let showDetails = false;
  let authenticated = false;

  function send(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.ok) return reject(new Error(response?.error || "Auto Nex əlavəsi cavab vermədi."));
        resolve(response.data);
      });
    });
  }

  function renderAuth(email = "") {
    refs.authGuest.hidden = authenticated;
    refs.authUser.hidden = !authenticated;
    refs.calculatorContent.hidden = !authenticated;
    refs.authBox.classList.toggle("signed-in", authenticated);
    refs.authStatus.hidden = authenticated;
    refs.authEmail.textContent = email;
    refs.calculate.disabled = !authenticated;
    if (!authenticated) refs.calculate.textContent = "Hesablamaq üçün giriş edin";
    else if (!calculating) refs.calculate.textContent = "Auto Nex ilə hesabla";
  }

  async function loadAuth() {
    try {
      const settings = await send({ type: "ANX_GET_SETTINGS" });
      authenticated = Boolean(settings.authenticated);
      renderAuth(settings.authEmail || "");
      return authenticated;
    } catch (error) {
      authenticated = false;
      renderAuth();
      refs.authStatus.className = "status error";
      refs.authStatus.textContent = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  async function login() {
    const email = refs.loginEmail.value.trim();
    const password = refs.loginPassword.value;
    if (!email || !password) {
      refs.authStatus.className = "status error";
      refs.authStatus.textContent = "E-poçt və şifrəni yazın.";
      return;
    }
    refs.loginButton.disabled = true;
    refs.authStatus.className = "status";
    refs.authStatus.textContent = "Giriş yoxlanılır…";
    try {
      const account = await send({ type: "ANX_LOGIN", email, password });
      authenticated = true;
      refs.loginPassword.value = "";
      refs.authStatus.textContent = "";
      renderAuth(account.email || email);
      await calculate(false);
    } catch (error) {
      refs.authStatus.className = "status error";
      refs.authStatus.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      refs.loginButton.disabled = false;
    }
  }

  async function logout() {
    await send({ type: "ANX_LOGOUT" }).catch(() => undefined);
    authenticated = false;
    lastCalculation = null;
    refs.result.hidden = true;
    refs.rateEditor.hidden = true;
    refs.authStatus.className = "status";
    refs.authStatus.textContent = "Hesabdan çıxış edildi.";
    renderAuth();
  }

  function collectBidCandidates() {
    const candidates = [];
    document.querySelectorAll("input,[contenteditable='true'],[role='spinbutton']").forEach((element) => {
      if (host.contains(element)) return;
      const value = "value" in element ? element.value : element.textContent;
      let context = "";
      let parent = element;
      for (let depth = 0; parent && depth < 5; depth++, parent = parent.parentElement) {
        const text = parser.clean(parent.innerText);
        if (text.length <= 600) context = text;
        if (/Bid Now|Place Bid|Your max bid|Your bid/i.test(text)) break;
      }
      let score = 1;
      if (/Bid Now|Place Bid/i.test(context)) score += 10;
      if (/Your max bid|Your bid/i.test(context)) score += 6;
      if (/year|engine|odometer|search|filter/i.test(context)) score -= 8;
      candidates.push({ value, score, kind: /Bid Now|Place Bid|Your max bid|Your bid/i.test(context) ? "bidNow" : "" });
    });

    [...document.querySelectorAll("button")]
      .filter((button) => /^(Bid Now|Place Bid)$/i.test(parser.clean(button.innerText)))
      .forEach((button) => {
        let parent = button.parentElement;
        for (let depth = 0; parent && depth < 6; depth++, parent = parent.parentElement) {
          const text = parser.clean(parent.innerText);
          if (text.length > 800) continue;
          const amounts = [...text.matchAll(/\$\s*[\d,.]+|[\d,.]+\s*USD/gi)];
          if (amounts.length) {
            candidates.push({ value: amounts[amounts.length - 1][0], score: 20, kind: "bidNow" });
            break;
          }
        }
      });
    return candidates;
  }

  function auctionHintNearTitle() {
    const heading = document.querySelector("h1");
    if (!heading) return "";
    const headingRect = heading.getBoundingClientRect();
    const candidates = [...document.querySelectorAll("span,a,button,strong")]
      .filter((element) => !host.contains(element) && /^(Copart|IAA|IAAI)$/i.test(parser.clean(element.textContent)))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const sameParent = element.parentElement === heading.parentElement ? 10000 : 0;
        const distance = Math.abs(rect.top - headingRect.top) + Math.abs(rect.left - headingRect.right);
        return { value: parser.clean(element.textContent), score: sameParent - distance };
      })
      .sort((left, right) => right.score - left.score);
    return candidates[0]?.value || "";
  }

  function visibleLabeledValue(label, stopLabels) {
    const lines = String(document.body?.innerText || "")
      .split(/\r?\n/)
      .map((line) => parser.clean(line))
      .filter(Boolean);
    const wanted = label.toLowerCase();
    const stops = new Set(stopLabels.map((value) => value.toLowerCase()));
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].toLowerCase() !== wanted) continue;
      const values = [];
      for (let cursor = index + 1; cursor < lines.length && values.length < 3; cursor += 1) {
        if (stops.has(lines[cursor].toLowerCase())) break;
        values.push(lines[cursor]);
      }
      const value = parser.clean(values.join(" "));
      if (value && value.length <= 100) return value;
    }
    return "";
  }

  function specificationValue(labels) {
    const wanted = new Set(labels.map((label) => label.toLowerCase()));
    for (const row of document.querySelectorAll(".options-list .option, .vehicle-info .option, .specifications .option")) {
      if (host.contains(row)) continue;
      const valueElement = row.querySelector(".right-info");
      if (!valueElement) continue;
      const copy = row.cloneNode(true);
      copy.querySelectorAll(".right-info, img, svg").forEach((element) => element.remove());
      const label = parser.clean(copy.textContent).replace(/:$/, "").toLowerCase();
      const value = parser.clean(valueElement.textContent);
      if (wanted.has(label) && value) return value;
    }
    return "";
  }

  function snapshot() {
    const textParts = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (parent && !host.contains(parent)) textParts.push(walker.currentNode.nodeValue || "");
    }
    const pageText = textParts.join("\n");
    const exactTokens = [...document.querySelectorAll("span,a,button,strong")]
      .filter((element) => !host.contains(element))
      .map((element) => parser.clean(element.textContent))
      .filter((value) => value.length <= 12);
    return parser.parseSnapshot({
      text: pageText,
      title: `${document.title} ${document.querySelector("h1")?.innerText || ""}`,
      url: location.href,
      auctionHint: auctionHintNearTitle(),
      engineLabel:
        specificationValue(["Engine", "Engine Size", "Engine displacement", "Engine capacity"]) ||
        visibleLabeledValue("Engine", ["Transmission", "Fuel Type", "Drive Type", "Cylinders", "Keys"]),
      fuel:
        specificationValue(["Fuel Type", "Fuel", "Engine Type"]) ||
        visibleLabeledValue("Fuel Type", ["Drive Type", "Transmission", "Engine", "Cylinders", "Keys", "Show more"]),
      exactTokens,
      bidCandidates: collectBidCandidates(),
    });
  }

  function setField(name, value, force) {
    if (value == null || value === "" || (!force && manual.has(name))) return;
    refs[name].value = String(value);
  }

  function readPage(force = false) {
    if (force) manual.clear();
    const data = snapshot();
    latestData = data;
    updatePriceChoices(data, force);
    if (force) refs.auctionFee.value = "";
    setField("auction", data.auction, force);
    setField("location", data.location, force);
    setField("titleKind", data.titleKind, force);
    setField("year", data.year, force);
    setField("engine", data.engineCc, force);
    setField("fuel", normalizeFuel(data.fuel), force);
    refs.status.className = "status";
    refs.status.textContent = detectedSummary(data);
    return data;
  }

  function normalizeFuel(value) {
    return parser.normalizeFuel(value);
  }

  function updatePriceChoices(data, force) {
    const amounts = {
      bidNow: Number(data.bidNowUsd) || 0,
      currentBid: Number(data.currentBidUsd) || 0,
      lotPrice: Number(data.lotPriceUsd) || 0,
    };
    const labels = {
      bidNow: "Bid Now / seçilən qiymət",
      currentBid: "Current Bid",
      lotPrice: "Lot Price",
    };
    for (const [key, amount] of Object.entries(amounts)) {
      const option = refs.priceSource.querySelector(`option[value="${key}"]`);
      option.disabled = amount <= 0;
      option.textContent = amount > 0 ? `${labels[key]} — ${usd(amount)}` : `${labels[key]} — tapılmadı`;
    }
    if (force || refs.priceSource.selectedOptions[0]?.disabled) {
      refs.priceSource.value = amounts.bidNow ? "bidNow" : amounts.currentBid ? "currentBid" : amounts.lotPrice ? "lotPrice" : "manual";
    }
    if (refs.priceSource.value !== "manual") refs.price.value = String(amounts[refs.priceSource.value] || "");
  }

  function detectedSummary(data) {
    const values = [
      data.auction,
      data.location,
      data.currentBidUsd ? `Current Bid ${usd(data.currentBidUsd)}` : "",
      data.bidNowUsd ? `Bid Now ${usd(data.bidNowUsd)}` : "",
      data.year,
      data.engineCc ? `${data.engineCc} cm³` : "",
      data.fuel,
    ].filter(Boolean);
    return values.length ? `Səhifədən oxundu: ${values.join(" · ")}` : "Sahələr avtomatik tapılmadı; məlumatları əl ilə yaza bilərsiniz.";
  }

  function stateFromLocation(value) {
    return String(value || "").toUpperCase().match(/\(([A-Z]{2})\)/)?.[1] || String(value || "").toUpperCase().match(/,\s*([A-Z]{2})\b/)?.[1] || "";
  }

  function usd(value) {
    return `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function azn(value) {
    return `${Number(value || 0).toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AZN`;
  }

  function renderCalculation() {
    const data = lastCalculation;
    if (!data) return;
    const dypAzn = includeDyp ? 800 : 0;
    const finalAzn = data.totalWithCustomsAzn == null ? null : data.totalWithCustomsAzn + dypAzn;
    const compactOptions = [...refs.priceSource.options].map((option) =>
      `<option value="${escapeHtml(option.value)}"${option.value === refs.priceSource.value ? " selected" : ""}${option.disabled ? " disabled" : ""}>${escapeHtml(option.textContent)}</option>`,
    ).join("");
    refs.result.innerHTML = `
      <div class="price-line"><span>Hesablama qiyməti</span><select class="compact-source" id="compactPriceSource" aria-label="Hesablama qiyməti mənbəyi">${compactOptions}</select>${refs.priceSource.value === "manual" ? `<input class="compact-manual" id="compactPrice" type="number" min="1" step="50" value="${Number(refs.price.value) || ""}" aria-label="Əl ilə hesablama qiyməti">` : ""}</div>
      <div class="azn-total"><small>Yekun məbləğ${includeDyp ? " · DYP daxil" : ""}</small><strong>${finalAzn == null ? "—" : azn(finalAzn)}</strong></div>
      <button class="dyp-button${includeDyp ? " active" : ""}" id="toggleDyp" type="button" ${finalAzn == null ? "disabled" : ""}>${includeDyp ? "✓ DYP xərci əlavə edildi — 800 AZN" : "+ DYP xərclərini əlavə et — 800 AZN"}</button>
      <section class="result-details" ${showDetails ? "" : "hidden"}><div class="detail-body">
        <div class="fee-strip">
          <div class="fee-box"><span>Auction</span><strong>${usd(data.auctionFeeUsd)}</strong></div>
          <div class="fee-box"><span>Yol</span><strong>${data.freightUsd == null ? "—" : usd(data.freightUsd)}</strong></div>
          <div class="fee-box"><span>Gömrük</span><strong>${data.duty ? usd(data.customsUsd) : "—"}</strong></div>
        </div>
        <div class="row"><span>Avtomobil</span><strong>${usd(data.priceUsd)}</strong></div>
        <div class="row"><span>Auction fee (${escapeHtml(data.auctionFeeSource)})</span><strong>${usd(data.auctionFeeUsd)}</strong></div>
        <div class="row"><span>Avtomobil + auction</span><strong>${usd(data.invoiceUsd)}</strong></div>
        <div class="row"><span>ABŞ–Poti</span><strong>${data.quote.oceanUsd == null ? "Tarif yoxdur" : usd(data.quote.oceanUsd)}</strong></div>
        <div class="row"><span>Poti–Bakı</span><strong>${usd(data.quote.tirUsd)}</strong></div>
        <div class="row"><span>Bütün yol xərci</span><strong>${data.freightUsd == null ? "—" : usd(data.freightUsd)}</strong></div>
        ${data.totalWithoutCustomsUsd == null ? "" : `<div class="row"><span>Gömrükdən əvvəl</span><strong>${usd(data.totalWithoutCustomsUsd)}</strong></div>`}
        <div class="row"><span>DGK gömrük</span><strong>${data.duty ? `${usd(data.customsUsd)} · ${azn(data.duty.total?.value)}` : "—"}</strong></div>
        ${includeDyp ? `<div class="row"><span>DYP xərcləri</span><strong>800.00 AZN</strong></div>` : ""}
        ${data.totalWithCustomsUsd == null ? "" : `<div class="row"><span>Yekun USD</span><strong>${usd(data.totalWithCustomsUsd)}</strong></div>`}
        ${finalAzn == null ? "" : `<div class="row"><span>Yekun AZN</span><strong>${azn(finalAzn)}</strong></div>`}
        ${data.quote.rateSource === "state" ? `<p class="note">Bu yard üçün ayrıca tarif tapılmadı; ${escapeHtml(data.quote.state)} ştatının əvvəlki tarifi istifadə olundu.</p>` : ""}
        ${data.quote.auctionFee ? `<p class="note">${escapeHtml(data.quote.auction)} fee: buyer ${usd(data.quote.auctionFee.buyerUsd)} + live ${usd(data.quote.auctionFee.virtualUsd)} + gate ${usd(data.quote.auctionFee.gateUsd)}${data.quote.auctionFee.envUsd ? ` + env ${usd(data.quote.auctionFee.envUsd)}` : ""}${data.quote.auctionFee.titleUsd ? ` + title ${usd(data.quote.auctionFee.titleUsd)}` : ""}</p>` : ""}
        ${data.quote.missing ? `<p class="note">Bu yard və qiymət qrupu üçün yol pulu tarifi admin paneldə yoxdur.</p>` : ""}
        ${data.customsNote ? `<p class="note">${escapeHtml(data.customsNote)}</p>` : ""}
      </div></section>`;
    refs.result.hidden = false;
    shadow.getElementById("toggleDyp")?.addEventListener("click", () => {
      includeDyp = !includeDyp;
      renderCalculation();
    });
    const compactPriceSource = shadow.getElementById("compactPriceSource");
    compactPriceSource?.addEventListener("change", () => {
      refs.priceSource.value = compactPriceSource.value;
      manual.delete("price");
      if (latestData) updatePriceChoices(latestData, false);
      if (compactPriceSource.value === "manual") {
        renderCalculation();
        shadow.getElementById("compactPrice")?.focus();
      } else {
        void calculate(false);
      }
    });
    const compactPrice = shadow.getElementById("compactPrice");
    compactPrice?.addEventListener("input", () => {
      refs.price.value = compactPrice.value;
      refs.priceSource.value = "manual";
      manual.add("price");
    });
    compactPrice?.addEventListener("change", () => void calculate(false));
    compactPrice?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        compactPrice.blur();
      }
    });
  }

  async function calculate(triggeredAutomatically = false) {
    if (!authenticated) {
      if (!triggeredAutomatically) {
        refs.status.className = "status error";
        refs.status.textContent = "Hesablamaq üçün Auto Nex hesabına daxil olun.";
      }
      return;
    }
    if (calculating) {
      recalculateAfterCurrent = true;
      return;
    }
    const priceUsd = Number(refs.price.value);
    const auction = refs.auction.value;
    const yard = refs.location.value.trim();
    const state = stateFromLocation(yard);
    let year = Number(refs.year.value);
    let engineCc = Number(refs.engine.value);
    let fuel = refs.fuel.value;
    if (!priceUsd || !auction || !yard || !state) {
      if (!triggeredAutomatically) {
        refs.status.className = "status error";
        refs.status.textContent = "Qiymət, hərrac və Location (ştat kodu ilə) lazımdır.";
      }
      return;
    }

    calculating = true;
    refs.calculate.disabled = true;
    refs.calculate.textContent = "Hesablanır…";
    refs.status.className = "status";
    refs.status.textContent = "Auto Nex tarifləri hesablanır…";
    refs.result.hidden = true;

    try {
      const [quote, vinDetails] = await Promise.all([
        send({
          type: "ANX_API",
          path: "/shipping/quote",
          method: "POST",
          body: { url: location.href, priceUsd, auction, yard, state, titleKind: refs.titleKind.value },
        }),
        latestData?.vin
          ? send({ type: "ANX_API", path: `/vins/${latestData.vin}` }).catch(() => null)
          : Promise.resolve(null),
      ]);
      const fallbackEngineCc = parser.parseEngineCc(quote.engineLabel || vinDetails?.engine || "") || Number(quote.engineCc) || 0;
      const fallbackFuel = quote.fuel || vinDetails?.fuel || "";
      if (!year && Number(quote.year || vinDetails?.year) > 0) {
        year = Number(quote.year || vinDetails.year);
        setField("year", year, false);
      }
      if (!engineCc && fallbackEngineCc > 0) {
        engineCc = fallbackEngineCc;
        setField("engine", engineCc, false);
      }
      if (!latestData?.fuel && fallbackFuel) {
        fuel = normalizeFuel(fallbackFuel);
        setField("fuel", fuel, false);
      }
      lastQuote = quote;
      refs.rateEditor.hidden = !quote.missing;
      refs.rateHint.textContent = `${quote.auction} · ${quote.yard || yard} (${quote.state}) · ${quote.band?.min ?? 0}–${quote.band?.max ?? "+"} USD qiymət aralığı üçün ABŞ–Poti tarifini yazın. Poti–Bakı ${usd(quote.tirUsd)} avtomatik əlavə olunacaq.`;
      const pickedFee = parser.selectAuctionFee({
        priceUsd,
        bidCarsFeeUsd: latestData?.auctionFeeUsd,
        bidNowUsd: latestData?.bidNowUsd,
        lotPriceUsd: latestData?.lotPriceUsd,
        fallbackFeeUsd: quote.auctionFeeUsd,
      });
      const auctionFeeUsd = pickedFee.amount;
      const auctionFeeSource = pickedFee.source;
      refs.auctionFee.value = String(auctionFeeUsd);
      const invoiceUsd = priceUsd + auctionFeeUsd;
      const freightUsd = quote.freightUsd == null ? null : Number(quote.freightUsd);
      const totalWithoutCustomsUsd = freightUsd == null ? null : invoiceUsd + freightUsd;
      let duty = null;
      let customsUsd = 0;
      let customsNote = "";

      if (quote.missing || freightUsd == null || freightUsd <= 0) {
        customsNote = "Yol pulu tapılmadığı üçün gömrük hesablanmadı.";
      } else if (!year || !fuel || (engineCc <= 0 && fuel !== "Electric")) {
        customsNote = "DGK hesabı üçün il, mühərrik həcmi və yanacaq növü lazımdır.";
      } else {
        try {
          const options = await send({ type: "ANX_API", path: "/customs/auto-options?lang=az" });
          const code = parser.fuelCode(fuel);
          const engines = options.AutoEngineTypes || [];
          const picked = engines.find((row) => row.code === code) || engines.find((row) => row.code === "1") || engines[0];
          const autoType = options.AutoCategories?.[0]?.code;
          if (!picked || !autoType) throw new Error("DGK avtomobil növü tapılmadı.");
          const response = await send({
            type: "ANX_API",
            path: "/customs/auto-duty?lang=az",
            method: "POST",
            body: {
              autoType,
              engineType: picked.abbreviation2,
              engine: engineCc,
              commerceType: "nonFree",
              issueDate: `${year}-06-01`,
              price: invoiceUsd,
              transportExpenses: freightUsd,
              otherExpenses: 0,
            },
          });
          duty = response.autoDuty;
          if (!duty || Number(duty.usdCourse) <= 0) throw new Error("DGK nəticəsi boş qayıtdı.");
          customsUsd = Number(duty.total?.value || 0) / Number(duty.usdCourse);
        } catch (error) {
          customsNote = `Gömrük hesablanmadı: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      const totalWithCustomsUsd = totalWithoutCustomsUsd == null || !duty ? null : totalWithoutCustomsUsd + customsUsd;
      const totalWithCustomsAzn = totalWithCustomsUsd == null || !duty ? null : totalWithCustomsUsd * Number(duty.usdCourse || 0);
      lastCalculation = { priceUsd, auctionFeeUsd, auctionFeeSource, invoiceUsd, freightUsd, totalWithoutCustomsUsd, duty, customsUsd, customsNote, totalWithCustomsUsd, totalWithCustomsAzn, quote };
      renderCalculation();
      refs.status.textContent = `${quote.auction} · ${quote.yard || yard} · ${quote.state} · ${year || "il yoxdur"} · ${engineCc || "EV"} cm³ · ${fuel}`;
    } catch (error) {
      refs.status.className = "status error";
      const message = error instanceof Error ? error.message : String(error);
      refs.status.textContent = /503|Service Unavailable/i.test(message)
        ? "Auto Nex API verilənlər bazasına qoşula bilmir. Deploy API ayarını yoxlayın."
        : message;
    } finally {
      calculating = false;
      refs.calculate.disabled = false;
      refs.calculate.textContent = "Auto Nex ilə hesabla";
      if (recalculateAfterCurrent) {
        recalculateAfterCurrent = false;
        window.setTimeout(() => void calculate(true), 0);
      }
    }
  }

  async function saveMissingRate() {
    const rateUsd = Number(refs.rateUsd.value);
    if (!lastQuote?.cellKey || !Number.isFinite(rateUsd) || rateUsd <= 0) {
      refs.rateStatus.className = "status error";
      refs.rateStatus.textContent = "ABŞ–Poti yol pulunu düzgün yazın.";
      return;
    }
    refs.saveRate.disabled = true;
    refs.rateStatus.className = "status";
    refs.rateStatus.textContent = "Tarif bazaya yazılır…";
    try {
      const saved = await send({
        type: "ANX_SAVE_RATE_SMART",
        cellKey: lastQuote.cellKey,
        rateUsd,
        tirUsd: Number(lastQuote.tirUsd || 0),
      });
      refs.rateStatus.textContent = saved.synced
        ? "Tarif DB-də və bu brauzerdə yadda saxlandı."
        : "Tarif bu brauzerdə yadda saxlandı və indi avtomatik istifadə olunacaq.";
      await calculate(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      refs.rateStatus.className = "status error";
      refs.rateStatus.textContent = message;
    } finally {
      refs.saveRate.disabled = false;
    }
  }

  function placePanel() {
    if (host.parentElement !== document.documentElement) document.documentElement.appendChild(host);
    shadow.querySelector(".card").classList.add("dock");
  }

  function scheduleAuto() {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        manual.clear();
        lastAutoSignature = "";
        refs.result.hidden = true;
        lastCalculation = null;
        includeDyp = false;
        showDetails = false;
        refs.advancedControls.hidden = true;
        refs.toggleAdvanced.textContent = "Ətraflı";
      }
      const data = readPage(false);
      const signature = [refs.priceSource.value, refs.price.value, data.bidNowUsd, data.currentBidUsd, data.lotPriceUsd, data.auctionFeeUsd, data.auction, data.location].join("|");
      if (!host.hidden && signature !== lastAutoSignature) {
        lastAutoSignature = signature;
        void calculate(true);
      }
    }, 900);
  }

  ["auction", "location", "titleKind", "year", "engine", "fuel"].forEach((name) => {
    refs[name].addEventListener("input", () => manual.add(name));
  });
  refs.price.addEventListener("input", () => {
    refs.priceSource.value = "manual";
    manual.add("price");
  });
  refs.price.addEventListener("change", () => void calculate(false));
  refs.priceSource.addEventListener("change", () => {
    manual.delete("price");
    if (latestData) updatePriceChoices(latestData, false);
    void calculate(false);
  });
  refs.refresh.addEventListener("click", () => {
    readPage(true);
    void calculate(false);
  });
  refs.close.addEventListener("click", () => {
    host.hidden = true;
  });
  refs.calculate.addEventListener("click", () => void calculate(false));
  refs.loginButton.addEventListener("click", () => void login());
  refs.loginPassword.addEventListener("keydown", (event) => { if (event.key === "Enter") void login(); });
  refs.logoutButton.addEventListener("click", () => void logout());
  refs.toggleAdvanced.addEventListener("click", () => {
    showDetails = !showDetails;
    refs.advancedControls.hidden = !showDetails;
    refs.toggleAdvanced.textContent = showDetails ? "Yığcam göstər" : "Ətraflı";
    if (lastCalculation) renderCalculation();
  });
  refs.saveRate.addEventListener("click", () => void saveMissingRate());
  document.addEventListener("input", (event) => {
    if (!host.contains(event.target)) scheduleAuto();
  }, true);

  placePanel();
  readPage(true);
  void loadAuth();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "ANX_OPEN_CALCULATOR") return false;
    host.hidden = false;
    placePanel();
    readPage(true);
    void loadAuth().then((ok) => { if (ok) void calculate(false); });
    sendResponse({ ok: true });
    return false;
  });

  const observer = new MutationObserver(() => scheduleAuto());
  observer.observe(document.body, { childList: true, subtree: true });
})();
