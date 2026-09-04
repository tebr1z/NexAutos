export const PHOTO_CATEGORIES = [
  "auction",
  "depot",
  "exterior",
  "interior",
  "engine",
  "damage",
  "loading",
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, { en: string; az: string }> = {
  auction: { en: "Auction", az: "Hərrac" },
  depot: { en: "Depot / yard", az: "Depo" },
  exterior: { en: "Exterior", az: "Gövdə" },
  interior: { en: "Interior", az: "Salon" },
  engine: { en: "Engine", az: "Mühərrik" },
  damage: { en: "Damage", az: "Zədə" },
  loading: { en: "Loading / container", az: "Yükləmə" },
};

export function isPhotoCategory(value?: string | null): value is PhotoCategory {
  return !!value && (PHOTO_CATEGORIES as readonly string[]).includes(value);
}

export type PhotosByCategory = Record<PhotoCategory, string[]>;

export function emptyPhotos(): PhotosByCategory {
  return Object.fromEntries(PHOTO_CATEGORIES.map((c) => [c, []])) as PhotosByCategory;
}

export function flattenPhotos(photos: PhotosByCategory) {
  return PHOTO_CATEGORIES.flatMap((category) =>
    photos[category].map((url) => ({ url, category, caption: PHOTO_CATEGORY_LABELS[category].az })),
  );
}

export function photosFromList(photos: { url: string; category?: string | null }[]): PhotosByCategory {
  const next = emptyPhotos();
  for (const photo of photos) {
    const category = isPhotoCategory(photo.category) ? photo.category : "auction";
    next[category].push(photo.url);
  }
  return next;
}

export function groupPhotos<T extends { category?: string | null }>(photos: T[]) {
  const groups: { key: string; items: T[] }[] = [];
  for (const category of PHOTO_CATEGORIES) {
    const items = photos.filter((p) => p.category === category);
    if (items.length) groups.push({ key: category, items });
  }
  const other = photos.filter((p) => !isPhotoCategory(p.category));
  if (other.length) groups.push({ key: "other", items: other });
  return groups;
}
