import type { AuctionCode } from "./zones";

type Tier = { max: number; fee: number };

function feeFromTiers(price: number, tiers: Tier[]) {
  const value = Math.max(0, Number(price) || 0);
  const hit = tiers.find((row) => value <= row.max);
  return hit?.fee ?? tiers[tiers.length - 1]?.fee ?? 0;
}

/** Copart US buyer fee (hammer). */
const COPART_BUYER: Tier[] = [
  { max: 49.99, fee: 1 },
  { max: 99.99, fee: 1 },
  { max: 199.99, fee: 25 },
  { max: 299.99, fee: 50 },
  { max: 349.99, fee: 80 },
  { max: 399.99, fee: 90 },
  { max: 449.99, fee: 110 },
  { max: 499.99, fee: 120 },
  { max: 549.99, fee: 130 },
  { max: 599.99, fee: 140 },
  { max: 699.99, fee: 165 },
  { max: 799.99, fee: 195 },
  { max: 899.99, fee: 215 },
  { max: 999.99, fee: 230 },
  { max: 1199.99, fee: 255 },
  { max: 1299.99, fee: 275 },
  { max: 1399.99, fee: 285 },
  { max: 1499.99, fee: 295 },
  { max: 1599.99, fee: 305 },
  { max: 1699.99, fee: 325 },
  { max: 1799.99, fee: 340 },
  { max: 1999.99, fee: 355 },
  { max: 2399.99, fee: 380 },
  { max: 2499.99, fee: 400 },
  { max: 2999.99, fee: 415 },
  { max: 3499.99, fee: 455 },
  { max: 3999.99, fee: 500 },
  { max: 4499.99, fee: 550 },
  { max: 4999.99, fee: 600 },
  { max: 5499.99, fee: 625 },
  { max: 5999.99, fee: 650 },
  { max: 6499.99, fee: 675 },
  { max: 6999.99, fee: 700 },
  { max: 7499.99, fee: 725 },
  { max: 7999.99, fee: 750 },
  { max: 8499.99, fee: 775 },
  { max: 8999.99, fee: 800 },
  { max: 9999.99, fee: 825 },
  { max: 14999.99, fee: 850 },
  { max: 19999.99, fee: 900 },
  { max: 24999.99, fee: 975 },
  { max: 29999.99, fee: 1050 },
  { max: 34999.99, fee: 1150 },
  { max: 39999.99, fee: 1250 },
  { max: 44999.99, fee: 1350 },
  { max: 49999.99, fee: 1450 },
  { max: Number.POSITIVE_INFINITY, fee: 0 },
];

const COPART_VIRTUAL: Tier[] = [
  { max: 99.99, fee: 0 },
  { max: 499.99, fee: 49 },
  { max: 999.99, fee: 59 },
  { max: 1499.99, fee: 79 },
  { max: 1999.99, fee: 89 },
  { max: 3999.99, fee: 99 },
  { max: 5999.99, fee: 109 },
  { max: 7499.99, fee: 129 },
  { max: Number.POSITIVE_INFINITY, fee: 195 },
];

/** IAAI buyer premium (hammer). */
const IAAI_BUYER: Tier[] = [
  { max: 99.99, fee: 25 },
  { max: 199.99, fee: 50 },
  { max: 299.99, fee: 70 },
  { max: 399.99, fee: 90 },
  { max: 499.99, fee: 110 },
  { max: 599.99, fee: 130 },
  { max: 699.99, fee: 145 },
  { max: 799.99, fee: 165 },
  { max: 899.99, fee: 185 },
  { max: 999.99, fee: 205 },
  { max: 1199.99, fee: 230 },
  { max: 1499.99, fee: 265 },
  { max: 1999.99, fee: 310 },
  { max: 2499.99, fee: 355 },
  { max: 2999.99, fee: 395 },
  { max: 3499.99, fee: 435 },
  { max: 3999.99, fee: 475 },
  { max: 4499.99, fee: 515 },
  { max: 4999.99, fee: 555 },
  { max: 5999.99, fee: 600 },
  { max: 6999.99, fee: 650 },
  { max: 7999.99, fee: 700 },
  { max: 8999.99, fee: 750 },
  { max: 9999.99, fee: 800 },
  { max: 14999.99, fee: 850 },
  { max: 19999.99, fee: 925 },
  { max: 24999.99, fee: 1000 },
  { max: 29999.99, fee: 1075 },
  { max: Number.POSITIVE_INFINITY, fee: 0 },
];

const IAAI_INTERNET: Tier[] = [
  { max: 99.99, fee: 0 },
  { max: 499.99, fee: 45 },
  { max: 999.99, fee: 55 },
  { max: 1999.99, fee: 75 },
  { max: 3999.99, fee: 95 },
  { max: 7499.99, fee: 119 },
  { max: Number.POSITIVE_INFINITY, fee: 149 },
];

const GATE = 95;

function highBidFee(price: number, auction: AuctionCode) {
  if (price <= 49999.99) return 0;
  const extra = price * (auction === "COPART" ? 0.04 : 0.035);
  return Math.round(extra);
}

export function auctionFeeUsd(priceUsd: number, auction: AuctionCode) {
  const price = Math.max(0, Number(priceUsd) || 0);
  if (auction === "COPART") {
    const buyer = price > 49999.99 ? highBidFee(price, auction) : feeFromTiers(price, COPART_BUYER);
    return buyer + feeFromTiers(price, COPART_VIRTUAL) + GATE;
  }
  const buyer = price > 49999.99 ? highBidFee(price, auction) : feeFromTiers(price, IAAI_BUYER);
  return buyer + feeFromTiers(price, IAAI_INTERNET) + GATE;
}
