"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";

const inp =
  "w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500";

type AisStatus = { configured: boolean; preview: string | null; source: "admin" | "env" | "none" };
type CloudStatus = {
  configured: boolean;
  source: "admin" | "env" | "none";
  cloudName: string;
  apiKeyPreview: string;
  apiSecretPreview: string;
};

const EMPTY_CLOUD = { cloudName: "", apiKey: "", apiSecret: "" };

export default function AdminSettingsPage() {
  const [status, setStatus] = useState<AisStatus | null>(null);
  const [cloud, setCloud] = useState<CloudStatus | null>(null);
  const [cloudForm, setCloudForm] = useState(EMPTY_CLOUD);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      const [ais, media] = await Promise.all([api.aisSettings(), api.cloudinarySettings()]);
      setStatus(ais);
      setCloud(media);
      setCloudForm({
        cloudName: media.cloudName || "",
        apiKey: media.apiKeyPreview || "",
        apiSecret: media.apiSecretPreview || "",
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
  const cloudSource =
    cloud?.source === "admin" ? "admin panel" : cloud?.source === "env" ? "server .env" : "yoxdur";

  async function saveCloud(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await api.saveCloudinarySettings(cloudForm);
      setCloud(row);
      setNotice("Cloudinary yadda saxlanıldı. Şəkillər VIN qovluğunda saxlanır. Docker restart lazım deyil.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cloudinary yazılmadı.");
    }
    setBusy(false);
  }

  async function testCloud() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await api.testCloudinarySettings(cloudForm);
      if (row.ok) setNotice(row.message);
      else setError(row.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cloudinary yoxlanılmadı.");
    }
    setBusy(false);
  }

  async function clearCloud() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await api.saveCloudinarySettings({ clear: true });
      setCloud(row);
      setNotice(
        row.source === "env"
          ? "Admin Cloudinary silindi. İndi .env açarları qalır."
          : "Cloudinary silindi. Şəkillər bazada qalacaq.",
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
        AIS və Cloudinary-ni buradan yazın. .env və konteyner restart lazım deyil.
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

      <form className="mt-10 space-y-4 rounded-2xl border border-white/10 p-5" onSubmit={saveCloud}>
        <p className="text-sm text-zinc-300">
          Cloudinary:{" "}
          {cloud?.configured ? (
            <span className="text-emerald-400">aktiv · {cloud.cloudName} · {cloudSource}</span>
          ) : (
            <span className="text-amber-400">açar yoxdur — şəkillər bazada qalır</span>
          )}
        </p>
        <p className="text-xs text-zinc-500">
          Cloudinary dashboard → Settings → Product Environment Credentials. Şəkillər{" "}
          <span className="font-mono text-zinc-300">catalog/VIN/…</span> qovluğuna yazılır. Sistemdən silinəndə
          Cloudinary-dən də silinir.
        </p>
        <label className="block text-xs text-zinc-500">
          Cloud name
          <input
            value={cloudForm.cloudName}
            onChange={(e) => setCloudForm({ ...cloudForm, cloudName: e.target.value.trim() })}
            className={`${inp} mt-1 font-mono`}
            placeholder="cpyig7an"
            autoComplete="off"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          API key
          <input
            value={cloudForm.apiKey}
            onChange={(e) => setCloudForm({ ...cloudForm, apiKey: e.target.value.trim() })}
            className={`${inp} mt-1 font-mono`}
            placeholder="545964837536995"
            autoComplete="off"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          API secret
          <input
            type="password"
            value={cloudForm.apiSecret}
            onChange={(e) => setCloudForm({ ...cloudForm, apiSecret: e.target.value })}
            className={`${inp} mt-1 font-mono`}
            autoComplete="off"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50">
            {busy ? "…" : "Cloudinary yadda saxla"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void testCloud()}
            className="rounded-xl border border-emerald-500/40 px-4 py-3 text-xs text-emerald-300 disabled:opacity-40"
          >
            {busy ? "Yoxlanır…" : "Cloudinary-ni yoxla"}
          </button>
          <button
            type="button"
            disabled={busy || cloud?.source !== "admin"}
            onClick={() => void clearCloud()}
            className="rounded-xl border border-white/15 px-4 py-3 text-xs text-zinc-300 disabled:opacity-40"
          >
            Admin Cloudinary-ni sil
          </button>
        </div>
      </form>
    </div>
  );
}
