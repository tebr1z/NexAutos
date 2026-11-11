const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const shipment = (code, extra = {}) => ({ trackingCode: code, vin: 'QA000000000000001', make: 'QA', model: code, customerName: 'QA', auctionHouse: 'OTHER', currentStatus: 'PURCHASED', events: [], photos: [], documents: [], ...extra });
const flatten = tree => tree == null || typeof tree === 'boolean' ? [] : Array.isArray(tree) ? tree.flatMap(flatten) : typeof tree === 'object' ? [tree, ...flatten(tree.props?.children)] : [tree];
const text = tree => flatten(tree).filter(node => typeof node === 'string' || typeof node === 'number').join(' ');

class ApiError extends Error {
  constructor(status, message) { super(message); this.name = 'ApiError'; this.status = status; }
}

function mount(track, local = () => null) {
  let cursor = 0, effects = [], props, tree;
  const slots = [];
  function changed(old, deps) { return !old || !deps || deps.some((value, i) => !Object.is(value, old.deps?.[i])); }
  const hooks = {
    ...React,
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) {
        const slot = slots[i] = { value: typeof initial === 'function' ? initial() : initial };
        slot.setter = next => { slot.value = typeof next === 'function' ? next(slot.value) : next; };
      }
      return [slots[i].value, slots[i].setter];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(fn, deps) { const i = cursor++; if (changed(slots[i], deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = cursor++;
      if (changed(slots[i], deps)) {
        slots[i]?.cleanup?.();
        const slot = slots[i] = { deps };
        effects.push(() => { slot.cleanup = fn(); });
      }
    },
  };
  const location = () => null;
  const cache = new Map();
  function load(file) {
    file = path.resolve(__dirname, '..', file);
    if (cache.has(file)) return cache.get(file);
    const compiledModule = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    const requireLocal = name => {
      if (name === 'react') return hooks;
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => typeof key === 'string' ? 'icon-' + key : undefined });
      if (name === 'next/link') return { __esModule: true, default: 'a' };
      if (name === 'qrcode.react') return { QRCodeSVG: () => null };
      if (name === '@/lib/api') return { api: { track }, ApiError };
      if (name === '@/lib/local-orders') return { getLocalOrder: local, overlayLocal: row => row };
      if (name === '@/lib/carriers') return { findPortCoords: () => null };
      if (name === '@/providers/i18n-provider') return { useI18n: () => ({ locale: 'az', t: load('src/lib/i18n.ts').dictionaries.az }) };
      if (name.endsWith('/shipment-location') || name === './shipment-location') return { ShipmentLocation: location };
      if (name.includes('photo-catalog')) return { PhotoCatalog: () => null };
      if (name.includes('shipment-notices')) return { ...load('src/components/tracking/shipment-notices.tsx'), ShipmentNotices: 'shipment-notices', CarrierDetails: () => null };
      if (name.includes('shipment-review')) return { ShipmentReview: 'shipment-review' };
      if (name.includes('shipping-notice')) return { ShippingNotice: () => null };
      if (name.startsWith('@/lib/')) return load('src/lib/' + name.slice(6) + '.ts');
      if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(file), name + '.ts')));
      return require(name);
    };
    new Function('require', 'module', 'exports', source)(requireLocal, compiledModule, compiledModule.exports);
    cache.set(file, compiledModule.exports);
    return compiledModule.exports;
  }
  const { TrackingDetail } = load('src/components/tracking/tracking-detail.tsx');
  return {
    render(next = props) { props = next; cursor = 0; effects = []; tree = TrackingDetail(props); effects.forEach(fn => fn()); return tree; },
    tree: () => tree,
    current: () => flatten(tree).find(node => node?.type === location)?.props.shipment,
    refresh() { const button = flatten(tree).find(node => node?.type === 'button' && /yenilə/i.test(text(node))); assert.ok(button, 'manual refresh button'); button.props.onClick(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('clear overview exposes current shipment and safe map component after loading', async () => {
  const app = mount(async code => shipment(code));
  app.render({ code: 'QA-A' }); await tick(); app.render();
  assert.equal(app.current().trackingCode, 'QA-A');
  assert.match(text(app.tree()), /nə etməli|Nə etməli|addım|Sizdən/);
  assert.match(text(app.tree()), /Növbəti/);
  app.unmount();
});

test('manual refresh keeps existing shipment visible until the new record arrives', async () => {
  const next = deferred(); let calls = 0;
  const app = mount(code => ++calls === 1 ? Promise.resolve(shipment(code)) : next.promise);
  app.render({ code: 'QA-A' }); await tick(); app.render(); app.refresh(); app.render();
  assert.equal(app.current().trackingCode, 'QA-A');
  next.resolve(shipment('QA-A', { currentStatus: 'SHIP_DEPARTED' })); await tick(); app.render();
  assert.equal(app.current().currentStatus, 'SHIP_DEPARTED');
  assert.equal(calls, 2); app.unmount();
});

test('refresh failure keeps last good data and presents an honest error', async () => {
  let calls = 0;
  const app = mount(code => ++calls === 1 ? Promise.resolve(shipment(code)) : Promise.reject(new Error('offline')));
  app.render({ code: 'QA-A' }); await tick(); app.render(); app.refresh(); app.render(); await tick(); app.render();
  assert.equal(app.current().trackingCode, 'QA-A');
  assert.ok(flatten(app.tree()).some(node => ['status', 'alert'].includes(node?.props?.role)), 'visible failure status');
  app.unmount();
});

test('changing tracking code hides old data and ignores its late response', async () => {
  const first = deferred(), second = deferred();
  const app = mount(code => code === 'QA-A' ? first.promise : second.promise);
  app.render({ code: 'QA-A' }); app.render({ code: 'QA-B' });
  assert.equal(app.current(), undefined);
  second.resolve(shipment('QA-B')); await tick(); app.render();
  first.resolve(shipment('QA-A')); await tick(); app.render();
  assert.equal(app.current().trackingCode, 'QA-B'); app.unmount();
});

test('browser cached fallback is labelled and is not claimed to be a fresh server update', async () => {
  const app = mount(() => Promise.reject(new Error('offline')), code => shipment(code));
  app.render({ code: 'QA-CACHE' }); await tick(); app.render();
  assert.equal(app.current().trackingCode, 'QA-CACHE');
  assert.match(text(app.tree()), /brauzer|yaddaş|saxlanmış|lokal/i);
  app.unmount();
});

test('authoritative API rejections never become a browser cached shipment', async () => {
  for (const status of [400, 401, 403, 404, 409, 429]) {
    let cacheReads = 0;
    const app = mount(() => Promise.reject(new ApiError(status, 'QA lookup rejection')), code => { cacheReads++; return shipment(code); });
    app.render({ code: 'QA-CACHE' }); await tick(); app.render();
    assert.equal(app.current(), undefined, `HTTP ${status} does not display cached data`);
    assert.equal(cacheReads, 0, `HTTP ${status} does not even consult local orders`);
    if (status === 409) assert.match(text(app.tree()), /bir neçə|çox|birdən|dəqiq/i);
    if (status === 429) assert.match(text(app.tree()), /sorğu|cəhd|gözlə|sonra/i);
    app.unmount();
  }
});

test('authoritative rejection on refresh clears a previously loaded shipment instead of masking the conflict', async () => {
  for (const status of [404, 409]) {
    let calls = 0;
    const app = mount(code => ++calls === 1 ? Promise.resolve(shipment(code)) : Promise.reject(new ApiError(status, 'QA authoritative rejection')), code => shipment(code));
    app.render({ code: 'QA-OLD' }); await tick(); app.render();
    assert.equal(app.current().trackingCode, 'QA-OLD');
    app.refresh(); app.render(); await tick(); app.render();
    assert.equal(app.current(), undefined, `HTTP ${status} invalidates the previous good result`);
    assert.doesNotMatch(text(app.tree()), /əvvəlki məlumat|Son yüklənmiş məlumat saxlanılıb/i);
    app.unmount();
  }
});

test('network errors and API service errors may show only the exact canonical cached tracking code', async () => {
  for (const error of [new Error('offline'), new ApiError(502, 'service unavailable')]) {
    for (const cached of [shipment('SOME-OTHER-CODE'), shipment('QA-CACHE', { lookupType: 'lot' })]) {
      const app = mount(() => Promise.reject(error), () => cached);
      app.render({ code: 'QA-CACHE' }); await tick(); app.render();
      assert.equal(app.current(), undefined, 'an unrelated or public-alias cache record is never a fallback');
      app.unmount();
    }
    const app = mount(() => Promise.reject(error), () => shipment('QA-CACHE'));
    app.render({ code: 'QA-CACHE' }); await tick(); app.render();
    assert.equal(app.current().trackingCode, 'QA-CACHE');
    app.unmount();
  }
});

test('a full public VIN query never retrieves a private browser-cached order, even with an equal cache key', async () => {
  const vin = '1HGCM82633A004352';
  const app = mount(() => Promise.reject(new Error('offline')), () => shipment(vin, { customerName: 'PRIVATE CUSTOMER' }));
  app.render({ code: vin }); await tick(); app.render();
  assert.equal(app.current(), undefined);
  assert.doesNotMatch(text(app.tree()), /PRIVATE CUSTOMER/);
  app.unmount();
});

test('VIN and lot results retain their public alias without exposing private payment, document or review sections', async () => {
  for (const [lookupType, code] of [['vin', '1HGCM82633A004352'], ['lot', '00123456']]) {
    const app = mount(async () => shipment(code, {
      lookupType,
      currentStatus: 'DELIVERED',
      customerName: 'PRIVATE CUSTOMER NAME',
      invoiceUrl: 'https://qa.invalid/private-invoice',
      documents: [{ title: 'PRIVATE DOCUMENT', type: 'invoice', url: 'https://qa.invalid/private-document' }],
      insurance: { status: 'PAID', firstName: 'PRIVATE INSURANCE NAME' },
      contract: { status: 'SIGNED', signed: true },
      reviewToken: 'private-review-token',
    }));
    app.render({ code }); await tick(); app.render();
    assert.equal(app.current().trackingCode, code);
    assert.equal(app.current().lookupType, lookupType);
    assert.equal(flatten(app.tree()).some(node => node?.props?.id === 'shipment-payments'), false);
    assert.equal(flatten(app.tree()).some(node => ['shipment-notices', 'shipment-review'].includes(node?.type)), false);
    assert.equal(flatten(app.tree()).some(node => node?.type === 'a' && /^\/insurance\//.test(node.props.href ?? '')), false);
    assert.doesNotMatch(text(app.tree()), /PRIVATE CUSTOMER|PRIVATE DOCUMENT|PRIVATE INSURANCE|private-review-token/);
    assert.match(text(app.tree()), /VIN|Lot/i);
    const qr = flatten(app.tree()).find(node => typeof node?.props?.value === 'string' && node.props.value.includes('/track/'));
    assert.ok(qr, 'public tracking link remains available');
    assert.equal(new URL(qr.props.value).pathname, `/track/${code}`);
    app.unmount();
  }
});

test('safe live link is visible in the first header and unsafe links are never exposed', async () => {
  for (const url of ['https://carrier.example/track', 'javascript:alert(1)', 'https://user:password@carrier.example']) {
    const app = mount(async code => shipment(code, { carrierTrackingUrl: url }));
    app.render({ code: 'QA-LINK' }); await tick(); app.render();
    const header = flatten(app.tree()).find(node => node?.type === 'header');
    const live = flatten(header).find(node => node?.type === 'a' && /Canlı izləməni aç/.test(text(node)));
    if (url === 'https://carrier.example/track') {
      assert.equal(live.props.href, url);
      assert.equal(live.props.target, '_blank');
      assert.match(live.props.rel, /noopener/);
    } else assert.equal(live, undefined);
    app.unmount();
  }
});

test('manual opening date is visible in the main status card, not hidden only in technical details', async () => {
  const app = mount(async code => shipment(code, { currentStatus: 'CONTAINER_OPENING_PENDING', containerOpeningDate: '2026-11-15' }));
  app.render({ code: 'QA-OPENING' }); await tick(); app.render();
  const main = flatten(app.tree()).find(node => node?.props?.id === 'shipment-status');
  assert.match(text(main), /15\s*\.\s*11\s*\.\s*2026/);
  app.unmount();
});
