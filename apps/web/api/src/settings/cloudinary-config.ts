export const CLOUDINARY_SETTING = "cloudinary";

export type CloudinaryCreds = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export function emptyCloudinary(): CloudinaryCreds {
  return { cloudName: "", apiKey: "", apiSecret: "" };
}

export function cloudinaryReady(c: CloudinaryCreds) {
  return Boolean(c.cloudName && c.apiKey && c.apiSecret);
}

export function parseCloudinaryUrl(raw?: string | null): CloudinaryCreds | null {
  const value = String(raw ?? "").trim();
  const match = /^cloudinary:\/\/([^:]+):([^@]+)@([^/\s]+)/i.exec(value);
  if (!match) return null;
  return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
}

export function maskSecret(value: string) {
  if (!value) return "";
  if (value.length < 8) return "••••";
  return `••••${value.slice(-4)}`;
}

export function isMaskedSecret(value: string) {
  return !value || (/^[•*xX.]+[A-Za-z0-9_-]{0,8}$/.test(value) && value.includes("•"));
}

export function vinFolder(vin?: string | null) {
  const clean = String(vin ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 17);
  return `catalog/${clean || "unknown"}`;
}
