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

const { getTrackingOverview, getTrackingPhases } = load('tracking-overview');
const { TRACKING_STEPS } = load('constants');
const settled = { documentMethod: 'SIGNIFY', documentStatus: 'COMPLETED', freightPaymentStatus: 'PAID' };

test('each recorded status has an accurate phase and explanation in all four languages', () => {
  for (const status of [...TRACKING_STEPS.map(row => row.key), 'CANCELLED']) {
    for (const locale of ['az', 'en', 'ru', 'tr']) {
      const summary = getTrackingOverview({ ...settled, currentStatus: status }, locale);
      assert.ok(summary.phaseLabel, `${status}/${locale}`);
      assert.ok(summary.explanation.length > 20, `${status}/${locale}`);
      assert.ok(summary.nextAction.length > 20, `${status}/${locale}`);
      assert.equal(summary.phaseIndex >= 0, status !== 'CANCELLED');
      assert.equal(summary.phases.length, 8);
      assert.equal(summary.phases.filter(phase => phase.state === 'current').length, status === 'CANCELLED' ? 0 : 1);
    }
  }
  assert.match(getTrackingOverview({ currentStatus: 'PAYMENT_RECEIVED' }).explanation, /şirkətin hesabına/);
  assert.match(getTrackingOverview({ currentStatus: 'CUSTOMS_DOCUMENTS' }).explanation, /artıq Bakıda olması demək deyil/);
  assert.equal(getTrackingOverview({ currentStatus: 'CUSTOMS_DOCUMENTS' }).phaseKey, 'truck');
  assert.equal(getTrackingOverview({ currentStatus: 'TIR_BAKU_CUSTOMS' }).phaseKey, 'customs');
});

test('phases stay ordered across the detailed workflow without claiming GPS distance', () => {
  let previous = -1;
  for (const row of TRACKING_STEPS) {
    const summary = getTrackingOverview({ currentStatus: row.key });
    assert.ok(summary.phaseIndex >= previous, row.key);
    previous = summary.phaseIndex;
    assert.equal(Object.hasOwn(summary, 'progress'), false);
  }
  const delivered = getTrackingPhases({ currentStatus: 'DELIVERED' });
  assert.equal(delivered.filter(phase => phase.state === 'complete').length, 7);
  assert.equal(delivered[7].state, 'current');
});

test('customer action priority is cancellation, collection, documents, then freight', () => {
  const pending = { documentMethod: 'SIGNIFY', documentStatus: 'PENDING', freightPaymentStatus: 'UNPAID' };
  const cancelled = getTrackingOverview({ ...pending, currentStatus: 'CANCELLED' });
  assert.match(cancelled.nextAction, /əlaqə saxlayın/);
  assert.equal(cancelled.actionNeeded, true);
  const collect = getTrackingOverview({ ...pending, currentStatus: 'READY_FOR_DELIVERY' });
  assert.match(collect.nextAction, /Təhvil vaxtını/);
  const sign = getTrackingOverview({ ...pending, currentStatus: 'PURCHASED' });
  assert.match(sign.nextAction, /Signify/);
  const power = getTrackingOverview({ ...pending, currentStatus: 'PURCHASED', documentMethod: 'POWER_OF_ATTORNEY' });
  assert.match(power.nextAction, /Etibarnamə/);
  const legacyUsa = getTrackingOverview({ ...settled, currentStatus: 'PURCHASED', originCountry: 'USA', documentMethod: 'POWER_OF_ATTORNEY' });
  assert.match(legacyUsa.nextAction, /Signify/);
  assert.doesNotMatch(legacyUsa.nextAction, /Etibarnamə/);
  const unpaid = getTrackingOverview({ ...settled, currentStatus: 'PURCHASED', freightPaymentStatus: 'UNPAID' });
  assert.match(unpaid.nextAction, /Yol pulu ödənilməyib/);
  const partial = getTrackingOverview({ ...settled, currentStatus: 'PURCHASED', freightPaymentStatus: 'PARTIAL' });
  assert.match(partial.nextAction, /qismən/);
  assert.equal(partial.actionNeeded, true);
});

test('unset document method is not falsely marked complete or an urgent request', () => {
  const unset = getTrackingOverview({ currentStatus: 'PURCHASED', freightPaymentStatus: 'PAID', documentMethod: 'UNSET' });
  assert.match(unset.nextAction, /meneceriniz dəqiqləşdirəcək/);
  assert.equal(unset.actionNeeded, false);
  const none = getTrackingOverview({ ...settled, currentStatus: 'SHIP_DEPARTED' });
  assert.match(none.nextAction, /əlavə addım tələb olunmur/);
  assert.equal(none.actionNeeded, false);
});

test('handover asks for a review once and does not show stale freight or signature prompts', () => {
  const delivered = { currentStatus: 'DELIVERED', freightPaymentStatus: 'UNPAID', documentMethod: 'SIGNIFY', documentStatus: 'PENDING' };
  assert.match(getTrackingOverview(delivered).nextAction, /qiymətləndirmə/);
  assert.equal(getTrackingOverview(delivered).actionNeeded, true);
  const reviewed = getTrackingOverview({ ...delivered, review: { rating: 5 } });
  assert.match(reviewed.nextAction, /təşəkkür/);
  assert.equal(reviewed.actionNeeded, false);
});

test('selected transit stop is explained as recorded information, not live GPS', () => {
  const row = { ...settled, currentStatus: 'IN_TRANSIT', currentTransitIndex: 1, transitPorts: [{ place: 'Valencia' }, { place: 'Istanbul' }] };
  const summary = getTrackingOverview(row);
  assert.match(summary.explanation, /Istanbul/);
  assert.match(summary.explanation, /canlı GPS mövqeyi deyil/);
  assert.equal(summary.phaseKey, 'sea');
  for (const index of [-1, 99, 0.5]) {
    const fallback = getTrackingOverview({ ...row, currentTransitIndex: index });
    assert.doesNotMatch(fallback.explanation, /Istanbul|Valencia/);
  }
});

test('last update uses latest valid recorded event and reached transit stop, never fetch or future times', () => {
  const now = Date.parse('2026-11-08T12:00:00Z');
  const events = [{ occurredAt: '2026-11-01T10:00:00Z' }, { occurredAt: 'bad' }, { occurredAt: '2026-12-01T10:00:00Z' }];
  const transitPorts = [{ place: 'A', occurredAt: '2026-11-05T10:00:00Z' }, { place: 'B', occurredAt: '2026-11-07T10:00:00Z' }];
  const atFirst = getTrackingOverview({ currentStatus: 'IN_TRANSIT', currentTransitIndex: 0, events, transitPorts }, 'az', now);
  assert.equal(atFirst.lastUpdatedAt, '2026-11-05T10:00:00.000Z');
  const beforeSea = getTrackingOverview({ currentStatus: 'PURCHASED', events, transitPorts }, 'az', now);
  assert.equal(beforeSea.lastUpdatedAt, '2026-11-01T10:00:00.000Z');
  const afterSea = getTrackingOverview({ currentStatus: 'DESTINATION_PORT', events, transitPorts }, 'az', now);
  assert.equal(afterSea.lastUpdatedAt, '2026-11-07T10:00:00.000Z');
  const invalidStop = getTrackingOverview({ currentStatus: 'IN_TRANSIT', currentTransitIndex: 99, events, transitPorts }, 'az', now);
  assert.equal(invalidStop.lastUpdatedAt, '2026-11-01T10:00:00.000Z');
  assert.equal(getTrackingOverview({ currentStatus: 'PURCHASED', events: [{ occurredAt: 'bad' }] }, 'az', now).lastUpdatedAt, undefined);
});

test('unknown and missing data do not masquerade as the purchased stage or require action', () => {
  for (const row of [null, undefined, {}, { currentStatus: 'UNKNOWN' }, { currentStatus: 'toString' }]) {
    const summary = getTrackingOverview(row);
    assert.equal(summary.phaseIndex, -1);
    assert.equal(summary.phaseKey, null);
    assert.equal(summary.actionNeeded, false);
    assert.equal(summary.phases.filter(phase => phase.state === 'current' || phase.state === 'complete').length, 0);
    assert.equal(summary.lastUpdatedAt, undefined);
    assert.match(summary.phaseLabel, /Məlumat gözlənilir/);
  }
});
