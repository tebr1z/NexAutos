"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";

const inp =
  "w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500";

type AisStatus = { configured: boolean; preview: string | null; source: "admin" | "env" | "none" };

export default function AdminSettingsPage() {
  const [status, setStatus] = useState<AisStatus | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      setStatus(await api.aisSettings());
    } catch {
      setError("Ayarlar oxunmadı. Yenidən daxil olun.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const next = key.trim();
    if (!next) {
      setError("Açar boş ola bilməz. Silmək üçün «Admin açarını sil» basın.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await api.saveAisKey(next);
      setStatus(row);
      setKey("");
      setNotice("AIS açarı yadda saxlanıldı. Gəmi xəritəsi indi bu açarla işləyir — Docker restart lazım deyil.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yazılmadı.");
    }
    setBusy(false);
  }

  async function testAis() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await api.testAisKey(key.trim());
      if (row.ok) setNotice(row.message);
      else setError(row.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AIS yoxlanılmadı.");
    }
    setBusy(false);
  }

  async function clearAdmin() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await api.saveAisKey("");
      setStatus(row);
      setKey("");
      setNotice(
        row.source === "env"
          ? "Admin açarı silindi. İndi server .env-dəki açar istifadə olunur."
          : "Açar silindi. AISStream key yazmayınca canlı gəmi yeri işləməyəcək.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinmədi.");
    }
    setBusy(false);
  }

  const sourceLabel =
    status?.source === "admin" ? "admin panel" : status?.source === "env" ? "server .env" : "yoxdur";

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-3xl">Ayarlar</h1>
      <p className="mt-2 text-sm text-zinc-400">
        AISStream açarını buradan dəyişmək olar. Konteyneri yenidən qurmaq və ya .env redaktə etmək lazım deyil.
      </p>
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {notice ? <p className="mt-4 text-sm text-emerald-400">{notice}</p> : null}

      <form className="mt-8 space-y-4 rounded-2xl border border-white/10 p-5" onSubmit={save}>
        <p className="text-sm text-zinc-300">
          Canlı AIS:{" "}
          {status?.configured ? (
            <span className="text-emerald-400">aktiv · {status.preview} · {sourceLabel}</span>
          ) : (
            <span className="text-amber-400">açar yoxdur</span>
          )}
        </p>
        <label className="block text-xs text-zinc-500">
          AISStream API key
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="aisstream.io hesabındakı açar"
            className={`${inp} mt-1 font-mono`}
          />
        </label>
        <p className="text-xs text-zinc-500">
          Açarı{" "}
          <a className="text-zinc-300 underline" href="https://aisstream.io/apikeys" target="_blank" rel="noreferrer">
            aisstream.io/apikeys
          </a>{" "}
          səhifəsindən kopyalayın. Tam açar admin ekranında saxlanmır, yalnız son 4 simvol görünür.
        </p>
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50">
            {busy ? "…" : "Yadda saxla"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void testAis()}
            className="rounded-xl border border-emerald-500/40 px-4 py-3 text-xs text-emerald-300 disabled:opacity-40"
          >
            AIS-i yoxla
          </button>
          <button
            type="button"
            disabled={busy || status?.source !== "admin"}
            onClick={() => void clearAdmin()}
            className="rounded-xl border border-white/15 px-4 py-3 text-xs text-zinc-300 disabled:opacity-40"
          >
            Admin açarını sil
          </button>
        </div>
      </form>
    </div>
  );
}
