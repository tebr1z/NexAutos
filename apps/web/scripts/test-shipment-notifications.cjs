const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const web = path.resolve(__dirname, '..');
const pageSource = fs.readFileSync(path.join(web, 'src/app/admin/page.tsx'), 'utf8');

function compile(source, requireMock = () => { throw new Error('Unexpected dependency'); }, globals = {}) {
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { process, URL, ...globals })(requireMock, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

function functions(source, names) {
  const ast = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
}

function helpers(api = {}) {
  const names = ['channelNotice', 'notificationNotice', 'stageNotice', 'photoQueueNotice', 'pushOrderPhotos'];
  const phone = functions(fs.readFileSync(path.join(web, 'src/lib/sms.ts'), 'utf8'), ['normalizePhone']);
  return compile(`${phone}\n${functions(pageSource, names)}\nmodule.exports = {${names.join(',')}};`, undefined, { api, fitDataUrl: async value => value });
}

const { stageNotice, notificationNotice, photoQueueNotice } = helpers();
const phone = '+994501234567';
const accepted = { sent: true, outcome: 'accepted' };
const absent = { sent: false, outcome: 'failed', error: 'not_configured' };

test('important milestone policy keeps legacy stages and adds the six requested essentials', () => {
  const constants = compile(fs.readFileSync(path.join(web, 'src/lib/constants.ts'), 'utf8'));
  const required = ['PURCHASED', 'EXPORT_DOCUMENTS', 'EXPORT_READY', 'LOADED_CONTAINER', 'SHIP_DEPARTED', 'DESTINATION_PORT', 'TIR_BAKU_CUSTOMS', 'READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'PAYMENT_RECEIVED', 'PICKED_UP', 'CONTAINER_OPENED', 'TIR_LOADED', 'TIR_DEPARTED', 'CUSTOMS_DOCUMENTS_READY'];
  assert.equal(constants.SMS_NOTIFY_STATUSES.length, required.length);
  for (const status of required) assert.equal(constants.shouldNotifyStatus(status), true, status);
  for (const status of ['IN_TRANSIT', 'TO_ORIGIN_PORT', 'VESSEL_WAITING', 'UNKNOWN']) assert.equal(constants.shouldNotifyStatus(status), false, status);
});

test('legacy public notification route returns 410 without reading a recipient or invoking any provider', async () => {
  let imports = 0;
  const route = compile(fs.readFileSync(path.join(web, 'src/app/api/notify/route.ts'), 'utf8'), name => {
    imports += 1;
    assert.equal(name, 'next/server');
    return { NextResponse: { json: (body, init) => ({ body, status: init.status }) } };
  }, { fetch: () => { throw new Error('No outbound request allowed'); } });
  for (const req of [undefined, { json: () => { throw new Error('Body must not be read'); } }]) {
    const response = await route.POST(req);
    assert.equal(response.status, 410);
    assert.equal(response.body.sent, false);
    assert.equal(response.body.error, 'endpoint_removed');
  }
  assert.equal(imports, 1);
});

test('WhatsApp acceptance is never mislabeled as successful SMS', () => {
  const text = stageNotice('Maşın alınıb', phone, { sent: true, channel: 'whatsapp', channelResults: { whatsapp: accepted, sms: absent } });
  assert.match(text, /WhatsApp: xidmət göndərmə üçün qəbul etdi/);
  assert.match(text, /SMS: xidmət qurulmayıb/);
  assert.match(text, /çatdırılma təsdiqi deyil/);
  assert.doesNotMatch(text, /SMS göndərildi|SMS getdi|çatdırıldı/);
});

test('both channel acceptances are named independently without claiming delivery', () => {
  const text = notificationNotice(phone, { sent: true, channel: 'whatsapp+sms', channelResults: { whatsapp: accepted, sms: accepted } });
  assert.match(text, /WhatsApp: xidmət göndərmə üçün qəbul etdi/);
  assert.match(text, /SMS: xidmət göndərmə üçün qəbul etdi/);
  assert.doesNotMatch(text, /çatdırıldı|müştəriyə göndərildi/);
});

test('partial SMS acceptance reports failed WhatsApp separately', () => {
  const text = notificationNotice(phone, { sent: true, channel: 'sms', channelResults: { whatsapp: { sent: false, outcome: 'failed', error: 'provider_rejected' }, sms: accepted } });
  assert.match(text, /WhatsApp: xidmət göndərişi qəbul etmədi/);
  assert.match(text, /SMS: xidmət göndərmə üçün qəbul etdi/);
});

test('unknown provider outcomes warn against blind retries even if the other channel accepted', () => {
  const text = notificationNotice(phone, { sent: true, channelResults: { whatsapp: { sent: false, outcome: 'unknown', error: 'provider_uncertain' }, sms: accepted } });
  assert.match(text, /WhatsApp: nəticə qeyri-müəyyəndir/);
  assert.match(text, /təkrar göndərməzdən əvvəl xidmətdə yoxlayın/);
  assert.match(text, /SMS: xidmət göndərmə üçün qəbul etdi/);
});

test('disabled SMS and a missing per-channel result never imply an SMS was sent', () => {
  const disabled = notificationNotice(phone, { sent: true, channelResults: { whatsapp: accepted, sms: { sent: false, outcome: 'failed', error: 'disabled' } } });
  assert.match(disabled, /WhatsApp: xidmət göndərmə üçün qəbul etdi/);
  assert.doesNotMatch(disabled, /SMS/);
  const incomplete = notificationNotice(phone, { sent: true, channelResults: { whatsapp: accepted } });
  assert.match(incomplete, /SMS: göndəriş nəticəsi yoxdur/);
});

test('legacy response feedback respects its actual channel and does not leak provider errors', () => {
  assert.match(notificationNotice(phone, { sent: true, channel: 'whatsapp' }), /^WhatsApp:/);
  assert.match(notificationNotice(phone, { sent: true, channel: 'sms' }), /^SMS:/);
  assert.doesNotMatch(notificationNotice(phone, { sent: false, error: 'secret-provider-payload-123' }), /secret-provider/);
});

test('missing phones and nonessential stages produce clear non-send feedback', () => {
  assert.match(stageNotice('Tranzit', phone, { sent: false, error: 'skipped' }), /nəzərdə tutulmayıb/);
  assert.match(notificationNotice(undefined, { sent: false, error: 'no_phone' }), /telefon nömrəsi yoxdur/);
  assert.match(notificationNotice(phone, { sent: false, error: 'unchanged' }), /Mərhələ dəyişməyib; təkrar bildiriş göndərilmədi/);
});

test('deduplicated photo flushes explain no-new, already-processed and in-progress without claiming send', () => {
  for (const error of ['no_new_photos', 'already_processed', 'in_progress']) {
    const text = notificationNotice(phone, { sent: false, error });
    assert.match(text, /təkrar|əlavə göndəriş/);
    assert.doesNotMatch(text, /qəbul etdi|SMS getdi|SMS göndərildi/);
  }
});

test('queued photo feedback explains automation and does not promise an unavailable SMS channel', () => {
  const queued = photoQueueNotice({ queued: true });
  assert.match(queued, /avtomatik növbəyə alındı/);
  assert.match(queued, /əlavə klik lazım deyil/);
  assert.match(queued, /WhatsApp bildirişi/);
  assert.doesNotMatch(queued, /SMS|Twilio/);
  for (const value of [undefined, { queued: false, error: 'enqueue_failed' }]) {
    const failed = photoQueueNotice(value);
    assert.match(failed, /növbəyə alınması təsdiqlənmədi/);
    assert.doesNotMatch(failed, /avtomatik növbəyə alındı/);
  }
});

test('photo uploader retains automatic queue metadata after gallery pruning', async () => {
  const api = {
    addOrderPhoto: async () => ({ uploadedPhotoId: 'new-id', photos: [{ id: 'new-id', url: '/api/media/photos/new-id' }], photoNotification: { queued: true, pendingPhotos: 1 } }),
    pruneOrderPhotos: async () => ({ photos: [{ id: 'new-id', url: '/api/media/photos/new-id' }] }),
  };
  const result = await helpers(api).pushOrderPhotos('order-qa', [{ url: 'data:image/png;base64,QA' }]);
  assert.equal(result.photoNotification.queued, true);
  assert.equal(result.photoNotification.pendingPhotos, 1);
});

test('one enqueue failure cannot be hidden by a later successful upload', async () => {
  let calls = 0;
  const api = {
    addOrderPhoto: async () => ({ uploadedPhotoId: `id-${++calls}`, photos: [{ id: `id-${calls}`, url: `/api/media/photos/id-${calls}` }], photoNotification: calls === 1 ? { queued: false, error: 'enqueue_failed' } : { queued: true } }),
    pruneOrderPhotos: async () => ({ photos: [] }),
  };
  const result = await helpers(api).pushOrderPhotos('order-qa', [{ url: 'data:image/png;base64,ONE' }, { url: 'data:image/png;base64,TWO' }]);
  assert.equal(result.photoNotification.queued, false);
  assert.equal(result.photoNotification.error, 'enqueue_failed');
});

test('old API upload responses cannot falsely claim an automatic notification was queued', async () => {
  const result = await helpers({ addOrderPhoto: async () => ({ uploadedPhotoId: 'qa', photos: [] }), pruneOrderPhotos: async () => ({ photos: [] }) }).pushOrderPhotos('order-qa', [{ url: 'data:image/png;base64,QA' }]);
  assert.equal(result.photoNotification.queued, false);
});

test('admin save preserves milestone channel results alongside photo queue feedback', () => {
  assert.match(pageSource, /stageFeedback = \[stageFeedback, stageNotice\(stageLabel\(staged\), staged\.customerPhone, staged\.notify\)\]/);
  assert.match(pageSource, /setNotice\(\[stageFeedback, saveFeedback\]\.filter\(Boolean\)\.join\(" "\)\)/);
  assert.doesNotMatch(pageSource, /Aşağıda «Yeni şəkillər SMS»|Yeni şəkillər haqqında SMS göndər|Müştəriyə SMS göndərildi/);
  assert.match(pageSource, /WhatsApp bildirişini indi göndər/);
});

test('initial purchase channel feedback survives photo uploads in both create entry points', () => {
  assert.match(pageSource, /stageFeedback = stageNotice\("Maşın alınıb", remote\.customerPhone, remote\.notify\)/);
  assert.match(pageSource, /purchaseFeedback = stageNotice\("Maşın alınıb", remote\.customerPhone, remote\.notify\)/);
  assert.match(pageSource, /setNotice\(\[purchaseFeedback, photoQueueNotice\(withPhotos\.photoNotification\)\]/);
  assert.match(pageSource, /setNotice\(\[purchaseFeedback, saveError\]/);
});
