export const BANDS = [
  { id: "a", min: 1, max: 3000 },
  { id: "b", min: 3001, max: 7000 },
  { id: "c", min: 7001, max: 15000 },
  { id: "d", min: 15001, max: 1_000_000 },
] as const;

export const AUCTIONS = ["COPART", "IAAI"] as const;

export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

export type AuctionCode = (typeof AUCTIONS)[number];
export type BandId = (typeof BANDS)[number]["id"];
export type StateCode = (typeof US_STATES)[number]["code"];

export function bandForPrice(price: number): (typeof BANDS)[number] {
  const value = Number(price);
  return BANDS.find((band) => value >= band.min && value <= band.max) ?? BANDS[BANDS.length - 1];
}

export function knownState(state?: string | null): StateCode | null {
  if (!state) return null;
  const code = state.trim().toUpperCase();
  return US_STATES.some((row) => row.code === code) ? (code as StateCode) : null;
}

export function yardSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCaseYard(name: string) {
  return name
    .toLowerCase()
    .replace(/\b([a-z])/g, (ch) => ch.toUpperCase())
    .replace(/\b(Ny|Nj|La|Dc)\b/g, (ch) => ch.toUpperCase());
}

/** Copart/IAAI yard from Bid.cars / Copart strings: "CA - SUN VALLEY", "Sun Valley (CA)". */
export function parseYardPlace(raw?: string | null): { yard: string; slug: string; state?: StateCode } | null {
  if (!raw) return null;
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  text = text.replace(/^(copart|iaai|iaa)\s*[-–:]\s*/i, "").trim();

  let state: StateCode | undefined;
  const paren = text.match(/^(.*?)\s*\(([A-Z]{2})\)\s*$/i);
  if (paren) {
    text = paren[1].trim();
    state = knownState(paren[2].toUpperCase()) || undefined;
  }

  const prefixed = text.match(/^([A-Z]{2})\s*[-–:,]\s*(.+)$/i);
  if (prefixed && knownState(prefixed[1].toUpperCase())) {
    state = knownState(prefixed[1].toUpperCase()) || undefined;
    text = prefixed[2].trim();
  } else {
    const spaced = text.match(/^([A-Z]{2})\s+(.+)$/i);
    if (spaced && knownState(spaced[1].toUpperCase()) && spaced[2].trim().length > 2) {
      state = knownState(spaced[1].toUpperCase()) || undefined;
      text = spaced[2].trim();
    }
  }

  const trailing = text.match(/^(.+?)[,\s]+([A-Z]{2})$/i);
  if (trailing && knownState(trailing[2].toUpperCase())) {
    state = knownState(trailing[2].toUpperCase()) || undefined;
    text = trailing[1].trim();
  }

  const slug = yardSlug(text);
  if (!slug || slug.length < 2) return null;
  if (US_STATES.some((row) => yardSlug(row.name) === slug || row.code.toLowerCase() === slug)) return null;
  return { yard: titleCaseYard(text), slug, state };
}

export function cellKey(state: string, auction: AuctionCode, band: BandId, yard?: string) {
  const slug = yard ? yardSlug(yard) : "";
  if (slug) return `${state.toUpperCase()}:${auction}:${slug}:${band}`;
  return `${state.toUpperCase()}:${auction}:${band}`;
}

export function emptyRateCells() {
  const cells: Record<string, number | null> = {};
  for (const state of US_STATES) {
    for (const auction of AUCTIONS) {
      for (const band of BANDS) {
        cells[cellKey(state.code, auction, band.id)] = null;
      }
    }
  }
  return cells;
}

/** DGK AutoEngineTypes.code for Bid.cars / Copart fuel text. */
export function dgkEngineCode(fuel?: string | null) {
  const value = (fuel ?? "").toLowerCase();
  if (!value || value === "other") return "1";
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
