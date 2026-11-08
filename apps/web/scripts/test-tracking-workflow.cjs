const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();

function load(name) {
  const file = path.resolve(__dirname, '../src/lib', `${name}.ts`);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const resolve = spec => load(spec.replace('@/lib/', '').replace('./', ''));
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { process })(resolve, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}

test('detailed workflow preserves every legacy status and includes requested stages in order', () => {
  const { TRACKING_STEPS } = load('constants');
  const keys = TRACKING_STEPS.map(s => s.key);
  const wanted = ['PURCHASED', 'PAYMENT_RECEIVED', 'AUCTION_RELEASED', 'EXPORT_DOCUMENTS', 'EXPORT_READY', 'PICKED_UP', 'TO_ORIGIN_PORT', 'CONTAINER_LOADING', 'LOADED_CONTAINER', 'VESSEL_WAITING', 'VESSEL_LOADED', 'SHIP_DEPARTED', 'IN_TRANSIT', 'ISTANBUL_TO_POTI', 'DESTINATION_APPROACHING', 'DESTINATION_PORT', 'CONTAINER_DISCHARGED', 'CONTAINER_OPENING_PENDING', 'CONTAINER_OPENED', 'TIR_LOADING_PENDING', 'TIR_LOADED', 'CUSTOMS_DOCUMENTS', 'CUSTOMS_DOCUMENTS_READY', 'TIR_DEPARTED', 'TIR_BAKU_CUSTOMS', 'READY_FOR_DELIVERY', 'DELIVERED'];
  for (let i = 0; i < wanted.length; i++) {
    assert.ok(keys.includes(wanted[i]), wanted[i]);
    if (i) assert.ok(keys.indexOf(wanted[i - 1]) < keys.indexOf(wanted[i]));
  }
  assert.equal(new Set(keys).size, keys.length);
  for (const old of ['AUCTION_PAID', 'ARRIVED_PORT', 'TIR_GEORGIA_BORDER', 'CUSTOMS_CLEARANCE']) assert.ok(keys.includes(old));
  for (const step of TRACKING_STEPS) for (const locale of ['az', 'en', 'ru', 'tr']) assert.ok(step[locale]);
  const prisma = fs.readFileSync(path.resolve(__dirname, '../api/prisma/schema.prisma'), 'utf8');
  const enumBody = prisma.match(/enum ShipmentStatus\s*\{([^}]+)\}/)[1];
  for (const key of keys) assert.match(enumBody, new RegExp(`\\b${key}\\b`));
});

test('manual transit stops remain after vessel underway and before destination stages', () => {
  const { buildJourney, journeyPosition } = load('journey');
  const stops = [{ place: 'Istanbul', occurredAt: '2026-11-08T12:00:00Z' }, { place: 'Poti' }];
  const items = buildJourney(stops, 'az', 'Poti');
  const first = items.findIndex(i => i.id === 'transit:0');
  assert.ok(first > items.findIndex(i => i.key === 'IN_TRANSIT'));
  assert.ok(first < items.findIndex(i => i.key === 'ISTANBUL_TO_POTI'));
  const atStop = journeyPosition('IN_TRANSIT', stops, 1);
  assert.equal(atStop.items[atStop.cursor].id, 'transit:1');
  assert.equal(journeyPosition('DELIVERED', stops).progress, 100);
  assert.equal(journeyPosition('CANCELLED', stops).progress, 0);
});

test('photo categories preserve old photos and add each requested delivery album', () => {
  const { PHOTO_CATEGORIES, photosFromList, flattenPhotos } = load('photo-categories');
  for (const key of ['auction', 'terminal', 'container_loading', 'poti_terminal', 'truck_loading', 'baku_customs', 'depot', 'loading']) assert.ok(PHOTO_CATEGORIES.includes(key));
  const rows = [{ url: 'https://example.com/a.jpg', category: 'loading' }, { url: 'https://example.com/b.jpg', category: 'baku_customs' }];
  assert.equal(flattenPhotos(photosFromList(rows)).length, 2);
  assert.equal(photosFromList(rows).loading[0], rows[0].url);
});

test('server-cleared logistics/photos and new statuses cannot be masked by stale browser cache', () => {
  const { mergeRemotePreserveLocal, overlayLocal } = load('local-orders');
  const local = { trackingCode: 'QA', currentStatus: 'PURCHASED', photos: [{ url: 'old' }], events: [{ title: 'old' }], transitPorts: [{ place: 'old' }], carrierTrackingUrl: 'https://old.example', purchasePaymentPercent: 30 };
  const remote = { trackingCode: 'QA', currentStatus: 'DELIVERED', photos: [], events: [], transitPorts: [], currentTransitIndex: -1, carrierTrackingUrl: '', purchasePaymentPercent: null, review: { rating: 5 } };
  const merged = mergeRemotePreserveLocal(local, remote);
  assert.equal(merged.currentStatus, 'DELIVERED');
  assert.equal(merged.photos.length, 0);
  assert.equal(merged.transitPorts.length, 0);
  assert.equal(merged.carrierTrackingUrl, '');
  assert.equal(merged.purchasePaymentPercent, null);
  assert.equal(overlayLocal(remote, 'QA').review.rating, 5);
  const cleared = mergeRemotePreserveLocal(local, { ...remote, purchasePaymentPercent: undefined });
  assert.equal(cleared.purchasePaymentPercent, undefined);
});
