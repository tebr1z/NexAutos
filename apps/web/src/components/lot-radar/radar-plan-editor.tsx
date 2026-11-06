"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { RadarPlan } from "@/lib/lot-radar";

export function RadarPlanEditor({ userId, canEditPhone = true }: { userId: string; canEditPhone?: boolean }) {
  const [plan, setPlan] = useState<RadarPlan | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { let active = true; api.radarPlan(userId).then(p => { if (active) { setPlan(p); setPhone(p.phone || ''); } }).catch(e => { if (active) setMessage(e.message); }); return () => { active = false; }; }, [userId]);
  async function save() {
    if (!plan) return; setBusy(true); setMessage('');
    try {
      if (canEditPhone && phone !== (plan.phone || '')) await api.updateAccessUser(userId, { phone });
      const saved = await api.saveRadarPlan(userId, { enabled: plan.enabled, watchLimit: plan.watchLimit, monthlyAlertLimit: plan.monthlyAlertLimit });
      setPlan(saved); setPhone(saved.phone || ''); setMessage('WhatsApp nömrəsi və Lot Radar limiti saxlanıldı.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Saxlanılmadı.'); } finally { setBusy(false); }
  }
  const field = 'mt-2 w-full rounded-xl border border-white/15 bg-[#0b111b] px-3 py-2.5 text-sm text-white';
  return <section className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-5"><h3 className="font-medium text-violet-200">Lot Radar · Müştərinin avtomatik axtarışı</h3>{plan ? <>
    <p className="mt-2 text-xs text-zinc-400">{plan.month} · {plan.used} / {plan.monthlyAlertLimit} bildiriş · {plan.active} aktiv axtarış</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-xs text-zinc-400">WhatsApp nömrəsi<input type="tel" disabled={!canEditPhone || busy} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+994 50 123 45 67" className={field} /></label><label className="text-xs text-zinc-400">Aktiv axtarış limiti<input type="number" min={0} max={100} value={plan.watchLimit} onChange={e => setPlan({ ...plan, watchLimit: Number(e.target.value) })} className={field} /></label><label className="text-xs text-zinc-400">Aylıq yeni-lot bildirişi<input type="number" min={0} max={1000000} value={plan.monthlyAlertLimit} onChange={e => setPlan({ ...plan, monthlyAlertLimit: Number(e.target.value) })} className={field} /></label></div>
    <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={plan.enabled} onChange={e => setPlan({ ...plan, enabled: e.target.checked })} />Lot Radar bu hesab üçün aktivdir</label>
    <p className="mt-2 text-xs leading-5 text-zinc-500">Ay Bakı vaxtı ilə yenilənir. Bir axtarışda bir yeni lot = bir bildiriş haqqı; WhatsApp və e-poçt ayrıca sayılmır. Silmək istifadə sayını geri qaytarmır. Limit azaldılanda artıq aktiv axtarışlar dayandırılır.</p>
    <button type="button" disabled={busy} onClick={() => void save()} className="mt-4 rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-50">{busy ? 'Saxlanılır…' : 'Radar ayarlarını saxla'}</button>
  </> : <p className="mt-3 text-xs text-zinc-500">Yüklənir…</p>}{message && <p role="status" className="mt-3 text-xs text-sky-200">{message}</p>}</section>;
}
