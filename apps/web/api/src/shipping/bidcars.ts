import { BadRequestException, BadGatewayException } from '@nestjs/common';

export type BidCarsLot = {
  url: string;
  title?: string;
  vin?: string;
  lot?: string;
  auction?: 'COPART' | 'IAAI' | 'OTHER';
  location?: string;
  shippingFrom?: string;
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
    text.match(/Engine(?:\s*(?:size|displacement|capacity))?\s*:?\s*([\d.,]+)\s*(L|l|Litr|liter|cc|cm3|cm³|CID|cu)/i) ||
    text.match(/([\d.,]+)\s*(L|liter)\s*(?:engine|V\d)/i);
  if (labeled) {
    const n = Number(String(labeled[1]).replace(',', '.'));
    const unit = labeled[2].toLowerCase();
    if (!Number.isFinite(n)) return undefined;
    if (unit.startsWith('l')) return Math.round(n * 1000);
    if (unit === 'cid' || unit.startsWith('cu')) return Math.round(n * 16.387);
    return Math.round(n);
  }
  const liters = text.match(/\b(\d(?:\.\d)?)\s*L\b/);
  if (liters) return Math.round(Number(liters[1]) * 1000);
  const cc = text.match(/\b(\d{3,5})\s*(?:cc|cm³|cm3)\b/i);
  if (cc) return Number(cc[1]);
  return undefined;
}

function parseFuel(text: string) {
  const labeled = field(text, 'Fuel Type') || field(text, 'Fuel');
  if (labeled) return labeled.replace(/\s+/g, ' ').slice(0, 40);
  const hit = text.match(/\b(Gasoline|Petrol|Diesel|Hybrid|Plug-?in hybrid|Electric|Gas|Flex Fuel|CNG|LPG)\b/i);
  return hit?.[1];
}

export function parseBidCarsHtml(html: string, url: string): BidCarsLot {
  const text = strip(html);
  const location = field(text, 'Location');
  const shippingFrom = field(text, 'Shipping from');
  const state =
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
    state,
    year,
    engineCc,
    engineLabel,
    fuel,
  };
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
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(url.toString(), {
      signal: ac.signal,
      headers: {
        Accept: 'text/html',
        'User-Agent': 'AutoNexQuote/1.0 (nex.autos freight estimate)',
      },
    });
    if (!res.ok) throw new BadGatewayException('Bid.cars lot səhifəsi açılmadı.');
    const html = await res.text();
    return parseBidCarsHtml(html, url.toString());
  } catch (err) {
    if (err instanceof BadRequestException || err instanceof BadGatewayException) throw err;
    throw new BadGatewayException('Bid.cars-a çıxılmadı.');
  } finally {
    clearTimeout(timer);
  }
}
