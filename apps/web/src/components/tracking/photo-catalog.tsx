"use client";

import { useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Expand, ImageOff, X } from "lucide-react";
import { groupPhotos, PHOTO_CATEGORY_LABELS } from "@/lib/photo-categories";
import type { TrackingPhoto } from "@/lib/types";
import { useI18n } from "@/providers/i18n-provider";

function Photo({ photo, alt, thumbnail = false }: { photo: TrackingPhoto; alt: string; thumbnail?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted"><ImageOff size={thumbnail ? 18 : 32} />{!thumbnail && <span className="text-sm">Şəkil yüklənmədi</span>}</span>;
  // Uploaded photos may be data URLs or private storage URLs; preserve their original proportions.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photo.url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={`h-full w-full ${thumbnail ? "object-cover" : "object-contain"}`} />;
}

export function PhotoCatalog({ photos }: { photos: TrackingPhoto[] }) {
  const { t, locale } = useI18n();
  const groups = useMemo(() => groupPhotos(photos ?? []), [photos]);
  const [tab, setTab] = useState("");
  const [selection, setSelection] = useState({ key: "", index: 0 });
  const [open, setOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const active = groups.find((row) => row.key === tab) ?? groups[0];
  const items = active?.items ?? [];
  const index = selection.key === active?.key ? Math.min(selection.index, Math.max(items.length - 1, 0)) : 0;
  const current = items[index];
  const categoryLabel = (key: string) => {
    const labels = PHOTO_CATEGORY_LABELS[key as keyof typeof PHOTO_CATEGORY_LABELS];
    return t.photoCats[key] ?? (labels ? labels[locale === "az" ? "az" : "en"] : "Digər şəkillər");
  };
  const activeLabel = active ? categoryLabel(active.key) : "";

  if (!groups.length) return null;

  function select(next: number, behavior: ScrollBehavior = "smooth") {
    if (!active || !items.length) return;
    const bounded = (next + items.length) % items.length;
    setSelection({ key: active.key, index: bounded });
    const el = scroller.current;
    if (el && !open) el.scrollTo({ left: bounded * el.clientWidth, behavior });
  }

  function changeOpen(next: boolean) {
    if (!next && scroller.current) scroller.current.scrollTo({ left: index * scroller.current.clientWidth, behavior: "instant" });
    setOpen(next);
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-line bg-card p-4 sm:p-6" aria-label={t.track.photos}>
      <div className="flex items-end justify-between gap-3">
        <div><p className="text-[11px] uppercase tracking-[0.2em] text-muted">{t.track.photos}</p><h2 className="mt-1 text-xl font-semibold">Avtomobilin foto tarixçəsi</h2></div>
        <span className="shrink-0 rounded-full bg-bg px-3 py-2 text-xs text-muted">{photos.length} şəkil</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">Hərracdan təhvilədək şəkillər mərhələlər üzrə. Tam ölçüdə baxmaq üçün şəklin üzərinə vurun.</p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Foto mərhələləri">
        {groups.map((group) => <button key={group.key} type="button" aria-pressed={active?.key === group.key} onClick={() => { setTab(group.key); setSelection({ key: group.key, index: 0 }); scroller.current?.scrollTo({ left: 0, behavior: "instant" }); }} className={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition ${active?.key === group.key ? "border-royal bg-royal/10 text-royal" : "border-line text-muted hover:border-royal/40 hover:text-fg"}`}>{categoryLabel(group.key)} <span className="ml-1 opacity-60">{group.items.length}</span></button>)}
      </div>

      <div className="relative mt-2 overflow-hidden rounded-2xl border border-line bg-bg">
        <div ref={scroller} key={active?.key} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onScroll={(event) => { const el = event.currentTarget; if (!open && el.clientWidth && active) { const next = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollLeft / el.clientWidth))); if (next !== index) setSelection({ key: active.key, index: next }); } }}>
          {items.map((photo, i) => <button key={`${photo.id || photo.url}-${i}`} type="button" aria-label={`${activeLabel}, şəkil ${i + 1}. Tam ölçüdə aç`} onClick={(event) => { opener.current = event.currentTarget; setSelection({ key: active!.key, index: i }); setOpen(true); }} className="relative h-[65vw] max-h-[32rem] min-h-[15rem] w-full shrink-0 snap-center p-2 sm:h-[28rem] sm:p-4"><Photo key={photo.url} photo={photo} alt={photo.caption || `${activeLabel} — şəkil ${i + 1}`} /></button>)}
        </div>
        {items.length > 1 && <><button type="button" aria-label="Əvvəlki şəkil" onClick={() => select(index - 1)} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white shadow-lg hover:bg-black/85"><ChevronLeft size={23} /></button><button type="button" aria-label="Növbəti şəkil" onClick={() => select(index + 1)} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white shadow-lg hover:bg-black/85"><ChevronRight size={23} /></button></>}
        <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1.5 text-xs text-white" aria-live="polite">{index + 1} / {items.length}</span>
        <button type="button" aria-label="Şəkli tam ölçüdə aç" onClick={(event) => { opener.current = event.currentTarget; setOpen(true); }} className="absolute bottom-3 right-3 rounded-full bg-black/65 p-2 text-white"><Expand size={19} /></button>
      </div>
      <p className="mt-3 min-h-5 text-sm text-muted">{current?.caption || activeLabel}</p>
      {items.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Şəkil seçimi">{items.map((photo, i) => <button key={`${photo.id || photo.url}-${i}`} type="button" aria-label={`Şəkil ${i + 1}`} aria-pressed={i === index} onClick={() => select(i)} className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition sm:h-20 sm:w-28 ${i === index ? "border-royal ring-2 ring-royal/15" : "border-transparent opacity-60 hover:opacity-100"}`}><Photo key={photo.url} photo={photo} alt={photo.caption || `${activeLabel} ${i + 1}`} thumbnail /></button>)}</div>}

      <Dialog.Root open={open} onOpenChange={changeOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm" />
          <Dialog.Content onCloseAutoFocus={(event) => { event.preventDefault(); opener.current?.focus({ preventScroll: true }); }} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); select(index - 1); } if (event.key === "ArrowRight") { event.preventDefault(); select(index + 1); } }} className="fixed left-1/2 top-1/2 z-[81] flex h-[min(92dvh,64rem)] w-[96vw] max-w-7xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/15 bg-neutral-950 p-3 text-white outline-none sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-4 pr-12"><div><Dialog.Title className="text-sm font-medium">{activeLabel} · {index + 1} / {items.length}</Dialog.Title><Dialog.Description className="mt-1 text-xs text-white/60">Şəkilləri dəyişmək üçün oxlardan istifadə edin. Bağlamaq: Esc.</Dialog.Description></div></div>
            <Dialog.Close aria-label="Bağla" className="absolute right-3 top-3 rounded-full bg-white/10 p-3 hover:bg-white/20"><X size={21} /></Dialog.Close>
            <div className="relative min-h-0 flex-1">{current && <Photo key={current.url} photo={current} alt={current.caption || activeLabel} />}{items.length > 1 && <><button type="button" aria-label="Əvvəlki şəkil" onClick={() => select(index - 1)} className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white"><ChevronLeft size={25} /></button><button type="button" aria-label="Növbəti şəkil" onClick={() => select(index + 1)} className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-3 text-white"><ChevronRight size={25} /></button></>}</div>
            <p className="mt-3 text-center text-sm text-white/75" aria-live="polite">{current?.caption || activeLabel}</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
