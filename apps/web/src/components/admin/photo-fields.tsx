"use client";

import {
  PHOTO_CATEGORIES,
  PHOTO_CATEGORY_LABELS,
  type PhotoCategory,
  type PhotosByCategory,
} from "@/lib/photo-categories";
import { compressImageFile } from "@/lib/fit-image";
import { useState } from "react";

export function PhotoFields({
  value,
  onChange,
}: {
  value: PhotosByCategory;
  onChange: (next: PhotosByCategory) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Şəkil sayı və fayl ölçüsü məhdudiyyəti yoxdur. Şəkillər telefon üçün optimallaşdırılır. Hazır olanda sifarişi yadda saxlayın.
      </p>
      {message && <p role="status" className="text-sm text-sky-300">{message}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {PHOTO_CATEGORIES.map((category) => (
          <CategoryDropzone
            key={category}
            category={category}
            urls={value[category]}
            disabled={busy}
            onAdd={async (files) => {
              if (!files?.length || busy) return;
              const picked = Array.from(files);
              const next: string[] = [];
              const failed: string[] = [];
              setBusy(true);
              for (const [index, file] of picked.entries()) {
                setMessage(`Şəkillər hazırlanır: ${index + 1} / ${picked.length}`);
                try { next.push(await compressImageFile(file)); }
                catch { failed.push(file.name); }
              }
              if (next.length) onChange({ ...value, [category]: [...value[category], ...next] });
              setMessage(`${next.length} şəkil əlavə edildi.${failed.length ? ` Oxunmadı: ${failed.join(', ')}` : ''}`);
              setBusy(false);
            }}
            onRemove={(url) =>
              onChange({ ...value, [category]: value[category].filter((item) => item !== url) })
            }
          />
        ))}
      </div>
    </div>
  );
}

function CategoryDropzone({
  category,
  urls,
  onAdd,
  onRemove,
  disabled,
}: {
  category: PhotoCategory;
  urls: string[];
  onAdd: (files: FileList | null) => void;
  onRemove: (url: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 p-3">
      <label className="block cursor-pointer rounded-lg border border-dashed border-white/20 px-3 py-4 text-center">
        <span className="block text-sm text-white">{PHOTO_CATEGORY_LABELS[category].az}</span>
        <span className="mt-1 block text-[11px] text-zinc-500">
          {urls.length ? `${urls.length} şəkil` : "Yüklə"}
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            onAdd(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {urls.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-1">
          {urls.map((src, index) => (
            <button
              key={`${index}-${src.slice(-48)}`}
              type="button"
              disabled={disabled}
              onClick={() => onRemove(src)}
              className="relative aspect-square overflow-hidden rounded-md"
              title="Sil"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
