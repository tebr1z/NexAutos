(function initAutoNexBidCarsParser(global) {
  "use strict";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  const LOT_PAGE_NOTICE = "Zəhmət olmasa BidCars-da avtomobilin lot səhifəsini açın. Ana səhifə və axtarış nəticələri oxunmur.";
  function isBidCarsLotUrl(value) {
    try {
      const url = new URL(value || "");
      if (url.protocol !== "https:" || url.username || url.password || !["bid.cars", "www.bid.cars"].includes(url.hostname)) return false;
      const segments = url.pathname.split("/").filter(Boolean);
      const lotIndex = segments.findIndex((segment) => segment.toLowerCase() === "lot");
      // BidCars occasionally changes locale/prefix and slug segments.  The stable
      // part is the numeric auction-source + lot id immediately after /lot/.
      return lotIndex >= 0 && /^\d+-\d+$/.test(segments[lotIndex + 1] || "");
    } catch { return false; }
  }

  function readDocumentText(root, excluded) {
    if (!root) return "";
    const parts = [];
    const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      // Text nodes inside scripts are source code, not vehicle specifications.
      // Keep hidden specification rows (Show more) but never script/style data.
      if (!parent || excluded?.contains(parent) || parent.closest("script,style,noscript,template,svg,canvas,iframe,object")) continue;
      parts.push(walker.currentNode.nodeValue || "");
    }
    return parts.join("\n");
  }

  function parseMoney(value) {
    const raw = clean(value).replace(/USD/gi, "").replace(/\$/g, "").replace(/\s/g, "");
    const normalized = raw.includes(",") && raw.includes(".")
      ? raw.replace(/,/g, "")
      : raw.replace(/,(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
    const hit = normalized.match(/-?\d+(?:\.\d+)?/);
    const amount = hit ? Number(hit[0]) : NaN;
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  function moneyAfterLabel(text, labels) {
    for (const label of labels) {
      const index = text.toLowerCase().indexOf(label.toLowerCase());
      if (index < 0) continue;
      const tail = text.slice(index + label.length, index + label.length + 100);
      const hit = tail.match(/\$\s*[\d,.]+|[\d,.]+\s*USD/i);
      const amount = parseMoney(hit && hit[0]);
      if (amount) return amount;
    }
    return null;
  }

  function parseEngineCc(value) {
    const text = clean(value);
    // Auction feeds use many compact variants: 2.0L4, 2.0L I4,
    // 2,0 L/4 Cyl, 3.6L-V6, 3.7LV-6 and the regular 1.6L, 4 cyl.
    const liters = text.match(/(\d+(?:[.,]\d+)?)\s*(?:L(?:IT(?:ER|RE)S?)?)(?=\s|\d|[IVHW](?:\s*[-/]?\s*\d)|[\/,;()\-]|$)/i);
    if (liters) {
      const number = Number(liters[1].replace(",", "."));
      if (number > 0 && number < 20) return Math.round(number * 1000);
    }
    const cc = text.match(/\b(\d{1,2}(?:[,. ]\d{3})|\d{3,5})\s*(?:cc|cm3|cm³|cubic\s*centimeters?)\b/i);
    return cc ? Number(cc[1].replace(/[,. ]/g, "")) : null;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function field(text, label, stopLabels) {
    const source = String(text || "");
    const matcher = new RegExp(`${escapeRegExp(label)}\\s*:?\\s*`, "gi");
    const stops = stopLabels.length ? new RegExp(stopLabels.map(escapeRegExp).join("|"), "gi") : null;
    const candidates = [];
    let match;
    while ((match = matcher.exec(source))) {
      const tail = source.slice(match.index + match[0].length, match.index + match[0].length + 220);
      let end = Math.min(tail.length, 180);
      if (stops) {
        stops.lastIndex = 0;
        const stop = stops.exec(tail);
        if (stop) end = Math.min(end, stop.index);
      }
      const value = clean(tail.slice(0, end)).replace(/^[:\-\s]+/, "");
      // Continue past menu/filter labels that have no value and try the actual
      // specification row later in the document.
      if (value && value.length <= 180 && !/[<>{};=]/.test(value)) candidates.push(value);
      if (matcher.lastIndex === match.index) matcher.lastIndex += 1;
    }
    // Real specification values are concise.  This makes the visible vehicle
    // row win over long search-menu text when both use the same label.
    return candidates.sort((left, right) => left.length - right.length)[0] || "";
  }

  function fieldAny(text, labels, stopLabels) {
    for (const label of labels) {
      const value = field(text, label, stopLabels);
      if (value) return value;
    }
    return "";
  }

  function fuelCode(fuel) {
    const value = clean(fuel).toLowerCase();
    const diesel = /diesel|dizel|olej nap[eę]dowy|дизел/.test(value);
    const gas = /\blpg\b|\bcng\b|propane|autogaz|\bqaz\b|газ/.test(value) && !/gasoline|petrol|benzin|benzyna/.test(value);
    if (/plug[\s-]?in|phev|плагин/.test(value)) return diesel ? "10" : "8";
    if (/mild.*hybr|mhev|mi[eę]kk.*hybryd/.test(value)) return diesel ? "13" : gas ? "14" : "11";
    if (/hybr|hev|гибрид/.test(value)) return diesel ? "7" : gas ? "9" : "6";
    if (/electric|battery|elektr|\bev\b|bex|электр/.test(value)) return "12";
    if (diesel) return "2";
    if (gas) return "3";
    return "1";
  }

  function normalizeFuel(fuel) {
    const value = clean(fuel).toLowerCase();
    if (!value) return "";
    const diesel = /diesel|dizel|olej nap[eę]dowy|дизел/.test(value);
    const gas = /\blpg\b|\bcng\b|propane|autogaz|\bqaz\b|газ/.test(value) && !/gasoline|petrol|benzin|benzyna/.test(value);
    if (/plug[\s-]?in|phev|плагин/.test(value)) return diesel ? "Plug-in diesel hybrid" : "Plug-in hybrid";
    if (/mild.*hybr|mhev|mi[eę]kk.*hybryd/.test(value)) return diesel ? "Mild diesel hybrid" : gas ? "Mild LPG hybrid" : "Mild hybrid";
    if (/hybr|hev|гибрид/.test(value)) return diesel ? "Diesel hybrid" : gas ? "LPG hybrid" : "Hybrid";
    if (/electric|battery|elektr|\bev\b|bex|электр/.test(value)) return "Electric";
    if (diesel) return "Diesel";
    if (gas) return "LPG";
    return "Gasoline";
  }

  function selectAuctionFee({ priceUsd, bidCarsFeeUsd, bidNowUsd, lotPriceUsd, fallbackFeeUsd }) {
    const price = Number(priceUsd) || 0;
    const pageFee = Number(bidCarsFeeUsd) || 0;
    const matchesPagePrice = [bidNowUsd, lotPriceUsd]
      .map(Number)
      .some((value) => value > 0 && Math.abs(value - price) < 0.01);
    return pageFee > 0 && matchesPagePrice
      ? { amount: pageFee, source: "BidCars" }
      : { amount: Number(fallbackFeeUsd) || 0, source: "Auto Nex fallback" };
  }

  function parseSnapshot(snapshot) {
    if (snapshot.url && !isBidCarsLotUrl(snapshot.url)) return null;
    const text = clean(snapshot.text);
    const title = clean(snapshot.title);
    const candidates = Array.isArray(snapshot.bidCandidates) ? snapshot.bidCandidates : [];
    const scored = candidates
      .map((candidate) => ({
        amount: parseMoney(candidate.value),
        score: Number(candidate.score) || 0,
        kind: candidate.kind || "",
      }))
      .filter((candidate) => candidate.amount)
      .sort((a, b) => b.score - a.score);

    const currentBidUsd = moneyAfterLabel(text, ["Current Bid", "Winning Bid", "Sold for"]);
    const lotPriceUsd = moneyAfterLabel(text, ["Lot Price"]);
    const bidNowUsd = scored.find((candidate) => candidate.kind === "bidNow")?.amount || scored[0]?.amount || null;
    const bidAmount = bidNowUsd || lotPriceUsd || currentBidUsd;

    const locationLabels = ["Location", "Lokalizacja", "Standort", "Местоположение", "Yer"];
    const shippingLabels = ["Shipping from", "Wysyłka z", "Versand ab", "Отправка из"];
    const locationStops = [...shippingLabels, "Odległość", "Distance", "Entfernung", "Расстояние", "Estimated cost", "Sale date", "Data sprzedaży", "Engine", "Motor", "Silnik", "Mühərrik", "Двигатель"];
    const location = fieldAny(text, locationLabels, locationStops) || fieldAny(text, shippingLabels, locationStops);
    const state = location.match(/\(([A-Z]{2})\)/)?.[1] || location.match(/,\s*([A-Z]{2})\b/)?.[1] || "";
    // BidCars has hidden navigation text such as "Engine size, type, horsepower"
    // before the actual vehicle specification table.  Content scripts provide the
    // visible label/value pair so that the navigation text cannot win this match.
    const engineLabels = ["Engine", "Engine Size", "Engine displacement", "Engine capacity", "Motor", "Silnik", "Mühərrik", "Двигатель"];
    const fuelLabels = ["Fuel Type", "Fuel", "Engine Type", "Kraftstoffart", "Kraftstoff", "Rodzaj paliwa", "Paliwo", "Yanacaq", "Тип топлива"];
    const specStops = ["Transmission", "Fuel Type", "Fuel", "Drive Type", "Cylinders", "Keys", "Engine", "Engine Type", "Body Style", "Exterior", "Show more", "Getriebe", "Kraftstoffart", "Antrieb", "Zylinder", "Skrzynia biegów", "Rodzaj paliwa", "Napęd", "Cylindry", "Трансмиссия", "Тип топлива", "Привод", "Цилиндры"];
    const engineLabel = (clean(snapshot.engineLabel) || fieldAny(text, engineLabels, specStops)).slice(0, 120);
    const fuel = (clean(snapshot.fuel) || fieldAny(text, fuelLabels, specStops)).slice(0, 80);
    const vin = `${title} ${text}`.toUpperCase().match(/\b([A-HJ-NPR-Z0-9]{17})\b/)?.[1] || "";
    const yearHit = `${title} ${text.slice(0, 500)}`.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
    const exact = (snapshot.exactTokens || []).map((token) => clean(token).toUpperCase());
    const auctionHint = clean(snapshot.auctionHint).toUpperCase();
    const auctionText = `${title} ${text.slice(0, 1500)}`;
    const auction =
      auctionHint === "COPART"
        ? "COPART"
        : auctionHint === "IAA" || auctionHint === "IAAI"
        ? "IAAI"
        : /\bCOPART\b/i.test(title)
          ? "COPART"
          : /\bIAA(?:I)?\b/i.test(title)
            ? "IAAI"
            : exact.includes("COPART") && !exact.some((token) => token === "IAA" || token === "IAAI")
              ? "COPART"
              : exact.some((token) => token === "IAA" || token === "IAAI") && !exact.includes("COPART")
                ? "IAAI"
                : /\bCOPART\b/i.test(auctionText) && !/\bIAA(?:I)?\b/i.test(auctionText)
                  ? "COPART"
                  : /\bIAA(?:I)?\b/i.test(auctionText) && !/\bCOPART\b/i.test(auctionText)
                    ? "IAAI"
                    : "";
    const titleKind = /\bclean title\b/i.test(text) ? "CLEAN" : "SALVAGE";

    return {
      priceUsd: bidAmount,
      currentBidUsd,
      bidNowUsd,
      lotPriceUsd,
      auctionFeeUsd: moneyAfterLabel(text, ["Auction Fees", "Auction Fee"]),
      auction,
      location,
      state,
      year: yearHit ? Number(yearHit[1]) : null,
      engineCc: parseEngineCc(engineLabel),
      engineLabel,
      fuel,
      fuelCode: fuelCode(fuel),
      vin,
      titleKind,
    };
  }

  const api = { clean, LOT_PAGE_NOTICE, isBidCarsLotUrl, readDocumentText, parseMoney, parseEngineCc, normalizeFuel, fuelCode, selectAuctionFee, parseSnapshot };
  global.AutoNexBidCarsParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
