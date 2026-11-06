"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { RadarPlan } from "@/lib/lot-radar";

export function RadarPlanEditor({ userId, canEditPhone = true, onSaved }: { userId: string; canEditPhone?: boolean; onSaved?: (plan: RadarPlan) => void }) {
  const targetId = userId.trim();
  const [loaded, setLoaded] = useState<{ userId: string; plan: RadarPlan } | null>(null);
  const plan = loaded?.userId === targetId ? loaded.plan : null;
  function setPlan(next: RadarPlan) { setLoaded({ userId: targetId, plan: next }); }
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const currentTarget = useRef(targetId);
  useLayoutEffect(() => { currentTarget.current = targetId; }, [targetId]);
  useEffect(() => {
    const request = ++generation.current;
    const isCurrent = () => generation.current === request && currentTarget.current === targetId;
    setLoaded(null); setPhone(''); setBusy(false); setMessage(''); setLoading(true);
    if (!targetId) { setMessage('İdarə ediləcək hesab seçilməyib.'); setLoading(false); }
    else void api.radarPlan(targetId).then(p => { if (isCurrent()) { setLoaded({ userId: targetId, plan: p }); setPhone(p.phone || ''); } }).catch(e => { if (isCurrent()) setMessage(e instanceof Error ? e.message : 'Radar ayarları yüklənmədi.'); }).finally(() => { if (isCurrent()) setLoading(false); });
    return () => { generation.current = request + 1; };
  }, [targetId]);
  async function save() {
    if (!plan || !targetId || busy) return;
    const request = generation.current;
    const isCurrent = () => generation.current === request && currentTarget.current === targetId;
    setBusy(true); setMessage('');
    try {
      if (canEditPhone && phone !== (plan.phone || '')) await api.updateAccessUser(targetId, { phone });
      if (!isCurrent()) return;
      const saved = await api.saveRadarPlan(targetId, { enabled: plan.enabled, watchLimit: plan.watchLimit, monthlyAlertLimit: plan.monthlyAlertLimit });
      if (isCurrent()) { setPlan(saved); setPhone(saved.phone || ''); onSaved?.(saved); setMessage('WhatsApp nömrəsi və Lot Radar limiti saxlanıldı.'); }
    } catch (e) { if (isCurrent()) setMessage(e instanceof Error ? e.message : 'Saxlanılmadı.'); } finally { if (isCurrent()) setBusy(false); }
  }
  const field = 'mt-2 w-full rounded-xl border border-white/15 bg-[#0b111b] px-3 py-2.5 text-sm text-white';
  return <section className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-5"><h3 className="font-medium text-violet-200">Lot Radar · Müştərinin avtomatik axtarışı</h3>{plan ? <>
    <p className="mt-2 text-xs text-zinc-400">{plan.month} · {plan.used} / {plan.monthlyAlertLimit} bildiriş · {plan.active} aktiv axtarış</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-xs text-zinc-400">WhatsApp nömrəsi<input type="tel" disabled={!canEditPhone || busy} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+994 50 123 45 67" className={field} /></label><label className="text-xs text-zinc-400">Aktiv axtarış limiti<input disabled={busy} type="number" min={0} max={100} value={plan.watchLimit} onChange={e => setPlan({ ...plan, watchLimit: Number(e.target.value) })} className={field} /></label><label className="text-xs text-zinc-400">Aylıq yeni-lot bildirişi<input disabled={busy} type="number" min={0} max={1000000} value={plan.monthlyAlertLimit} onChange={e => setPlan({ ...plan, monthlyAlertLimit: Number(e.target.value) })} className={field} /></label></div>
    <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300"><input disabled={busy} type="checkbox" checked={plan.enabled} onChange={e => setPlan({ ...plan, enabled: e.target.checked })} />Lot Radar bu hesab üçün aktivdir</label>
    <p className="mt-2 text-xs leading-5 text-zinc-500">Ay Bakı vaxtı ilə yenilənir. Bir axtarışda bir yeni lot = bir bildiriş haqqı; WhatsApp və e-poçt ayrıca sayılmır. Silmək istifadə sayını geri qaytarmır. Limit azaldılanda artıq aktiv axtarışlar dayandırılır.</p>
    <button type="button" disabled={busy} onClick={() => void save()} className="mt-4 rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-50">{busy ? 'Saxlanılır…' : 'Radar ayarlarını saxla'}</button>
  </> : <p className="mt-3 text-xs text-zinc-500">{loading ? 'Yüklənir…' : 'Radar ayarları açıla bilmədi.'}</p>}{message && <p role="status" className="mt-3 text-xs text-sky-200">{message}</p>}</section>;
}
