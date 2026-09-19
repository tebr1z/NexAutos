import { createHash } from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import { SettingsService } from "../settings/settings.service";
import { cloudinaryReady, vinFolder } from "../settings/cloudinary-config";

@Injectable()
export class CloudinaryStorage {
  private readonly log = new Logger(CloudinaryStorage.name);

  constructor(private settings: SettingsService) {}

  async isEnabled() {
    return cloudinaryReady(await this.settings.resolveCloudinary());
  }

  async put(vin: string, photoId: string, dataUrl: string) {
    const c = await this.settings.resolveCloudinary();
    if (!cloudinaryReady(c)) throw new Error("Cloudinary ayarları yoxdur.");
    const folder = vinFolder(vin);
    const publicId = `${folder}/${photoId}`;
    const timestamp = Math.round(Date.now() / 1000);
    const body = new URLSearchParams({
      file: dataUrl,
      api_key: c.apiKey,
      timestamp: String(timestamp),
      public_id: publicId,
      overwrite: "true",
      signature: sign({ overwrite: "true", public_id: publicId, timestamp: String(timestamp) }, c.apiSecret),
    });
    const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/image/upload`, {
      method: "POST",
      body,
    });
    const json = (await res.json()) as { secure_url?: string; public_id?: string; error?: { message?: string } };
    if (!res.ok || !json.secure_url) {
      throw new Error(json.error?.message || `Cloudinary ${res.status}`);
    }
    return json.secure_url;
  }

  async remove(url: string) {
    const publicId = publicIdFromUrl(url);
    if (!publicId) return;
    const c = await this.settings.resolveCloudinary();
    if (!cloudinaryReady(c)) return;
    const timestamp = Math.round(Date.now() / 1000);
    const body = new URLSearchParams({
      public_id: publicId,
      api_key: c.apiKey,
      timestamp: String(timestamp),
      signature: sign({ public_id: publicId, timestamp: String(timestamp) }, c.apiSecret),
    });
    try {
      await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/image/destroy`, { method: "POST", body });
    } catch (err) {
      this.log.warn(`Cloudinary silinmədi ${publicId}: ${(err as Error).message}`);
    }
  }

  async get(url: string): Promise<{ mime: string; buf: Buffer } | null> {
    if (!/^https?:\/\//i.test(url)) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const mime = res.headers.get("content-type") || "image/jpeg";
      return { mime, buf: Buffer.from(await res.arrayBuffer()) };
    } catch {
      return null;
    }
  }
}

export function publicIdFromUrl(url: string) {
  if (url.startsWith("cloudinary:")) return url.slice("cloudinary:".length);
  const match = /res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url.split("?")[0] || "");
  return match?.[1] || "";
}

function sign(params: Record<string, string>, secret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${payload}${secret}`).digest("hex");
}
