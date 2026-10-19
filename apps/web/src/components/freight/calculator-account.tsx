"use client";

import { useEffect, useState } from "react";
import { api, type CalculatorProfile, type CalculatorReport } from "@/lib/api";

const field = "mt-1 w-full rounded-lg border border-white/15 bg-[#101722] p-2 text-sm text-white";
export function CalculatorAccount({ userId, refreshKey = 0 }: { userId?: string; refreshKey?: number }) {
  const [profile, setProfile] = useState<CalculatorProfile | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api.calculatorProfile(userId).then((p) => { if (active) setProfile(p); }).catch((e) => { if (active) setMessage(e.message); }); return () => { active = false; }; }, [userId, refreshKey]);
  async function save() {
    if (!profile) return;
    setBusy(true); setMessage("");
    try {
      const { discountAUsd, discountBUsd, discountCUsd, potiBakuUsd, monthlyLimit, allowSelfPricing } = profile;
      setProfile(await api.saveCalculatorProfile({ discountAUsd, discountBUsd, discountCUsd, potiBakuUsd, ...(userId ? { monthlyLimit, allowSelfPricing } : {}) }, userId));
      setMessage("Yadda saxlanıldı. Növbəti hesablama yeni tariflə olacaq.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Saxlanılmadı."); }
    finally { setBusy(false); }
  }
  const canEdit = !!userId || !!profile?.allowSelfPricing;
  return <section className="my-4 rounded-xl border border-sky-400/20 bg-sky-400/[.04] p-4">
    <h2 className="text-sm font-semibold">{userId ? "Hesablama paketi və fərdi tarif" : "Mənim hesablama paketim"}</h2>
    {profile ? <>
      <p className="mt-2 text-sm text-sky-200">{profile.month} · {profile.used} hesab istifadə olunub · {profile.monthlyLimit == null ? "Limitsiz" : `${profile.remaining} / ${profile.monthlyLimit} qalıb`}</p>
      <p className="mt-1 text-xs text-zinc-400">Limit Bakı vaxtı ilə ayın 1-də yenilənir. Eyni qiymət və marşrutun 10 dəqiqə ərzində təkrarı yenidən sayılmır. Tarif tapılmayan sorğu sayılmır.</p>
      {userId ? <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <label><input type="checkbox" checked={profile.monthlyLimit == null} onChange={(e) => setProfile({ ...profile, monthlyLimit: e.target.checked ? null : 100 })} /> Limitsiz</label>
        {profile.monthlyLimit != null ? <label>Aylıq limit<input aria-label="Aylıq limit" type="number" min={0} max={1000000} step={1} className={field} value={profile.monthlyLimit} onChange={(e) => setProfile({ ...profile, monthlyLimit: Number(e.target.value) })} /></label> : null}
        <label><input type="checkbox" checked={profile.allowSelfPricing} onChange={(e) => setProfile({ ...profile, allowSelfPricing: e.target.checked })} /> İstifadəçi öz endirimini və Poti–Bakı məbləğini dəyişə bilər</label>
      </div> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([['discountAUsd', '0–3 000 USD'], ['discountBUsd', '3 000-dən çox – 7 000 USD'], ['discountCUsd', '7 000-dən çox – 150 000 USD']] as const).map(([key, label]) => <label key={key} className="text-xs text-zinc-400">{label} · endirim, USD<input disabled={!canEdit} type="number" min={-10000} max={10000} step="0.01" className={field} value={profile[key]} onChange={(e) => setProfile({ ...profile, [key]: Number(e.target.value) })} /></label>)}
        <label className="text-xs text-zinc-400">Poti–Bakı, USD (boş = ümumi tarif)<input disabled={!canEdit} type="number" min={0} max={10000} step="0.01" placeholder="Ümumi tarif" className={field} value={profile.potiBakuUsd ?? ""} onChange={(e) => setProfile({ ...profile, potiBakuUsd: e.target.value === "" ? null : Number(e.target.value) })} /></label>
      </div>
      <p className="mt-2 text-xs text-zinc-400">Qrup avtomobil + auction fee cəminə görə seçilir. 50 = $50 endirim, −50 = $50 əlavə xərc, 0 = endirim yoxdur. Poti–Bakı üçün 0 yazmaq həmin xərci çıxarır. Endirim ABŞ–Poti məbləğindən çıxılır.</p>
      {canEdit ? <button disabled={busy} onClick={() => void save()} className="mt-3 rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy ? "Saxlanılır…" : "Yadda saxla"}</button> : <p className="mt-3 text-xs text-zinc-400">Bu ayarları administrator təyin edir.</p>}
    </> : <p className="mt-2 text-xs">Yüklənir…</p>}
    {message ? <p role="status" className="mt-2 text-sm text-amber-200">{message}</p> : null}
  </section>;
}

export function CalculatorReports() {
  const [rows, setRows] = useState<CalculatorReport[]>([]);
  const [error, setError] = useState("");
  async function load() { try { setRows(await api.calculatorReports()); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Yüklənmədi"); } }
  useEffect(() => { void load(); }, []);
  async function resolve(row: CalculatorReport) {
    try { await api.resolveCalculatorReport(row.id, row.status === "OPEN" ? "RESOLVED" : "OPEN"); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Saxlanılmadı"); }
  }
  return <section className="mt-8 rounded-xl border border-white/10 p-5"><div className="flex justify-between"><h2 className="font-semibold">Extension xəta bildirişləri</h2><button onClick={() => void load()} className="text-sm text-sky-300">Yenilə</button></div>{error ? <p className="text-red-300">{error}</p> : null}{rows.map((row) => <article key={row.id} className="mt-4 border-t border-white/10 pt-3"><p className="text-xs text-zinc-400">{row.user.name} · {row.user.email} · v{row.version || "?"} · {new Date(row.createdAt).toLocaleString("az-AZ")}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.message}</p>{row.pageUrl ? <p className="mt-1 break-all text-xs text-zinc-400">{row.pageUrl}</p> : null}<button onClick={() => void resolve(row)} className="mt-2 text-xs text-sky-300">{row.status === "OPEN" ? "Açıq · Həll edildi kimi işarələ" : "Həll edildi · Yenidən aç"}</button></article>)}{!rows.length ? <p className="mt-3 text-sm text-zinc-400">Bildiriş yoxdur.</p> : null}</section>;
}
