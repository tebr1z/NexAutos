export type RadarFilters = {
  make: string; model: string; yearFrom: number; yearTo: number;
  engineMin?: number; engineMax?: number; damages: string[];
  document: 'any' | 'clean' | 'salvage' | 'restricted' | 'unknown';
  mode?: 'buy_now'; maxBuyNowUsd?: number; marketValueUsd?: number; minDiscountPercent?: number;
};
export type RadarLot = {
  key: string; url: string; title: string; make: string; model: string; year: number;
  engineCc: number | null; primaryDamage: string; secondaryDamage: string;
  document: string; documentKind: string; active: boolean; vin?: string;
  auctionAt?: string; auctionTimeText?: string;
  buyNowUsd?: number | null;
};
export function auctionTime(html: string, lotUrl?: string) {
  const toIso = (s: unknown) => {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(s) || !Number.isFinite(Date.parse(s))) return undefined;
    return new Date(s).toISOString();
  };
  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (v: unknown): string | undefined => {
        if (Array.isArray(v)) return v.map(walk).find(Boolean);
        if (!v || typeof v !== 'object') return undefined;
        const o = v as Record<string, unknown>;
        if (/Event/i.test(String(o['@type'] || ''))) {
          const eventUrl = typeof o.url === 'string' ? o.url : typeof o['@id'] === 'string' ? o['@id'] : '';
          if (lotUrl && safeLotUrl(eventUrl) !== safeLotUrl(lotUrl)) return undefined;
          return toIso(o.startDate);
        }
        return o['@graph'] ? walk(o['@graph']) : undefined;
      };
      const date = walk(JSON.parse(script[1])); if (date) return { auctionAt: date };
    } catch { /* malformed structured metadata is not a date */ }
  }
  const exact = html.match(/(?:data-auction-date|data-sale-date)=["']([^"']+)["']/i)?.[1];
  const at = toIso(exact); if (at) return { auctionAt: at };
  const text = textFromHtml(html);
  const raw = text.match(/(?:Live auction|Sale date|Auction date)\s*:?\s*(.{0,120}?)(?=\s+(?:Time left|Lot|Location|Seller|Bid Now|Sales History|Engine|Primary damage)|$)/i)?.[1]?.trim();
  return { auctionTimeText: raw?.slice(0, 120) };
}
export function auctionLabel(lot: Pick<RadarLot, 'auctionAt' | 'auctionTimeText'>) {
  if (lot.auctionAt && Number.isFinite(Date.parse(lot.auctionAt))) return `${new Intl.DateTimeFormat('az-AZ', { timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(lot.auctionAt))} (Bakı vaxtı)`;
  return lot.auctionTimeText ? `${lot.auctionTimeText} (mənbə vaxtı; saat qurşağı təsdiqlənməyib)` : 'Gün və saat hələ açıqlanmayıb';
}
export function radarMessage(name: string, lot: RadarLot, filters?: RadarFilters) {
  if (filters?.mode === 'buy_now') return dealMessage(name, lot, filters);
  const tags = damageTags(`${lot.primaryDamage} ${lot.secondaryDamage}`);
  const az: Record<string, string> = { right: 'sağ', left: 'sol', front: 'ön', rear: 'arxa', side: 'yan', water: 'su/sel', fire: 'yanğın', rollover: 'aşma', hail: 'dolu', minor: 'kiçik əzik/cızıq', none: 'normal aşınma' };
  const damage = tags.map(t => az[t]).join(', ');
  return ['Auto Nex · BidCars hərrac bildirişi', name, lot.title,
    damage ? `${damage} zədəsi olan avtomobil hərraca çıxır.` : 'Seçiminizə uyğun avtomobil hərraca çıxır.',
    `Hərrac: ${auctionLabel(lot)}`, `Mühərrik: ${lot.engineCc ? `${lot.engineCc} cm³` : 'naməlum'}`,
    `Zədə: ${lot.primaryDamage || 'naməlum'} / ${lot.secondaryDamage || '—'}`, `Sənəd: ${lot.document || 'naməlum'}`, lot.url,
    'Hərrac vaxtı dəyişə bilər. Alışdan əvvəl elanı və sənədi yenidən yoxlayın.'].join('\n');
}
const usd = (value: number) => `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}`;
export function dealDetails(filters: RadarFilters, lot: RadarLot) {
  const price = lot.buyNowUsd;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return 'Buy Now: təsdiqlənməyib';
  const lines = [`Buy Now: ${usd(price)}`];
  if (filters.maxBuyNowUsd != null) lines.push(`Adminin maksimum alış həddi: ${usd(filters.maxBuyNowUsd)}`);
  if (filters.marketValueUsd != null && filters.minDiscountPercent != null && filters.marketValueUsd > 0) {
    const saving = filters.marketValueUsd - price;
    lines.push(`Adminin daxil etdiyi bazar istinadı: ${usd(filters.marketValueUsd)} (avtomatik qiymətləndirmə deyil)`, `Tələb olunan minimum fərq: ${filters.minDiscountPercent}%`, `İstinaddan fərq: ${usd(saving)} (${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(saving / filters.marketValueUsd * 100)}%)`);
  }
  return lines.join('\n');
}
export function dealMessage(name: string, lot: RadarLot, filters: RadarFilters) {
  return ['Auto Nex · Uyğun Buy Now təklifi', name, lot.title, dealDetails(filters, lot), `Hərrac: ${auctionLabel(lot)}`, `Zədə: ${lot.primaryDamage || 'naməlum'} / ${lot.secondaryDamage || '—'}`, `Sənəd: ${lot.document || 'naməlum'}`, lot.url, 'Məbləğ yalnız Buy Now qiymətidir; hərrac rüsumu, çatdırılma, gömrük və təmir daxil deyil. Qiymət və mövcudluğu alışdan əvvəl yoxlayın.'].join('\n');
}
export function safeLotUrl(value: string) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && ['bid.cars', 'www.bid.cars'].includes(u.hostname) && /^\/(?:en\/)?lot\/[01]-\d+(?:\/[^/?#]+)?\/?$/.test(u.pathname) ? `https://bid.cars${u.pathname}` : null; } catch { return null; }
}
export function searchUrl(f: RadarFilters) {
  const u = new URL('https://bid.cars/en/search/results');
  // These are public filter-page parameters, not an undocumented data API.
  for (const [k, v] of Object.entries({ 'search-type': 'filters', status: f.mode === 'buy_now' ? 'Fast-buy' : 'All', type: 'Automobile', make: f.make, model: f.model, 'year-from': f.yearFrom, 'year-to': f.yearTo, 'auction-type': 'All' })) u.searchParams.set(k, String(v));
  return u.href;
}
export function documentKind(raw: string) {
  const value = raw.toLowerCase();
  if (/non.?repair|parts.?only|junk|scrap|certificate of destruction|bill of sale|no title|not (?:for )?export|export.*(?:prohibit|restrict)|salvage retention/.test(value)) return 'restricted';
  if (/salvage|rebuilt|rebuildable/.test(value)) return 'salvage';
  if (/\bclean\b|clear title|original title/.test(value)) return 'clean';
  return 'unknown';
}
export function damageTags(raw: string) {
  const s = raw.toLowerCase(); const tags: string[] = [];
  if (/front/.test(s)) tags.push('front'); if (/rear|back end/.test(s)) tags.push('rear');
  if (/left|driver.?s? side/.test(s)) tags.push('left'); if (/right|passenger.?s? side/.test(s)) tags.push('right');
  if (/side/.test(s) && !/left|right|driver|passenger/.test(s)) tags.push('side');
  if (/flood|water/.test(s)) tags.push('water'); if (/fire|burn/.test(s)) tags.push('fire');
  if (/rollover/.test(s)) tags.push('rollover'); if (/hail/.test(s)) tags.push('hail');
  if (/minor dent|scratch/.test(s)) tags.push('minor'); if (/normal wear|no damage/.test(s)) tags.push('none');
  return tags;
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export function modelMatches(make: string, wanted: string, actual: string) {
  const w = norm(wanted), a = norm(actual);
  if (w === a) return true;
  const familyMatch = (candidate: string) => {
    if (w === norm(candidate)) return true;
    if (norm(make) === 'bmw' && /^[1-8]series$/.test(w)) return new RegExp(`^${w[0]}[0-9]{2}(?:i|d|e|xi|xd|li|ld|xdrive)?$`).test(norm(candidate));
    if (norm(make) === 'mercedesbenz' && /^[ces]class$/.test(w)) return new RegExp(`^${w[0]}[0-9]{2,3}(?:d|e|cdi|cgi|amg|4matic)?$`).test(norm(candidate));
    if (norm(make) === 'lexus' && /^(es|is|rx|nx|gs|ls|gx|lx)$/.test(w)) return new RegExp(`^${w}[0-9]{3}(?:h|hplus)?$`).test(norm(candidate));
    return false;
  };
  if (familyMatch(actual)) return true;
  // Only known trim/drivetrain words may be removed. A generic prefix check
  // would incorrectly match Camry Solara, Grand Cherokee and other models.
  const trims = new Set(['le', 'se', 'xle', 'xse', 'sle', 'slt', 'sv', 'sr', 's', 'lx', 'ex', 'exl', 'lxs', 'ls', 'lt', 'ltz', 'xl', 'xlt', 'st', 'sel', 'sl', 'limited', 'platinum', 'premium', 'sport', 'touring', 'base', 'hybrid', 'awd', 'fwd', 'rwd', '4wd', '4x4', '4matic', 'xdrive', 'sdrive', 'competition', 'luxury', 'plus', 'ultimate', 'preferred']);
  const words = actual.trim().split(/\s+/);
  while (words.length > 1 && trims.has(norm(words[words.length - 1]))) {
    words.pop(); if (familyMatch(words.join(' '))) return true;
  }
  return false;
}
export function dealMatches(filters: RadarFilters, lot: RadarLot) {
  if (!matches(filters, lot) || filters.mode !== 'buy_now' || typeof lot.buyNowUsd !== 'number' || !Number.isFinite(lot.buyNowUsd) || lot.buyNowUsd <= 0 || lot.buyNowUsd > 10000000) return false;
  const hasMax = filters.maxBuyNowUsd != null;
  const hasReference = filters.marketValueUsd != null;
  const hasDiscount = filters.minDiscountPercent != null;
  // Fail closed for malformed rules even if a caller bypasses DTO validation.
  if (!hasMax && !hasReference || hasReference !== hasDiscount) return false;
  if (hasMax && (!Number.isFinite(filters.maxBuyNowUsd) || filters.maxBuyNowUsd! <= 0 || lot.buyNowUsd > filters.maxBuyNowUsd!)) return false;
  if (hasReference && (!Number.isFinite(filters.marketValueUsd) || filters.marketValueUsd! <= 0 || !Number.isFinite(filters.minDiscountPercent) || filters.minDiscountPercent! < 0 || filters.minDiscountPercent! >= 100 || lot.buyNowUsd * 100 > filters.marketValueUsd! * (100 - filters.minDiscountPercent!))) return false;
  return true;
}
export function matches(f: RadarFilters, lot: RadarLot) {
  return lot.active && norm(lot.make) === norm(f.make) && modelMatches(f.make, f.model, lot.model)
    && lot.year >= f.yearFrom && lot.year <= f.yearTo
    && (!f.engineMin || (lot.engineCc != null && lot.engineCc >= f.engineMin))
    && (!f.engineMax || (lot.engineCc != null && lot.engineCc <= f.engineMax))
    && (!f.damages.length || damageTags(`${lot.primaryDamage} ${lot.secondaryDamage}`).some(d => f.damages.includes(d)))
    && (f.document === 'any' || lot.documentKind === f.document);
}
export function textFromHtml(html: string) {
  return html.replace(/<(script|style|noscript|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
}
export function blocked(html: string) { return /<title[^>]*>\s*(?:Just a moment|Access denied)|cf-chl-|challenge-platform|verify you are human|captcha/i.test(html); }
function currentLotText(html: string) {
  // History and recommendation cards contain prices for different lots/sales.
  // Only inspect the current vehicle's section, before any of those sections.
  // A jump link near the vehicle title is not the actual history section.
  // Remove only an anchor pointing at a history fragment with an exact history
  // label (and optional count). Unlinked labels and actual section headings stay.
  const source = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (anchor, attributes: string, content: string, index: number) => {
    const hrefAttribute = attributes.match(/(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    const href = hrefAttribute?.[1] ?? hrefAttribute?.[2] ?? hrefAttribute?.[3];
    const label = textFromHtml(content);
    const before = html.slice(0, index);
    const headingOpen = [...before.matchAll(/<\/?h[1-6]\b[^>]*>/gi)].pop()?.[0];
    if (headingOpen && !/^<\//.test(headingOpen)) return anchor;
    return href && /^#(?:sales?[-_]?history|auction[-_]?history|history)$/i.test(href) && /^(?:Sales? history|Auction history)(?:\s*\(?\d+\)?)?$/i.test(label) ? ' ' : anchor;
  });
  const marker = /(?:^|[-_\s])(?:auction[-_ ]?history|sales?[-_ ]?history|history[-_ ]?(?:list|table|section)|recommend(?:ed|ation|ations)?(?:[-_ ]?(?:lots?|vehicles?|cars?|offers?))?|similar(?:[-_ ]?(?:archival[-_ ]?)?(?:lots?|vehicles?|cars?|offers?))?|related(?:[-_ ]?(?:lots?|vehicles?|cars?|offers?))?)(?=[-_\s]|$)/i;
  let otherSection = -1;
  for (const tag of source.matchAll(/<(?:section|div|table|aside|article|ul|ol|h[1-6])\b([^>]*)>/gi)) {
    const attributes = [...tag[1].matchAll(/(?:^|\s)(?:id|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)].map(attribute => attribute[1] ?? attribute[2] ?? attribute[3]);
    if (attributes.some(value => marker.test(value))) { otherSection = tag.index!; break; }
  }
  return textFromHtml(otherSection < 0 ? source : source.slice(0, otherSection)).split(/\b(?:Auction history|Sales? history|Recommended (?:lots|vehicles|cars|offers)|Similar (?:archival )?(?:lots|vehicles|cars|offers)|Related (?:lots|vehicles|cars|offers)|You may also like|Other auctions)\b/i)[0];
}
export function buyNowPrice(html: string): number | null {
  const text = currentLotText(html);
  const amounts: number[] = [];
  const number = '(?:[1-9]\\d{0,2}(?:,\\d{3})+|[1-9]\\d{0,2}(?: \\d{3})+|[1-9]\\d*|0)(?:\\.\\d{2})?';
  const price = new RegExp(`^(?:\\$\\s*(${number})(?:\\s*USD)?|USD\\s*\\$?\\s*(${number})|(${number})\\s*USD)(?![\\d.,])`, 'i');
  for (const hit of text.matchAll(/\bBuy\s*Now\b\s*:?\s*(?:Buy\s*Now\s*:?\s*)?/gi)) {
    const tail = text.slice(hit.index! + hit[0].length, hit.index! + hit[0].length + 100);
    const match = tail.match(price); if (!match) continue;
    const rest = tail.slice(match[0].length);
    if (/^\s*(?:EUR|CAD|AUD|GBP|€|£|\d|\$|[-–—]\s*(?:\$|USD|\d)|to\s*(?:\$|USD|\d))/i.test(rest)) continue;
    const value = Number((match[1] || match[2] || match[3]).replace(/[, ]/g, ''));
    if (Number.isFinite(value) && value > 0 && value <= 10000000) amounts.push(value);
  }
  const distinct = [...new Set(amounts)];
  return distinct.length === 1 ? distinct[0] : null;
}
const labels = ['Primary damage', 'Secondary damage', 'Sale Document', 'Sale doc', 'Odometer', 'Start code', 'Seller', 'Loss', 'Engine', 'Transmission', 'Fuel Type', 'Drive Type', 'Show sale document', 'Show more', 'Body Style', 'Key Present', 'ACV'];
export function parseLot(html: string, url: string): RadarLot {
  const safe = safeLotUrl(url); if (!safe || blocked(html)) throw new Error('BidCars yoxlama səhifəsi göstərir. Brauzerdə açıb yoxlayın.');
  const headings = [...html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)].map(m => textFromHtml(m[1]));
  const heading = headings.find(h => /^(?:19|20)\d{2}\s+/.test(h)) || textFromHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').split('|')[0].trim();
  const text = textFromHtml(html);
  const info = heading.match(/\b((?:19|20)\d{2})\s+(.+)/); if (!info) throw new Error('Lotun avtomobil başlığı oxunmadı.');
  const rest = info[2].split(/[,|]/)[0].trim();
  const make = ['Land Rover', 'Alfa Romeo', 'Aston Martin', 'Mercedes-Benz', 'Mercedes Benz', 'Rolls-Royce'].find(m => rest.toLowerCase().startsWith(m.toLowerCase() + ' ')) || rest.split(' ')[0];
  const model = rest.slice(make.length).trim();
  const field = (label: string) => {
    const re = new RegExp(`\\b${label}\\s*:?\\s*(.*?)(?=\\s+(?:${labels.filter(l => l !== label).join('|')})\\s*:?|$)`, 'ig');
    const values = [...text.matchAll(re)].map(m => m[1].trim()).filter(v => v && v.length < 150);
    return values.sort((a, b) => a.length - b.length)[0] || '';
  };
  const engine = field('Engine');
  const liters = engine.match(/(\d+(?:[.,]\d+)?)\s*L(?=\s|\d|[IVHW/,-]|$)/i);
  const cc = engine.match(/\b(\d{3,5})\s*(?:cc|cm³|cm3)/i);
  const doc = field('Sale Document') || field('Sale doc');
  const key = safe.match(/\/lot\/([01]-\d+)/)![1];
  return { key, url: safe, title: heading.slice(0, 200), year: Number(info[1]), make, model,
    ...auctionTime(html, safe),
    buyNowUsd: buyNowPrice(html),
    engineCc: liters ? Math.round(Number(liters[1].replace(',', '.')) * 1000) : cc ? Number(cc[1]) : null,
    primaryDamage: field('Primary damage'), secondaryDamage: field('Secondary damage'), document: doc, documentKind: documentKind(doc),
    active: !/\b(?:Archived auction|Auction ended|Sold by Buy Now)\b/i.test(text.slice(0, text.indexOf('Auction history') > 0 ? text.indexOf('Auction history') : undefined)),
    vin: `${heading} ${text}`.match(/\b[A-HJ-NPR-Z0-9]{17}\b/)?.[0],
  };
}
export function listingLinks(html: string) {
  if (blocked(html)) throw new Error('BidCars Cloudflare yoxlaması tələb edir. Brauzer rejimini istifadə edin.');
  const links = [...html.matchAll(/href\s*=\s*["']([^"']*\/lot\/[^"']+)["']/gi)]
    .map(m => { try { return safeLotUrl(new URL(m[1].replace(/&amp;/g, '&'), 'https://bid.cars').href); } catch { return null; } }).filter((x): x is string => !!x);
  return [...new Map(links.map(u => [u.match(/\/lot\/([01]-\d+)/)![1], u])).values()].slice(0, 60);
}
