(function initMarketParser(global) {
  "use strict";

  const TRIMS = [
    "SEL Premium", "SEL Plus", "SEL Convenience", "Limited Ultimate", "Limited",
    "N Line", "Calligraphy", "Platinum", "Touring", "Premium Plus", "Premium",
    "Sport", "Luxury", "Ultimate", "XSE", "XLE", "EX-L", "EX", "LX", "SX",
    "GT-Line", "GT Line", "GT", "SE", "SEL", "LE", "LS", "LT", "S"
  ];
  const MULTI_MAKES = ["Alfa Romeo", "Aston Martin", "Land Rover", "Mercedes Benz", "Mercedes-Benz"];

  function clean(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function parseScaledNumber(value) {
    const hit = clean(value).replace(/,/g, "").match(/([\d.]+)\s*([km])?/i);
    if (!hit) return null;
    const multiplier = String(hit[2] || "").toLowerCase() === "k" ? 1000 : String(hit[2] || "").toLowerCase() === "m" ? 1000000 : 1;
    const number = Number(hit[1]) * multiplier;
    return Number.isFinite(number) ? Math.round(number) : null;
  }

  function parseMoney(value) {
    const hit = clean(value).replace(/USD/gi, "").replace(/[$,\s]/g, "").match(/\d+(?:\.\d+)?/);
    const number = hit ? Number(hit[0]) : NaN;
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function moneyAfter(text, label) {
    const hit = clean(text).match(new RegExp(`${label}\\s*:?\\s*(?:USD\\s*)?\\$?\\s*([\\d,.]+)`, "i"));
    return parseMoney(hit?.[1]);
  }

  function parseMileage(text) {
    const value = clean(text);
    const milesHit = value.match(/(?:mileage|milage|odometer)\s*:?\s*([\d.,]+\s*[km]?)\s*(?:mi|miles)\b/i) || value.match(/([\d.,]+\s*[km]?)\s*(?:mi|miles)\b/i);
    const kmHit = value.match(/\(([\d.,]+\s*[km]?)\s*km\)/i) || value.match(/(?:mileage|milage|odometer)\s*:?\s*([\d.,]+\s*[km]?)\s*km\b/i);
    let miles = parseScaledNumber(milesHit?.[1]);
    let km = parseScaledNumber(kmHit?.[1]);
    if (!miles && km) miles = Math.round(km / 1.609344);
    if (!km && miles) km = Math.round(miles * 1.609344);
    return { mileageMi: miles, mileageKm: km };
  }

  function parseEngineCc(value) {
    const text = clean(value);
    const liters = text.match(/(\d+(?:[.,]\d+)?)\s*L(?=\s|\d|[I,V/,.()\-]|$)/i);
    if (liters) {
      const number = Number(liters[1].replace(",", "."));
      if (number > 0 && number < 20) return Math.round(number * 1000);
    }
    const cc = text.match(/\b(\d{3,5})\s*(?:cc|cm3|cm³)\b/i);
    return cc ? Number(cc[1]) : null;
  }

  function normalizeFuel(value) {
    const text = clean(value).toLowerCase();
    if (/plug[\s-]?in|phev/.test(text)) return "Plug-in hybrid";
    if (/mild.*hybrid|mhev/.test(text)) return "Mild hybrid";
    if (/hybrid|\bhev\b/.test(text)) return "Hybrid";
    if (/electric|battery|\bev\b/.test(text)) return "Electric";
    if (/diesel|dizel/.test(text)) return "Diesel";
    if (/lpg|cng|propane/.test(text)) return "LPG";
    if (/gasoline|petrol|benzin/.test(text)) return "Gasoline";
    return "";
  }

  function normalizeTrim(value) {
    const text = clean(value).replace(/[_-]+/g, " ");
    for (const trim of TRIMS) {
      const pattern = trim.replace(/[ -]/g, "[ -]?");
      if (new RegExp(`(^|[,/ ])${pattern}($|[,/ ])`, "i").test(` ${text} `)) return trim.replace("GT Line", "GT-Line");
    }
    return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Naməlum";
  }

  function parseVehicleTitle(value) {
    const title = clean(value).replace(/\s*[·•]\s*[A-HJ-NPR-Z0-9]{17}.*$/i, "");
    const match = title.match(/\b(19[5-9]\d|20[0-3]\d)\s+(.+)/);
    if (!match) return { year: null, make: "", model: "", trim: "Naməlum", title };
    const year = Number(match[1]);
    const [vehiclePart, ...commaParts] = match[2].split(",").map(clean);
    const explicitTrim = commaParts.join(" ");
    let make = MULTI_MAKES.find((item) => vehiclePart.toLowerCase().startsWith(item.toLowerCase() + " ")) || vehiclePart.split(" ")[0] || "";
    const remainder = clean(vehiclePart.slice(make.length));
    let trim = explicitTrim;
    let model = remainder;
    if (!trim) {
      const found = TRIMS.find((item) => new RegExp(`\\b${item.replace(/[ -]/g, "[ -]?")}\\b`, "i").test(remainder));
      if (found) {
        trim = found;
        model = clean(remainder.replace(new RegExp(`\\b${found.replace(/[ -]/g, "[ -]?")}\\b.*$`, "i"), ""));
      }
    }
    return { year, make, model, trim: normalizeTrim(trim), title };
  }

  function valueAfter(text, label, stops) {
    const stop = stops.join("|");
    const hit = clean(text).match(new RegExp(`${label}\\s*:?\\s*(.+?)(?=\\s+(?:${stop})\\s*:?|$)`, "i"));
    return clean(hit?.[1]).slice(0, 240);
  }

  function parseAuctionDate(text) {
    const normalized = clean(text).replace(/(st|nd|rd|th),/gi, ",");
    const hit = normalized.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?\s+(\d{1,2})\s+([A-Za-z]+),?\s+(20\d{2})/i) ||
      normalized.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(20\d{2})/i);
    if (!hit) return null;
    const dateText = /^\d/.test(hit[1]) ? `${hit[2]} ${hit[1]}, ${hit[3]}` : `${hit[1]} ${hit[2]}, ${hit[3]}`;
    const date = new Date(`${dateText} 12:00:00 UTC`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function parseRecordSnapshot(snapshot) {
    const text = clean(snapshot.text);
    const titleInfo = parseVehicleTitle(snapshot.title || text.slice(0, 160));
    const finalBidUsd = moneyAfter(text, "Final bid");
    if (!finalBidUsd || !/(final bid|archived auction|auction ended|sold by buy now)/i.test(text)) return null;
    const combinedFuel = `${snapshot.fuel || ""} ${snapshot.imageAlts || ""} ${valueAfter(text, "Fuel Type", ["Drive Type", "Transmission", "Engine", "Data fetched"])} ${titleInfo.title}`;
    const mileage = parseMileage(text);
    const engineLabel = clean(snapshot.engineLabel) || valueAfter(text, "Engine", ["Transmission", "Fuel Type", "Drive Type", "Cylinders", "Horsepower"]) || text.match(/\b\d(?:[.,]\d)?\s*L\s*(?:I|V)?\d?\b/i)?.[0] || "";
    const auction = /\bCOPART\b/i.test(`${snapshot.auction || ""} ${text}`) ? "COPART" : /\bIAA(?:I)?\b/i.test(`${snapshot.auction || ""} ${text}`) ? "IAAI" : "";
    const vin = clean(`${snapshot.vin || ""} ${text}`).toUpperCase().match(/\b([A-HJ-NPR-Z0-9]{17})\b/)?.[1] || "";
    const lot = clean(snapshot.lot || "") || text.match(/\b([01]-\d{5,})\b/)?.[1] || "";
    const location = valueAfter(text, "Location", ["Damage", "Status", "Seller", "Sale doc", "Primary damage", "Final bid"]);
    const state = location.match(/\(([A-Z]{2})\)/)?.[1] || "";
    const color = valueAfter(text, "Exterior color", ["Engine", "Transmission", "Fuel Type", "Drive Type", "Data fetched"]);
    return {
      key: vin || lot || clean(snapshot.url), url: clean(snapshot.url), lot, vin, auction,
      ...titleInfo, finalBidUsd, ...mileage, engineCc: parseEngineCc(engineLabel), engineLabel,
      fuel: normalizeFuel(combinedFuel) || "Naməlum", color: color || clean(snapshot.color) || "Naməlum",
      location, state, saleDate: parseAuctionDate(text), observedAt: snapshot.observedAt || new Date().toISOString()
    };
  }

  function percentile(sorted, p) {
    if (!sorted.length) return null;
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }

  function acceptableMileage(row) {
    const km = Number(row?.mileageKm);
    if (Number.isFinite(km) && km > 0) return km <= 300000;
    const miles = Number(row?.mileageMi);
    return !Number.isFinite(miles) || miles <= 0 || miles * 1.609344 <= 300000;
  }

  function statistics(records) {
    const values = records.filter(acceptableMileage).map((row) => Number(row.finalBidUsd)).filter((value) => value > 0).sort((a, b) => a - b);
    if (!values.length) return null;
    const q1 = percentile(values, 0.25);
    const q3 = percentile(values, 0.75);
    const iqr = q3 - q1;
    const trimmed = values.filter((value) => value >= q1 - 1.5 * iqr && value <= q3 + 1.5 * iqr);
    return {
      count: values.length, min: values[0], max: values.at(-1), q1: Math.round(q1), q3: Math.round(q3),
      median: Math.round(percentile(values, 0.5)), average: Math.round(trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length)
    };
  }

  function chooseCohort(records, target, filters = {}) {
    const same = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
    const base = records.filter((row) => acceptableMileage(row) && (!filters.auction || row.auction === filters.auction) && (!filters.fuel || row.fuel === filters.fuel) && (!filters.color || same(row.color, filters.color)));
    const tiers = [
      { label: "Tam oxşar", rows: base.filter((r) => same(r.make, target.make) && same(r.model, target.model) && same(r.trim, target.trim) && same(r.fuel, target.fuel) && Math.abs((r.year || 0) - (target.year || 0)) <= 1 && (!r.engineCc || !target.engineCc || Math.abs(r.engineCc - target.engineCc) <= 200) && (!r.mileageMi || !target.mileageMi || Math.abs(r.mileageMi - target.mileageMi) <= 30000)) },
      { label: "Yaxın komplektasiya", rows: base.filter((r) => same(r.make, target.make) && same(r.model, target.model) && same(r.trim, target.trim) && same(r.fuel, target.fuel) && Math.abs((r.year || 0) - (target.year || 0)) <= 2) },
      { label: "Model və yanacaq", rows: base.filter((r) => same(r.make, target.make) && same(r.model, target.model) && same(r.fuel, target.fuel) && Math.abs((r.year || 0) - (target.year || 0)) <= 2) }
    ];
    return tiers.find((tier) => tier.rows.length >= 3) || tiers.find((tier) => tier.rows.length) || { label: "Nəticə yoxdur", rows: [] };
  }

  const api = { clean, parseMoney, parseMileage, parseEngineCc, normalizeFuel, normalizeTrim, parseVehicleTitle, parseAuctionDate, parseRecordSnapshot, percentile, acceptableMileage, statistics, chooseCohort };
  global.AutoNexMarketParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
