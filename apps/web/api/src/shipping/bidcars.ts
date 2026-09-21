import { BadRequestException } from '@nestjs/common';
import { knownState, parseYardPlace } from './zones';

const BROWSER_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

export type BidCarsLot = {
  url: string;
  title?: string;
  vin?: string;
  lot?: string;
  auction?: 'COPART' | 'IAAI' | 'OTHER';
  location?: string;
  shippingFrom?: string;
  yard?: string;
  yardSlug?: string;
  state?: string;
  year?: number;
  engineCc?: number;
  engineLabel?: string;
  fuel?: string;
};

function strip(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

function field(text: string, label: string) {
  const match = text.match(
    new RegExp(
      `${label}\\s*:\\s*([^|]+?)(?=\\s+(?:Location|Shipping|Seller|Sale|Odległość|Estimated|Live|Lot|Fuel|Engine|Transmission|Odometer|Primary|Secondary)\\b|$)`,
      'i',
    ),
  );
  return match?.[1]?.trim();
}

function vinFromText(raw?: string) {
  const hit = String(raw || '')
    .toUpperCase()
    .match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  return hit?.[1];
}

function lotCandidates(raw?: string) {
  const value = String(raw || '').trim();
  const dashed = value.match(/^(\d+)-(\d{5,})$/);
  if (dashed) return [dashed[2]];
  const digits = value.replace(/\D/g, '');
  return digits.length >= 5 ? [digits] : [];
}

function parseYear(url: string, title?: string, text?: string) {
  const fromPath = url.match(/\/((?:19|20)\d{2})-/);
  if (fromPath) return Number(fromPath[1]);
  const fromTitle = title?.match(/\b((?:19|20)\d{2})\b/);
  if (fromTitle) return Number(fromTitle[1]);
  const fromText = text?.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  return fromText ? Number(fromText[1]) : undefined;
}

function parseEngineCc(text: string) {
  const labeled =
    text.match(/Engine(?:\s*(?:size|displacement|capacity|type))?\s*:?\s*([\d.,]+)\s*(L|l|Litr|liter|cc|cm3|cm³|CID|cu)/i) ||
    text.match(/\b([\d.,]+)\s*(L|liter)\s*(?:\d+\s*)?(?:cyl|cylinder|V\d|engine)/i) ||
    text.match(/\b([\d.,]+)\s*L\b/i);
  if (labeled) {
    const n = Number(String(labeled[1]).replace(',', '.'));
    const unit = (labeled[2] || 'L').toLowerCase();
    if (!Number.isFinite(n) || n <= 0) return undefined;
    if (unit.startsWith('l')) return Math.round(n * 1000);
    if (unit === 'cid' || unit.startsWith('cu')) return Math.round(n * 16.387);
    return Math.round(n);
  }
  const cc = text.match(/\b(\d{3,5})\s*(?:cc|cm³|cm3)\b/i);
  if (cc) return Number(cc[1]);
  return undefined;
}

function parseFuel(text: string) {
  const labeled = field(text, 'Fuel Type') || field(text, 'Fuel') || field(text, 'Engine Type');
  const blob = `${labeled || ''} ${text}`.replace(/\s+/g, ' ');
  const low = blob.toLowerCase();
  if (/plug[\s-]?in|phev/.test(low) && /diesel|dizel/.test(low)) return 'Plug-in hybrid diesel';
  if (/plug[\s-]?in|phev/.test(low)) return 'Plug-in hybrid';
  if (/mild[\s-]?hybrid|mhev/.test(low) && /diesel|dizel/.test(low)) return 'Mild hybrid diesel';
  if (/mild[\s-]?hybrid|mhev/.test(low)) return 'Mild hybrid';
  if (/\bhybrid\b|\bhev\b/.test(low) && /diesel|dizel/.test(low)) return 'Hybrid diesel';
  if (/\bhybrid\b|\bhev\b/.test(low)) return 'Hybrid';
  if (/electric|battery|\bev\b/.test(low) && !/hybrid/.test(low)) return 'Electric';
  if (/diesel|dizel/.test(low)) return 'Diesel';
  if (/\blpg\b|\bcng\b|propane/.test(low)) return 'Gas';
  if (labeled) return labeled.replace(/\s+/g, ' ').slice(0, 40);
  const hit = blob.match(/\b(Gasoline|Petrol|Flex Fuel|Gas)\b/i);
  return hit?.[1];
}

export function parseBidCarsHtml(html: string, url: string): BidCarsLot {
  const text = strip(html);
  const location = field(text, 'Location');
  const shippingFrom = field(text, 'Shipping from');
  const place = parseYardPlace(location) || parseYardPlace(shippingFrom);
  const state =
    place?.state ||
    (location || shippingFrom || '').match(/\(([A-Z]{2})\)/)?.[1] ||
    text.match(/\(([A-Z]{2})\)/)?.[1];
  const vin = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/)?.[1];
  const lot = url.match(/\/lot\/([^/]+)/i)?.[1] || text.match(/\b(\d-\d{6,})\b/)?.[1];
  let auction: BidCarsLot['auction'] = 'OTHER';
  if (/\bCOPART\b/i.test(text)) auction = 'COPART';
  else if (/\bIAAI\b/i.test(text)) auction = 'IAAI';
  const title =
    html.match(/<h1[^>]*>([^<]+)/i)?.[1]?.trim() ||
    url.match(/\/\d{4}-([^/?#]+)/)?.[1]?.replace(/-/g, ' ');
  const year = parseYear(url, title, text);
  const engineCc = parseEngineCc(text);
  const fuel = parseFuel(text);
  const engineLabel = engineCc ? `${engineCc} cm³` : undefined;
  return {
    url,
    title,
    vin,
    lot,
    auction,
    location,
    shippingFrom,
    yard: place?.yard,
    yardSlug: place?.slug,
    state,
    year,
    engineCc,
    engineLabel,
    fuel,
  };
}

function betterFuel(a?: string, b?: string) {
  const rank = (v?: string) => {
    const x = (v || "").toLowerCase();
    if (/plug/.test(x)) return 5;
    if (/mild/.test(x)) return 4;
    if (/hybrid/.test(x)) return 3;
    if (/electric/.test(x)) return 2;
    if (x) return 1;
    return 0;
  };
  return rank(a) >= rank(b) ? a || b : b || a;
}

function mergeLot(base: BidCarsLot, extra: Partial<BidCarsLot> | null | undefined): BidCarsLot {
  if (!extra) return base;
  return {
    ...base,
    title: extra.title || base.title,
    vin: extra.vin || base.vin,
    lot: extra.lot || base.lot,
    auction: extra.auction && extra.auction !== 'OTHER' ? extra.auction : base.auction,
    location: extra.location || base.location,
    shippingFrom: extra.shippingFrom || base.shippingFrom,
    yard: extra.yard || base.yard,
    yardSlug: extra.yardSlug || base.yardSlug,
    state: extra.state || base.state,
    year: extra.year || base.year,
    engineCc: extra.engineCc || base.engineCc,
    engineLabel: extra.engineLabel || base.engineLabel,
    fuel: betterFuel(extra.fuel, base.fuel),
  };
}

function parseLotFromUrl(url: URL): BidCarsLot {
  const path = url.pathname;
  const match = path.match(/\/lot\/([^/]+)(?:\/([^/?#]*))?/i);
  const lot = match?.[1] ? decodeURIComponent(match[1]) : undefined;
  const slug = match?.[2] ? decodeURIComponent(match[2]) : '';
  const tokens = slug.split(/[-_]+/).filter(Boolean);
  const yearTok = tokens.find((tok) => /^(19|20)\d{2}$/.test(tok));
  const vin = vinFromText(slug) || vinFromText(url.toString());
  let state: string | undefined;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const code = tokens[i].toUpperCase();
    if (vin && code === vin.slice(0, 2)) continue;
    if (code.length === 2 && knownState(code) && i !== 0) {
      state = code;
      break;
    }
  }
  const title = slug ? slug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim() : undefined;
  return {
    url: url.toString(),
    lot,
    title,
    vin,
    state,
    year: yearTok ? Number(yearTok) : parseYear(url.toString(), title),
  };
}

async function fetchText(url: string, ms: number, extra?: { accept?: string; referer?: string }) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        ...BROWSER_HEADERS,
        Accept: extra?.accept || BROWSER_HEADERS.Accept,
        Referer: extra?.referer || 'https://bid.cars/',
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCopartLot(lotRaw?: string): Promise<{ hit: Partial<BidCarsLot> } | { miss: true } | { skip: true }> {
  const ids = lotCandidates(lotRaw);
  if (!ids.length) return { skip: true };
  let skipped = false;
  for (const lot of ids) {
    const body = await fetchText(`https://www.copart.com/public/data/lotdetails/solr/${lot}`, 10000, {
      accept: 'application/json',
      referer: `https://www.copart.com/lot/${lot}`,
    });
    if (!body || body.trim().startsWith('<')) {
      skipped = true;
      continue;
    }
    try {
      const json = JSON.parse(body) as {
        returnCode?: number;
        data?: {
          lotDetails?: {
            ln?: number;
            mkn?: string;
            lmg?: string;
            lcy?: number;
            ld?: string;
            yn?: string;
            fv?: string;
            egn?: string;
            ft?: string;
            vin?: string;
          };
        };
      };
      const row = json.data?.lotDetails;
      if (json.returnCode !== 1 || !row || (row.ln != null && String(row.ln) !== lot)) continue;
      if (!row.mkn && !row.yn && !row.lcy) continue;
      const yardRaw = String(row.yn || '').trim();
      const place = parseYardPlace(yardRaw);
      const state = place?.state || yardRaw.match(/\b([A-Z]{2})\b/)?.[1] || yardRaw.split('-')[0]?.trim();
      const liters = String(row.egn || '').match(/(\d(?:\.\d)?)\s*L/i);
      const engineCc = liters ? Math.round(Number(liters[1]) * 1000) : parseEngineCc(String(row.egn || row.ld || ''));
      return {
        hit: {
          lot,
          auction: 'COPART',
          title: row.ld?.trim() || [row.lcy, row.mkn, row.lmg].filter(Boolean).join(' '),
          year: row.lcy || undefined,
          location: yardRaw || undefined,
          yard: place?.yard,
          yardSlug: place?.slug,
          state: knownState(state) || undefined,
          vin: row.vin || (row.fv && !row.fv.includes('*') ? row.fv : undefined),
          engineCc,
          engineLabel: engineCc ? `${engineCc} cm³` : undefined,
          fuel: parseFuel([row.ft, row.egn, row.ld].filter(Boolean).join(' ')) || row.ft || undefined,
        },
      };
    } catch {
      skipped = true;
    }
  }
  return skipped ? { skip: true } : { miss: true };
}

export async function fetchBidCarsLot(raw: string): Promise<BidCarsLot> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BadRequestException('Bid.cars linki düzgün deyil.');
  }
  if (!/^(www\.)?bid\.cars$/i.test(url.hostname) || !url.pathname.includes('/lot/')) {
    throw new BadRequestException('Yalnız bid.cars lot linki qəbul olunur.');
  }
  url.hostname = 'bid.cars';
  let lot = parseLotFromUrl(url);
  const html = await fetchText(url.toString(), 12000);
  if (html) lot = mergeLot(lot, parseBidCarsHtml(html, url.toString()));
  const copart = await fetchCopartLot(lot.lot);
  if ('hit' in copart) lot = mergeLot(lot, copart.hit);
  else if ('miss' in copart && (!lot.auction || lot.auction === 'OTHER')) {
    lot = { ...lot, auction: 'IAAI' };
  }
  if (lot.engineCc && !lot.engineLabel) lot.engineLabel = `${lot.engineCc} cm³`;
  return lot;
}
