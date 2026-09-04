"use client";

import { useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import type { VinRecord } from "@/lib/types";
import { useI18n } from "@/providers/i18n-provider";

export default function VinSearchPage() {
  const { t } = useI18n();
  const [vin, setVin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [record, setRecord] = useState<VinRecord | null>(null);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const clean = vin.replace(/\s/g, "").toUpperCase();
    if (clean.length !== 17) {
      setError(t.vin.invalid);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await api.vin(clean);
      setRecord(data);
    } catch {
      setError(t.vin.notFound);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pt-32 pb-24 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.4em] text-muted">Decode</p>
      <h1 className="font-display mt-3 text-4xl md:text-6xl">{t.vin.title}</h1>
      <p className="mt-4 max-w-2xl text-muted">{t.vin.subtitle}</p>

      <form onSubmit={onSearch} className="glass mt-10 flex flex-col gap-3 rounded-2xl p-3 sm:flex-row">
        <input
          value={vin}
          onChange={(e) => setVin(e.target.value)}
          placeholder={t.vin.placeholder}
          className="flex-1 bg-transparent px-4 py-3 font-mono text-sm outline-none"
        />
        <button type="submit" className="rounded-xl bg-fg px-6 py-3 text-sm text-bg">
          {loading ? t.common.loading : t.vin.search}
        </button>
      </form>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {record && (
        <div className="mt-12 space-y-10">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass rounded-3xl p-6">
              <p className="text-sm text-muted">{record.vin}</p>
              <h2 className="font-display mt-2 text-3xl">
                {record.year} {record.make} {record.model}
              </h2>
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <Spec label="Engine" value={record.engine} />
                <Spec label="Mileage" value={record.mileage?.toLocaleString()} />
                <Spec label="Fuel" value={record.fuel} />
                <Spec label="Transmission" value={record.transmission} />
                <Spec label="Exterior" value={record.exteriorColor} />
                <Spec label="Interior" value={record.interiorColor} />
                <Spec label="Auction" value={record.auctionHouse} />
                <Spec label="Status" value={record.status} />
              </dl>
            </div>
            <div className="glass rounded-3xl p-6">
              <h3 className="text-sm uppercase tracking-widest text-muted">{t.vin.damage}</h3>
              <p className="mt-3 text-sm leading-7">{record.damageHistory ?? "—"}</p>
            </div>
          </div>
          <Gallery title={t.vin.photos} urls={record.photos} />
          <Gallery title={t.vin.auctionPhotos} urls={record.auctionPhotos} />
        </div>
      )}
    </div>
  );
}

function Spec({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1">{value ?? "—"}</dd>
    </div>
  );
}

function Gallery({ title, urls }: { title: string; urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div>
      <h3 className="mb-4 text-sm uppercase tracking-widest text-muted">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {urls.map((url) => (
          <div key={url} className="relative aspect-[16/10] overflow-hidden rounded-2xl">
            <Image src={url} alt="" fill className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
