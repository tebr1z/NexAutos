const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// A small deterministic hook harness exercises target changes and in-flight
// requests without adding a browser/test-runner dependency to the application.
function mount(file, exportName, api, extras = {}) {
  let cursor = 0;
  let effects = [];
  let props;
  let tree;
  const slots = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useMemo(create) { return create(); },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        previous?.cleanup?.();
        const next = slots[index] = { deps };
        effects.push(() => { next.cleanup = effect(); });
      }
    },
  };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  hooks.useLayoutEffect = hooks.useEffect;
  const module = { exports: {} };
  const requireMock = name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (name === '@/lib/api') return { api };
    if (name in extras) return extras[name];
    throw new Error(`Unexpected import: ${name}`);
  };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext('(function(require,module,exports){' + compiled + '\n})', {})(requireMock, module, module.exports);
  const Component = module.exports[exportName];
  return {
    render(nextProps = props) { props = nextProps; cursor = 0; effects = []; tree = Component(props); effects.forEach(run => run()); return tree; },
    tree: () => tree,
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
function nodes(tree) {
  if (tree == null || typeof tree === 'boolean') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (typeof tree !== 'object') return [tree];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) { return nodes(tree).filter(node => typeof node === 'string' || typeof node === 'number').join(' '); }
function button(tree, label) { return nodes(tree).find(node => node.type === 'button' && text(node).includes(label)); }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
const tick = () => new Promise(resolve => setImmediate(resolve));
const profile = brandName => ({ brandName, month: '2026-11', used: 0, monthlyLimit: 100, remaining: 100, expired: false, accessUntil: null, discountAUsd: 0, discountBUsd: 0, discountCUsd: 0, profitMarginUsd: 0, surchargeAUsd: 0, surchargeBUsd: 0, surchargeCUsd: 0, potiBakuUsd: null, allowSelfPricing: false });
const plan = phone => ({ phone, enabled: true, watchLimit: 3, monthlyAlertLimit: 100, month: '2026-11', used: 0, active: 0 });
const calculatorFile = 'src/components/freight/calculator-account.tsx';
const radarFile = 'src/components/lot-radar/radar-plan-editor.tsx';

test('calculator explicit admin mode and blank IDs never request the current admin profile', () => {
  const calls = [];
  const view = mount(calculatorFile, 'CalculatorAccount', { calculatorProfile: id => { calls.push(id); return Promise.resolve(profile('admin')); } });
  view.render({ mode: 'admin' });
  view.render({ userId: '   ' });
  view.render();
  assert.deepEqual(calls, []);
  assert.match(text(view.tree()), /İdarə ediləcək hesab seçilməyib/);
});

test('calculator self-service intentionally keeps its own profile endpoint', async () => {
  const calls = [];
  const view = mount(calculatorFile, 'CalculatorAccount', { calculatorProfile: id => { calls.push(id); return Promise.resolve(profile('self')); } });
  view.render({}); await tick(); view.render();
  assert.deepEqual(calls, [undefined]);
  assert.ok(nodes(view.tree()).some(node => node.type === 'input' && node.props.value === 'self'));
});

test('calculator hides the previous profile immediately and ignores its late load', async () => {
  const old = deferred();
  const view = mount(calculatorFile, 'CalculatorAccount', { calculatorProfile: id => id === 'a' ? old.promise : Promise.resolve(profile('customer-b')) });
  view.render({ mode: 'admin', userId: 'a' });
  view.render({ mode: 'admin', userId: 'b' });
  await tick(); view.render();
  old.resolve(profile('customer-a')); await tick(); view.render();
  assert.ok(nodes(view.tree()).some(node => node.type === 'input' && node.props.value === 'customer-b'));
  assert.ok(!nodes(view.tree()).some(node => node.type === 'input' && node.props.value === 'customer-a'));
});

test('calculator old save cannot replace a different selected user or fire its callback', async () => {
  const oldSave = deferred();
  const calls = [];
  let saved = 0;
  const view = mount(calculatorFile, 'CalculatorAccount', {
    calculatorProfile: id => Promise.resolve(profile(id)),
    saveCalculatorProfile: (payload, id) => { calls.push(id); return oldSave.promise; },
  });
  view.render({ mode: 'admin', userId: 'a', onSaved: () => saved++ }); await tick(); view.render();
  button(view.tree(), 'Yadda saxla').props.onClick();
  view.render({ mode: 'admin', userId: 'b', onSaved: () => saved++ }); await tick(); view.render();
  oldSave.resolve(profile('a-saved')); await tick(); view.render();
  assert.deepEqual(calls, ['a']);
  assert.equal(saved, 0);
  assert.ok(nodes(view.tree()).some(node => node.type === 'input' && node.props.value === 'b'));
});

test('radar rejects blank user targets and clears old data while switching', async () => {
  const calls = [];
  const second = deferred();
  const view = mount(radarFile, 'RadarPlanEditor', { radarPlan: id => { calls.push(id); return id === 'a' ? Promise.resolve(plan('+994501111111')) : second.promise; } });
  view.render({ userId: ' ' }); view.render();
  assert.equal(calls.length, 0);
  view.render({ userId: 'a' }); await tick(); view.render();
  assert.ok(nodes(view.tree()).some(node => node.type === 'input' && node.props.value === '+994501111111'));
  view.render({ userId: 'b' });
  assert.ok(!nodes(view.tree()).some(node => node.type === 'input' && node.props.value === '+994501111111'));
  second.resolve(plan('+994502222222')); await tick(); view.render();
  assert.ok(nodes(view.tree()).some(node => node.type === 'input' && node.props.value === '+994502222222'));
});

test('radar old save cannot replace a newly selected plan', async () => {
  const saving = deferred();
  const calls = [];
  const view = mount(radarFile, 'RadarPlanEditor', {
    radarPlan: id => Promise.resolve(plan(id === 'a' ? '+994501111111' : '+994502222222')),
    saveRadarPlan: (id, payload) => { calls.push(id); return saving.promise; },
  });
  view.render({ userId: 'a' }); await tick(); view.render();
  button(view.tree(), 'Radar ayarlarını saxla').props.onClick();
  view.render({ userId: 'b' }); await tick(); view.render();
  saving.resolve(plan('+994509999999')); await tick(); view.render();
  assert.deepEqual(calls, ['a']);
  assert.ok(nodes(view.tree()).some(node => node.type === 'input' && node.props.value === '+994502222222'));
  assert.ok(!text(view.tree()).includes('saxlanıldı.'));
});

test('radar closing the panel during phone save does not continue plan mutation', async () => {
  const phoneSave = deferred();
  let planSaves = 0;
  const view = mount(radarFile, 'RadarPlanEditor', {
    radarPlan: () => Promise.resolve(plan('+994501111111')),
    updateAccessUser: () => phoneSave.promise,
    saveRadarPlan: () => { planSaves++; return Promise.resolve(plan('+994502222222')); },
  });
  view.render({ userId: 'a' }); await tick(); view.render();
  nodes(view.tree()).find(node => node.type === 'input' && node.props.type === 'tel').props.onChange({ target: { value: '+994502222222' } });
  view.render(); button(view.tree(), 'Radar ayarlarını saxla').props.onClick(); view.unmount();
  phoneSave.resolve({}); await tick();
  assert.equal(planSaves, 0);
});

test('account management opens the clicked target with keyed editors and no customer calculator controls', async () => {
  const admin = { id: 'admin', name: 'Admin', email: 'admin@nex.autos', role: 'SUPER_ADMIN', isActive: true };
  const rows = [admin, { id: 'customer', name: 'Müştəri', email: 'customer@example.com', role: 'CUSTOMER', isActive: true }, { id: 'freight', name: 'Daşıma', email: 'freight@example.com', role: 'FREIGHT_USER', isActive: true }];
  function CalculatorAccount() {}
  function RadarPlanEditor() {}
  const roleDetails = Object.fromEntries(['SUPER_ADMIN', 'ADMIN', 'CUSTOMER', 'FREIGHT_USER'].map(role => [role, { label: role, short: role, description: role }]));
  const view = mount('src/app/admin/users/page.tsx', 'default', { accessUsers: () => Promise.resolve(rows) }, {
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    '@radix-ui/react-dialog': Object.fromEntries(['Root', 'Portal', 'Overlay', 'Content', 'Title', 'Description', 'Close'].map(name => [name, `Dialog.${name}`])),
    'lucide-react': new Proxy({}, { get: (_, name) => name }),
    '@/lib/admin-access': { assignableRolesFor: () => ['CUSTOMER', 'FREIGHT_USER'], ROLE_DETAILS: roleDetails },
    '@/providers/auth-provider': { useAuth: () => ({ user: admin, loading: false }) },
    '@/components/freight/calculator-account': { CalculatorAccount },
    '@/components/lot-radar/radar-plan-editor': { RadarPlanEditor },
  });
  view.render({}); await tick(); view.render();
  const select = email => { nodes(view.tree()).find(node => node.type === 'button' && node.props['aria-label']?.includes(email)).props.onClick(); view.render(); };
  select('customer@example.com');
  assert.equal(text(nodes(view.tree()).find(node => node.type === 'Dialog.Description')), 'customer@example.com');
  let editor = nodes(view.tree()).find(node => node.type === RadarPlanEditor);
  assert.equal(editor.props.userId, 'customer'); assert.equal(editor.key, 'radar-customer');
  assert.equal(button(view.tree(), 'Hesablama paketi ·'), undefined);
  select('freight@example.com');
  button(view.tree(), 'Hesablama paketi ·').props.onClick(); view.render();
  editor = nodes(view.tree()).find(node => node.type === CalculatorAccount);
  assert.equal(editor.props.userId, 'freight'); assert.equal(editor.props.mode, 'admin'); assert.equal(editor.key, 'calculator-freight');
});
