const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

// Compile only the dependency-free display helpers; the API import is type-only.
const source = fs.readFileSync(path.join(__dirname, "../src/lib/extension-reports.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const helpers = { exports: {} };
new Function("module", "exports", compiled)(helpers, helpers.exports);
const { safeReportUrl, reportDate, filterReports } = helpers.exports;

test("external report links allow only absolute HTTP(S) URLs without credentials", () => {
  assert.equal(safeReportUrl("https://bid.cars/en/lot/1-12345678"), "https://bid.cars/en/lot/1-12345678");
  assert.equal(safeReportUrl("http://nex.autos/lot-radar"), "http://nex.autos/lot-radar");
  for (const value of [undefined, "", "/admin/users", "//evil.test", "javascript:alert(1)", "data:text/html,test", "file:///etc/passwd", "https://user:pass@bid.cars/", "not a URL"]) {
    assert.equal(safeReportUrl(value), null, String(value));
  }
});

const rows = [
  { id: "first", message: "Mühərrik həcmi tapılmır", version: "1.13.6", pageUrl: "https://bid.cars/lot/123", status: "OPEN", user: { name: "İlqar", email: "ilqar@example.com" } },
  { id: "second", message: "Qiymət hesablanmır", version: "1.13.5", status: "RESOLVED", user: { name: "Aysel", email: "aysel@example.com" } },
];

test("filters preserve status and search together, including Azerbaijani case", () => {
  assert.deepEqual(filterReports(rows, "ALL", " İLQAR ").map((row) => row.id), ["first"]);
  assert.deepEqual(filterReports(rows, "RESOLVED", "hesablanmır").map((row) => row.id), ["second"]);
  assert.deepEqual(filterReports(rows, "OPEN", "hesablanmır"), []);
  assert.deepEqual(filterReports(rows, "OPEN", "").map((row) => row.id), ["first"]);
});

test("search includes version, email and source URL and tolerates absent optional fields", () => {
  for (const query of ["1.13.6", "ilqar@example.com", "bid.cars"]) {
    assert.deepEqual(filterReports(rows, "ALL", query).map((row) => row.id), ["first"]);
  }
  assert.deepEqual(filterReports(rows, "ALL", "not found"), []);
  assert.deepEqual(filterReports([], "ALL", ""), []);
});

test("date display uses Bakı time across day boundaries and handles invalid dates", () => {
  const formatted = reportDate("2026-11-06T21:30:00.000Z");
  assert.match(formatted, /07|7/);
  assert.match(formatted, /01:30/);
  assert.doesNotMatch(formatted, /M11/);
  assert.equal(reportDate("invalid"), "Tarix məlum deyil");
});
