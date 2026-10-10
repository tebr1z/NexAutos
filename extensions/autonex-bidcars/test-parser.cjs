"use strict";

const assert = require("node:assert/strict");
const parser = require("./parser.js");

const lot = parser.parseSnapshot({
  title: "2022 HYUNDAI SONATA, SEL PLUS 5NPEJ4J29NH148698 IAAI",
  text: `
    Current Bid $2,200 USD Your max bid --- Time left 0 d 0 h 36 min 35 sec $5,000 Bid Now
    Final Price Calculator Lot Price $5,000 Auction Fees $925 Trucking to port $270
    Location: Savannah (GA) Shipping from: Savannah (GA) Estimated cost: $4,160 - $7,420
    Body Style Sedan Exterior color Blue Engine 1.6L, 4 cyl. Transmission Automatic
    Fuel Type Gasoline Drive Type Front wheel drive
  `,
  exactTokens: ["IAAI"],
  bidCandidates: [{ value: "$5,000", score: 20, kind: "bidNow" }, { value: "$2,200", score: 2 }],
});

assert.equal(lot.priceUsd, 5000);
assert.equal(lot.bidNowUsd, 5000);
assert.equal(lot.currentBidUsd, 2200);
assert.equal(lot.lotPriceUsd, 5000);
assert.equal(lot.auctionFeeUsd, 925);
assert.equal(lot.auction, "IAAI");
assert.equal(lot.location, "Savannah (GA)");
assert.equal(lot.state, "GA");
assert.equal(lot.year, 2022);
assert.equal(lot.engineCc, 1600);
assert.equal(lot.fuel, "Gasoline");
assert.equal(lot.fuelCode, "1");
assert.equal(parser.fuelCode("Diesel"), "2");
assert.equal(parser.fuelCode("Electric"), "12");

const visibleSpecsWinOverHiddenMenu = parser.parseSnapshot({
  title: "2021 KIA K5, GT LINE",
  text: `
    Search & Bid Engine size, type, horsepower Type Electric Hybrid Gasoline Diesel
    Location: Freetown (MA) Shipping from: Newark (NJ)
    Exterior color Gray Engine 2.0L Transmission Automatic Fuel Type Hybrid
  `,
  auctionHint: "Copart",
  engineLabel: "1.6L, 4 cyl.",
  fuel: "Gasoline",
});
assert.equal(visibleSpecsWinOverHiddenMenu.engineCc, 1600);
assert.equal(visibleSpecsWinOverHiddenMenu.engineLabel, "1.6L, 4 cyl.");
assert.equal(visibleSpecsWinOverHiddenMenu.fuel, "Gasoline");
assert.equal(visibleSpecsWinOverHiddenMenu.fuelCode, "1");

const dieselSpecs = parser.parseSnapshot({
  title: "2020 TEST CAR",
  text: "Location: Dallas (TX)",
  engineLabel: "2.2L, 4 cyl.",
  fuel: "Diesel",
});
assert.equal(dieselSpecs.engineCc, 2200);
assert.equal(dieselSpecs.fuelCode, "2");

const electricSpecs = parser.parseSnapshot({
  title: "2024 TEST EV",
  text: "Location: Dallas (TX)",
  engineLabel: "Electric",
  fuel: "Electric",
});
assert.equal(electricSpecs.engineCc, null);
assert.equal(electricSpecs.fuelCode, "12");

const liveBid = parser.parseSnapshot({
  title: "2022 HYUNDAI SONATA IAAI",
  text: `
    Time left Live auction in progress $2,700 Bid Now
    Final Price Estimator Lot Price $2,700 Auction Fees $720 Trucking to port $270
    Location: Savannah (GA) Engine 2.0L Fuel Type Gasoline Drive Type Front wheel drive
  `,
  exactTokens: ["IAAI"],
  bidCandidates: [{ value: "$2,700", score: 20, kind: "bidNow" }],
});

assert.equal(liveBid.bidNowUsd, 2700);
assert.equal(liveBid.lotPriceUsd, 2700);
assert.equal(liveBid.auctionFeeUsd, 720);

const copartFromBody = parser.parseSnapshot({
  title: "2020 Toyota Camry",
  text: "Location: Dallas (TX) Auction Copart Engine 2.5L Fuel Type Gasoline",
  exactTokens: [],
  bidCandidates: [{ value: "$3,100", score: 20, kind: "bidNow" }],
});
assert.equal(copartFromBody.auction, "COPART");

const copartBadgeWins = parser.parseSnapshot({
  title: "2016 HYUNDAI SONATA, LIMITED",
  text: "Copart and IAAI vehicles Location: Freetown (MA)",
  auctionHint: "Copart",
  exactTokens: ["IAAI", "Copart"],
  bidCandidates: [{ value: "$8,400", score: 20, kind: "bidNow" }],
});
assert.equal(copartBadgeWins.auction, "COPART");

const iaaiBadgeWins = parser.parseSnapshot({
  title: "2021 KIA K5",
  text: "Copart and IAAI vehicles Location: Orlando South (FL)",
  auctionHint: "IAAI",
  exactTokens: ["Copart", "IAAI"],
  bidCandidates: [{ value: "$12,500", score: 20, kind: "bidNow" }],
});
assert.equal(iaaiBadgeWins.auction, "IAAI");
assert.deepEqual(
  parser.selectAuctionFee({ priceUsd: 2700, bidCarsFeeUsd: 720, bidNowUsd: 2700, lotPriceUsd: 2700, fallbackFeeUsd: 860 }),
  { amount: 720, source: "BidCars" },
);
assert.deepEqual(
  parser.selectAuctionFee({ priceUsd: 2200, bidCarsFeeUsd: 720, bidNowUsd: 2700, lotPriceUsd: 2700, fallbackFeeUsd: 785 }),
  { amount: 785, source: "Auto Nex fallback" },
);

console.log("BidCars parser tests passed.");
