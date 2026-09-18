"use client";

import {
  PHOTO_CATEGORIES,
  PHOTO_CATEGORY_LABELS,
  type PhotoCategory,
  type PhotosByCategory,
} from "@/lib/photo-categories";

async function readPhotos(files: FileList | null) {
  if (!files?.length) return [] as string[];
  const picked = [...files].slice(0, 12);
  return Promise.all(picked.map(compressImage));
}

function compressImage(file: File) {
  return new Promise<string>((resolve) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1400;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.74));
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(file);
    };
    img.src = blobUrl;
  });
}

export function PhotoFields({
  value,
  onChange,
}: {
  value: PhotosByCategory;
  onChange: (next: PhotosByCategory) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Kateqoriya üzrə şəkil yükləyin. Boş kateqoriyalar müştəri səhifəsində görünməyəcək.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PHOTO_CATEGORIES.map((category) => (
          <CategoryDropzone
            key={category}
            category={category}
            urls={value[category]}
            onAdd={async (files) => {
              const next = await readPhotos(files);
              if (!next.length) return;
              onChange({ ...value, [category]: [...value[category], ...next] });
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
}: {
  category: PhotoCategory;
  urls: string[];
  onAdd: (files: FileList | null) => void;
  onRemove: (url: string) => void;
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
          className="hidden"
          onChange={(e) => {
            onAdd(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {urls.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {urls.map((src) => (
            <button
              key={src.slice(0, 48)}
              type="button"
              onClick={() => onRemove(src)}
              className="relative aspect-[4/3] overflow-hidden rounded-md"
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
