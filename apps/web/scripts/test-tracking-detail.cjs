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
      if (name === '@/lib/api') return { api: { track } };
      if (name === '@/lib/local-orders') return { getLocalOrder: local, overlayLocal: row => row };
      if (name === '@/lib/carriers') return { findPortCoords: () => null };
      if (name === '@/providers/i18n-provider') return { useI18n: () => ({ locale: 'az', t: load('src/lib/i18n.ts').dictionaries.az }) };
      if (name.endsWith('/shipment-location') || name === './shipment-location') return { ShipmentLocation: location };
      if (name.includes('photo-catalog')) return { PhotoCatalog: () => null };
      if (name.includes('shipment-notices')) return { ...load('src/components/tracking/shipment-notices.tsx'), ShipmentNotices: () => null, CarrierDetails: () => null };
      if (name.includes('shipment-review')) return { ShipmentReview: () => null };
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
