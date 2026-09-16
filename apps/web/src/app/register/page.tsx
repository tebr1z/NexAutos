"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";

const field = "mt-1 w-full rounded-xl border border-line bg-transparent px-4 py-3 text-sm outline-none transition focus:border-royal";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="mx-auto max-w-md px-5 pb-24 pt-32">
      <p className="text-[11px] uppercase tracking-[0.35em] text-royal">Müştəri kabineti</p>
      <h1 className="font-display mt-3 text-4xl">Hesab yaradın</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Sifarişlərinizi və daşınma mərhələlərini şəxsi kabinetdən izləyin.</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setSaving(true);
          try {
            await register(form);
            router.push("/account");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Qeydiyyat alınmadı");
          } finally {
            setSaving(false);
          }
        }}
      >
        <label className="block text-xs text-muted">Ad və soyad<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} autoComplete="name" /></label>
        <label className="block text-xs text-muted">E-poçt<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} autoComplete="email" /></label>
        <label className="block text-xs text-muted">Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} autoComplete="tel" placeholder="+994 50 000 00 00" /></label>
        <label className="block text-xs text-muted">Şifrə<input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} autoComplete="new-password" /></label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={saving} className="w-full rounded-full bg-fg py-3 text-sm font-medium text-bg disabled:opacity-60">{saving ? "Yaradılır…" : "Hesab yarat"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Artıq hesabınız var? <Link href="/login" className="text-fg underline underline-offset-4">Daxil olun</Link></p>
    </div>
  );
}
