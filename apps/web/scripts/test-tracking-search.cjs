const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const sourceRoot = path.resolve(__dirname, '../src');
const read = relative => fs.readFileSync(path.join(sourceRoot, relative), 'utf8');
const nodes = tree => tree == null || typeof tree === 'boolean' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [tree];

function compile(relative, resolve = name => { throw new Error(`Unexpected import: ${name}`); }, globals = {}) {
  const compiledModule = { exports: {} };
  const compiled = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { process, URL, AbortSignal, ...globals })(resolve, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const query = compile('lib/tracking-query.ts');
const { dictionaries } = compile('lib/i18n.ts');

function mount(relative) {
  let cursor = 0;
  const slots = [];
  const paths = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      const slot = slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slot.value, next => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useEffect() { cursor++; },
  };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const loaded = compile(relative, name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => `icon-${String(key)}` });
    if (name === 'next/link') return { __esModule: true, default: 'a' };
    if (name === 'next/navigation') return { useRouter: () => ({ push: value => paths.push(value) }) };
    if (name === '@/lib/tracking-query') return query;
    if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
    if (name === '@/providers/i18n-provider') return { useI18n: () => ({ locale: 'az', t: dictionaries.az }) };
    if (name === '@/providers/theme-provider') return { useTheme: () => ({ resolvedTheme: 'light', setTheme() {} }) };
    if (name === '@/providers/auth-provider') return { useAuth: () => ({ user: null }) };
    if (name === '@/components/brand/logo') return { Logo: 'site-logo' };
    if (name === '@/components/layout/locale-switcher') return { LocaleSwitcher: 'locale-selector' };
    if (name === '@/components/layout/shipping-notice') return { ShippingNotice: 'shipping-notice' };
    if (name === './container-tracker') return { ContainerTracker: 'container-tracker' };
    throw new Error(`Unexpected component import: ${name}`);
  });
  function expand(tree) {
    if (tree == null || typeof tree !== 'object') return tree;
    if (Array.isArray(tree)) return tree.map(expand);
    if (typeof tree.type === 'function') return expand(tree.type(tree.props));
    return { ...tree, props: { ...tree.props, children: expand(tree.props.children) } };
  }
  return {
    paths,
    render(name) { cursor = 0; return expand(loaded[name]({})); },
  };
}

test('complete code, VIN and lot normalize consistently without removing meaningful hyphens or leading zeroes', () => {
  for (const [raw, normalized] of [
    [' qa-12345 ', 'QA-12345'],
    [' 1hg cm82633a 004352 ', '1HGCM82633A004352'],
    [' 00123456 ', '00123456'],
    ['\tqa 12345\n', 'QA12345'],
  ]) {
    assert.equal(query.normalizeTrackingQuery(raw), normalized);
    assert.equal(query.trackingSearchPath(raw), `/track/${encodeURIComponent(normalized)}`);
  }
});

test('lookup paths cannot turn identifier punctuation into a new path, query or fragment', () => {
  assert.equal(query.trackingSearchPath(' qa/123?# % '), '/track/QA%2F123%3F%23%25');
  assert.equal(query.trackingSearchPath('qa%2f123'), '/track/QA%252F123');
  assert.equal(query.trackingSearchPath('qa-123'), '/track/QA-123');
});

test('empty, oversized and control-character queries never produce a lookup URL', () => {
  for (const raw of ['', ' \n\t', 'A'.repeat(101), 'QA\0CODE', 'QA\u0085CODE']) {
    assert.equal(query.normalizeTrackingQuery(raw), '');
    assert.equal(query.trackingSearchPath(raw), '/track');
  }
  assert.equal(query.normalizeTrackingQuery('A'.repeat(100)).length, 100);
});

test('only full valid VINs are identified as public VIN queries', () => {
  assert.equal(query.isFullVinQuery(' 1hgcm82633a004352 '), true);
  for (const raw of ['QA12345', '00123456', '1HGCM82633A00435', 'IHGCM82633A004352', '1HGCM82633A0043523']) {
    assert.equal(query.isFullVinQuery(raw), false, raw);
  }
});

test('main tracking form accepts each identifier and safely encodes navigation', () => {
  const view = mount('components/tracking/track-form.tsx');
  for (const raw of ['qa-12345', '1hgcm82633a004352', '00123456', 'qa/123?#%']) {
    let tree = view.render('TrackForm');
    const input = nodes(tree).find(node => node.type === 'input');
    assert.equal(input.props.maxLength, 100);
    assert.equal(input.props.spellCheck, false);
    input.props.onChange({ target: { value: raw } });
    tree = view.render('TrackForm');
    nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(view.paths.at(-1), query.trackingSearchPath(raw));
  }
  const previous = view.paths.length;
  let tree = view.render('TrackForm');
  nodes(tree).find(node => node.type === 'input').props.onChange({ target: { value: '  ' } });
  tree = view.render('TrackForm');
  nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(view.paths.length, previous, 'blank main form does not navigate');
});

test('desktop, compact and mobile header searches use the same encoded identifier path', () => {
  const view = mount('components/layout/header.tsx');
  let tree = view.render('Header');
  nodes(tree).find(node => node.type === 'button' && node.props['aria-label'] === dictionaries.az.common.menu).props.onClick();
  tree = view.render('Header');
  assert.equal(nodes(tree).filter(node => node.type === 'form').length, 3);
  for (let index = 0; index < 3; index++) {
    const raw = ['qa/123?#%', '1hgcm82633a004352', '00123456'][index];
    const input = nodes(tree).filter(node => node.type === 'input')[index];
    assert.equal(input.props.autoCapitalize, 'characters');
    assert.equal(input.props.maxLength, 100);
    input.props.onChange({ target: { value: raw } });
    tree = view.render('Header');
    nodes(tree).filter(node => node.type === 'form')[index].props.onSubmit({ preventDefault() {} });
    assert.equal(view.paths.at(-1), query.trackingSearchPath(raw));
    tree = view.render('Header');
  }
});

test('all tracking form translations advertise VIN and lot, without claiming only a secret code works', () => {
  for (const [locale, { track }] of Object.entries(dictionaries)) {
    assert.match(track.placeholder, /VIN/i, locale);
    assert.match(track.placeholder, /lot|лот/i, locale);
    assert.match(track.subtitle, /VIN/i, locale);
    assert.doesNotMatch(track.featSafeD, /only with your unique|Yalnız unikal|только по вашему уникальному|yalnızca benzersiz/i, locale);
  }
});

test('API lookup retains error status and disables caching for exact VIN and lot requests', async () => {
  const calls = [];
  let status = 409;
  const loaded = compile('lib/api.ts', name => {
    if (name === './nest-url') return { browserApiBase: () => '/api/v1', nestApiBase: () => 'http://qa.invalid/api/v1' };
    if (name === './account-target') return {};
    if (name === './telegram') return {};
    throw new Error(`Unexpected API import: ${name}`);
  }, {
    window: {},
    localStorage: { getItem: () => null },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return { ok: status === 200, status, json: async () => status === 200 ? { trackingCode: '1HGCM82633A004352', lookupType: 'vin' } : { message: 'Exact lookup is not unique' } };
    },
  });
  for (status of [400, 404, 409, 500]) {
    await assert.rejects(loaded.api.track('qa/123?#%'), error => {
      assert.equal(error instanceof loaded.ApiError, true);
      assert.equal(error.status, status);
      assert.equal(error.message, 'Exact lookup is not unique');
      return true;
    });
    assert.equal(calls.at(-1).url, '/api/v1/tracking/qa%2F123%3F%23%25');
    assert.equal(calls.at(-1).init.cache, 'no-store');
  }
  status = 200;
  assert.equal((await loaded.api.track('1HGCM82633A004352')).lookupType, 'vin');
  assert.equal(calls.length, 5, 'a failed alias lookup is not retried through another endpoint');
});
