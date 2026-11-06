"use strict";
const API = "https://nex.autos/api/v1";
const SCAN_INTERVAL_MS = 20 * 60 * 1000;
let refreshPromise, ticking = false, starting = false, sessionVersion = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const validLot = raw => { try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password && !u.port && ['bid.cars','www.bid.cars'].includes(u.hostname) && /^\/en\/lot\/[01]-\d+(?:\/[^/]+)?\/?$/.test(u.pathname); } catch { return false; } };
const lotKey = raw => new URL(raw).pathname.match(/\/lot\/([01]-\d+)/)?.[1];
const validSearch = raw => { try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password && !u.port && ['bid.cars','www.bid.cars'].includes(u.hostname) && /^\/en\/search\/results\/?$/.test(u.pathname); } catch { return false; } };
const collectorAllowed = auth => ['ADMIN','SUPER_ADMIN'].includes(auth?.user?.role);
const finishPath = job => job.collector ? `/lot-radar/admin/collector/${encodeURIComponent(job.id)}/finish` : `/lot-radar/${encodeURIComponent(job.id)}/browser/finish`;
function scanDue(watch, browserDue, now = Date.now()) {
  if (!watch.enabled || (watch.leaseUntil && Date.parse(watch.leaseUntil) > now)) return false;
  const checked = Date.parse(watch.checkedAt || '');
  const scheduled = Date.parse(watch.nextCheckAt || '');
  return (!Number.isFinite(checked) || now - checked >= SCAN_INTERVAL_MS)
    && (!Number.isFinite(scheduled) || scheduled <= now)
    && (browserDue[watch.id] || 0) <= now;
}
async function raw(path, method = 'GET', body, token) {
  const response = await fetch(`${API}${path}`, { method, credentials: 'omit', signal: AbortSignal.timeout(25000), cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => null);
  if (!response.ok) { const error = new Error(Array.isArray(data?.message) ? data.message.join(' ') : data?.message || `Server xətası: ${response.status}`); error.status = response.status; throw error; }
  return data;
}
async function api(path, method = 'GET', body) {
  let { auth } = await chrome.storage.local.get('auth');
  if (!auth) throw new Error('Auto Nex hesabınıza daxil olun.');
  try { return await raw(path, method, body, auth.accessToken); }
  catch (error) {
    if (error.status !== 401) throw error;
    if (!refreshPromise) refreshPromise = raw('/auth/refresh', 'POST', { refreshToken: auth.refreshToken }).then(async data => {
      const current = (await chrome.storage.local.get('auth')).auth;
      if (!current || current.refreshToken !== auth.refreshToken) throw new Error('Sessiya dəyişib.');
      auth = { ...current, ...data }; await chrome.storage.local.set({ auth }); return auth;
    }).catch(async e => { if ([400,401,403].includes(e.status)) await chrome.storage.local.remove('auth'); throw e; }).finally(() => { refreshPromise = null; });
    const renewed = await refreshPromise; return raw(path, method, body, renewed.accessToken);
  }
}
async function alarms() {
  await chrome.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.alarms.create('radar-tick', { periodInMinutes: 0.5 });
}
chrome.runtime.onInstalled.addListener(() => void alarms());
chrome.runtime.onStartup.addListener(() => void alarms());
chrome.action.onClicked.addListener(() => void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }));
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'radar-tick') void tick(); });
async function inbox() {
  const session = sessionVersion;
  const items = await api('/lot-radar/inbox');
  if (session !== sessionVersion) return [];
  const { shown = [], notificationLinks = {} } = await chrome.storage.local.get(['shown', 'notificationLinks']);
  const known = new Set(shown);
  for (const item of items.slice().reverse()) {
    if (session !== sessionVersion) return [];
    if (known.has(item.id) || item.readAt) continue;
    const lot = item.data;
    if (!validLot(lot.url)) continue;
    const auction = lot.auctionAt && Number.isFinite(Date.parse(lot.auctionAt)) ? `${new Date(lot.auctionAt).toLocaleString('az-AZ',{timeZone:'Asia/Baku'})} (Bakı vaxtı)` : lot.auctionTimeText || 'Hərrac vaxtı açıqlanmayıb';
    const price = Number.isFinite(lot.buyNowUsd) && lot.buyNowUsd > 0 ? `Buy Now: $${lot.buyNowUsd.toLocaleString('en-US')} USD\n` : '';
    await chrome.notifications.create(item.id, { type: 'basic', iconUrl: 'icons/icon128.png', title: `${item.watch.filters?.mode === 'buy_now' ? 'Buy Now fürsəti' : 'Yeni lot'}: ${lot.title}`, message: `${item.watch.name}\n${price}${auction}\n${lot.engineCc || '?'} cm³ · ${lot.primaryDamage || 'Zədə naməlum'} · ${lot.document || 'Sənəd naməlum'}` });
    known.add(item.id); notificationLinks[item.id] = lot.url;
  }
  const recent = [...known].slice(-500);
  await chrome.storage.local.set({ shown: recent, notificationLinks: Object.fromEntries(Object.entries(notificationLinks).filter(([id]) => recent.includes(id))) });
  const unread = items.filter(i => !i.readAt).length;
  await chrome.action.setBadgeBackgroundColor({ color: '#2563eb' }); await chrome.action.setBadgeText({ text: unread ? String(unread) : '' });
  return items;
}
chrome.notifications.onClicked.addListener(async id => {
  const { notificationLinks = {} } = await chrome.storage.local.get('notificationLinks');
  if (validLot(notificationLinks[id])) { await chrome.tabs.create({ url: notificationLinks[id] }); await api(`/lot-radar/inbox/${encodeURIComponent(id)}/read`, 'POST').catch(() => {}); }
});
async function readTab(id, expected) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const tab = await chrome.tabs.get(id);
    if (tab.status === 'complete') {
      const snapshot = await chrome.tabs.sendMessage(id, { type: 'RADAR_SNAPSHOT' }).catch(() => null);
      if (snapshot?.error) throw new Error(snapshot.error);
      const samePage = snapshot?.url && (() => {
        const actual = new URL(snapshot.url), wanted = expected && new URL(expected);
        if (actual.protocol !== 'https:' || actual.username || actual.password || actual.port || !['bid.cars','www.bid.cars'].includes(actual.hostname)) return false;
        if (!wanted) return true;
        if (validLot(expected)) return validLot(snapshot.url) && lotKey(snapshot.url) === lotKey(expected);
        return actual.pathname.replace(/\/$/, '') === wanted.pathname.replace(/\/$/, '')
          && [...wanted.searchParams].every(([key, value]) => actual.searchParams.get(key) === value);
      })();
      if (snapshot && samePage && !snapshot.pending && (snapshot.html || snapshot.links?.length || snapshot.empty)) return snapshot;
    }
    await sleep(1000);
  }
  throw new Error('BidCars məlumatı 25 saniyədə hazır olmadı. Boş nəticə kimi saxlanılmadı; səhifəni brauzerdə yoxlayın.');
}
async function openJob(begin, id, collector, session) {
  if (session !== sessionVersion) throw new Error('Sessiya dəyişib.');
  if (typeof id !== 'string' || !id || id.length > 100 || !validSearch(begin.url) || !Number.isFinite(Date.parse(begin.lease)) || Date.parse(begin.lease) <= Date.now()) throw new Error('Server etibarlı BidCars axtarışı və ya yoxlama müddəti qaytarmadı.');
  const tab = await chrome.tabs.create({ url: begin.url, active: false });
  if (session !== sessionVersion) { await chrome.tabs.remove(tab.id).catch(() => {}); throw new Error('Sessiya dəyişib.'); }
  await chrome.storage.local.set({ job: { id, lease: begin.lease, collector: !!collector, tabId: tab.id, stage: 'search', url: begin.url, known: Array.isArray(begin.known) ? begin.known : [], refreshKnown: !!begin.refreshKnown, lots: [], remaining: [] } });
}
async function startBrowser(id) {
  if (starting) throw new Error('Brauzer yoxlaması başladılır.'); starting = true;
  const session = sessionVersion;
  try {
  const { job } = await chrome.storage.local.get('job'); if (job) throw new Error('Əvvəlki brauzer yoxlaması tamamlanır.');
  const begin = await api(`/lot-radar/${encodeURIComponent(id)}/browser`, 'POST');
  await openJob(begin, id, false, session);
  } finally { starting = false; }
}
async function startCollector(auth) {
  if (!collectorAllowed(auth)) throw new Error('Admin kollektoru yalnız ADMIN və SUPER_ADMIN üçündür. Yenidən daxil olun.');
  if (starting) return;
  starting = true;
  const session = sessionVersion;
  try {
    const { job } = await chrome.storage.local.get('job'); if (job) return;
    const result = await api('/lot-radar/admin/collector/next', 'POST');
    if (session !== sessionVersion) return;
    await chrome.storage.local.set({ collectorPollAt: Date.now() });
    if (result?.job) await openJob(result.job, result.job.id, true, session);
  } finally { starting = false; }
}
async function stepBrowser() {
  const session = sessionVersion;
  const { job } = await chrome.storage.local.get('job'); if (!job) return;
  try {
    if (!Number.isFinite(Date.parse(job.lease)) || Date.parse(job.lease) <= Date.now()) throw new Error('Brauzer yoxlamasının vaxtı bitdi. Yenidən başladın.');
    if (job.stage === 'search') {
      const snapshot = await readTab(job.tabId, job.url);
      if (session !== sessionVersion) return;
      if (!Array.isArray(snapshot.links)) throw new Error('Axtarış səhifəsi açılmadı.');
      job.remaining = [...new Map(snapshot.links.filter(validLot).map(url => [lotKey(url), url])).values()].filter(url => job.refreshKnown || !(job.known || []).includes(lotKey(url))).slice(0, 30);
      job.stage = 'lots'; await chrome.storage.local.set({ job });
    }
    for (let i = 0; i < 2 && job.remaining.length; i++) {
      const url = job.remaining[0];
      await chrome.tabs.update(job.tabId, { url });
      const snapshot = await readTab(job.tabId, url);
      if (session !== sessionVersion) return;
      if (!snapshot.html || !validLot(snapshot.url) || new URL(snapshot.url).pathname.match(/\/lot\/([01]-\d+)/)?.[1] !== new URL(url).pathname.match(/\/lot\/([01]-\d+)/)?.[1]) throw new Error('Lot yerinə başqa səhifə açıldı.');
      job.lots.push({ url: snapshot.url, html: snapshot.html }); job.remaining.shift(); await chrome.storage.local.set({ job });
    }
    if (!job.remaining.length) {
      await api(finishPath(job), 'POST', { lease: job.lease, lots: job.lots });
      if (session !== sessionVersion) return;
      await chrome.tabs.remove(job.tabId).catch(() => {}); await chrome.storage.local.remove('job');
      const { browserDue = {} } = await chrome.storage.local.get('browserDue'); browserDue[job.id] = Date.now() + SCAN_INTERVAL_MS; await chrome.storage.local.set({ browserDue, browserError: '', lastBrowserAt: new Date().toISOString(), lastError: '' });
    }
  } catch (error) {
    if (session !== sessionVersion) return;
    await api(finishPath(job), 'POST', { lease: job.lease, lots: [], error: error.message }).catch(() => {});
    await chrome.tabs.remove(job.tabId).catch(() => {}); await chrome.storage.local.remove('job');
    // Pause until the user resolves the site challenge; never bypass it or loop.
    await chrome.storage.local.set({ browserMode: false, collectorMode: false, browserError: error.message, lastBrowserFailureAt: new Date().toISOString() });
    await chrome.notifications.create('radar-attention', { type: 'basic', iconUrl: 'icons/icon128.png', title: 'Lot Radar · yoxlama lazımdır', message: error.message });
  }
}
async function tick() {
  if (ticking) return; ticking = true;
  try {
    const { auth, browserMode, collectorMode, job, browserDue = {}, pollAt = 0, collectorPollAt = 0 } = await chrome.storage.local.get(['auth','browserMode','collectorMode','job','browserDue','pollAt','collectorPollAt']);
    if (!auth) return;
    if (Date.now() - pollAt > 60000) { await inbox(); await chrome.storage.local.set({ pollAt: Date.now() }); }
    if (job) await stepBrowser();
    else if (browserMode && collectorMode) {
      if (!collectorAllowed(auth)) { await chrome.storage.local.set({ collectorMode: false, lastError: 'Admin kollektoru üçün admin hesabına yenidən daxil olun.' }); return; }
      if (Date.now() - collectorPollAt >= 60000) await startCollector(auth);
    } else if (browserMode) {
      const { watches } = await api('/lot-radar');
      const next = watches.filter(w => scanDue(w, browserDue)).sort((a,b) => (Date.parse(a.checkedAt) || 0) - (Date.parse(b.checkedAt) || 0))[0];
      if (next) await startBrowser(next.id);
    }
  } catch (error) { await chrome.storage.local.set({ lastError: error.message }); }
  finally { ticking = false; }
}
async function logout() {
  sessionVersion++;
  const { job } = await chrome.storage.local.get('job');
  if (job) { await api(finishPath(job), 'POST', { lease: job.lease, lots: [], error: 'İstifadəçi sessiyanı bağladı.' }).catch(() => {}); await chrome.tabs.remove(job.tabId).catch(() => {}); }
  await chrome.storage.local.clear(); await chrome.action.setBadgeText({ text: '' });
}
chrome.runtime.onMessage.addListener((m, sender, respond) => {
  if (sender.url !== chrome.runtime.getURL('dashboard.html')) return false;
  (async () => {
    if (m.type === 'LOGIN') {
      await logout(); const data = await raw('/auth/login', 'POST', { email: m.email, password: m.password });
      await chrome.storage.local.set({ auth: { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user } }); await alarms(); return { signedIn: true };
    }
    if (m.type === 'LOGOUT') { await logout(); return {}; }
    if (m.type === 'STATE') {
      const [state, items, local] = await Promise.all([api('/lot-radar'), inbox(), chrome.storage.local.get(['auth','browserMode','collectorMode','browserError','job','lastError','lastBrowserAt','lastBrowserFailureAt'])]);
      let auth = local.auth;
      if (auth && !auth.user) { const user = await api('/auth/me'); const current = (await chrome.storage.local.get('auth')).auth; if (current && current.refreshToken === auth.refreshToken) { auth = { ...current, user }; await chrome.storage.local.set({ auth }); } }
      const { auth: _auth, ...visible } = local;
      return { ...state, items, ...visible, collectorAllowed: collectorAllowed(auth), job: local.job ? { id: local.job.id, collector: !!local.job.collector, pending: local.job.remaining.length } : null };
    }
    if (m.type === 'CREATE') return api('/lot-radar', 'POST', m.body);
    const id = encodeURIComponent(String(m.id || ''));
    if (m.type === 'TOGGLE') return api(`/lot-radar/${id}`, 'PATCH', { enabled: m.enabled });
    if (m.type === 'DELETE') return api(`/lot-radar/${id}`, 'DELETE');
    if (m.type === 'READ') return api(`/lot-radar/inbox/${id}/read`, 'POST');
    if (m.type === 'CHECK') { if (m.browser) { await startBrowser(m.id); void tick(); return { queued: true }; } return api(`/lot-radar/${id}/check`, 'POST'); }
    if (m.type === 'BROWSER_MODE') { await chrome.storage.local.set({ browserMode: !!m.enabled, browserError: '' }); if (m.enabled) void tick(); return {}; }
    if (m.type === 'COLLECTOR_MODE') { const { auth } = await chrome.storage.local.get('auth'); if (!collectorAllowed(auth)) throw new Error('Admin kollektoru yalnız ADMIN və SUPER_ADMIN üçündür.'); await chrome.storage.local.set({ collectorMode: !!m.enabled, collectorPollAt: 0, browserError: '' }); if (m.enabled) void tick(); return {}; }
    throw new Error('Əməliyyat tanınmadı.');
  })().then(data => respond({ ok: true, data })).catch(error => respond({ ok: false, error: error.message }));
  return true;
});
