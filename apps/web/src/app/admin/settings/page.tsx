"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";

const inp =
  "w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500";

type AisStatus = { configured: boolean; preview: string | null; source: "admin" | "env" | "none" };
type R2Status = {
  configured: boolean;
  source: "admin" | "env" | "none";
  accountId: string;
  endpoint: string;
  bucket: string;
  publicUrl: string;
  accessKeyPreview: string;
  secretPreview: string;
  tokenPreview: string;
};

const EMPTY_R2 = {
  accountId: "",
  endpoint: "",
  accessKeyId: "",
  secretAccessKey: "",
  apiToken: "",
  bucket: "nex-autos",
  publicUrl: "",
};

export default function AdminSettingsPage() {
  const [status, setStatus] = useState<AisStatus | null>(null);
  const [r2, setR2] = useState<R2Status | null>(null);
  const [r2Form, setR2Form] = useState(EMPTY_R2);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      const [ais, cloud] = await Promise.all([api.aisSettings(), api.r2Settings()]);
      setStatus(ais);
      setR2(cloud);
      setR2Form({
        accountId: cloud.accountId || "",
        endpoint: cloud.endpoint || "",
        accessKeyId: cloud.accessKeyPreview || "",
        secretAccessKey: cloud.secretPreview || "",
        apiToken: cloud.tokenPreview || "",
        bucket: cloud.bucket || "nex-autos",
        publicUrl: cloud.publicUrl || "",
      });
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
  const r2Source =
    r2?.source === "admin" ? "admin panel" : r2?.source === "env" ? "server .env" : "yoxdur";

  async function saveR2(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await api.saveR2Settings(r2Form);
      setR2(row);
      setNotice("Cloudflare R2 yadda saxlanıldı. Foto yükləməsi indi bu açarlarla işləyir — .env və Docker restart lazım deyil.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "R2 yazılmadı.");
    }
    setBusy(false);
  }

  async function testR2() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await api.testR2Settings(r2Form);
      if (row.ok) {
        if (row.endpoint) setR2Form((current) => ({ ...current, endpoint: row.endpoint || current.endpoint }));
        setNotice(row.message);
      } else setError(row.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "R2 yoxlanılmadı.");
    }
    setBusy(false);
  }

  async function clearR2() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await api.saveR2Settings({ clear: true });
      setR2(row);
      setNotice(
        row.source === "env"
          ? "Admin R2 silindi. İndi server .env-dəki açarlar qalır."
          : "R2 silindi. Şəkillər Postgres-də saxlanacaq.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinmədi.");
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl">Ayarlar</h1>
      <p className="mt-2 text-sm text-zinc-400">
        AIS və Cloudflare R2-ni buradan yeniləyin. .env və konteyner restart lazım deyil.
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
            {busy ? "Yoxlanır…" : "AIS-i yoxla"}
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

      <form className="mt-10 space-y-4 rounded-2xl border border-white/10 p-5" onSubmit={saveR2}>
        <p className="text-sm text-zinc-300">
          Cloudflare R2:{" "}
          {r2?.configured ? (
            <span className="text-emerald-400">aktiv · {r2Source}</span>
          ) : (
            <span className="text-amber-400">açar yoxdur — şəkillər bazada qalır</span>
          )}
        </p>
        <p className="text-xs text-zinc-500">
          Cloudflare dashboard → R2 → Manage API tokens → <b>S3 Access Key ID</b> və{" "}
          <b>Secret Access Key</b>. API Token S3 Secret deyil — Access Denied ona görə olur.
        </p>
        <label className="block text-xs text-zinc-500">
          Account ID
          <input
            value={r2Form.accountId}
            onChange={(e) => setR2Form({ ...r2Form, accountId: e.target.value.trim() })}
            className={`${inp} mt-1 font-mono`}
            placeholder="Cloudflare Account ID"
            autoComplete="off"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Endpoint
          <input
            value={r2Form.endpoint}
            onChange={(e) => setR2Form({ ...r2Form, endpoint: e.target.value.trim() })}
            className={`${inp} mt-1 font-mono`}
            placeholder="https://ACCOUNT.r2.cloudflarestorage.com"
            autoComplete="off"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          S3 Access Key ID
          <input
            value={r2Form.accessKeyId}
            onChange={(e) => setR2Form({ ...r2Form, accessKeyId: e.target.value })}
            className={`${inp} mt-1 font-mono`}
            autoComplete="off"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          S3 Secret Access Key
          <input
            type="password"
            value={r2Form.secretAccessKey}
            onChange={(e) => setR2Form({ ...r2Form, secretAccessKey: e.target.value })}
            className={`${inp} mt-1 font-mono`}
            autoComplete="off"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Bucket
          <input
            value={r2Form.bucket}
            onChange={(e) => setR2Form({ ...r2Form, bucket: e.target.value.trim() })}
            className={`${inp} mt-1 font-mono`}
            placeholder="nex-autos"
            autoComplete="off"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Public URL (istəyə bağlı)
          <input
            value={r2Form.publicUrl}
            onChange={(e) => setR2Form({ ...r2Form, publicUrl: e.target.value.trim() })}
            className={`${inp} mt-1 font-mono`}
            placeholder="https://pub-….r2.dev"
            autoComplete="off"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          API Token (yalnız public domain, istəyə bağlı)
          <input
            type="password"
            value={r2Form.apiToken}
            onChange={(e) => setR2Form({ ...r2Form, apiToken: e.target.value })}
            className={`${inp} mt-1 font-mono`}
            autoComplete="off"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50">
            {busy ? "…" : "R2 yadda saxla"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void testR2()}
            className="rounded-xl border border-emerald-500/40 px-4 py-3 text-xs text-emerald-300 disabled:opacity-40"
          >
            {busy ? "Yoxlanır…" : "R2-ni yoxla"}
          </button>
          <button
            type="button"
            disabled={busy || r2?.source !== "admin"}
            onClick={() => void clearR2()}
            className="rounded-xl border border-white/15 px-4 py-3 text-xs text-zinc-300 disabled:opacity-40"
          >
            Admin R2-ni sil
          </button>
        </div>
      </form>
    </div>
  );
}
