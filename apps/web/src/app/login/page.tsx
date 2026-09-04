"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="mx-auto max-w-md px-5 pt-32 pb-24">
      <h1 className="font-display text-4xl">Admin</h1>
      <p className="mt-3 text-sm text-muted">Yalnız Auto Nex əməkdaşı. Müştəri hesabı yoxdur — izləmə kodu kifayətdir.</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const user = await login(email, password);
            if (user.role === "CUSTOMER") {
              setError("Müştəri girişi bağlıdır. İzləmə kodunu /track səhifəsinə yazın.");
              return;
            }
            router.push("/admin");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Giriş olmadı");
          }
        }}
      >
        <label className="block text-xs text-muted">
          E-poçt
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-transparent px-4 py-3 text-sm"
            placeholder="admin@nex.autos"
          />
        </label>
        <label className="block text-xs text-muted">
          Şifrə
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-line bg-transparent px-4 py-3 text-sm"
            placeholder="Şifrə"
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="w-full rounded-full bg-fg py-3 text-sm text-bg">Daxil ol</button>
      </form>
    </div>
  );
}
