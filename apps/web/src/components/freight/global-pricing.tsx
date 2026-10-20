"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const bands = [['surchargeAUsd', '0–3 000 USD'], ['surchargeBUsd', '3 001–7 000 USD'], ['surchargeCUsd', '7 001–150 000 USD']] as const;

export function GlobalPricing({ onSaved }: { onSaved: () => void }) {
  const [values, setValues] = useState({ surchargeAUsd: '', surchargeBUsd: '', surchargeCUsd: '' });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    api.globalCalculatorPricing().then((data) => {
      if (!active) return;
      setValues({ surchargeAUsd: String(data.surchargeAUsd), surchargeBUsd: String(data.surchargeBUsd), surchargeCUsd: String(data.surchargeCUsd) });
      setReady(true);
    }).catch((error) => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  return <form className="my-5 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await api.saveGlobalCalculatorPricing({ surchargeAUsd: Number(values.surchargeAUsd), surchargeBUsd: Number(values.surchargeBUsd), surchargeCUsd: Number(values.surchargeCUsd) });
      onSaved(); setMessage('Yadda saxlanıldı. Bütün hesabların növbəti hesablamasına tətbiq olunur.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Saxlanılmadı.'); }
    finally { setBusy(false); }
  }}>
    <h2 className="font-semibold text-amber-200">Bütün hesablar üçün əlavə yol pulu</h2>
    <p className="mt-2 text-sm text-zinc-400">Hər şəhərin ABŞ–Poti tarifinə, Copart və IAAI üzrə əlavə olunur. Aralıq avtomobil + auction fee cəminə görə seçilir. Müştərinin endirimi bu əlavə daxil yol pulundan çıxılır, sonra fərdi düzəliş, kar marjı və Poti–Bakı gəlir.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">{bands.map(([key, label]) => <label key={key} className="text-xs text-zinc-400">{label} · əlavə, USD<input required disabled={!ready || busy} type="number" min="0" max="10000" step="0.01" value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101722] px-3 py-3 text-base text-white" /></label>)}</div>
    <button disabled={!ready || busy} className="mt-4 rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">{busy ? 'Saxlanılır…' : 'Bütün hesablara tətbiq et'}</button>
    {message && <p role="status" className="mt-3 text-sm text-amber-200">{message}</p>}
  </form>;
}
