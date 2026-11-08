const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const cache = new Map();
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const source = fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiledModule = { exports: {} };
  const localRequire = (name) => {
    if (name === "@/lib/constants") return { SITE: { whatsapp: "994000000000" } };
    if (name === "@/lib/api") return { api: {} };
    if (name === "@/lib/photo-categories") return load("src/lib/photo-categories.ts");
    if (name === "@/providers/i18n-provider") return { useI18n: () => ({ locale: "az", t: { track: { photos: "Şəkillər" }, photoCats: { auction: "Hərrac" } } }) };
    return require(name);
  };
  new Function("require", "module", "exports", compiled)(localRequire, compiledModule, compiledModule.exports);
  cache.set(relative, compiledModule.exports);
  return compiledModule.exports;
}

const { ShipmentNotices, CarrierDetails, safeCarrierUrl } = load("src/components/tracking/shipment-notices.tsx");
const { ShipmentReview } = load("src/components/tracking/shipment-review.tsx");
const { PhotoCatalog } = load("src/components/tracking/photo-catalog.tsx");
const shipment = { trackingCode: "TEST-123", vin: "1TESTVIN1234567890", currentStatus: "PURCHASED", photos: [], documents: [], events: [] };
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));

test("carrier links require absolute HTTPS without embedded credentials", () => {
  assert.equal(safeCarrierUrl("https://carrier.example/track?container=ABC123"), "https://carrier.example/track?container=ABC123");
  for (const value of [undefined, null, "", "/track", "//evil.test/", "http://carrier.example", "https://user:password@carrier.example/", "javascript:alert(1)", "data:text/html,<h1>bad</h1>", "invalid"]) {
    assert.equal(safeCarrierUrl(value), undefined, String(value));
  }
});

test("initial tracking has no placeholder container, forced commission or initial percentage", () => {
  assert.equal(render(CarrierDetails, { shipment }), "");
  const html = render(ShipmentNotices, { shipment });
  assert.match(html, /Yol pulu ödənilməyib/);
  assert.match(html, /Sənədlər dəqiqləşdirilir/);
  assert.doesNotMatch(html, /105|30%|toplam komissiya/);
});

test("USA instructions use Signify, never an outstanding POA, even with a legacy conflicting method", () => {
  const html = render(ShipmentNotices, { shipment: { ...shipment, originCountry: "USA", documentMethod: "POWER_OF_ATTORNEY", documentStatus: "COMPLETED" } });
  assert.match(html, /Zəhmət olmasa Signify ilə imzalayın/);
  assert.doesNotMatch(html, /Etibarnamə təqdim edilməyib|Signify imzası tamamlanıb/);
  assert.match(html, /Menecerdən kömək alın/);
});

test("explicit payment percentage, commission and completed documents are displayed", () => {
  const html = render(ShipmentNotices, { shipment: { ...shipment, freightPaymentStatus: "PAID", documentMethod: "SIGNIFY", documentStatus: "COMPLETED", purchasePaymentPercent: 30, commissionUsd: 105 } });
  assert.match(html, /Yol pulu ödənilib/);
  assert.match(html, /Signify imzası tamamlanıb/);
  assert.match(html, /30% ilkin ödənişlə/);
  assert.match(html, /\$105 toplam komissiya/);
  assert.doesNotMatch(html, /Menecerdən kömək alın/);
});

test("carrier card shows optional container, manually entered date and a separate safe external link", () => {
  const html = render(CarrierDetails, { shipment: { ...shipment, containerNumber: "TEST1234567", carrierTrackingUrl: "https://carrier.example/track", containerOpeningDate: "2026-11-12" } });
  assert.match(html, /TEST1234567/);
  assert.match(html, /12\.11\.2026/);
  assert.match(html, /href="https:\/\/carrier.example\/track"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(render(CarrierDetails, { shipment: { ...shipment, containerNumber: "TEST", carrierTrackingUrl: "javascript:alert(1)" } }), /href=/);
});

test("review form is available only after delivery with a scoped review token", () => {
  assert.equal(render(ShipmentReview, { shipment: { ...shipment, reviewToken: "secret" } }), "");
  const html = render(ShipmentReview, { shipment: { ...shipment, currentStatus: "DELIVERED", reviewToken: "secret" } });
  assert.equal((html.match(/type="radio"/g) || []).length, 5);
  assert.match(html, /maxLength="2000"/);
  assert.doesNotMatch(html, /secret/);
  assert.match(render(ShipmentReview, { shipment: { ...shipment, currentStatus: "DELIVERED" } }), /səhifəni yeniləyin/);
});

test("stored review replaces form and escapes the submitted comment", () => {
  const html = render(ShipmentReview, { shipment: { ...shipment, currentStatus: "DELIVERED", review: { rating: 5, comment: "<script>alert(1)</script>", createdAt: "2026-11-08" } } });
  assert.match(html, /5 \/ 5/);
  assert.doesNotMatch(html, /<form|<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("photo gallery preserves full vehicle aspect ratio and exposes new category labels and image counts", () => {
  assert.equal(render(PhotoCatalog, { photos: [] }), "");
  const html = render(PhotoCatalog, { photos: [{ url: "https://img.example/car.jpg", category: "baku_customs", caption: "Avtomobil gömrükdə" }, { url: "https://img.example/rear.jpg", category: "baku_customs" }] });
  assert.match(html, /object-contain/);
  assert.match(html, /Bakı gömrüyü/);
  assert.match(html, /Avtomobil gömrükdə/);
  assert.match(html, /aria-label="Şəkil seçimi"/);
  assert.match(html, /Tam ölçüdə aç/);
});
