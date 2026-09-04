"use client";

import { useState } from "react";
import { api, type VesselHit, type VesselPosition } from "@/lib/api";
import { useI18n } from "@/providers/i18n-provider";

export function VesselSearch() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hits, setHits] = useState<VesselHit[]>([]);
  const [vessel, setVessel] = useState<VesselPosition | null>(null);

  async function loadPosition(mmsi: string) {
    const data = await api.vesselPosition(mmsi);
    setVessel(data);
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setError(t.vessel.empty);
      return;
    }
    setError("");
    setHits([]);
    setVessel(null);
    setLoading(true);
    try {
      if (/^\d{9}$/.test(q)) {
        await loadPosition(q);
        return;
      }
      const data = await api.searchVessels(q);
      const rows = (data.results || []).filter((row) => row.mmsi);
      setHits(rows);
      if (rows.length === 1) await loadPosition(String(rows[0].mmsi));
      else if (rows.length === 0) setError(t.vessel.notFound);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.vessel.notFound);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pt-32 pb-24 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.4em] text-muted">AIS</p>
      <h1 className="font-display mt-3 text-4xl md:text-6xl">{t.vessel.title}</h1>
      <p className="mt-4 max-w-2xl text-muted">{t.vessel.subtitle}</p>

      <form onSubmit={onSearch} className="glass mt-10 flex flex-col gap-3 rounded-2xl p-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.vessel.placeholder}
          className="flex-1 bg-transparent px-4 py-3 font-mono text-sm outline-none"
        />
        <button type="submit" className="rounded-xl bg-fg px-6 py-3 text-sm text-bg" disabled={loading}>
          {loading ? t.common.loading : t.vessel.search}
        </button>
      </form>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {hits.length > 1 && (
        <ul className="mt-8 grid gap-2">
          {hits.map((row) => (
            <li key={row.mmsi}>
              <button
                type="button"
                className={`glass w-full rounded-2xl px-5 py-4 text-left transition hover:bg-fg/5 ${
                  vessel?.mmsi === row.mmsi ? "ring-1 ring-royal" : ""
                }`}
                onClick={() => {
                  setLoading(true);
                  loadPosition(String(row.mmsi)).finally(() => setLoading(false));
                }}
              >
                <strong>{row.name}</strong>
                <span className="mt-1 block text-xs text-muted">
                  {t.vessel.mmsi} {row.mmsi} · {t.vessel.imo} {row.imo ?? "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {vessel && (
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glass overflow-hidden rounded-3xl">
            {vessel.hasCoordinates && vessel.latitude != null && vessel.longitude != null ? (
              <iframe
                title={vessel.name ?? t.vessel.title}
                className="h-[420px] w-full border-0"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${vessel.longitude - 2.2}%2C${vessel.latitude - 1.3}%2C${vessel.longitude + 2.2}%2C${vessel.latitude + 1.3}&layer=mapnik&marker=${vessel.latitude}%2C${vessel.longitude}`}
              />
            ) : (
              <p className="p-8 text-sm text-muted">{t.vessel.noCoords}</p>
            )}
          </div>
          <div className="glass rounded-3xl p-6">
            <p className="text-xs uppercase tracking-widest text-muted">{vessel.source}</p>
            <h2 className="font-display mt-2 text-3xl">{vessel.name || "—"}</h2>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <Spec label={t.vessel.mmsi} value={String(vessel.mmsi)} />
              <Spec label={t.vessel.imo} value={vessel.imo ? String(vessel.imo) : undefined} />
              <Spec label="Latitude" value={fmtCoord(vessel.latitude)} />
              <Spec label="Longitude" value={fmtCoord(vessel.longitude)} />
              <Spec label={t.vessel.speed} value={vessel.speed != null ? `${vessel.speed} kn` : undefined} />
              <Spec label={t.vessel.course} value={vessel.course != null ? `${vessel.course}°` : undefined} />
              <Spec label={t.vessel.heading} value={vessel.heading != null ? `${vessel.heading}°` : undefined} />
              <Spec label={t.vessel.destination} value={vessel.destination ?? undefined} />
              <Spec label={t.vessel.status} value={vessel.aisStatus ?? undefined} />
              <Spec label={t.vessel.updated} value={vessel.lastUpdate ?? undefined} />
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtCoord(n: number | null) {
  if (typeof n !== "number" || Number.isNaN(n)) return undefined;
  return n.toFixed(5);
}

function Spec({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1">{value ?? "—"}</dd>
    </div>
  );
}
