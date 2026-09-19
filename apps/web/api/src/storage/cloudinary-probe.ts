import { cloudinaryReady, type CloudinaryCreds } from "../settings/cloudinary-config";

export async function probeCloudinary(c: CloudinaryCreds) {
  if (!cloudinaryReady(c)) {
    return { ok: false, message: "Cloud name, API key və API secret yazın." };
  }
  const auth = Buffer.from(`${c.apiKey}:${c.apiSecret}`).toString("base64");
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/resources/image?max_results=1`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (res.ok) return { ok: true, message: `Cloudinary qoşuldu · ${c.cloudName}` };
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: false, message: json.error?.message || `Cloudinary ${res.status}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Cloudinary əlçatan deyil" };
  }
}
