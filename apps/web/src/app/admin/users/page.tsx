"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, LockKeyhole, ShieldCheck, UserCog } from "lucide-react";
import { api, type AccessUser } from "@/lib/api";
import { assignableRolesFor, ROLE_DETAILS, type AssignableRole, type InternalRole } from "@/lib/admin-access";
import { useAuth } from "@/providers/auth-provider";

const input = "w-full rounded-xl border border-white/10 bg-[#0d0d0f] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-500/60";

export default function AccessUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<AccessUser[]>([]);
  const [form, setForm] = useState<{ name: string; email: string; password: string; role: AssignableRole }>({ name: "", email: "", password: "", role: "STAFF" });
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [selectedRoles, setSelectedRoles] = useState<Record<string, AssignableRole>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const roleOptions = useMemo(() => assignableRolesFor(user?.role), [user?.role]);

  async function load() {
    try {
      const list = await api.accessUsers();
      setRows(list);
      setSelectedRoles(Object.fromEntries(list.filter((row) => row.role !== "SUPER_ADMIN").map((row) => [row.id, row.role as AssignableRole])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "İstifadəçilər yüklənmədi.");
    }
  }

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace("/admin");
    if (!authLoading && isAdmin) void load();
  }, [authLoading, isAdmin, router]);

  async function create(e: FormEvent) {
    e.preventDefault(); setBusyId("create"); setError(""); setNotice("");
    try {
      const created = await api.createAccessUser(form);
      setRows((current) => [created, ...current]);
      setSelectedRoles((current) => ({ ...current, [created.id]: created.role as AssignableRole }));
      setForm({ name: "", email: "", password: "", role: "STAFF" });
      setNotice(`${ROLE_DETAILS[created.role].label} hesabı yaradıldı.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hesab yaradılmadı.");
    } finally { setBusyId(""); }
  }

  async function update(id: string, payload: { password?: string; isActive?: boolean; role?: AccessUser["role"] }) {
    setBusyId(id); setError(""); setNotice("");
    try {
      const updated = await api.updateAccessUser(id, payload);
      setRows((current) => current.map((row) => row.id === id ? updated : row));
      setSelectedRoles((current) => ({ ...current, [id]: updated.role as AssignableRole }));
      if (payload.password) setPasswords((current) => ({ ...current, [id]: "" }));
      if (payload.role) setNotice(`Giriş səviyyəsi “${ROLE_DETAILS[updated.role].label}” olaraq dəyişdirildi; köhnə sessiyalar bağlandı.`);
      else if (payload.password) setNotice("Yeni şifrə yadda saxlanıldı; köhnə sessiyalar bağlandı.");
      else setNotice(updated.isActive ? "İstifadəçi girişi aktiv edildi." : "İstifadəçi girişi dayandırıldı.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dəyişiklik saxlanılmadı.");
    } finally { setBusyId(""); }
  }

  if (authLoading || !isAdmin || !user) return <p className="text-sm text-zinc-500">Yüklənir…</p>;

  return <div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Giriş nəzarəti</p>
        <h1 className="mt-2 text-3xl font-semibold">İstifadəçilər və səlahiyyətlər</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">Hər əməkdaşa işinə uyğun giriş verin. Menyular gizlədilir və eyni icazələr API səviyyəsində də qorunur.</p>
      </div>
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-xs text-emerald-300"><ShieldCheck className="mr-2 inline" size={16} />{rows.filter((row) => row.isActive).length} aktiv hesab</div>
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {(Object.keys(ROLE_DETAILS) as InternalRole[]).map((role) => <div key={role} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <p className="text-sm font-semibold text-white">{ROLE_DETAILS[role].label}</p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-sky-400">{ROLE_DETAILS[role].short}</p>
        <p className="mt-3 text-xs leading-5 text-zinc-500">{ROLE_DETAILS[role].description}</p>
      </div>)}
    </div>

    {error ? <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</p> : null}
    {notice ? <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">{notice}</p> : null}

    <form onSubmit={create} className="mt-7 rounded-2xl border border-white/10 bg-[#0a0a0c] p-5">
      <div className="mb-4 flex items-center gap-2"><UserCog size={18} className="text-sky-400" /><h2 className="font-semibold">Yeni işçi hesabı</h2></div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_0.9fr_auto]">
        <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ad və soyad" className={input} />
        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-poçt" className={input} />
        <input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Şifrə (minimum 8 simvol)" className={input} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AssignableRole })} className={input}>{roleOptions.map((role) => <option key={role} value={role}>{ROLE_DETAILS[role].label}</option>)}</select>
        <button disabled={busyId === "create"} className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">Hesab yarat</button>
      </div>
      <p className="mt-3 text-xs text-zinc-600">Baş administrator rolu təhlükəsizlik üçün yeni hesaba verilmir. Tam giriş rolunu yalnız baş administrator təyin edə bilər.</p>
    </form>

    <div className="mt-6 space-y-3">
      {rows.map((row) => {
        const protectedAccount = row.role === "SUPER_ADMIN" || (user.role !== "SUPER_ADMIN" && row.role === "ADMIN");
        const ownAccount = row.id === user.id;
        const chosenRole = selectedRoles[row.id] || (row.role === "SUPER_ADMIN" ? "ADMIN" : row.role as AssignableRole);
        const allowedForTarget = roleOptions.includes(chosenRole);
        return <div key={row.id} className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_1.5fr] xl:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-white">{row.name}</p>{ownAccount ? <span className="rounded-full bg-sky-400/10 px-2 py-1 text-[10px] font-semibold text-sky-300">SİZ</span> : null}<span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${row.isActive ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>{row.isActive ? "AKTİV" : "BAĞLI"}</span></div>
              <p className="mt-1 text-sm text-zinc-400">{row.email}</p>
              <p className="mt-2 text-xs font-medium text-sky-400">{ROLE_DETAILS[row.role].label} · {ROLE_DETAILS[row.role].short}</p>
              <p className="mt-2 text-xs text-zinc-600">{row.lastLoginAt ? `Son giriş: ${new Date(row.lastLoginAt).toLocaleString("az-AZ")}` : "Hələ daxil olmayıb"}</p>
            </div>

            {!protectedAccount ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_auto_1fr_auto_auto]">
              <select disabled={ownAccount} value={chosenRole} onChange={(e) => setSelectedRoles({ ...selectedRoles, [row.id]: e.target.value as AssignableRole })} className={input}>
                {roleOptions.map((role) => <option key={role} value={role}>{ROLE_DETAILS[role].label}</option>)}
                {!allowedForTarget ? <option value={row.role}>{ROLE_DETAILS[row.role].label}</option> : null}
              </select>
              <button type="button" disabled={busyId === row.id || ownAccount || chosenRole === row.role} onClick={() => void update(row.id, { role: chosenRole })} className="rounded-xl border border-sky-400/25 px-4 py-2 text-xs text-sky-300 disabled:opacity-35"><CheckCircle2 className="mr-1.5 inline" size={14} />Rolu saxla</button>
              <input minLength={8} type="password" value={passwords[row.id] || ""} onChange={(e) => setPasswords({ ...passwords, [row.id]: e.target.value })} placeholder="Yeni şifrə" className={input} />
              <button type="button" disabled={busyId === row.id || (passwords[row.id] || "").length < 8} onClick={() => void update(row.id, { password: passwords[row.id] })} className="rounded-xl border border-white/15 px-4 py-2 text-xs disabled:opacity-35"><KeyRound className="mr-1.5 inline" size={14} />Şifrə</button>
              <button type="button" disabled={busyId === row.id || ownAccount} onClick={() => void update(row.id, { isActive: !row.isActive })} className={`rounded-xl px-4 py-2 text-xs disabled:opacity-35 ${row.isActive ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>{row.isActive ? "Girişi bağla" : "Girişi aç"}</button>
            </div> : <div className="flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/5 px-4 py-3 text-xs text-amber-200"><LockKeyhole size={15} />Bu hesab qorunur və sizin rolunuzla dəyişdirilə bilməz.</div>}
          </div>
        </div>;
      })}
      {!rows.length ? <p className="rounded-2xl border border-white/10 p-8 text-center text-sm text-zinc-500">Hələ işçi hesabı yaradılmayıb.</p> : null}
    </div>
  </div>;
}
