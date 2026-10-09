(function initAutoNexBidCarsParser(global) {
  "use strict";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
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
    const liters = text.match(/(\d+(?:[.,]\d+)?)\s*(?:L|liter)\b/i);
    if (liters) {
      const number = Number(liters[1].replace(",", "."));
      if (number > 0 && number < 20) return Math.round(number * 1000);
    }
    const cc = text.match(/\b(\d{3,5})\s*(?:cc|cm3|cm³)\b/i);
    return cc ? Number(cc[1]) : null;
  }

  function field(text, label, stopLabels) {
    const start = text.search(new RegExp(`\\b${label}\\s*:?\\s*`, "i"));
    if (start < 0) return "";
    const prefix = text.slice(start).match(new RegExp(`^.*?${label}\\s*:?\\s*`, "i"));
    const tail = text.slice(start + (prefix ? prefix[0].length : label.length));
    const stop = stopLabels.length ? new RegExp(`\\s+(?=${stopLabels.join("|")}\\s*:?\\s*)`, "i") : null;
    return clean(stop ? tail.split(stop)[0] : tail.slice(0, 80)).replace(/^[:\-\s]+/, "");
  }

  function fuelCode(fuel) {
    const value = clean(fuel).toLowerCase();
    const diesel = /diesel|dizel/.test(value);
    const gas = /\blpg\b|\bcng\b|propane|\bqaz\b/.test(value) && !/gasoline|petrol|benzin/.test(value);
    if (/plug[\s-]?in|phev/.test(value)) return diesel ? "10" : "8";
    if (/mild[\s-]?hybrid|mhev/.test(value)) return diesel ? "13" : gas ? "14" : "11";
    if (/hybrid|hev/.test(value)) return diesel ? "7" : gas ? "9" : "6";
    if (/electric|battery|\bev\b|bex/.test(value)) return "12";
    if (diesel) return "2";
    if (gas) return "3";
    return "1";
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

    const location =
      field(text, "Location", ["Shipping from", "Odległość", "Distance", "Estimated cost", "Sale date"]) ||
      field(text, "Shipping from", ["Odległość", "Distance", "Estimated cost", "Sale date"]);
    const state = location.match(/\(([A-Z]{2})\)/)?.[1] || location.match(/,\s*([A-Z]{2})\b/)?.[1] || "";
    const engineLabel = field(text, "Engine", ["Transmission", "Fuel Type", "Drive Type", "Cylinders", "Keys"]);
    const fuel = field(text, "Fuel Type", ["Drive Type", "Transmission", "Engine", "Cylinders", "Keys"]);
    const yearHit = `${title} ${text.slice(0, 500)}`.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
    const exact = (snapshot.exactTokens || []).map((token) => clean(token).toUpperCase());
    const auction = exact.includes("IAAI") || /\bIAAI\b/i.test(title) ? "IAAI" : exact.includes("COPART") || /\bCOPART\b/i.test(title) ? "COPART" : "";
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
      titleKind,
    };
  }

  const api = { clean, parseMoney, parseEngineCc, fuelCode, selectAuctionFee, parseSnapshot };
  global.AutoNexBidCarsParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
