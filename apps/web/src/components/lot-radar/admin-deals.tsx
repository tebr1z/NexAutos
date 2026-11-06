"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowUpRight, Bell, CalendarClock, Check, Clock3, DollarSign, Loader2, Mail, MessageCircle, Pause, Play, Radar, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { auctionTimeLabel, RADAR_DAMAGES, radarCheckTime, radarUsd, type RadarDealSearch, type RadarMatch, type RadarState, type RadarWatch } from '@/lib/lot-radar';
import { useAuth } from '@/providers/auth-provider';

const inputClass = 'mt-2 w-full rounded-xl border border-white/10 bg-[#101013] px-3.5 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-blue-400/70 disabled:opacity-50';
const quietButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs text-zinc-300 transition hover:border-white/25 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40';

function priceCriteria(watch: RadarWatch) {
  const { maxBuyNowUsd, marketValueUsd, minDiscountPercent } = watch.filters;
  const criteria: string[] = [];
  if (maxBuyNowUsd != null) criteria.push(`Buy Now ≤ ${radarUsd(maxBuyNowUsd)}`);
  if (marketValueUsd != null && minDiscountPercent != null) criteria.push(`${radarUsd(marketValueUsd)} bazar qiymətindən ən azı ${minDiscountPercent}% aşağı`);
  return criteria.join(' və ');
}

export function AdminDeals() {
  const { user, loading: authLoading } = useAuth();
  const authorized = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [state, setState] = useState<RadarState | null>(null);
  const [matches, setMatches] = useState<RadarMatch[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const active = useRef(false);
  const session = useRef(0);
  const sequence = useRef(0);
  const actionPending = useRef(false);

  const load = useCallback(async () => {
    if (!active.current) return;
    const request = ++sequence.current;
    const currentSession = session.current;
    setRefreshing(true);
    try {
      const [data, inbox] = await Promise.all([api.adminRadarDeals(), api.radarInbox()]);
      if (!active.current || currentSession !== session.current || request !== sequence.current) return;
      setState(data);
      setMatches(inbox.filter((item) => item.watch.filters?.mode === 'buy_now'));
      setLoadError('');
    } catch (error) {
      if (active.current && currentSession === session.current && request === sequence.current) {
        setLoadError(error instanceof Error ? error.message : 'Buy Now qaydaları yüklənmədi.');
      }
    } finally {
      if (active.current && currentSession === session.current && request === sequence.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;
    active.current = true;
    session.current += 1;
    setState(null);
    setMatches([]);
    setLoadError('');
    setActionError('');
    setNotice('');
    setBusy(null);
    actionPending.current = false;
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      active.current = false;
      session.current += 1;
      sequence.current += 1;
      window.clearInterval(interval);
    };
  }, [authorized, user?.id, load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionPending.current || !state) return;
    setActionError('');
    setNotice('');
    const form = event.currentTarget;
    const values = new FormData(form);
    const text = (key: string) => String(values.get(key) ?? '').trim();
    const payload: RadarDealSearch = {
      name: text('name') || `${text('make')} ${text('model')} · Buy Now`.slice(0, 80),
      make: text('make'), model: text('model'),
      yearFrom: Number(text('yearFrom')), yearTo: Number(text('yearTo')),
      damages: values.getAll('damages').map(String), document: text('document'),
      emailEnabled: values.has('emailEnabled'), whatsappEnabled: values.has('whatsappEnabled'),
    };
    if (payload.yearFrom > payload.yearTo) { setActionError('Minimum il maksimum ildən böyük ola bilməz.'); return; }
    if (text('engineMin')) payload.engineMin = Math.round(Number(text('engineMin')) * 1000);
    if (text('engineMax')) payload.engineMax = Math.round(Number(text('engineMax')) * 1000);
    if (payload.engineMin != null && payload.engineMax != null && payload.engineMin > payload.engineMax) { setActionError('Minimum mühərrik maksimumdan böyük ola bilməz.'); return; }
    if (text('maxBuyNowUsd')) payload.maxBuyNowUsd = Number(text('maxBuyNowUsd'));
    if (text('marketValueUsd')) payload.marketValueUsd = Number(text('marketValueUsd'));
    if (text('minDiscountPercent') !== '') payload.minDiscountPercent = Number(text('minDiscountPercent'));
    if ((payload.marketValueUsd == null) !== (payload.minDiscountPercent == null)) { setActionError('Bazar qiyməti və minimum endirim faizi birlikdə daxil edilməlidir. 0% də seçilə bilər.'); return; }
    if (payload.maxBuyNowUsd == null && payload.marketValueUsd == null) { setActionError('Maksimum Buy Now qiymətini və ya bazar qiyməti + minimum endirim cütünü daxil edin.'); return; }
    actionPending.current = true;
    setBusy('create');
    const currentSession = session.current;
    try {
      await api.createAdminRadarDeal(payload);
      if (!active.current || currentSession !== session.current) return;
      form.reset();
      setNotice('Qayda saxlanıldı. İlk uğurlu yoxlamada da qiymət şərtinə uyğun lotlar bildiriləcək.');
      await load();
    } catch (error) {
      if (active.current && currentSession === session.current) setActionError(error instanceof Error ? error.message : 'Qayda yaradılmadı.');
    } finally {
      if (active.current && currentSession === session.current) { actionPending.current = false; setBusy(null); }
    }
  }

  async function change(watch: RadarWatch, action: 'toggle' | 'delete' | 'check') {
    if (actionPending.current) return;
    if (action === 'delete' && !window.confirm(`“${watch.name}” qaydası və tarixçəsi silinsin? Aylıq istifadə sayı geri qaytarılmır.`)) return;
    actionPending.current = true;
    setBusy(watch.id);
    setActionError('');
    setNotice('');
    const currentSession = session.current;
    try {
      if (action === 'delete') await api.deleteRadarWatch(watch.id);
      else if (action === 'toggle') await api.toggleRadarWatch(watch.id, !watch.enabled);
      else await api.checkRadarWatch(watch.id);
      if (!active.current || currentSession !== session.current) return;
      if (action === 'check') setNotice('Tək yoxlama sorğusu göndərildi. Mənbə və növbə vəziyyətinə görə nəticə aşağıda yenilənəcək.');
      await load();
    } catch (error) {
      if (active.current && currentSession === session.current) setActionError(error instanceof Error ? error.message : 'Əməliyyat alınmadı.');
    } finally {
      if (active.current && currentSession === session.current) { actionPending.current = false; setBusy(null); }
    }
  }

  if (authLoading) return <p className="text-sm text-zinc-400">Hesab yoxlanılır…</p>;
  if (!authorized) return <p role="alert" className="text-sm text-amber-400">Bu bölmə yalnız administrator üçündür.</p>;

  const cadence = state?.delivery.pollIntervalMinutes ?? 20;
  const atLimit = !state?.plan.enabled || state.plan.active >= state.plan.watchLimit;
  const blocked = state?.watches.filter((watch) => watch.enabled && watch.lastError) ?? [];
  const sourceFeed = state?.delivery.sourceMode === 'feed';

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-5">
      <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-blue-400"><Radar size={16} /> Buy Now Radar</p><h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Yaxşı qiyməti qaçırmayın</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Maşının şərtlərini və sizə uyğun alış qiymətini təyin edin. Tapılan uyğun Buy Now lotları öz admin hesabınıza bildirilsin.</p></div>
      <button type="button" onClick={() => void load()} disabled={refreshing} className={quietButton}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />Paneli yenilə</button>
    </header>

    {loadError && <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{loadError} Saxlanmış məlumat göstərilə bilər; bu, yeni uğurlu yoxlama demək deyil.</p>}
    {actionError && <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{actionError}</p>}
    {notice && <p role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-300"><Check size={17} className="mt-0.5 shrink-0" />{notice}</p>}

    {!state ? !loadError && <div className="flex items-center gap-3 rounded-2xl border border-white/10 p-8 text-sm text-zinc-400"><Loader2 size={18} className="animate-spin" />Qaydalar yüklənir…</div> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        {[{ label: 'Hesab üzrə aktiv axtarış', value: `${state.plan.active} / ${state.plan.watchLimit}`, detail: 'Müştəri istəkləri və admin qaydaları birlikdə' }, { label: `${state.plan.month} · bildiriş limiti`, value: `${state.plan.used} / ${state.plan.monthlyAlertLimit}`, detail: `${state.plan.remaining} yeni lot bildirişi qalıb` }, { label: 'Avtomatik yoxlama intervalı', value: `${cadence} dəqiqə`, detail: 'Real-time deyil · növbə əlavə gecikmə yarada bilər' }].map((card) => <div key={card.label} className="rounded-2xl border border-white/10 bg-[#101013] p-5"><p className="text-xs text-zinc-500">{card.label}</p><p className="mt-3 text-2xl font-semibold tracking-tight">{card.value}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{card.detail}</p></div>)}
      </div>
      {state.plan.remaining === 0 && <p role="status" className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-6 text-amber-300">Bu ayın bildiriş limiti dolub. Yeni uyğun lot üçün bildiriş ayrılmayacaq; limiti istifadəçi idarəetməsindən dəyişə bilərsiniz. Axtarışı silmək istifadə sayını geri qaytarmır.</p>}

      <section aria-label="Məlumat mənbəyinin vəziyyəti" className={`rounded-2xl border p-5 ${blocked.length || !state.delivery.serverMonitoring ? 'border-amber-400/25 bg-amber-400/5' : 'border-white/10 bg-[#101013]'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={17} className="text-blue-400" />Mənbə və server vəziyyəti</h2><span className={`rounded-full px-3 py-1 text-xs ${state.delivery.serverMonitoring ? 'bg-blue-400/10 text-blue-300' : 'bg-amber-400/10 text-amber-300'}`}>{state.delivery.serverMonitoring ? 'Server yoxlaması aktivdir' : 'Server yoxlaması bağlıdır'}</span></div>
        <p className="mt-3 text-sm text-zinc-300">Mənbə: {sourceFeed ? 'Serverdə konfiqurasiya edilmiş feed' : 'BidCars açıq səhifələri · birbaşa server oxuması'}</p>
        <p className="mt-2 text-xs leading-6 text-zinc-400">{sourceFeed ? 'Feed-in əlçatanlığı, məlumatın yeniliyi və icazələri ayrıca təmin edilməlidir.' : 'BidCars server sorğusuna Cloudflare yoxlaması və ya boş JavaScript səhifəsi qaytara bilər. Belə halda aşağıdakı xəta mənbənin oxunmadığını göstərir, “uyğun maşın yoxdur” demək deyil. Alternativ: Lot Radar 1.2-də “Admin kollektoru”nu aktiv edin. Adminin Chrome-u açıq və extension hesaba bağlı olduqda təsdiqlənmiş müştəri axtarışları da mərkəzləşdirilmiş yoxlanır; müştərinin Chrome-u açıq olmalı deyil.'} Panelin yenilənməsi yeni skan başlatmır.</p>
        {!state.delivery.serverMonitoring && <p className="mt-2 text-xs leading-6 text-amber-300">Server yoxlaması bağlıdır. Admin kollektoru olmadan avtomatik toplama aparılmır. Bütün brauzerlər bağlı halda işləmək üçün əlçatan icazəli feed və aktiv server izləməsi lazımdır. Qaydanın saxlanması mənbə bağlantısını aktivləşdirmir.</p>}
        {blocked.length > 0 && <div className="mt-3 space-y-2">{blocked.map((watch) => <p key={watch.id} className="flex items-start gap-2 text-xs leading-5 text-amber-300"><AlertCircle size={14} className="mt-0.5 shrink-0" /><span><strong>{watch.name}:</strong> {watch.lastError}</span></p>)}</div>}
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <form onSubmit={create} className="rounded-3xl border border-white/10 bg-[#101013] p-5 sm:p-7">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-blue-400/10 p-2.5 text-blue-400"><DollarSign size={19} /></span><div><h2 className="font-semibold">Yeni qiymət qaydası</h2><p className="mt-1 text-xs text-zinc-500">Şərtləri siz təyin edirsiniz</p></div></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">Marka<input name="make" required minLength={2} maxLength={50} placeholder="Toyota" className={inputClass} /></label>
            <label className="text-xs text-zinc-400">Model<input name="model" required maxLength={60} placeholder="Camry" className={inputClass} /></label>
            <label className="text-xs text-zinc-400">Minimum il<input name="yearFrom" type="number" required min={1950} max={2100} defaultValue={2018} className={inputClass} /></label>
            <label className="text-xs text-zinc-400">Maksimum il<input name="yearTo" type="number" required min={1950} max={2100} defaultValue={new Date().getFullYear() + 1} className={inputClass} /></label>
            <label className="text-xs text-zinc-400">Minimum mühərrik, litr<input name="engineMin" type="number" min={0} max={20} step={0.1} placeholder="İstənilən" className={inputClass} /></label>
            <label className="text-xs text-zinc-400">Maksimum mühərrik, litr<input name="engineMax" type="number" min={0} max={20} step={0.1} placeholder="İstənilən" className={inputClass} /></label>
          </div>
          <fieldset className="mt-5"><legend className="text-xs text-zinc-400">Zədə · boş buraxsanız istənilən, seçsəniz ən azı biri uyğun olsun</legend><div className="mt-3 flex flex-wrap gap-2">{Object.entries(RADAR_DAMAGES).map(([value, label]) => <label key={value} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300"><input type="checkbox" name="damages" value={value} className="accent-blue-500" />{label}</label>)}</div></fieldset>
          <label className="mt-5 block text-xs text-zinc-400">Sənəd vəziyyəti<select name="document" className={inputClass}><option value="any">Hamısı</option><option value="clean">Clean / təmiz title</option><option value="salvage">Salvage / rebuilt</option><option value="restricted">Məhdudiyyətli / yüksək risk</option><option value="unknown">Məlumat naməlumdur</option></select></label>

          <fieldset className="mt-6 rounded-2xl border border-blue-400/20 bg-blue-400/5 p-4"><legend className="px-1 text-xs font-semibold text-blue-300">Buy Now qiyməti · USD</legend>
            <label className="block text-xs text-zinc-400">Maksimum Buy Now<input name="maxBuyNowUsd" type="number" min={1} max={10000000} step={0.01} placeholder="Məsələn: 7 000" className={inputClass} /></label>
            <p className="my-4 text-center text-[11px] uppercase tracking-widest text-zinc-500">və ya bazara görə hədd</p>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-zinc-400">Sizin bazar qiymətiniz, USD<input name="marketValueUsd" type="number" min={1} max={10000000} step={0.01} placeholder="Məsələn: 12 000" className={inputClass} /></label><label className="text-xs text-zinc-400">Minimum ucuzluq, %<input name="minDiscountPercent" type="number" min={0} max={99.99} step={0.01} placeholder="Məsələn: 30" className={inputClass} /></label></div>
            <p className="mt-3 text-xs leading-5 text-zinc-400">Bazar qiyməti avtomatik qiymətləndirmə deyil, sizin təyin etdiyiniz istinaddır. Son iki sahə birlikdə doldurulur. Hər iki qiymət üsulunu seçsəniz, hər ikisi uyğun olmalıdır. Daşınma, gömrük və təmir daxil deyil.</p>
          </fieldset>
          <label className="mt-5 block text-xs text-zinc-400">Qaydanın adı (istəyə bağlı)<input name="name" maxLength={80} placeholder="Camry · sərfəli Buy Now" className={inputClass} /></label>

          <fieldset className="mt-6 border-t border-white/10 pt-5"><legend className="text-xs font-medium text-zinc-300">Bildiriş mənim admin hesabıma gəlsin</legend>
            <div className="mt-3 space-y-3"><label className="flex items-center gap-3 text-sm"><input name="whatsappEnabled" type="checkbox" disabled={!state.delivery.phone} className="accent-blue-500" /><MessageCircle size={16} className="text-zinc-500" /><span>WhatsApp <span className="text-xs text-zinc-500">{state.delivery.phone || '— hesabınıza nömrə təyin edilməyib'}</span></span></label><label className="flex items-center gap-3 text-sm"><input name="emailEnabled" type="checkbox" className="accent-blue-500" /><Mail size={16} className="text-zinc-500" /><span>E-poçt <span className="text-xs text-zinc-500">{state.delivery.email}</span></span></label></div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">Yalnız öz hesabınızın ünvanlarına göndərilir; başqa alıcı daxil edilmir. Panel bildirişi həmişə saxlanılır. Kanalları seçərək bu lot bildirişlərinə razılıq verirsiniz.</p>
            {(!state.delivery.emailReady || !state.delivery.whatsappReady || !state.delivery.phone) && <p className="mt-3 rounded-xl bg-amber-400/5 p-3 text-xs leading-5 text-amber-300">{!state.delivery.whatsappReady ? 'WhatsApp xidməti hazır deyil. ' : ''}{!state.delivery.emailReady ? 'E-poçt xidməti hazır deyil. ' : ''}{!state.delivery.phone ? 'WhatsApp üçün admin hesabınıza nömrə əlavə edin. ' : ''}Qaydanı saxlamaq kanalları avtomatik quraşdırmır.</p>}
          </fieldset>
          <button disabled={!!busy || atLimit} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3.5 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40">{busy === 'create' ? <Loader2 size={17} className="animate-spin" /> : <Radar size={17} />}{atLimit ? state.plan.enabled ? 'Hesabın aktiv axtarış limiti dolub' : 'Hesab üçün Lot Radar bağlıdır' : 'Qaydanı yarat'}</button>
        </form>

        <div className="space-y-5">
          <section className="rounded-3xl border border-white/10 bg-[#101013] p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="font-semibold">Mənim Buy Now qaydalarım</h2><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-400">{state.watches.length}</span></div>
            {!state.watches.length && <div className="py-10 text-center"><Radar size={30} className="mx-auto text-zinc-700" /><p className="mt-3 text-sm text-zinc-400">Hələ qiymət qaydası yoxdur</p><p className="mt-2 text-xs text-zinc-600">Soldakı formadan ilk qiymət həddini təyin edin.</p></div>}
            <div className="mt-4 space-y-4">{state.watches.map((watch) => <article key={watch.id} className="rounded-2xl border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{watch.name}</h3><p className="mt-1 text-xs text-zinc-500">{watch.filters.make} {watch.filters.model} · {watch.filters.yearFrom}–{watch.filters.yearTo}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${watch.enabled ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-zinc-500'}`}>{watch.enabled ? 'Aktiv' : 'Dayandırılıb'}</span></div>
              <p className="mt-3 text-sm leading-6 text-blue-300">{priceCriteria(watch)}</p>
              <div className="mt-3 space-y-1 text-xs leading-5 text-zinc-500"><p>Son yoxlama: {watch.checkedAt ? radarCheckTime(watch.checkedAt) : 'Hələ yoxlanmayıb'}</p><p>Növbəti yoxlama: {watch.enabled ? radarCheckTime(watch.nextCheckAt) : 'Qayda dayandırılıb'}</p>{watch.lastSource && <p>Son uğurlu mənbə: {watch.lastSource === 'browser' ? 'Chrome / extension' : watch.lastSource === 'feed' ? 'Server feed' : 'Birbaşa server'}</p>}<p>Kanallar: panel{watch.whatsappEnabled ? ' · WhatsApp' : ''}{watch.emailEnabled ? ' · e-poçt' : ''}</p></div>
              {watch.lastError && <p role="status" className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-xs leading-5 text-amber-300">{watch.lastError}</p>}
              {!watch.initializedAt && !watch.lastError && <p className="mt-3 text-xs text-zinc-500">İlk uğurlu skan gözlənilir.</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" disabled={!!busy || !watch.enabled} onClick={() => void change(watch, 'check')} className={quietButton}><RefreshCw size={13} className={busy === watch.id ? 'animate-spin' : ''} />İndi yoxla</button><button type="button" disabled={!!busy} onClick={() => void change(watch, 'toggle')} className={quietButton}>{watch.enabled ? <Pause size={13} /> : <Play size={13} />}{watch.enabled ? 'Dayandır' : 'Aktiv et'}</button><button type="button" disabled={!!busy} onClick={() => void change(watch, 'delete')} className={`${quietButton} text-red-300`} aria-label={`${watch.name} qaydasını sil`}><Trash2 size={13} /></button><a href={watch.searchUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white">BidCars<ArrowUpRight size={13} /></a></div>
            </article>)}</div>
          </section>
          <div className="rounded-2xl border border-white/10 p-5"><h3 className="flex items-center gap-2 text-xs font-semibold text-zinc-300"><Clock3 size={15} />Bildiriş nə vaxt gəlir?</h3><p className="mt-3 text-xs leading-6 text-zinc-500">Yoxlama təxminən hər {cadence} dəqiqədə aparılır: dəyişiklik həmin interval və növbə gecikməsi ilə aşkarlanır, real-time deyil. Uyğun Buy Now ilk skanda da bildirilir. Sonradan qiymət həddi keçilərsə də lot hər qayda üzrə yalnız bir dəfə bildirilir. Naməlum qiymət uyğun sayılmır. Aktiv axtarış və aylıq bildiriş limitləri hesabın digər axtarışları ilə ortaqdır.</p><p className="mt-3 text-xs leading-6 text-zinc-500">Mənbə bütün inventarı təmin etməyə bilər. Hərrac vaxtını, sənədi və real alınma qiymətini lotda yenidən yoxlayın.</p></div>
        </div>
      </div>

      <section className="rounded-3xl border border-white/10 bg-[#101013] p-5 sm:p-7"><h2 className="flex items-center gap-2 font-semibold"><Bell size={18} className="text-blue-400" />Qiymətə uyğun tapılan lotlar</h2><p className="mt-2 text-xs text-zinc-500">Yalnız öz admin qaydalarınızın bildirişləri. Bir lot bir neçə fərqli qaydaya uyğun ola bilər.</p>
        {!matches.length && <p className="mt-5 text-sm leading-6 text-zinc-400">Hələ bildiriş yoxdur. Bu, mənbədə uyğun avtomobil olmadığına zəmanət vermir; yuxarıdakı son yoxlama və xəta vəziyyətinə baxın.</p>}
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{matches.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-[#0b0b0e] p-5"><p className="text-[11px] text-zinc-500">{item.watch.name}</p><a href={item.data.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-start gap-1 text-sm font-semibold leading-6 text-zinc-100 hover:text-blue-300">{item.data.title}<ArrowUpRight size={15} className="mt-1 shrink-0" /></a><p className="mt-4 text-xl font-semibold text-blue-300">{item.data.buyNowUsd != null ? radarUsd(item.data.buyNowUsd) : 'Qiymət göstərilməyib'}<span className="ml-2 text-xs font-normal text-zinc-500">Buy Now</span></p><p className="mt-3 flex items-start gap-2 text-xs leading-5 text-zinc-400"><CalendarClock size={14} className="mt-0.5 shrink-0" />{auctionTimeLabel(item.data)}</p><p className="mt-3 text-xs leading-5 text-zinc-500">Zədə: {item.data.primaryDamage || 'Naməlum'} / {item.data.secondaryDamage || '—'}</p><p className="mt-1 text-xs text-zinc-500">Sənəd: {item.data.document || 'Naməlum'}</p><p className="mt-3 text-[11px] leading-5 text-zinc-500">WhatsApp: {item.whatsappSentAt ? 'Göndərildi' : item.whatsappError ? 'Göndərmə alınmadı' : 'Seçilməyib / növbədədir'}<br />E-poçt: {item.emailSentAt ? 'Göndərildi' : item.emailError ? 'Göndərmə alınmadı' : 'Seçilməyib / növbədədir'}</p></article>)}</div>
      </section>
    </>}
  </div>;
}
