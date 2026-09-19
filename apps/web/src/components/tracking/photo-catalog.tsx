"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { groupPhotos } from "@/lib/photo-categories";
import type { TrackingPhoto } from "@/lib/types";
import { useI18n } from "@/providers/i18n-provider";

export function PhotoCatalog({ photos }: { photos: TrackingPhoto[] }) {
  const { t } = useI18n();
  const groups = useMemo(() => groupPhotos(photos ?? []), [photos]);
  const [tab, setTab] = useState("");
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const active = groups.find((row) => row.key === tab) ?? groups[0];
  const items = active?.items ?? [];
  const current = items[index] ?? items[0];

  useEffect(() => {
    setIndex(0);
    scroller.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [active?.key]);

  if (!groups.length) return null;

  function scrollToIndex(next: number) {
    const el = scroller.current;
    const slide = el?.children[next] as HTMLElement | undefined;
    if (el && slide) el.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
  }

  function go(delta: number) {
    if (!items.length) return;
    setIndex((i) => {
      const next = (i + delta + items.length) % items.length;
      scrollToIndex(next);
      return next;
    });
  }

  return (
    <section className="mt-8 rounded-3xl border border-line bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted">{t.track.photos}</p>
          <h2 className="mt-1 text-xl font-medium">Kataloq</h2>
        </div>
        <p className="text-xs text-muted">
          {items.length ? `${index + 1} / ${items.length}` : "0"} · {photos.length} şəkil
        </p>
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

      <div className="relative mt-4">
        <div
          ref={scroller}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            const next = [...el.children].findIndex((child) => {
              const node = child as HTMLElement;
              return Math.abs(node.offsetLeft - el.scrollLeft) < node.clientWidth / 2;
            });
            if (next >= 0 && next !== index) setIndex(next);
          }}
        >
          {items.map((photo, i) => (
            <button
              key={photo.id || photo.url.slice(0, 80)}
              type="button"
              onClick={() => {
                setIndex(i);
                setOpen(true);
              }}
              className="h-[52vw] max-h-[22rem] min-h-[14rem] w-full shrink-0 snap-center overflow-hidden rounded-2xl border border-line bg-bg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption ?? ""} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        {items.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Əvvəlki"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Növbəti"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <ChevronRight size={20} />
            </button>
          </>
        ) : null}
      </div>

      {open && current ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <button type="button" className="absolute inset-0" aria-label="Bağla" onClick={() => setOpen(false)} />
          {items.length > 1 ? (
            <button
              type="button"
              aria-label="Əvvəlki"
              onClick={() => go(-1)}
              className="relative z-10 mr-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <ChevronLeft size={22} />
            </button>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt=""
            className="relative z-10 max-h-[88vh] max-w-[min(92vw,56rem)] rounded-2xl object-contain"
          />
          {items.length > 1 ? (
            <button
              type="button"
              aria-label="Növbəti"
              onClick={() => go(1)}
              className="relative z-10 ml-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <ChevronRight size={22} />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
