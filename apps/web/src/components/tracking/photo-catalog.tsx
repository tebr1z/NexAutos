"use client";

import { useMemo, useState } from "react";
import { groupPhotos } from "@/lib/photo-categories";
import type { TrackingPhoto } from "@/lib/types";
import { useI18n } from "@/providers/i18n-provider";

export function PhotoCatalog({ photos }: { photos: TrackingPhoto[] }) {
  const { t } = useI18n();
  const groups = useMemo(() => groupPhotos(photos ?? []), [photos]);
  const [tab, setTab] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const active = groups.find((row) => row.key === tab) ?? groups[0];

  if (!groups.length) return null;

  return (
    <section className="mt-8 rounded-3xl border border-line bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted">{t.track.photos}</p>
          <h2 className="mt-1 text-xl font-medium">Kataloq</h2>
        </div>
        <p className="text-xs text-muted">{photos.length} şəkil</p>
      </div>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {groups.map((group) => (
          <button
            key={group.key}
            type="button"
            onClick={() => setTab(group.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
              (active?.key ?? tab) === group.key
                ? "border-royal bg-royal/10 text-royal"
                : "border-line text-muted hover:text-fg"
            }`}
          >
            {t.photoCats[group.key] ?? group.key} · {group.items.length}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {(active?.items ?? []).map((photo) => (
          <button
            key={photo.id || photo.url.slice(0, 80)}
            type="button"
            onClick={() => setOpen(photo.url)}
            className="aspect-square overflow-hidden rounded-xl border border-line bg-bg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.caption ?? ""} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setOpen(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open} alt="" className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain" />
        </button>
      ) : null}
    </section>
  );
}
