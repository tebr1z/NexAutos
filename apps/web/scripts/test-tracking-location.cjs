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
    if (name === "./shipment-notices") return load("src/components/tracking/shipment-notices.tsx");
    if (name === "./shipment-map") return { ShipmentMap: ({ lat, lng, label }) => React.createElement("div", { "data-map": true, "data-lat": lat, "data-lng": lng, "aria-label": label }) };
    return require(name);
  };
  new Function("require", "module", "exports", compiled)(localRequire, compiledModule, compiledModule.exports);
  cache.set(relative, compiledModule.exports);
  return compiledModule.exports;
}

const { ShipmentLocation } = load("src/components/tracking/shipment-location.tsx");
const shipment = { trackingCode: "TEST-123", vin: "1TESTVIN1234567890", currentStatus: "PURCHASED", photos: [], documents: [], events: [] };
const render = (extra = {}, props = {}) => renderToStaticMarkup(React.createElement(ShipmentLocation, { shipment: { ...shipment, ...extra }, ...props }));

test("initial location explains missing information without creating a fake map or carrier link", () => {
  const html = render();
  assert.match(html, /id="shipment-location"/);
  assert.match(html, /Xəritə və canlı izləmə/);
  assert.match(html, /Məntəqə hələ təsdiqlənməyib/);
  assert.match(html, /İzləmə linki hələ əlavə edilməyib/);
  assert.doesNotMatch(html, /data-map|href=|Canlı izləməni aç|\bLIVE\b/);
});

test("safe carrier tracking CTA is prominent even before coordinates or a container code exist", () => {
  const html = render({ carrierTrackingUrl: "https://www.carrier.example/track" });
  assert.match(html, /href="https:\/\/www\.carrier\.example\/track"/);
  assert.match(html, /Canlı izləməni aç/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /carrier\.example/);
  assert.match(html, /xarici saytında/);
  assert.doesNotMatch(html, /data-map|Konteyner kodu/);
});

test("unsafe carrier protocols and embedded credentials are never linked", () => {
  for (const carrierTrackingUrl of ["javascript:alert(1)", "data:text/html,bad", "http://carrier.example/", "//carrier.example", "https://user:password@carrier.example/"]) {
    const html = render({ carrierTrackingUrl });
    assert.doesNotMatch(html, /href=|Canlı izləməni aç/);
    assert.match(html, /İzləmə linki hələ əlavə edilməyib/);
  }
});

test("valid reported pin is explicitly distinguished from external tracking and live GPS", () => {
  const html = render({ lat: 41.6, lng: 41.6, currentPort: "Batumi", currentCountry: "Gürcüstan", carrierTrackingUrl: "https://carrier.example/track" });
  assert.match(html, /data-map="true"/);
  assert.match(html, /Batumi, Gürcüstan/);
  assert.match(html, /Son bildirilən məntəqə/);
  assert.match(html, /Canlı GPS deyil/);
  assert.match(html, /Xarici link: daşıyıcının məlumatı/);
  assert.doesNotMatch(html, /\bLIVE\b/);
});

test("manual coordinates take precedence and invalid coordinates never create a map", () => {
  const html = render({ lat: 1, lng: 2, mapLat: 41.6, mapLng: 41.7 });
  assert.match(html, /data-lat="41\.6" data-lng="41\.7"/);
  for (const point of [{ lat: 91, lng: 1 }, { lat: 1, lng: 181 }, { lat: Number.NaN, lng: 1 }, { lat: 1 }, { lat: Number.POSITIVE_INFINITY, lng: 1 }]) {
    assert.doesNotMatch(render(point), /data-map/);
  }
  assert.match(render({ lat: 0, lng: 0 }), /data-map="true"/);
});

test("container can be copied with instructions and untrusted labels remain escaped", () => {
  const html = render({ containerNumber: "TEST1234567", carrierName: "<script>bad</script>", carrierTrackingUrl: "https://carrier.example/track" }, { stageCaption: "Gəmi hərəkətdədir" });
  assert.match(html, /TEST1234567/);
  assert.match(html, /Kodu kopyala/);
  assert.match(html, /Sayt konteyner kodu istəsə/);
  assert.match(html, /Gəmi hərəkətdədir/);
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("location card supports all four public locales", () => {
  for (const [locale, expected] of [["en", "Open live tracking"], ["ru", "Открыть отслеживание"], ["tr", "Canlı takibi aç"]]) {
    const html = render({ carrierTrackingUrl: "https://carrier.example/" }, { locale });
    assert.ok(html.includes(expected));
    assert.doesNotMatch(html, /Canlı izləməni aç/);
  }
});

test("compact card keeps external CTA and container controls outside the collapsed explanations", () => {
  const html = render({ carrierTrackingUrl: "https://carrier.example/", containerNumber: "TEST1234567", lat: 41.6, lng: 41.7 });
  const details = html.indexOf("<details");
  assert.ok(details > html.indexOf('href="https://carrier.example/"'));
  assert.ok(details > html.indexOf("Kodu kopyala"));
  assert.match(html, /<details class=/);
  assert.doesNotMatch(html, /<details[^>]+open=|grid-cols-/);
});
