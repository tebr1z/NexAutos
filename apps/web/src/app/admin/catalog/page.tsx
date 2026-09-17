"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, type CatalogCar } from "@/lib/api";

const inp =
  "w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500";

const EMPTY = {
  title: "",
  year: "",
  make: "",
  model: "",
  auction: "",
  color: "",
  priceUsd: "",
  priceLabel: "",
  imageUrl: "",
  description: "",
  published: true,
  sortOrder: "0",
};

function payload(form: typeof EMPTY) {
  return {
    title: form.title.trim(),
    year: form.year ? Number(form.year) : undefined,
    make: form.make.trim() || undefined,
    model: form.model.trim() || undefined,
    auction: form.auction.trim() || undefined,
    color: form.color.trim() || undefined,
    priceUsd: form.priceUsd ? Number(form.priceUsd) : undefined,
    priceLabel: form.priceLabel.trim() || undefined,
    imageUrl: form.imageUrl.trim(),
    description: form.description.trim() || undefined,
    published: form.published,
    sortOrder: form.sortOrder ? Number(form.sortOrder) : 0,
  };
}

function fromRow(row: CatalogCar): typeof EMPTY {
  return {
    title: row.title,
    year: row.year != null ? String(row.year) : "",
    make: row.make ?? "",
    model: row.model ?? "",
    auction: row.auction ?? "",
    color: row.color ?? "",
    priceUsd: row.priceUsd != null ? String(row.priceUsd) : "",
    priceLabel: row.priceLabel ?? "",
    imageUrl: row.imageUrl,
    description: row.description ?? "",
    published: row.published,
    sortOrder: String(row.sortOrder ?? 0),
  };
}

export default function CatalogAdminPage() {
  const [rows, setRows] = useState<CatalogCar[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const list = await api.catalogManage();
    setRows(list);
  }

  useEffect(() => {
    refresh().catch(() => setError("Kataloq yüklənmədi."));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.imageUrl.trim()) return;
    setSaving(true);
    setError("");
    try {
      const body = payload(form);
      if (editingId) await api.updateCatalogCar(editingId, body);
      else await api.createCatalogCar(body);
      setForm(EMPTY);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yadda saxlanılmadı.");
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl">Sayt kataloqu</h1>
      <p className="mt-2 text-sm text-zinc-400">
        /cars səhifəsində görünən maşınlar. Əlavə edin, redaktə edin və ya silin.
      </p>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <form className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2" onSubmit={submit}>
        <input required placeholder="Başlıq — 2021 Tesla Model 3 *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${inp} sm:col-span-2`} />
        <input placeholder="Marka" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} className={inp} />
        <input placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className={inp} />
        <input placeholder="İl" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className={inp} />
        <input placeholder="Hərrac — Copart, IAAI…" value={form.auction} onChange={(e) => setForm({ ...form, auction: e.target.value })} className={inp} />
        <input placeholder="Rəng" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inp} />
        <input placeholder="Qiymət USD — 28450" value={form.priceUsd} onChange={(e) => setForm({ ...form, priceUsd: e.target.value })} className={inp} />
        <input placeholder="Qiymət yazısı — $28,450" value={form.priceLabel} onChange={(e) => setForm({ ...form, priceLabel: e.target.value })} className={inp} />
        <input placeholder="Sıra (kiçik rəqəm əvvəl)" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={inp} />
        <input required placeholder="Şəkil URL * (https://…)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className={`${inp} sm:col-span-2 font-mono text-xs`} />
        <textarea placeholder="Qısa qeyd" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inp} min-h-24 sm:col-span-2`} />
        <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
          <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
          Saytda göstər
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button disabled={saving} className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50">
            {saving ? "Yazılır…" : editingId ? "Yenilə" : "Kataloqa əlavə et"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
              }}
              className="px-5 py-3 text-sm text-zinc-400"
            >
              Ləğv et
            </button>
          )}
        </div>
      </form>

      <div className="mt-10 space-y-3">
        {rows.length === 0 && !error && <p className="text-sm text-zinc-500">Kataloq boşdur.</p>}
        {rows.map((row) => (
          <article key={row.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.imageUrl} alt="" className="h-16 w-24 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-white">{row.title}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {[row.auction, row.color, row.published ? "saytda" : "gizli"].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="text-xs text-sky-400 hover:underline"
                onClick={() => {
                  setEditingId(row.id);
                  setForm(fromRow(row));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Redaktə
              </button>
              <button
                type="button"
                className="text-xs text-red-400 hover:underline"
                onClick={async () => {
                  if (!window.confirm("Bu maşın kataloqdan silinsin?")) return;
                  try {
                    await api.deleteCatalogCar(row.id);
                    if (editingId === row.id) {
                      setEditingId(null);
                      setForm(EMPTY);
                    }
                    await refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Silinmədi.");
                  }
                }}
              >
                Sil
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
