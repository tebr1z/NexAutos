"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { useI18n } from "@/providers/i18n-provider";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="mx-auto max-w-md px-5 pt-32 pb-24">
      <p className="text-[11px] uppercase tracking-[0.35em] text-royal">{t.auth.loginKicker}</p>
      <h1 className="font-display mt-3 text-4xl">{t.auth.loginTitle}</h1>
      <p className="mt-3 text-sm text-muted">{t.auth.loginHint}</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const user = await login(email, password);
            router.push(user.role === "CUSTOMER" ? "/account" : "/admin");
          } catch (err) {
            setError(err instanceof Error ? err.message : t.auth.loginFail);
          }
        }}
      >
        <label className="block text-xs text-muted">
          {t.auth.email}
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-transparent px-4 py-3 text-sm"
            placeholder="email@example.com"
          />
        </label>
        <label className="block text-xs text-muted">
          {t.auth.password}
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-line bg-transparent px-4 py-3 text-sm"
            placeholder={t.auth.password}
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="w-full rounded-full bg-fg py-3 text-sm text-bg">{t.auth.loginBtn}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t.auth.noAccount}{" "}
        <Link href="/register" className="text-fg underline underline-offset-4">{t.auth.registerLink}</Link>
      </p>
    </div>
  );
}
