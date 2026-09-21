import type { AuctionCode } from "./zones";

type Tier = { max: number; fee: number };

export type TitleKind = "CLEAN" | "SALVAGE";

export type AuctionFeeBreakdown = {
  titleKind: TitleKind;
  buyerUsd: number;
  virtualUsd: number;
  gateUsd: number;
  envUsd: number;
  titleUsd: number;
  totalUsd: number;
};

function tierFee(price: number, tiers: Tier[]) {
  const value = Math.max(0, Number(price) || 0);
  const hit = tiers.find((row) => value <= row.max);
  return hit?.fee ?? 0;
}

/** Copart licensed, secured funds, clean title. */
const COPART_CLEAN_BUYER: Tier[] = [
  { max: 49.99, fee: 25 },
  { max: 99.99, fee: 45 },
  { max: 199.99, fee: 80 },
  { max: 399.99, fee: 120 },
  { max: 499.99, fee: 160 },
  { max: 599.99, fee: 185 },
  { max: 699.99, fee: 210 },
  { max: 799.99, fee: 230 },
  { max: 899.99, fee: 250 },
  { max: 999.99, fee: 275 },
  { max: 1199.99, fee: 325 },
  { max: 1299.99, fee: 350 },
  { max: 1399.99, fee: 365 },
  { max: 1499.99, fee: 380 },
  { max: 1599.99, fee: 390 },
  { max: 1699.99, fee: 410 },
  { max: 1799.99, fee: 420 },
  { max: 1999.99, fee: 440 },
  { max: 2399.99, fee: 470 },
  { max: 2499.99, fee: 480 },
  { max: 2999.99, fee: 500 },
  { max: 3499.99, fee: 600 },
  { max: 3999.99, fee: 675 },
  { max: 4499.99, fee: 710 },
  { max: 5999.99, fee: 750 },
  { max: 7499.99, fee: 800 },
  { max: 7999.99, fee: 815 },
  { max: 9999.99, fee: 840 },
  { max: 14999.99, fee: 850 },
];

/** Copart licensed, secured funds, non-clean / salvage title. */
const COPART_SALVAGE_BUYER: Tier[] = [
  { max: 49.99, fee: 25 },
  { max: 99.99, fee: 45 },
  { max: 199.99, fee: 80 },
  { max: 299.99, fee: 130 },
  { max: 349.99, fee: 137.5 },
  { max: 399.99, fee: 145 },
  { max: 449.99, fee: 175 },
  { max: 499.99, fee: 185 },
  { max: 549.99, fee: 205 },
  { max: 599.99, fee: 210 },
  { max: 699.99, fee: 240 },
  { max: 799.99, fee: 270 },
  { max: 899.99, fee: 295 },
  { max: 999.99, fee: 320 },
  { max: 1199.99, fee: 375 },
  { max: 1299.99, fee: 395 },
  { max: 1399.99, fee: 410 },
  { max: 1499.99, fee: 430 },
  { max: 1599.99, fee: 445 },
  { max: 1699.99, fee: 465 },
  { max: 1799.99, fee: 485 },
  { max: 1999.99, fee: 510 },
  { max: 2399.99, fee: 535 },
  { max: 2499.99, fee: 570 },
  { max: 2999.99, fee: 610 },
  { max: 3499.99, fee: 655 },
  { max: 3999.99, fee: 705 },
  { max: 4499.99, fee: 725 },
  { max: 4999.99, fee: 750 },
  { max: 5499.99, fee: 775 },
  { max: 5999.99, fee: 800 },
  { max: 6499.99, fee: 825 },
  { max: 6999.99, fee: 845 },
  { max: 7499.99, fee: 880 },
  { max: 7999.99, fee: 900 },
  { max: 8499.99, fee: 925 },
  { max: 9999.99, fee: 945 },
  { max: 14999.99, fee: 1000 },
];

const COPART_CLEAN_LIVE: Tier[] = [
  { max: 99.99, fee: 0 },
  { max: 499.99, fee: 49 },
  { max: 999.99, fee: 59 },
  { max: 1499.99, fee: 79 },
  { max: 1999.99, fee: 89 },
  { max: 3999.99, fee: 99 },
  { max: 5999.99, fee: 109 },
  { max: 7999.99, fee: 139 },
  { max: Number.POSITIVE_INFINITY, fee: 149 },
];

const COPART_SALVAGE_LIVE: Tier[] = [
  { max: 99.99, fee: 0 },
  { max: 499.99, fee: 50 },
  { max: 999.99, fee: 65 },
  { max: 1499.99, fee: 85 },
  { max: 1999.99, fee: 95 },
  { max: 3999.99, fee: 110 },
  { max: 5999.99, fee: 125 },
  { max: 7999.99, fee: 145 },
  { max: Number.POSITIVE_INFINITY, fee: 160 },
];

/** IAA standard licensed vehicle buyer fees. */
const IAAI_BUYER: Tier[] = [
  { max: 49.99, fee: 25 },
  { max: 99.99, fee: 45 },
  { max: 199.99, fee: 80 },
  { max: 299.99, fee: 130 },
  { max: 349.99, fee: 137 },
  { max: 399.99, fee: 145 },
  { max: 449.99, fee: 175 },
  { max: 499.99, fee: 185 },
  { max: 549.99, fee: 205 },
  { max: 599.99, fee: 210 },
  { max: 699.99, fee: 240 },
  { max: 799.99, fee: 270 },
  { max: 899.99, fee: 295 },
  { max: 999.99, fee: 320 },
  { max: 1199.99, fee: 375 },
  { max: 1299.99, fee: 395 },
  { max: 1399.99, fee: 410 },
  { max: 1499.99, fee: 430 },
  { max: 1599.99, fee: 445 },
  { max: 1699.99, fee: 465 },
  { max: 1799.99, fee: 485 },
  { max: 1999.99, fee: 510 },
  { max: 2399.99, fee: 535 },
  { max: 2499.99, fee: 570 },
  { max: 2999.99, fee: 610 },
  { max: 3499.99, fee: 655 },
  { max: 3999.99, fee: 705 },
  { max: 4499.99, fee: 725 },
  { max: 4999.99, fee: 750 },
  { max: 5499.99, fee: 775 },
  { max: 5999.99, fee: 800 },
  { max: 6499.99, fee: 825 },
  { max: 6999.99, fee: 845 },
  { max: 7499.99, fee: 880 },
  { max: 7999.99, fee: 900 },
  { max: 8499.99, fee: 925 },
  { max: 9999.99, fee: 945 },
  { max: 14999.99, fee: 1000 },
];

const IAAI_LIVE: Tier[] = COPART_SALVAGE_LIVE;

function copartBuyer(price: number, titleKind: TitleKind) {
  if (titleKind === "CLEAN") {
    if (price >= 15000) return Math.round(price * 0.0725);
    return tierFee(price, COPART_CLEAN_BUYER);
  }
  if (price >= 15000) return Math.round(price * 0.075);
  return tierFee(price, COPART_SALVAGE_BUYER);
}

function iaaiBuyer(price: number) {
  if (price >= 15000) return Math.round(price * 0.075);
  return tierFee(price, IAAI_BUYER);
}

export function normalizeTitleKind(value?: string | null): TitleKind {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "CLEAN" || raw === "CLEAN TITLE") return "CLEAN";
  return "SALVAGE";
}

/**
 * US national Copart / IAAI fees (secured wire, live online bid, licensed).
 * State does not change these tables. Copart changes by clean vs salvage title.
 * Inland freight / storage can still vary by yard.
 */
export function auctionFeeBreakdown(
  priceUsd: number,
  auction: AuctionCode,
  titleKindRaw?: string | null,
): AuctionFeeBreakdown {
  const price = Math.max(0, Number(priceUsd) || 0);
  const titleKind = normalizeTitleKind(titleKindRaw);
  if (auction === "COPART") {
    const buyerUsd = copartBuyer(price, titleKind);
    const virtualUsd = tierFee(price, titleKind === "CLEAN" ? COPART_CLEAN_LIVE : COPART_SALVAGE_LIVE);
    const gateUsd = titleKind === "CLEAN" ? 79 : 95;
    const envUsd = titleKind === "CLEAN" ? 0 : 15;
    const titleUsd = 0;
    return {
      titleKind,
      buyerUsd,
      virtualUsd,
      gateUsd,
      envUsd,
      titleUsd,
      totalUsd: buyerUsd + virtualUsd + gateUsd + envUsd + titleUsd,
    };
  }
  const buyerUsd = iaaiBuyer(price);
  const virtualUsd = tierFee(price, IAAI_LIVE);
  const gateUsd = 105;
  const envUsd = 15;
  const titleUsd = 20;
  return {
    titleKind,
    buyerUsd,
    virtualUsd,
    gateUsd,
    envUsd,
    titleUsd,
    totalUsd: buyerUsd + virtualUsd + gateUsd + envUsd + titleUsd,
  };
}

export function auctionFeeUsd(priceUsd: number, auction: AuctionCode, titleKind?: string | null) {
  return auctionFeeBreakdown(priceUsd, auction, titleKind).totalUsd;
}
