"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, type FreightAccessUser } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

const input = "w-full rounded-xl border border-white/10 bg-[#0d0d0f] px-4 py-3 text-sm text-white outline-none focus:border-sky-500/60";

export default function FreightUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<FreightAccessUser[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

  async function load() {
    try { setRows(await api.freightUsers()); }
    catch (err) { setError(err instanceof Error ? err.message : "İstifadəçilər yüklənmədi."); }
  }

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace("/admin");
    if (!authLoading && isAdmin) void load();
  }, [authLoading, isAdmin, router]);

  async function create(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const created = await api.createFreightUser(form);
      setRows((current) => [created, ...current]);
      setForm({ name: "", email: "", password: "" });
      setNotice("İstifadəçi yaradıldı. Bu hesab yalnız Yol pulu panelinə girə bilər.");
    } catch (err) { setError(err instanceof Error ? err.message : "Hesab yaradılmadı."); }
    setBusy(false);
  }

  async function update(id: string, payload: { password?: string; isActive?: boolean }) {
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await api.updateFreightUser(id, payload);
      setRows((current) => current.map((row) => row.id === id ? updated : row));
      if (payload.password) setPasswords((current) => ({ ...current, [id]: "" }));
      setNotice(payload.password ? "Yeni şifrə yadda saxlanıldı; köhnə sessiyalar bağlandı." : updated.isActive ? "Giriş aktiv edildi." : "Giriş dayandırıldı.");
    } catch (err) { setError(err instanceof Error ? err.message : "Dəyişiklik saxlanılmadı."); }
    setBusy(false);
  }

  if (authLoading || !isAdmin) return <p className="text-sm text-zinc-500">Yüklənir…</p>;

  return <div className="mx-auto max-w-5xl">
    <h1 className="text-3xl font-semibold">Yol pulu istifadəçiləri</h1>
    <p className="mt-2 text-sm text-zinc-400">Bu hesablar yalnız `/admin/freight` panelini və BidCars kalkulyatorunu istifadə edə bilər.</p>
    {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
    {notice ? <p className="mt-4 text-sm text-emerald-400">{notice}</p> : null}

    <form onSubmit={create} className="mt-7 grid gap-3 rounded-2xl border border-white/10 p-5 md:grid-cols-[1fr_1fr_1fr_auto]">
      <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ad və soyad" className={input} />
      <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-poçt" className={input} />
      <input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Şifrə (minimum 8 simvol)" className={input} />
      <button disabled={busy} className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">Hesab yarat</button>
    </form>

    <div className="mt-6 space-y-3">
      {rows.map((row) => <div key={row.id} className="grid gap-4 rounded-2xl border border-white/10 p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div><p className="font-medium text-white">{row.name}</p><p className="mt-1 text-sm text-zinc-400">{row.email}</p><p className="mt-1 text-xs text-zinc-600">{row.lastLoginAt ? `Son giriş: ${new Date(row.lastLoginAt).toLocaleString("az-AZ")}` : "Hələ daxil olmayıb"} · {row.isActive ? "Aktiv" : "Bağlı"}</p></div>
        <div className="flex flex-wrap gap-2">
          <input minLength={8} type="password" value={passwords[row.id] || ""} onChange={(e) => setPasswords({ ...passwords, [row.id]: e.target.value })} placeholder="Yeni şifrə" className={`${input} w-44`} />
          <button type="button" disabled={busy || (passwords[row.id] || "").length < 8} onClick={() => void update(row.id, { password: passwords[row.id] })} className="rounded-xl border border-white/15 px-4 py-2 text-xs disabled:opacity-40">Şifrəni dəyiş</button>
          <button type="button" disabled={busy} onClick={() => void update(row.id, { isActive: !row.isActive })} className={`rounded-xl px-4 py-2 text-xs ${row.isActive ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>{row.isActive ? "Girişi bağla" : "Girişi aç"}</button>
        </div>
      </div>)}
      {!rows.length ? <p className="rounded-2xl border border-white/10 p-8 text-center text-sm text-zinc-500">Hələ yol pulu istifadəçisi yaradılmayıb.</p> : null}
    </div>
  </div>;
}
