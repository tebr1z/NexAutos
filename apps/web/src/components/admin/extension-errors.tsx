"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowUpRight, Bug, Check, CheckCircle2, Clock3, Inbox, Loader2, RefreshCw, RotateCcw, Search, Shield } from "lucide-react";
import { api, type CalculatorReport } from "@/lib/api";
import { filterReports, reportDate, safeReportUrl, type ReportStatusFilter } from "@/lib/extension-reports";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

export function ExtensionErrors() {
  const { user, loading: authLoading } = useAuth();
  const authorized = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [rows, setRows] = useState<CalculatorReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<ReportStatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const active = useRef(false);
  const session = useRef(0);
  const loadSequence = useRef(0);
  const pending = useRef(new Set<string>());
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!active.current) return;
    const sequence = ++loadSequence.current;
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    setRefreshing(true);
    try {
      const reports = await api.calculatorReports(requestController.signal);
      if (!active.current || sequence !== loadSequence.current) return;
      setRows(reports);
      setLoaded(true);
      setLoadError("");
      setUpdatedAt(new Date());
    } catch (error) {
      if (!active.current || sequence !== loadSequence.current || requestController.signal.aborted) return;
      setLoadError(error instanceof Error ? error.message : "Xəta bildirişləri yüklənmədi.");
    } finally {
      if (active.current && sequence === loadSequence.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;
    active.current = true;
    session.current += 1;
    setRows([]);
    setLoaded(false);
    setLoadError("");
    setActionError("");
    setUpdatedAt(null);
    setBusyIds(new Set());
    pending.current.clear();
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      active.current = false;
      session.current += 1;
      loadSequence.current += 1;
      controller.current?.abort();
      window.clearInterval(interval);
    };
  }, [authorized, user?.id, load]);

  const openCount = rows.filter((row) => row.status === "OPEN").length;
  const resolvedCount = rows.filter((row) => row.status === "RESOLVED").length;
  const filteredRows = useMemo(() => filterReports(rows, filter, query), [rows, filter, query]);

  async function updateStatus(row: CalculatorReport) {
    if (!active.current || pending.current.has(row.id)) return;
    const currentSession = session.current;
    const status = row.status === "OPEN" ? "RESOLVED" : "OPEN";
    pending.current.add(row.id);
    setBusyIds(new Set(pending.current));
    setActionError("");
    try {
      await api.resolveCalculatorReport(row.id, status);
      if (!active.current || currentSession !== session.current) return;
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, status } : item));
      void load();
    } catch (error) {
      if (active.current && currentSession === session.current) {
        setActionError(error instanceof Error ? error.message : "Bildirişin statusu dəyişdirilmədi.");
      }
    } finally {
      if (active.current && currentSession === session.current) {
        pending.current.delete(row.id);
        setBusyIds(new Set(pending.current));
      }
    }
  }

  if (authLoading) return <p role="status" className="text-sm text-zinc-400">Giriş yoxlanılır…</p>;
  if (!authorized) return <div className="rounded-2xl border border-white/10 p-6"><Shield className="text-amber-300" size={24} /><h1 className="mt-3 text-lg font-semibold">Bu bölməyə giriş məhduddur</h1><p className="mt-2 text-sm text-zinc-400">Extension xəta bildirişlərini yalnız administrator görə bilər.</p></div>;

  return <div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="flex gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300"><Bug size={23} /></div>
        <div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-sky-300">Dəstək mərkəzi</p><h1 className="mt-1 font-display text-2xl sm:text-3xl">Extension xətaları</h1><p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">Extension-dan göndərilən xəta bildirişləri burada toplanır. Problemi yoxlayın və həll olunduqda statusunu dəyişin.</p></div>
      </div>
      <button type="button" onClick={() => void load()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[.08] disabled:cursor-wait disabled:opacity-60"><RefreshCw size={16} className={cn(refreshing && "animate-spin")} />{refreshing ? "Yenilənir…" : "Yenilə"}</button>
    </div>

    <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[
        { label: "Bütün bildirişlər", count: rows.length, icon: Inbox, color: "text-sky-300", background: "bg-sky-400/10" },
        { label: "Həll gözləyir", count: openCount, icon: Clock3, color: "text-amber-300", background: "bg-amber-400/10" },
        { label: "Həll edilib", count: resolvedCount, icon: CheckCircle2, color: "text-emerald-300", background: "bg-emerald-400/10" },
      ].map((item) => <div key={item.label} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className={cn("rounded-xl p-3", item.color, item.background)}><item.icon size={20} /></div><div><p className="text-xs text-zinc-400">{item.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{loaded ? item.count : "—"}</p></div></div>)}
    </div>

    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.02]">
      <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 rounded-xl bg-black/25 p-1" aria-label="Bildiriş statusu">
          {([
            { id: "ALL", label: "Hamısı", count: rows.length },
            { id: "OPEN", label: "Açıq", count: openCount },
            { id: "RESOLVED", label: "Həll edilib", count: resolvedCount },
          ] as const).map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={cn("flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs transition sm:flex-initial", filter === item.id ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white")}>{item.label}<span className={cn("rounded-md px-1.5 py-0.5 text-[10px] tabular-nums", filter === item.id ? "bg-white/10" : "bg-white/5")}>{loaded ? item.count : "—"}</span></button>)}
        </div>
        <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 lg:w-80"><Search size={16} className="shrink-0 text-zinc-500" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="İstifadəçi, xəta və ya versiya axtar…" aria-label="Xəta bildirişlərində axtar" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-zinc-600" /></label>
      </div>

      {(loadError || actionError) && <div role="alert" className="m-4 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[.07] p-4 sm:m-5"><AlertCircle size={18} className="mt-0.5 shrink-0 text-red-300" /><div className="min-w-0 text-sm text-red-200">{loadError && <p className="break-words">{loadError}{loaded ? " Son uğurlu yükləmənin məlumatları göstərilir." : " Bildirişləri yükləmək üçün yenidən cəhd edin."}</p>}{actionError && <p className={cn("break-words", loadError && "mt-2")}>{actionError}</p>}</div></div>}

      {!loaded && !loadError ? <div className="space-y-4 p-5" role="status" aria-label="Bildirişlər yüklənir">{[0, 1, 2].map((item) => <div key={item} className="animate-pulse rounded-xl border border-white/5 p-4"><div className="h-3 w-40 rounded bg-white/10" /><div className="mt-4 h-3 w-3/4 rounded bg-white/5" /><div className="mt-2 h-3 w-1/2 rounded bg-white/5" /></div>)}</div> : loaded && filteredRows.length === 0 ? <div className="px-5 py-16 text-center"><Inbox size={32} className="mx-auto text-zinc-600" /><h2 className="mt-4 font-medium">{rows.length === 0 ? "Hələ xəta bildirişi yoxdur" : "Uyğun bildiriş tapılmadı"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">{rows.length === 0 ? "İstifadəçi extension-dakı xəta bildirmə funksiyası ilə mesaj göndərdikdə burada görünəcək." : "Axtarış sözünü və ya status filtrini dəyişərək yenidən yoxlayın."}</p>{rows.length > 0 && <button type="button" className="mt-4 text-sm text-sky-300 hover:text-sky-200" onClick={() => { setQuery(""); setFilter("ALL"); }}>Filtrləri təmizlə</button>}</div> : <div className="divide-y divide-white/10">{filteredRows.map((row) => {
        const isOpen = row.status === "OPEN";
        const busy = busyIds.has(row.id);
        const url = safeReportUrl(row.pageUrl);
        return <article key={row.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><div className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", isOpen ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300")}>{isOpen ? <Bug size={17} /> : <Check size={17} />}</div><div className="min-w-0"><p className="break-words text-sm font-medium">{row.user.name || "İstifadəçi"}</p><p className="mt-0.5 break-all text-xs text-zinc-500">{row.user.email}</p></div></div><span className={cn("rounded-full border px-2.5 py-1 text-[11px]", isOpen ? "border-amber-400/20 bg-amber-400/5 text-amber-200" : "border-emerald-400/20 bg-emerald-400/5 text-emerald-200")}>{isOpen ? "Açıq" : row.status === "RESOLVED" ? "Həll edilib" : row.status}</span></div>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{row.message}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500"><span className="rounded-md border border-white/10 bg-white/[.03] px-2 py-1">Versiya {row.version || "məlum deyil"}</span><time dateTime={row.createdAt}>{reportDate(row.createdAt)} · Bakı</time>{url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">Mənbə səhifəsini aç<ArrowUpRight size={14} /></a>}</div>
          {row.pageUrl && <p className="mt-2 break-all text-[11px] leading-5 text-zinc-600">{row.pageUrl}</p>}
          <button type="button" disabled={busy} onClick={() => void updateStatus(row)} className={cn("mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:cursor-wait disabled:opacity-50", isOpen ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200 hover:bg-emerald-400/10" : "border-white/15 text-zinc-300 hover:bg-white/5")}>{busy ? <Loader2 size={14} className="animate-spin" /> : isOpen ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}{busy ? "Saxlanılır…" : isOpen ? "Həll edildi kimi işarələ" : "Yenidən aç"}</button>
        </article>;
      })}</div>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-4 text-[11px] leading-5 text-zinc-500"><p>Son 200 bildiriş · saylar bu siyahıya aiddir · hər 60 saniyədə yenilənir.</p><p role="status">{updatedAt ? `Son yenilənmə: ${updatedAt.toLocaleTimeString("az-AZ", { timeZone: "Asia/Baku", hour: "2-digit", minute: "2-digit" })} · Bakı` : "Hələ yenilənməyib"}</p></div>
    </div>
  </div>;
}
