"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, KeyRound, LockKeyhole, ShieldCheck, UserCog, Search, Users, UserPlus, X, SlidersHorizontal, RefreshCw } from "lucide-react";
import { api, type AccessUser } from "@/lib/api";
import { assignableRolesFor, ROLE_DETAILS, type AssignableRole, type InternalRole } from "@/lib/admin-access";
import { useAuth } from "@/providers/auth-provider";
import { CalculatorAccount } from "@/components/freight/calculator-account";
import { RadarPlanEditor } from "@/components/lot-radar/radar-plan-editor";

const input = "w-full rounded-xl border border-white/10 bg-[#0d0d0f] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-500/60";

export default function AccessUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<AccessUser[]>([]);
  const [form, setForm] = useState<{ name: string; email: string; password: string; role: AssignableRole; phone: string; radarWatchLimit: number; radarMonthlyAlertLimit: number }>({ name: "", email: "", password: "", role: "CUSTOMER", phone: "", radarWatchLimit: 3, radarMonthlyAlertLimit: 100 });
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [selectedRoles, setSelectedRoles] = useState<Record<string, AssignableRole>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openPlan, setOpenPlan] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const selectedUserIdRef = useRef(selectedUserId);

  function selectUser(id: string) {
    selectedUserIdRef.current = id;
    setSelectedUserId(id); setOpenPlan(false); setError(""); setNotice("");
  }

  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const roleOptions = useMemo(() => assignableRolesFor(user?.role), [user?.role]);

  async function load() {
    setLoading(true); setError("");
    try {
      const list = await api.accessUsers();
      setRows(list);
      setSelectedRoles(Object.fromEntries(list.filter((row) => row.role !== "SUPER_ADMIN").map((row) => [row.id, row.role as AssignableRole])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "İstifadəçilər yüklənmədi.");
    } finally { setLoading(false); }
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
      setForm({ name: "", email: "", password: "", role: "CUSTOMER", phone: "", radarWatchLimit: 3, radarMonthlyAlertLimit: 100 });
      setNotice(`${ROLE_DETAILS[created.role].label} hesabı yaradıldı.`);
      setShowCreate(false);
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
      if (selectedUserIdRef.current === id) {
        if (payload.role) setNotice(`Giriş səviyyəsi “${ROLE_DETAILS[updated.role].label}” olaraq dəyişdirildi; köhnə sessiyalar bağlandı.`);
        else if (payload.password) setNotice("Yeni şifrə yadda saxlanıldı; köhnə sessiyalar bağlandı.");
        else setNotice(updated.isActive ? "İstifadəçi girişi aktiv edildi." : "İstifadəçi girişi dayandırıldı.");
      }
    } catch (err) {
      if (selectedUserIdRef.current === id) setError(err instanceof Error ? err.message : "Dəyişiklik saxlanılmadı.");
    } finally { setBusyId((current) => current === id ? "" : current); }
  }

  if (authLoading || !isAdmin || !user) return <p className="text-sm text-zinc-500">Yüklənir…</p>;

  const filtered = rows.filter(row => (!roleFilter || row.role === roleFilter) && (!statusFilter || String(row.isActive) === statusFilter) && `${row.name} ${row.email}`.toLocaleLowerCase("az-AZ").includes(query.toLocaleLowerCase("az-AZ")));
  const selectedUser = rows.find(row => row.id === selectedUserId);
  const protectedAccount = selectedUser?.role === "SUPER_ADMIN" || (user.role !== "SUPER_ADMIN" && selectedUser?.role === "ADMIN");
  const ownAccount = selectedUser?.id === user.id;
  const chosenRole = selectedUser ? selectedRoles[selectedUser.id] || (selectedUser.role === "SUPER_ADMIN" ? "ADMIN" : selectedUser.role as AssignableRole) : "CUSTOMER";
  const allowedForTarget = roleOptions.includes(chosenRole);

  return <div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Giriş nəzarəti</p>
        <h1 className="mt-2 text-3xl font-semibold">İstifadəçilər və səlahiyyətlər</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">Müştəri və əməkdaş hesablarını, WhatsApp nömrələrini, giriş səviyyələrini və fərdi Lot Radar limitlərini idarə edin.</p>
      </div>
      <button type="button" onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950"><UserPlus size={17} />Yeni istifadəçi</button>
    </div>

    <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      { label: "Bütün hesablar", value: rows.length, icon: Users, color: "text-sky-300" },
      { label: "Aktiv giriş", value: rows.filter(r => r.isActive).length, icon: ShieldCheck, color: "text-emerald-300" },
      { label: "Müştəri hesabları", value: rows.filter(r => r.role === "CUSTOMER" || r.role === "FREIGHT_USER").length, icon: SlidersHorizontal, color: "text-violet-300" },
      { label: "Girişi bağlı", value: rows.filter(r => !r.isActive).length, icon: LockKeyhole, color: "text-amber-300" },
    ].map(stat => <div key={stat.label} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.04] to-transparent p-5"><stat.icon size={18} className={stat.color} /><p className="mt-4 text-3xl font-semibold tracking-tight">{loading ? "—" : stat.value}</p><p className="mt-1 text-xs text-zinc-400">{stat.label}</p></div>)}</div>
    <details className="mt-5 rounded-2xl border border-white/10 px-5 py-4"><summary className="cursor-pointer text-sm text-zinc-400">Giriş səviyyələri və səlahiyyətlər</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {(Object.keys(ROLE_DETAILS) as InternalRole[]).map((role) => <div key={role} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <p className="text-sm font-semibold text-white">{ROLE_DETAILS[role].label}</p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-sky-400">{ROLE_DETAILS[role].short}</p>
        <p className="mt-3 text-xs leading-5 text-zinc-500">{ROLE_DETAILS[role].description}</p>
      </div>)}
    </div>

    </details>
    {error ? <p role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</p> : null}
    {notice ? <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">{notice}</p> : null}

    {showCreate && <form onSubmit={create} className="mt-7 rounded-2xl border border-sky-400/25 bg-[#0a0a0c] p-5">
      <div className="mb-4 flex items-center gap-2"><UserCog size={18} className="text-sky-400" /><h2 className="font-semibold">Yeni istifadəçi hesabı</h2></div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_0.9fr_auto]">
        <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ad və soyad" className={input} />
        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-poçt" className={input} />
        <input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Şifrə (minimum 8 simvol)" className={input} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AssignableRole })} className={input}>{roleOptions.map((role) => <option key={role} value={role}>{ROLE_DETAILS[role].label}</option>)}</select>
        <button disabled={busyId === "create"} className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">Hesab yarat</button>
      </div>
      <p className="mt-3 text-xs text-zinc-600">Baş administrator rolu təhlükəsizlik üçün yeni hesaba verilmir. Tam giriş rolunu yalnız baş administrator təyin edə bilər.</p>
      <div className="mt-5 grid gap-3 rounded-xl border border-violet-400/20 bg-violet-400/5 p-4 sm:grid-cols-3"><label className="text-xs text-zinc-400">Müştərinin WhatsApp nömrəsi<input type="tel" required={form.role === 'CUSTOMER'} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+994 50 123 45 67" className={`${input} mt-2`} /></label><label className="text-xs text-zinc-400">Lot Radar · aktiv axtarış limiti<input type="number" min={0} max={100} value={form.radarWatchLimit} onChange={e => setForm({ ...form, radarWatchLimit: Number(e.target.value) })} className={`${input} mt-2`} /></label><label className="text-xs text-zinc-400">Lot Radar · aylıq bildiriş limiti<input type="number" min={0} max={1000000} value={form.radarMonthlyAlertLimit} onChange={e => setForm({ ...form, radarMonthlyAlertLimit: Number(e.target.value) })} className={`${input} mt-2`} /></label></div>
    </form>}

    <div className="mt-7 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Hesablar</h2><p className="mt-1 text-xs text-zinc-500">{filtered.length} / {rows.length} istifadəçi</p></div><button type="button" disabled={loading} onClick={() => void load()} aria-label="İstifadəçiləri yenilə" className="rounded-lg border border-white/10 p-2.5 text-zinc-400"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button></div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_180px]"><label className="relative"><Search size={17} className="absolute left-3 top-3.5 text-zinc-500" /><input aria-label="Ad və ya e-poçt üzrə axtar" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ad və ya e-poçt axtar…" className={`${input} pl-10`} /></label><select aria-label="Giriş səviyyəsi filtri" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={input}><option value="">Bütün giriş səviyyələri</option>{(Object.keys(ROLE_DETAILS) as InternalRole[]).map(role => <option key={role} value={role}>{ROLE_DETAILS[role].label}</option>)}</select><select aria-label="Status filtri" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={input}><option value="">Bütün statuslar</option><option value="true">Aktiv</option><option value="false">Girişi bağlı</option></select></div></div>

    <div className="mt-6 space-y-3">
      {filtered.map((row) => {
        const ownAccount = row.id === user.id;
        return <div key={row.id} className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-white">{row.name}</p>{ownAccount ? <span className="rounded-full bg-sky-400/10 px-2 py-1 text-[10px] font-semibold text-sky-300">SİZ</span> : null}<span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${row.isActive ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>{row.isActive ? "AKTİV" : "BAĞLI"}</span></div>
              <p className="mt-1 text-sm text-zinc-400">{row.email}</p>
              <p className="mt-1 text-xs text-zinc-500">WhatsApp: {row.phone || 'Təyin edilməyib'} · Radar: {row.radarPlan?.watchLimit ?? 3} aktiv axtarış / {row.radarPlan?.monthlyAlertLimit ?? 100} bildiriş/ay</p>
              <p className="mt-2 text-xs font-medium text-sky-400">{ROLE_DETAILS[row.role].label} · {ROLE_DETAILS[row.role].short}</p>
              <p className="mt-2 text-xs text-zinc-600">{row.lastLoginAt ? `Son giriş: ${new Date(row.lastLoginAt).toLocaleString("az-AZ")}` : "Hələ daxil olmayıb"}</p>
            </div>

            <button type="button" aria-haspopup="dialog" aria-label={`${row.name} (${row.email}) hesabını idarə et`} onClick={() => selectUser(row.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-xs text-sky-300"><UserCog size={16} />Hesabı idarə et</button>
          </div>
        </div>;
      })}
      {!filtered.length ? <p className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">{loading ? "Hesablar yüklənir…" : rows.length ? "Axtarışa uyğun istifadəçi tapılmadı." : "Hələ hesab yaradılmayıb."}</p> : null}
    </div>
    <Dialog.Root open={!!selectedUser} onOpenChange={(open) => { if (!open) selectUser(""); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-sky-400/25 bg-[#0a0a0c] p-5 text-white shadow-2xl sm:p-7">
          {selectedUser && <>
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-widest text-sky-400">İdarə edilən hesab</p><Dialog.Title className="mt-2 break-words text-2xl font-semibold">{selectedUser.name}</Dialog.Title><Dialog.Description className="mt-2 break-all text-sm text-sky-200">{selectedUser.email}</Dialog.Description><p className="mt-2 text-xs text-zinc-400">{ROLE_DETAILS[selectedUser.role].label} · {selectedUser.isActive ? "Aktiv" : "Girişi bağlı"}{ownAccount ? " · Öz hesabınız" : ""}</p></div>
              <Dialog.Close aria-label="Hesab idarəetməsini bağla" className="rounded-xl border border-white/10 p-2.5 text-zinc-400 hover:text-white"><X size={18} /></Dialog.Close>
            </div>
            <p className="mt-4 break-all text-xs text-zinc-500">Dəyişikliklər yalnız {selectedUser.email} hesabına tətbiq edilir.</p>
            {error ? <p role="alert" className="mt-4 text-sm text-red-300">{error}</p> : null}
            {notice ? <p role="status" className="mt-4 text-sm text-emerald-300">{notice}</p> : null}
            <div className="mt-5">
              {!protectedAccount ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_auto_1fr_auto_auto]">
                <select aria-label="Seçilmiş hesabın rolu" disabled={ownAccount || busyId !== ""} value={chosenRole} onChange={(e) => setSelectedRoles({ ...selectedRoles, [selectedUser.id]: e.target.value as AssignableRole })} className={input}>
                  {roleOptions.map((role) => <option key={role} value={role}>{ROLE_DETAILS[role].label}</option>)}
                  {!allowedForTarget ? <option value={selectedUser.role}>{ROLE_DETAILS[selectedUser.role].label}</option> : null}
                </select>
                <button type="button" disabled={busyId !== "" || ownAccount || chosenRole === selectedUser.role} onClick={() => void update(selectedUser.id, { role: chosenRole })} className="rounded-xl border border-sky-400/25 px-4 py-2 text-xs text-sky-300 disabled:opacity-35"><CheckCircle2 className="mr-1.5 inline" size={14} />Rolu saxla</button>
                <input aria-label="Seçilmiş hesabın yeni şifrəsi" autoComplete="new-password" disabled={busyId !== ""} minLength={8} type="password" value={passwords[selectedUser.id] || ""} onChange={(e) => setPasswords({ ...passwords, [selectedUser.id]: e.target.value })} placeholder="Yeni şifrə" className={input} />
                <button type="button" disabled={busyId !== "" || (passwords[selectedUser.id] || "").length < 8} onClick={() => void update(selectedUser.id, { password: passwords[selectedUser.id] })} className="rounded-xl border border-white/15 px-4 py-2 text-xs disabled:opacity-35"><KeyRound className="mr-1.5 inline" size={14} />Şifrə</button>
                <button type="button" disabled={busyId !== "" || ownAccount} onClick={() => void update(selectedUser.id, { isActive: !selectedUser.isActive })} className={`rounded-xl px-4 py-2 text-xs disabled:opacity-35 ${selectedUser.isActive ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>{selectedUser.isActive ? "Girişi bağla" : "Girişi aç"}</button>
              </div> : <div className="flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/5 px-4 py-3 text-xs text-amber-200"><LockKeyhole size={15} />Bu hesab qorunur və sizin rolunuzla dəyişdirilə bilməz.</div>}
            </div>
            {(!protectedAccount || ownAccount) && <RadarPlanEditor key={`radar-${selectedUser.id}`} userId={selectedUser.id} canEditPhone={!protectedAccount} onSaved={(plan) => setRows(current => current.map(row => row.id === selectedUser.id ? { ...row, phone: plan.phone, radarPlan: { enabled: plan.enabled, watchLimit: plan.watchLimit, monthlyAlertLimit: plan.monthlyAlertLimit } } : row))} />}
            {selectedUser.role !== "CUSTOMER" && (!protectedAccount || ownAccount) && <><button type="button" onClick={() => setOpenPlan(!openPlan)} className="mt-4 rounded-lg bg-sky-400/10 px-4 py-2.5 text-sm text-sky-300">{openPlan ? "Paketi bağla" : "Hesablama paketi · son tarix, limit, endirim və yol əlavəsi"}</button>{openPlan && <CalculatorAccount key={`calculator-${selectedUser.id}`} mode="admin" userId={selectedUser.id} />}</>}
          </>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
