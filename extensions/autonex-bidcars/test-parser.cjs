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

console.log("BidCars parser tests passed.");
