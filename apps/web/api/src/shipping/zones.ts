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

export function cellKey(state: string, auction: AuctionCode, band: BandId) {
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

/** DGK AutoEngineTypes.code for Bid.cars fuel text. */
export function dgkEngineCode(fuel?: string | null) {
  const value = (fuel ?? "").toLowerCase();
  if (!value || value === "other") return "1";
  if (/plugin|plug-in|phev/.test(value)) return "8";
  if (/electric|ev\b|battery/.test(value)) return "12";
  if (/hybrid/.test(value) && /diesel|dizel/.test(value)) return "7";
  if (/hybrid/.test(value)) return "6";
  if (/diesel|dizel/.test(value)) return "2";
  if (/\bgas\b|lpg|cng|propane/.test(value) && !/gasoline|petrol/.test(value)) return "3";
  return "1";
}
