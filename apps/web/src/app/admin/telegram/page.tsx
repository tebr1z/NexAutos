"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, ArrowRight, Bot, Check, ChevronRight, Container, ExternalLink, KeyRound, Link2, LoaderCircle, LockKeyhole, RefreshCw, Search, Send, ShieldCheck, Trash2, Unplug, Users } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { safeTelegramPairUrl, telegramHealth, telegramSafeError, type TelegramPair, type TelegramStatus } from "@/lib/telegram";

const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40";
type Confirmation = { kind: "clear" } | { kind: "revoke"; userId?: string; label: string };

function dateLabel(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Hələ yoxdur";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function StepTitle({ number, title, subtitle, done }: { number: string; title: string; subtitle: string; done?: boolean }) {
  return <div className="flex items-start gap-3"><span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold", done ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-zinc-400")}>{done ? <Check size={17} /> : number}</span><div><h2 className="text-base font-semibold text-white">{title}</h2><p className="mt-1 text-sm leading-6 text-zinc-400">{subtitle}</p></div></div>;
}

export default function AdminTelegramPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [token, setToken] = useState("");
  const [pair, setPair] = useState<TelegramPair | null>(null);
  const [now, setNow] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [operation, setOperation] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);
  const revision = useRef(0);
  const operating = useRef(false);
  const fetching = useRef<number | null>(null);
  const health = telegramHealth(status, now);
  const canManage = Boolean(status?.canManage && (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"));
  const pairUrl = health.key === "active" ? safeTelegramPairUrl(pair, status?.botUsername, now) : null;
  const busy = operation !== null;

  const load = useCallback(async () => {
    if (operating.current || fetching.current === revision.current) return;
    fetching.current = revision.current;
    const ticket = revision.current;
    setRefreshing(true);
    try {
      const next = await api.telegramStatus();
      if (!mounted.current || ticket !== revision.current) return;
      setStatus(next);
      setNow(Date.now());
      setError("");
      if (next.linkedAccount || !next.configured || !next.enabled) setPair(null);
    } catch (err) {
      if (mounted.current && ticket === revision.current) setError(telegramSafeError(err));
    } finally {
      if (fetching.current === ticket) fetching.current = null;
      if (mounted.current && ticket === revision.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; revision.current += 1; };
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), pair ? 1_000 : 15_000);
    return () => clearInterval(timer);
  }, [pair]);

  useEffect(() => {
    if (!pair || status?.linkedAccount || !status?.enabled || Date.parse(pair.expiresAt) <= Date.now()) return;
    const timer = setInterval(() => {
      if (Date.parse(pair.expiresAt) <= Date.now()) { clearInterval(timer); return; }
      void load();
    }, 5_000);
    return () => clearInterval(timer);
  }, [pair, status?.linkedAccount, status?.enabled, load]);

  async function perform(name: string, action: () => Promise<void>) {
    if (operating.current) return;
    operating.current = true;
    revision.current += 1;
    setRefreshing(false);
    setOperation(name);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      if (mounted.current) setError(telegramSafeError(err));
    } finally {
      operating.current = false;
      if (mounted.current) { setOperation(null); setNow(Date.now()); }
    }
  }

  async function saveToken(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !token.trim() || !status?.encryptionReady || operating.current) return;
    const value = token.trim();
    setToken("");
    setPair(null);
    await perform("token", async () => {
      const next = await api.saveTelegramConfig({ token: value });
      if (!mounted.current) return;
      setStatus(next);
      setNotice(next.enabled ? "Token yoxlanıb saxlanıldı. Botun vəziyyətini yeniləyərək bağlantını yoxlayın." : "Token yoxlanıb saxlanıldı. İndi botu aktivləşdirin, sonra öz Telegram hesabınızı bağlayın.");
    });
  }

  async function toggleBot() {
    if (!canManage || !status?.configured) return;
    const enabled = !status.enabled;
    setPair(null);
    await perform("toggle", async () => {
      const next = await api.saveTelegramConfig({ enabled });
      if (!mounted.current) return;
      setStatus(next);
      setNotice(enabled ? "Bot aktivləşdirildi. Bağlantını yoxlamaq üçün bir neçə saniyə sonra vəziyyəti yeniləyin." : "Bot dayandırıldı. Telegram-dan yeni əməliyyat qəbul edilmir.");
    });
  }

  async function createPair() {
    if (health.key !== "active" || status?.linkedAccount) return;
    setPair(null);
    await perform("pair", async () => {
      const next = await api.createTelegramPair();
      if (!mounted.current) return;
      if (!safeTelegramPairUrl(next, status?.botUsername, Date.now())) throw new Error("Təhlükəsiz bağlantı yaradılmadı. Vəziyyəti yeniləyib təkrar cəhd edin.");
      setPair(next);
      setNotice("Bağlantı hazırdır. Aşağıdakı düymə ilə öz Telegram hesabınızdan botu açıb Start düyməsinə basın.");
    });
  }

  async function confirmAction() {
    if (!confirmation) return;
    const action = confirmation;
    await perform("revoke", async () => {
      if (action.kind === "clear") {
        if (!canManage) return;
        const next = await api.saveTelegramConfig({ clear: true });
        if (!mounted.current) return;
        setStatus(next);
        setToken("");
        setPair(null);
        setNotice("Bot dayandırıldı və saxlanmış token silindi.");
      } else {
        await api.revokeTelegramLink(action.userId);
        const next = await api.telegramStatus();
        if (!mounted.current) return;
        setStatus(next);
        if (!action.userId || action.userId === user?.id) setPair(null);
        setNotice("Telegram bağlantısı ləğv edildi. Bu hesabın botdan idarəetmə girişi bağlandı.");
      }
      if (mounted.current) setConfirmation(null);
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-400/15 bg-sky-400/5 px-3 py-1 text-xs text-sky-300"><Send size={13} /> Mobil əməliyyat mərkəzi</div><h1 className="font-display text-3xl text-white sm:text-4xl">Telegram-dan idarə edin</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Müştərini tapın, maşını seçin, daşınma mərhələsini yeniləyin. Dəyişikliklər eyni izləmə səhifəsinə düşür — ayrıca məlumat bazası yoxdur.</p></div>
        <button type="button" onClick={() => void load()} disabled={busy || refreshing} className={secondaryButton}><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />{refreshing ? "Yoxlanılır…" : "Vəziyyəti yenilə"}</button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-sky-400/10 p-2.5 text-sky-300"><Bot size={22} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{status?.botName || "Auto Nex əməliyyat botu"}</p><p className="mt-1 text-xs text-zinc-500">{status?.botUsername ? `@${status.botUsername}` : "Telegram bot hələ qoşulmayıb"}</p></div></div>
        <div className="flex flex-wrap items-center gap-3"><span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium", health.tone === "success" ? "bg-emerald-400/10 text-emerald-300" : health.tone === "warning" ? "bg-amber-400/10 text-amber-300" : "bg-white/5 text-zinc-400")}><span className="h-1.5 w-1.5 rounded-full bg-current" />{!status && error ? "Məlumat alınmadı" : health.label}</span><span className="text-xs text-zinc-500">Son əlaqə: {dateLabel(status?.lastPollAt)}</span></div>
      </div>

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm leading-6 text-red-300"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{error}</p></div>}
      {notice && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm leading-6 text-emerald-200">{notice}</p>}
      {status?.lastError && <div role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-200"><p className="font-medium">Botla əlaqə təsdiqlənmir</p><p className="mt-1 break-words">{telegramSafeError(new Error(status.lastError))}</p><p className="mt-2 text-xs text-amber-200/70">Tokeni və server bağlantısını yoxlayın. Bu bot başqa proqramda işləyirsə, eyni vaxtda iki qoşulma istifadə etməyin.</p></div>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-[#0d0d10] p-5 sm:p-6">
            <StepTitle number="1" title="Botunuzu yaradın" subtitle="Bu addım yalnız bir dəfə, şirkətə aid Telegram hesabından edilir." done={status?.configured} />
            <div className="mt-5 rounded-xl bg-white/[0.025] p-4 text-sm leading-6 text-zinc-400"><p>Rəsmi <span className="text-zinc-200">@BotFather</span> botunu açın, <code className="rounded bg-white/5 px-1.5 py-0.5 text-sky-200">/newbot</code> yazın. Ad və sonu <code className="text-zinc-200">bot</code> ilə bitən istifadəçi adı seçin.</p><p className="mt-2">BotFather-in verdiyi tokeni yalnız aşağıdakı qorunan sahəyə daxil edin. Tokeni çata, qrupa və ya müştəriyə göndərməyin.</p></div>
            <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className={cn(secondaryButton, "mt-4")}><ExternalLink size={15} />BotFather-i aç</a>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0d0d10] p-5 sm:p-6">
            <StepTitle number="2" title="Botu sistemə qoşun" subtitle={canManage ? "Tokeni saxlayın, sonra botu aktivləşdirin. Serveri yenidən başlatmaq lazım deyil." : "Bu addımı baş administrator və ya administrator tamamlayır."} done={health.key === "active"} />
            {canManage ? <>
              {!status?.encryptionReady && <p className="mt-4 rounded-xl bg-amber-400/10 p-3 text-sm leading-6 text-amber-200">Serverin token şifrələmə ayarı hazır deyil. Administrator server konfiqurasiyasını tamamlamadan token saxlamaq mümkün deyil.</p>}
              <form onSubmit={saveToken} className="mt-5 space-y-3">
                <label htmlFor="telegram-token" className="flex items-center gap-2 text-sm text-zinc-300"><KeyRound size={15} />{status?.configured ? "Yeni token (yalnız dəyişmək üçün)" : "BotFather tokeni"}</label>
                <input id="telegram-token" name="telegram-bot-credential" type="password" value={token} onChange={event => setToken(event.target.value)} disabled={busy || !status?.encryptionReady} autoComplete="off" spellCheck={false} data-lpignore="true" data-1p-ignore="true" placeholder="Tokeni buraya daxil edin" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/50 disabled:opacity-40" aria-describedby="telegram-token-help" />
                <p id="telegram-token-help" className="flex items-start gap-2 text-xs leading-5 text-zinc-500"><LockKeyhole size={13} className="mt-0.5 shrink-0" />Token serverdə şifrəli saxlanılır, geri göstərilmir və brauzer yaddaşına yazılmır.</p>
                {status?.configured && <p className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200/80">Başqa bota aid token saxlasanız, bütün əməkdaşların mövcud Telegram bağlantıları ləğv olunur və hesablar yenidən bağlanmalıdır. Eyni botun yenilənmiş tokeni ilə bağlantılar saxlanılır.</p>}
                <button type="submit" disabled={busy || !token.trim() || !status?.encryptionReady} className={secondaryButton}>{operation === "token" ? <LoaderCircle size={15} className="animate-spin" /> : <ShieldCheck size={15} />}Tokeni yoxla və saxla</button>
              </form>
              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5"><button type="button" onClick={() => void toggleBot()} disabled={busy || !status?.configured || (!status.enabled && !status.encryptionReady)} className={status?.enabled ? secondaryButton : primaryButton}>{operation === "toggle" ? <LoaderCircle size={15} className="animate-spin" /> : <Bot size={15} />}{status?.enabled ? "Botu dayandır" : "Botu aktivləşdir"}</button>{status?.configured && <button type="button" onClick={() => setConfirmation({ kind: "clear" })} disabled={busy} className="inline-flex items-center gap-2 px-1 py-2 text-xs text-zinc-500 hover:text-red-300 disabled:opacity-40"><Trash2 size={13} />Tokeni sil</button>}</div>
            </> : <p className="mt-5 rounded-xl bg-white/[0.025] p-4 text-sm leading-6 text-zinc-400">{health.key === "active" ? "Bot hazırdır. Aşağıdakı addımda öz Telegram hesabınızı təhlükəsiz bağlaya bilərsiniz." : "Bot hazır olduqda aşağıdakı addımdan öz Telegram hesabınızı bağlaya biləcəksiniz. Token və ümumi bot ayarlarına yalnız administrator giriş edə bilər."}</p>}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0d0d10] p-5 sm:p-6">
            <StepTitle number="3" title="Öz Telegram hesabınızı bağlayın" subtitle="Hər əməkdaş öz admin hesabından fərdi bağlantı yaradır. Bot yalnız icazəli şəxsi çatlarda işləyir." done={Boolean(status?.linkedAccount)} />
            {status?.linkedAccount ? <div className="mt-5 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-medium text-emerald-200"><Check size={16} />Telegram hesabınız bağlıdır</p><p className="mt-2 text-sm text-zinc-300">{status.linkedAccount.username ? `@${status.linkedAccount.username}` : "Şəxsi Telegram hesabı"}</p><p className="mt-1 break-all text-xs text-zinc-500">ID: {status.linkedAccount.telegramUserId} · {dateLabel(status.linkedAccount.linkedAt)}</p></div><button type="button" disabled={busy} onClick={() => setConfirmation({ kind: "revoke", label: "Öz Telegram hesabınızın bağlantısı" })} className={cn(secondaryButton, "text-xs")}><Unplug size={14} />Bağlantını ləğv et</button></div><p className="mt-3 text-xs leading-5 text-zinc-400">{status.enabled ? "Telegram-da botu açıb /menu yazın. Hər dəyişiklikdən əvvəl təsdiq istənilir." : "Bağlantınız saxlanılır, amma bot hazırda dayandırılıb."}</p></div> : <>
              <div className="mt-5 flex items-start gap-3 rounded-xl bg-white/[0.025] p-4"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-sky-300" /><p className="text-sm leading-6 text-zinc-400">Bu link idarəetmə icazəsi verir. Onu yalnız öz Telegram hesabınızda açın. Başqa şəxsə göndərməyin — birdəfəlikdir və 10 dəqiqəyə bitir.</p></div>
              {pairUrl ? <div className="mt-4 space-y-3"><a href={pairUrl} target="_blank" rel="noopener noreferrer" className={primaryButton}><Send size={15} />Telegram-da bağla<ExternalLink size={13} /></a><p className="text-xs leading-5 text-zinc-400">Telegram açıldıqda <span className="text-white">Start / Başla</span> düyməsinə basın. Qalan vaxt: {Math.max(1, Math.ceil((Date.parse(pair!.expiresAt) - now) / 60_000))} dəqiqə. Bağlantı bu səhifədə avtomatik yoxlanılır.</p></div> : <div className="mt-4 space-y-3">{pair && <p role="status" className="text-sm text-amber-300">Bağlantının vaxtı bitib. Yeni birdəfəlik link yaradın.</p>}<button type="button" disabled={busy || health.key !== "active"} onClick={() => void createPair()} className={primaryButton}>{operation === "pair" ? <LoaderCircle size={15} className="animate-spin" /> : <Link2 size={15} />}Şəxsi bağlantı yarat</button>{health.key !== "active" && <p className="text-xs leading-5 text-zinc-500">Əvvəl botun aktiv və əlaqənin işlək olması təsdiqlənməlidir. Botu qoşduqdan sonra «Vəziyyəti yenilə» basın.</p>}</div>}
            </>}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-sky-400/15 bg-gradient-to-b from-sky-400/[0.06] to-[#0d0d10] p-5 sm:p-6"><div className="flex items-center gap-2 text-sky-300"><Bot size={19} /><h2 className="font-semibold text-white">Telefondan iş axını</h2></div><div className="mt-6 space-y-4">{[{ icon: Users, title: "Müştərini tapın", text: "Ad və ya telefonla axtarın, ona aid maşınları görün." }, { icon: Search, title: "Düzgün maşını seçin", text: "VIN, lot, izləmə və ya konteyner kodu ilə də axtara bilərsiniz." }, { icon: Container, title: "Mərhələni yeniləyin", text: "Maşının mərhələsini, konteyner kodunu və daşıyıcı linkini dəyişin." }, { icon: ShieldCheck, title: "Baxın və təsdiqləyin", text: "Köhnə və yeni məlumatı yoxlayın. Təsdiqsiz dəyişiklik yazılmır." }].map((item, index) => <div key={item.title} className="flex gap-3"><div className="flex flex-col items-center gap-2"><span className="rounded-lg border border-white/10 bg-black/20 p-2 text-sky-300"><item.icon size={16} /></span>{index < 3 && <span className="h-5 w-px bg-white/10" />}</div><div><h3 className="text-sm font-medium text-zinc-200">{item.title}</h3><p className="mt-1 text-xs leading-5 text-zinc-500">{item.text}</p></div></div>)}</div></section>
          <section className="rounded-2xl border border-white/10 bg-[#0d0d10] p-5"><h2 className="text-sm font-semibold text-white">Botun qısa komandaları</h2><dl className="mt-4 space-y-3 text-xs">{[["/menu", "Əsas idarəetmə menyusu"], ["/search", "Maşın axtarışı"], ["/customers", "Müştəriyə görə maşınlar"], ["/containers", "Konteynerə görə maşınlar"], ["/cancel", "Cari əməliyyatı dayandır"], ["/help", "İstifadə qaydası"]].map(([command, description]) => <div key={command} className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt className="font-mono text-sky-300">{command}</dt><dd className="text-zinc-500">{description}</dd></div>)}</dl></section>
          <div className="rounded-2xl border border-white/10 p-5"><p className="flex items-center gap-2 text-sm font-medium text-zinc-200"><ArrowRight size={16} className="text-emerald-300" />Müştəriyə nə görünür?</p><p className="mt-3 text-xs leading-6 text-zinc-500">Təsdiqlənən dəyişikliklər mövcud izləmə linkində görünür. Mərhələ bildirişləri sistemin hazırkı WhatsApp/SMS qaydalarına əsasən göndərilir; hər düzəliş avtomatik mesaj demək deyil.</p><p className="mt-3 border-t border-white/10 pt-3 text-xs leading-6 text-zinc-500">Bu bot müştərilər üçün deyil, səlahiyyətli əməkdaşlar üçündür. Müştərinin şəxsi məlumatlarını ümumi Telegram qruplarına göndərmir.</p></div>
        </aside>
      </div>

      {canManage && <section className="rounded-2xl border border-white/10 bg-[#0d0d10] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-base font-semibold text-white"><Users size={18} className="text-zinc-400" />İcazəli Telegram hesabları</h2><p className="mt-2 text-sm text-zinc-500">Əməkdaş ayrıldıqda bot girişini buradan dərhal ləğv edin.</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400">{status?.accounts?.length ?? 0} hesab</span></div>{status?.accounts?.length ? <ul className="mt-5 divide-y divide-white/10">{status.accounts.map(account => <li key={account.userId} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words text-sm text-zinc-200">{account.name}{account.userId === user?.id && <span className="ml-2 text-xs text-zinc-500">Siz</span>}</p><p className="mt-1 break-all text-xs text-zinc-500">{account.email}</p><p className="mt-1 break-all text-xs text-zinc-400">{account.username ? `@${account.username}` : "Telegram hesabı"} · ID: {account.telegramUserId}</p></div><button type="button" disabled={busy} onClick={() => setConfirmation({ kind: "revoke", userId: account.userId, label: `${account.name} — Telegram bağlantısı` })} className={cn(secondaryButton, "text-xs")}><Unplug size={14} />Girişi ləğv et</button></li>)}</ul> : <p className="mt-5 rounded-xl bg-white/[0.025] p-4 text-sm text-zinc-500">Hələ heç bir Telegram hesabı bağlanmayıb. Əvvəl öz hesabınız üçün 3-cü addımı tamamlayın.</p>}</section>}

      <Dialog.Root open={Boolean(confirmation)} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-red-400/25 bg-[#1a0e11] p-5 shadow-2xl outline-none">
            <Dialog.Title className="font-semibold text-red-200">{confirmation?.kind === "clear" ? "Botun tokeni silinsin?" : "Telegram girişi ləğv edilsin?"}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-zinc-400">
              {confirmation?.kind === "clear"
                ? "İşləyən bot dayandırılacaq, bütün əməkdaşların Telegram bağlantıları ləğv ediləcək və gözləyən bot əməliyyatları dayandırılacaq. Yenidən istifadə üçün tokeni daxil edib hər hesabı təkrar bağlamaq lazımdır."
                : `${confirmation?.kind === "revoke" ? confirmation.label : "Telegram bağlantısı"} ləğv ediləcək. Yenidən giriş üçün admin paneldən yeni şəxsi bağlantı yaradılmalıdır.`}
            </Dialog.Description>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" disabled={busy} onClick={() => setConfirmation(null)} className={secondaryButton}>İmtina et<ChevronRight size={14} /></button>
              <button type="button" disabled={busy} onClick={() => void confirmAction()} className="inline-flex items-center gap-2 rounded-xl bg-red-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40">{operation === "revoke" ? <LoaderCircle size={15} className="animate-spin" /> : <Unplug size={15} />}Bəli, {confirmation?.kind === "clear" ? "tokeni sil" : "ləğv et"}</button>
            </div>
            {error && confirmation && <p role="alert" className="mt-4 text-sm leading-6 text-red-300">{error}</p>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
