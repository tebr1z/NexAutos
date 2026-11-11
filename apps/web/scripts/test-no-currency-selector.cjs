const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const sourceRoot = path.resolve(__dirname, '../src');
const read = relative => fs.readFileSync(path.join(sourceRoot, relative), 'utf8');
const nodes = tree => tree == null || typeof tree === 'boolean' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [tree];
const content = tree => nodes(tree).filter(node => typeof node === 'string' || typeof node === 'number').join(' ');

function compile(relative, resolve, globals = {}) {
  const compiledModule = { exports: {} };
  const compiled = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { process, ...globals })(resolve, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const constants = compile('lib/constants.ts', name => { throw new Error(`Unexpected constants import ${name}`); });
const { dictionaries } = compile('lib/i18n.ts', name => { throw new Error(`Unexpected dictionary import ${name}`); });

function mount(relative, dependencies = {}) {
  let cursor = 0;
  let effects = [];
  const slots = [];
  const listeners = new Map();
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      const slot = slots[index];
      return [slot.value, next => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !deps || deps.some((value, at) => !Object.is(value, slots[index].deps?.[at]))) {
        slots[index]?.cleanup?.();
        const slot = slots[index] = { deps };
        effects.push(() => { slot.cleanup = effect(); });
      }
    },
  };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const window = {
    scrollY: 0,
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
  };
  const loaded = compile(relative, name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => `icon-${String(key)}` });
    if (name === 'next/link') return { __esModule: true, default: 'a' };
    if (name === '@/lib/constants') return constants;
    if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
    if (name === '@/lib/tracking-query') return compile('lib/tracking-query.ts');
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error(`Unexpected import ${name}; currency dependencies must not return`);
  }, { window });
  function expand(tree) {
    if (tree == null || typeof tree !== 'object') return tree;
    if (Array.isArray(tree)) return tree.map(expand);
    if (typeof tree.type === 'function') return expand(tree.type(tree.props));
    return { ...tree, props: { ...tree.props, children: expand(tree.props.children) } };
  }
  return {
    loaded,
    render(name, props = {}) {
      cursor = 0;
      effects = [];
      const tree = expand(loaded[name](props));
      effects.forEach(effect => effect());
      return tree;
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    listeners,
  };
}

test('desktop and opened mobile header keep language, theme, account and tracking controls without currency', () => {
  const themes = [];
  const paths = [];
  const t = dictionaries.az;
  const view = mount('components/layout/header.tsx', {
    'next/navigation': { useRouter: () => ({ push: value => paths.push(value) }) },
    '@/providers/theme-provider': { useTheme: () => ({ resolvedTheme: 'dark', setTheme: value => themes.push(value) }) },
    '@/providers/i18n-provider': { useI18n: () => ({ locale: 'az', t }) },
    '@/providers/auth-provider': { useAuth: () => ({ user: { id: 'qa-customer', role: 'CUSTOMER' } }) },
    '@/components/brand/logo': { Logo: 'site-logo' },
    '@/components/layout/locale-switcher': { LocaleSwitcher: 'locale-selector' },
  });
  let tree = view.render('Header');
  assert.equal(nodes(tree).filter(node => node.type === 'locale-selector').length, 1);
  assert.doesNotMatch(content(tree), /USD|EUR|TRY|AZN|Valyuta|Currency|Валюта|Para birimi/);
  const theme = nodes(tree).find(node => node.type === 'button' && node.props['aria-label'] === t.common.theme);
  assert.ok(theme, 'theme control remains');
  theme.props.onClick();
  assert.deepEqual(themes, ['light']);
  assert.ok(nodes(tree).some(node => node.type === 'a' && node.props.href === '/account'), 'customer account link remains');
  assert.ok(nodes(tree).some(node => node.type === 'a' && node.props.href === '/customs'), 'customs navigation remains');
  assert.equal(nodes(tree).filter(node => node.type === 'form').length, 2, 'desktop and compact tracking forms remain');
  nodes(tree).find(node => node.type === 'button' && node.props['aria-label'] === t.common.menu).props.onClick();
  tree = view.render('Header');
  assert.equal(nodes(tree).filter(node => node.type === 'locale-selector').length, 2, 'mobile drawer keeps language selector');
  assert.equal(nodes(tree).filter(node => node.type === 'form').length, 3, 'mobile drawer keeps tracking form');
  assert.doesNotMatch(content(tree), /USD|EUR|TRY|AZN|Valyuta|Currency|Валюта|Para birimi/);
  const input = nodes(tree).find(node => node.type === 'input');
  input.props.onChange({ target: { value: ' qa-tracking ' } });
  tree = view.render('Header');
  nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(paths, ['/track/QA-TRACKING']);
  view.unmount();
  assert.ok([...view.listeners.values()].every(value => value.size === 0));
});

test('actual language selector keeps all four languages and changes the selected language', () => {
  for (const locale of ['az', 'en', 'ru', 'tr']) {
    const choices = [];
    const view = mount('components/layout/locale-switcher.tsx', {
      '@/providers/i18n-provider': { useI18n: () => ({ locale, t: dictionaries[locale], setLocale: value => choices.push(value) }) },
    });
    assert.equal(Object.hasOwn(view.loaded, 'CurrencySwitcher'), false);
    let tree = view.render('LocaleSwitcher');
    const trigger = nodes(tree).find(node => node.type === 'button');
    const current = constants.LOCALES.find(row => row.code === locale);
    assert.match(content(trigger), new RegExp(current.label));
    assert.equal(trigger.props['aria-label'], dictionaries[locale].pages.language);
    trigger.props.onClick();
    tree = view.render('LocaleSwitcher');
    const buttons = nodes(tree).filter(node => node.type === 'button');
    assert.equal(buttons.length, 5, 'one trigger and four language choices');
    for (const row of constants.LOCALES) {
      const choice = buttons.slice(1).find(node => content(node).includes(row.name));
      assert.ok(choice, `language ${row.code} remains`);
      choice.props.onClick();
    }
    assert.deepEqual(choices, ['az', 'en', 'ru', 'tr']);
    view.unmount();
    assert.ok([...view.listeners.values()].every(value => value.size === 0));
  }
});

test('root layout removes currency provider while keeping theme, language and authentication providers', () => {
  const layout = read('app/layout.tsx');
  assert.doesNotMatch(layout, /CurrencyProvider|currency-provider/);
  for (const provider of ['ThemeProvider', 'I18nProvider', 'AuthProvider']) assert.match(layout, new RegExp(`<${provider}(?:\\s|>)`));
  assert.equal(fs.existsSync(path.join(sourceRoot, 'providers/currency-provider.tsx')), false);
  assert.doesNotMatch(read('components/layout/header.tsx'), /CurrencySwitcher|useCurrency/);
});

test('browser no longer requests exchange rates or stores currency preferences', () => {
  function visit(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? visit(absolute) : /\.[jt]sx?$/.test(entry.name) ? [absolute] : [];
    });
  }
  for (const filename of visit(sourceRoot)) {
    const source = fs.readFileSync(filename, 'utf8');
    assert.doesNotMatch(source, /anx_currency|CurrencyProvider|useCurrency|CurrencySwitcher|\/currency\/rates/, path.relative(sourceRoot, filename));
  }
  assert.equal(Object.hasOwn(constants, 'CURRENCIES'), false);
  for (const dictionary of Object.values(dictionaries)) assert.equal(Object.hasOwn(dictionary.pages, 'currency'), false);
});

test('price formatting still presents the supplied currency and amount', () => {
  const { formatMoney } = compile('lib/utils.ts', name => require(name));
  assert.equal(formatMoney(12500, 'USD'), '$12,500');
  assert.equal(formatMoney(170, 'AZN'), new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AZN', maximumFractionDigits: 0 }).format(170));
});
