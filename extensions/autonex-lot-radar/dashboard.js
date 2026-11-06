"use strict";
const $ = id => document.getElementById(id);
const makes = { Toyota:['Camry','Corolla','RAV4','Prius','Highlander'], Hyundai:['Sonata','Elantra','Tucson','Santa Fe'], Kia:['K5','Optima','Sportage','Sorento','Forte'], BMW:['3 Series','5 Series','X3','X5','X6'], 'Mercedes-Benz':['C-Class','E-Class','S-Class','GLC','GLE'], Honda:['Accord','Civic','CR-V'], Nissan:['Altima','Sentra','Rogue','X-Trail'], Ford:['Fusion','Focus','Mustang','Escape','F-150'], Chevrolet:['Malibu','Cruze','Equinox','Camaro'], Lexus:['ES','IS','RX','NX'], Audi:['A4','A6','Q5','Q7'], Volkswagen:['Jetta','Passat','Tiguan'], Mazda:['3','6','CX-5'], Tesla:['Model 3','Model Y','Model S'], Jeep:['Grand Cherokee','Compass','Wrangler'], Subaru:['Forester','Outback','Impreza'], Dodge:['Charger','Challenger','Durango'], Mitsubishi:['Outlander','Lancer'], Volvo:['XC60','XC90','S60'], Porsche:['Cayenne','Macan','Panamera'], 'Land Rover':['Range Rover','Discovery'], Infiniti:['Q50','QX50','QX60'] };
const damageNames = { front:'Ön', rear:'Arxa', left:'Sol', right:'Sağ', side:'Yan (tərəf bilinmir)', water:'Su / sel', fire:'Yanğın', rollover:'Aşma', hail:'Dolu', minor:'Cızıq / kiçik əzik', none:'Zədəsiz / normal aşınma' };
Object.assign(makes,{Acura:['ILX','TLX','MDX','RDX'],Cadillac:['ATS','CTS','XT5','Escalade'],Chrysler:['200','300','Pacifica'],GMC:['Terrain','Acadia','Yukon','Sierra'],Buick:['Encore','Envision','Enclave'],Genesis:['G70','G80','G90','GV70','GV80'],Lincoln:['MKZ','MKC','Nautilus','Navigator'],Mini:['Cooper','Countryman'],Suzuki:['Swift','Vitara','SX4'],Skoda:['Octavia','Superb','Kodiaq'],Renault:['Megane','Clio','Duster'],Peugeot:['208','308','3008'],Fiat:['500','Tipo'],BYD:['Han','Song','Seal'],Ram:['1500','2500'], 'Alfa Romeo':['Giulia','Stelvio']});
function node(tag, text, className) { const n = document.createElement(tag); if (text != null) n.textContent = text; if (className) n.className = className; return n; }
function message(text, error = false) { $('message').hidden = false; $('message').textContent = text; $('message').className = error ? 'error' : ''; }
async function send(payload) { const response = await chrome.runtime.sendMessage(payload); if (!response?.ok) throw new Error(response?.error || 'Extension cavab vermədi.'); return response.data; }
async function action(payload) { try { const r = await send(payload); if (r?.queued) message('Yoxlama başladıldı. Nəticəni bir qədər sonra “Yenilə” ilə görün.'); await load(); return r; } catch (e) { message(e.message, true); } }
function button(label, fn, danger = false) { const b = node('button', label, `quiet${danger ? ' danger' : ''}`); b.type='button'; b.onclick=async()=>{ b.disabled=true; try{await fn();}finally{b.disabled=false;} }; return b; }
const time = value => value ? new Date(value).toLocaleString('az-AZ',{timeZone:'Asia/Baku'}) : 'Hələ yoxlanmayıb';
const deliveryText = code => ({ not_configured:'Xidmət qurulmayıb', delivery_failed:'Göndərilmədi; təkrar yoxlanacaq' }[code] || code || '—');
const auctionText = lot => lot.auctionAt && Number.isFinite(Date.parse(lot.auctionAt)) ? `${time(lot.auctionAt)} · Bakı vaxtı` : lot.auctionTimeText || 'Hərrac günü və saatı açıqlanmayıb';
function link(label, url) { const a=node('a',label); a.href=url; a.target='_blank'; a.rel='noreferrer'; return a; }
for (const make of Object.keys(makes).sort()) { const o=node('option',make); o.value=make; $('make').append(o); }
$('make').onchange=()=>{ $('model').value=''; $('models').replaceChildren(...(makes[$('make').value] || []).map(model=>{const o=node('option');o.value=model;return o;})); };
$('year-to').value=new Date().getFullYear()+1;
for (const [value,label] of Object.entries(damageNames)) { const l=node('label'); const i=node('input'); i.type='checkbox';i.name='damages';i.value=value;l.append(i,document.createTextNode(label));$('damage-options').append(l); }
$('login-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await send({type:'LOGIN',email:$('email').value.trim(),password:$('password').value});$('password').value='';message('Hesaba daxil oldunuz.');await load();}catch(error){message(error.message,true);}finally{b.disabled=false;}};
$('logout').onclick=async()=>{await send({type:'LOGOUT'});location.reload();};
$('watch-form').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget;const values=new FormData(form);const b=$('save-watch');b.disabled=true;
  const body={name:values.get('name').trim(),make:values.get('make'),model:values.get('model').trim(),yearFrom:Number(values.get('yearFrom')),yearTo:Number(values.get('yearTo')),damages:values.getAll('damages'),document:values.get('document'),emailEnabled:values.has('emailEnabled'),whatsappEnabled:values.has('whatsappEnabled')};
  if(values.get('engineMin'))body.engineMin=Math.round(Number(values.get('engineMin'))*1000);if(values.get('engineMax'))body.engineMax=Math.round(Number(values.get('engineMax'))*1000);
  try{await send({type:'CREATE',body});message('Axtarış yaradıldı. İlk uğurlu yoxlama mövcud lotları yadda saxlayacaq.');await load();}catch(error){message(error.message,true);}finally{b.disabled=false;}
};
$('refresh').onclick=()=>void load();
$('browser-mode').onchange=()=>void action({type:'BROWSER_MODE',enabled:$('browser-mode').checked});
async function load() {
  try {
    const state=await send({type:'STATE'});$('login').hidden=true;$('app').hidden=false;$('logout').hidden=false;$('connection').textContent=state.delivery.email;
    $('watch-count').textContent=state.watches.length;$('match-count').textContent=state.items.length;$('channel-count').textContent=1+Number(state.delivery.emailReady)+Number(state.delivery.whatsappReady);
    let planInfo=$('plan-info');if(!planInfo){planInfo=node('p',null,'hint');planInfo.id='plan-info';$('delivery-status').after(planInfo);}
    if(state.plan)planInfo.textContent=`Admin limiti: ${state.plan.active} / ${state.plan.watchLimit} aktiv axtarış · ${state.plan.used} / ${state.plan.monthlyAlertLimit} yeni lot bildirişi (${state.plan.month}). ${state.plan.enabled?'':'Xidmət admin tərəfindən bağlıdır.'}`;
    $('delivery-status').textContent=`E-poçt: ${state.delivery.email} · ${state.delivery.emailReady?'hazırdır':'SMTP qurulmayıb'}. WhatsApp: ${state.delivery.phone||'profilə nömrə əlavə edin'} · ${state.delivery.whatsappReady?'xidmət hazırdır':'xidmət qurulmayıb'}. Kanalları seçməklə bu ünvana/nömrəyə yeni lot mesajlarına razılıq verirsiniz.`;
    $('server-status').textContent=state.delivery.serverMonitoring?'SERVER AKTİVDİR':'SERVER DAYANIB';$('browser-mode').checked=!!state.browserMode;
    $('job-status').textContent=state.job?`Brauzer yoxlaması gedir · qalan ${state.job.pending} lot`:state.browserError||state.lastError||'İzləmə seçilən rejimə əsasən işləyir. Chrome bağlı olduqda extension bildirişi gəlmir; e-poçt/WhatsApp üçün serverin mənbəyə çıxışı lazımdır.';
    $('job-status').className=`hint${state.browserError?' error':''}`;
    $('watches').replaceChildren();
    for(const w of state.watches){const row=node('article',null,'watch');const f=w.filters;row.append(node('h3',`${w.enabled?'●':'○'} ${w.name}`),node('p',`${f.make} ${f.model} · ${f.yearFrom}–${f.yearTo} · ${f.engineMin||'—'}–${f.engineMax||'—'} cm³`),node('p',`${f.damages.map(d=>damageNames[d]).join(', ')||'Bütün zədələr'} · sənəd: ${f.document}`),node('p',`Son yoxlama: ${time(w.checkedAt)} · ${w.initializedAt?'Yeni lotlar izlənir':'İlk yoxlama gözlənilir'}`));if(w.lastError)row.append(node('p',w.lastError,'error'));const controls=node('div',null,'actions');controls.append(link('BidCars-da aç ↗',w.searchUrl),button('Chrome ilə yoxla',()=>action({type:'CHECK',id:w.id,browser:true})),button('Server yoxla',()=>action({type:'CHECK',id:w.id,browser:false})),button(w.enabled?'Dayandır':'Aktiv et',()=>action({type:'TOGGLE',id:w.id,enabled:!w.enabled})),button('Sil',()=>{if(confirm('Bu axtarış və ona aid bildiriş tarixçəsi silinsin?'))return action({type:'DELETE',id:w.id});},true));row.append(controls);$('watches').append(row);}
    if(!state.watches.length)$('watches').append(node('p','İlk axtarışınızı yaradın.','empty'));
    $('inbox').replaceChildren();
    for(const item of state.items){
      const lot=item.data, row=node('article',null,'lot'), info=node('div'), title=node('h3');
      title.append(link(lot.title,lot.url));
      if(!item.readAt)title.append(node('span','YENİ','new'));
      info.append(title,
        node('p',`${lot.engineCc||'?'} cm³ · ${lot.primaryDamage||'Zədə naməlum'} / ${lot.secondaryDamage||'—'}`),
        node('p',`Sənəd: ${lot.document||'Naməlum'} · ${lot.documentKind}`),
        node('p',`Hərrac: ${auctionText(lot)}`),
        node('p',`${item.watch.name} · ${time(item.createdAt)}`),
        node('div',`E-poçt: ${item.emailSentAt?'göndərildi':deliveryText(item.emailError)} · WhatsApp: ${item.whatsappSentAt?'göndərildi':deliveryText(item.whatsappError)}`,'delivery'));
      row.append(info,button(item.readAt?'Oxunub':'Oxundu işarələ',()=>action({type:'READ',id:item.id})));$('inbox').append(row);
    }
    if(!state.items.length)$('inbox').append(node('p','İlk yoxlamadan sonra tapılan yeni uyğun lotlar burada görünəcək.','empty'));
  } catch(e) { message(e.message,true); }
}
void load();
const scopeNote=node('p','Əhatə: axtarış səhifəsində yüklənmiş ilk 30 lot (Chrome) / 60 lot (server). Daha dəqiq izləmə üçün dar marka, model və il filtrləri seçin.','hint');
$('job-status').after(scopeNote);
