"use strict";
const assert = require("node:assert/strict");
const p = require("./parser.js");

const card = p.parseRecordSnapshot({
  title: "2021 Hyundai Sonata, SEL",
  text: "2021 Hyundai Sonata, SEL · 5NPEL4JA7MH088050 · 1-62344946 Copart Mileage: 157k miles (253k km) Location: Jacksonville (FL) Damage: Rear Status: No information Sat 10 October, 2026 Final bid: $4,250 Archived Auction",
  imageAlts: "Automatic transmission Gasoline FWD 2.5L 4 cyl.",
  engineLabel: "2.5L, 4 cyl.", fuel: "Gasoline", color: "White", url: "https://bid.cars/en/lot/1-62344946/x"
});
assert.equal(card.finalBidUsd, 4250);
assert.equal(card.trim, "SEL");
assert.equal(card.engineCc, 2500);
assert.equal(card.fuel, "Gasoline");
assert.equal(card.mileageMi, 157000);
assert.equal(card.mileageKm, 253000);
assert.equal(card.auction, "COPART");

const hybrid = p.parseRecordSnapshot({ title: "2023 Hyundai Sonata, Limited", text: "Final bid: $9,600 Archived Auction IAAI Mileage: 25k miles (40k km)", imageAlts: "Hybrid", engineLabel: "1.6L 4 cyl.", url: "x" });
assert.equal(hybrid.fuel, "Hybrid");
assert.equal(hybrid.auction, "IAAI");

const rows = [3000, 4000, 5000, 6000, 50000].map((finalBidUsd, index) => ({ ...card, key: String(index), finalBidUsd }));
const stat = p.statistics(rows);
assert.equal(stat.median, 5000);
assert.equal(stat.average, 4500);
assert.equal(p.chooseCohort(rows, card).rows.length, 5);

const highMileage = { ...card, key: "high-mileage", mileageMi: 620758, mileageKm: 999000, finalBidUsd: 500 };
assert.equal(p.acceptableMileage(highMileage), false);
assert.equal(p.acceptableMileage({ ...card, mileageMi: 186411, mileageKm: 300000 }), true);
assert.equal(p.statistics([...rows, highMileage]).count, 5);
assert.equal(p.chooseCohort([...rows, highMileage], card).rows.length, 5);
console.log("Auto Nex Market parser tests passed");
