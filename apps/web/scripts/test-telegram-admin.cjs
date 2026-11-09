const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function compile(relative, requireMock, globals = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { URL, Error, ...globals })(requireMock, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const telegram = compile('src/lib/telegram.ts', () => { throw new Error('Unexpected dependency'); });
const access = compile('src/lib/admin-access.ts', () => { throw new Error('Unexpected dependency'); });
const NOW = Date.now();
const baseStatus = { configured: true, enabled: true, botUsername: 'AutoNexTestBot', botName: 'Auto Nex QA', encryptionReady: true, canManage: true, lastPollAt: new Date(NOW).toISOString(), lastError: null, linkedAccount: null, accounts: [] };
const pair = { url: 'https://t.me/AutoNexTestBot?start=qa_pairing_secret_0123456789', expiresAt: new Date(NOW + 600_000).toISOString() };

test('Telegram health never claims active without a recent successful poll', () => {
  assert.equal(telegram.telegramHealth(null, NOW).key, 'loading');
  assert.equal(telegram.telegramHealth({ ...baseStatus, configured: false }, NOW).key, 'setup');
  assert.equal(telegram.telegramHealth({ ...baseStatus, enabled: false }, NOW).key, 'paused');
  assert.equal(telegram.telegramHealth({ ...baseStatus, lastPollAt: null }, NOW).key, 'checking');
  assert.equal(telegram.telegramHealth({ ...baseStatus, lastPollAt: 'invalid' }, NOW).key, 'stale');
  assert.equal(telegram.telegramHealth({ ...baseStatus, lastPollAt: new Date(NOW - 90_001).toISOString() }, NOW).key, 'stale');
  assert.equal(telegram.telegramHealth({ ...baseStatus, lastPollAt: new Date(NOW + 31_000).toISOString() }, NOW).key, 'stale');
  assert.equal(telegram.telegramHealth({ ...baseStatus, lastError: 'Connection failed' }, NOW).key, 'error');
  assert.equal(telegram.telegramHealth(baseStatus, NOW).key, 'active');
});

test('pair links must be unexpired HTTPS deep links to the configured bot only', () => {
  assert.equal(telegram.safeTelegramPairUrl(pair, baseStatus.botUsername, NOW), pair.url);
  for (const url of [
    'https://evil.example/AutoNexTestBot?start=secret',
    'http://t.me/AutoNexTestBot?start=secret',
    'https://t.me/OtherBot?start=secret',
    'https://t.me/AutoNexTestBot?start=secret&start=other',
    'https://t.me/AutoNexTestBot?start=secret&other=1',
    'https://t.me/AutoNexTestBot?start=secret#data',
    'https://name@t.me/AutoNexTestBot?start=secret',
    'https://t.me:4433/AutoNexTestBot?start=secret',
    `https://t.me/AutoNexTestBot?start=${'a'.repeat(65)}`,
    'javascript:alert(1)',
  ]) assert.equal(telegram.safeTelegramPairUrl({ ...pair, url }, baseStatus.botUsername, NOW), null, url);
  assert.equal(telegram.safeTelegramPairUrl({ ...pair, expiresAt: new Date(NOW).toISOString() }, baseStatus.botUsername, NOW), null);
  assert.equal(telegram.safeTelegramPairUrl({ ...pair, expiresAt: 'invalid' }, baseStatus.botUsername, NOW), null);
  assert.equal(telegram.safeTelegramPairUrl(pair, null, NOW), null);
});

test('explicit revoke targets never fall back to the current user', () => {
  assert.equal(telegram.telegramLinkPath(), '/telegram/link');
  assert.equal(telegram.telegramLinkPath(' other/user? '), '/telegram/link/other%2Fuser%3F');
  for (const value of ['', ' ', null]) assert.throws(() => telegram.telegramLinkPath(value), /hesabı seçilməyib/);
});

test('bot management is reachable for operational staff but not customers/freight users', () => {
  for (const role of ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF']) assert.equal(access.canAccessAdminPath(role, '/admin/telegram'), true);
  for (const role of ['CUSTOMER', 'FREIGHT_USER', undefined]) assert.equal(access.canAccessAdminPath(role, '/admin/telegram'), false);
  assert.equal(access.canAccessAdminPath('STAFF', '/admin/settings'), false);
  assert.equal(access.canAccessAdminPath('MANAGER', '/admin/users'), false);
  assert.equal(access.canAccessAdminPath('STAFF', '/admin/telegram-unsafe'), false);
});

test('unexpected API errors cannot echo a bot token into the page', () => {
  assert.doesNotMatch(telegram.telegramSafeError(new Error('Failed 123456789:abcdefghijklmnopqrstuvwxyz_0123456789')), /123456789/);
  assert.match(telegram.telegramSafeError(new Error('Failed 123456789:abcdefghijklmnopqrstuvwxyz_0123456789')), /gizli token/);
  assert.ok(telegram.telegramSafeError(new Error('x'.repeat(1_000))).length <= 500);
});

function mount(api, role = 'SUPER_ADMIN') {
  let cursor = 0;
  let effects = [];
  const slots = [];
  const timers = new Map();
  let nextTimer = 0;
  const same = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const hooks = {
    useState(initial) { const index = cursor++; slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useCallback(callback, deps) { const index = cursor++; if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: callback, deps }; return slots[index].value; },
    useEffect(effect, deps) { const index = cursor++; const previous = slots[index]; if (!previous || !same(previous.deps, deps)) { previous?.cleanup?.(); const next = slots[index] = { effect, deps }; effects.push(() => { next.cleanup = effect(); }); } },
  };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const icons = new Proxy({}, { get: (_, name) => `icon-${name}` });
  const dialog = new Proxy({}, { get: (_, name) => `dialog-${name}` });
  const Page = compile('src/app/admin/telegram/page.tsx', name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (name === 'lucide-react') return icons;
    if (name === '@radix-ui/react-dialog') return dialog;
    if (name === '@/lib/api') return { api };
    if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
    if (name === '@/providers/auth-provider') return { useAuth: () => ({ user: { id: 'qa-admin', role } }) };
    if (name === '@/lib/telegram') return telegram;
    throw new Error(`Unexpected import ${name}`);
  }, { setInterval: (callback, interval) => { timers.set(++nextTimer, { callback, interval }); return nextTimer; }, clearInterval: id => timers.delete(id) }).default;
  return {
    render() { cursor = 0; effects = []; const tree = Page(); effects.forEach(effect => effect()); return tree; },
    replayEffects() { for (const slot of slots) if (slot?.effect) { slot.cleanup?.(); slot.cleanup = slot.effect(); } },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    timers,
  };
}
function nodes(tree) {
  if (tree == null || typeof tree === 'boolean') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (typeof tree !== 'object') return [tree];
  return [tree, ...nodes(tree.props?.children)];
}
function content(tree) { return nodes(tree).filter(node => typeof node === 'string' || typeof node === 'number').join(' '); }
function button(tree, label) { return nodes(tree).find(node => node.type === 'button' && content(node).includes(label)); }
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('pair grants are created only by a click and polling starts only while pairing', async () => {
  let pairCalls = 0;
  const view = mount({ telegramStatus: async () => baseStatus, createTelegramPair: async () => { pairCalls += 1; return pair; } });
  view.render(); await tick(); let tree = view.render();
  assert.equal(pairCalls, 0);
  assert.equal([...view.timers.values()].some(timer => timer.interval === 5_000), false);
  await button(tree, 'Şəxsi bağlantı yarat').props.onClick(); await tick(); tree = view.render();
  assert.equal(pairCalls, 1);
  assert.equal(nodes(tree).find(node => node.type === 'a' && node.props.href === pair.url).props.target, '_blank');
  assert.equal([...view.timers.values()].some(timer => timer.interval === 5_000), true);
  view.unmount();
  assert.equal(view.timers.size, 0);
});

test('non-admin operators cannot see or submit bot credentials even if status claims manage permission', async () => {
  const view = mount({ telegramStatus: async () => baseStatus }, 'STAFF');
  view.render(); await tick(); const tree = view.render();
  assert.equal(nodes(tree).some(node => node.type === 'input' && node.props.type === 'password'), false);
  assert.equal(button(tree, 'Tokeni yoxla və saxla'), undefined);
  assert.equal(button(tree, 'Şəxsi bağlantı yarat').props.disabled, false);
  view.unmount();
});

test('a stale status response cannot overwrite a newly saved configuration', async () => {
  const pending = deferred();
  let reads = 0;
  const view = mount({ telegramStatus: () => ++reads === 1 ? Promise.resolve({ ...baseStatus, configured: false, enabled: false }) : pending.promise, saveTelegramConfig: async () => ({ ...baseStatus, enabled: false }) });
  view.render(); await tick(); let tree = view.render();
  button(tree, 'Vəziyyəti yenilə').props.onClick();
  nodes(tree).find(node => node.type === 'input').props.onChange({ target: { value: '123456789:abcdefghijklmnopqrstuvwxyz_0123456789' } });
  tree = view.render();
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await tick();
  pending.resolve({ ...baseStatus, configured: false, enabled: false }); await tick(); tree = view.render();
  assert.equal(button(tree, 'Botu aktivləşdir').props.disabled, false);
  assert.equal(nodes(tree).find(node => node.type === 'input').props.value, '');
  view.unmount();
});

test('Strict Mode effect replay retries status without getting stuck behind a stale read', async () => {
  const old = deferred();
  let reads = 0;
  const view = mount({ telegramStatus: () => ++reads === 1 ? old.promise : Promise.resolve(baseStatus) });
  view.render(); view.replayEffects(); await tick();
  old.resolve({ ...baseStatus, configured: false }); await tick();
  const tree = view.render();
  assert.equal(reads, 2);
  assert.equal(button(tree, 'Şəxsi bağlantı yarat').props.disabled, false);
  view.unmount();
});

test('token deletion warns that all staff links and pending operations are revoked', async () => {
  const view = mount({ telegramStatus: async () => baseStatus });
  view.render(); await tick(); let tree = view.render();
  assert.match(content(tree), /Başqa bota aid token saxlasanız, bütün əməkdaşların mövcud Telegram bağlantıları ləğv olunur/);
  button(tree, 'Tokeni sil').props.onClick(); tree = view.render();
  assert.match(content(tree), /bütün əməkdaşların Telegram bağlantıları ləğv ediləcək/);
  assert.match(content(tree), /gözləyən bot əməliyyatları dayandırılacaq/);
  view.unmount();
});

test('failed token submission still clears the credential and redacts echoed secrets', async () => {
  const credential = '123456789:abcdefghijklmnopqrstuvwxyz_0123456789';
  const view = mount({ telegramStatus: async () => baseStatus, saveTelegramConfig: async () => { throw new Error(`Could not validate ${credential}`); } });
  view.render(); await tick(); let tree = view.render();
  nodes(tree).find(node => node.type === 'input').props.onChange({ target: { value: credential } });
  tree = view.render();
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  tree = view.render();
  assert.equal(nodes(tree).find(node => node.type === 'input').props.value, '');
  assert.doesNotMatch(content(tree), /123456789/);
  assert.match(content(tree), /gizli token/);
  view.unmount();
});

test('a disabled bot hides an outstanding pair link and stops pair polling', async () => {
  let enabled = true;
  const view = mount({ telegramStatus: async () => ({ ...baseStatus, enabled }), createTelegramPair: async () => pair });
  view.render(); await tick(); let tree = view.render();
  await button(tree, 'Şəxsi bağlantı yarat').props.onClick(); await tick(); tree = view.render();
  assert.equal(nodes(tree).some(node => node.type === 'a' && node.props.href === pair.url), true);
  enabled = false;
  await button(tree, 'Vəziyyəti yenilə').props.onClick(); await tick(); tree = view.render();
  assert.equal(nodes(tree).some(node => node.type === 'a' && node.props.href === pair.url), false);
  assert.equal([...view.timers.values()].some(timer => timer.interval === 5_000), false);
  view.unmount();
});
