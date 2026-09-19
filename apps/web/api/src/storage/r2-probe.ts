import { HeadBucketCommand, ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";
import type { R2Creds } from "../settings/r2-config";

function accountFromEndpoint(endpoint: string) {
  const host = endpoint.replace(/^https?:\/\//i, "").split("/")[0] || "";
  const match = host.match(/^([a-f0-9]{32})\.(?:eu\.|us\.)?r2\.cloudflarestorage\.com$/i);
  return match?.[1] || "";
}

export function r2EndpointCandidates(c: R2Creds) {
  const id = c.accountId.trim() || accountFromEndpoint(c.endpoint);
  const raw = [
    c.endpoint,
    id ? `https://${id}.r2.cloudflarestorage.com` : "",
    id ? `https://${id}.eu.r2.cloudflarestorage.com` : "",
    id ? `https://${id}.us.r2.cloudflarestorage.com` : "",
  ]
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return [...new Set(raw)];
}

function errText(err: unknown) {
  if (!err || typeof err !== "object") return String(err || "UnknownError");
  const row = err as { name?: string; message?: string; Code?: string };
  return row.Code || row.name || row.message || "UnknownError";
}

async function tryEndpoint(c: R2Creds, endpoint: string) {
  const client = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  try {
    await client.send(new HeadBucketCommand({ Bucket: c.bucket }));
    return { ok: true as const, endpoint, buckets: [c.bucket] };
  } catch (headErr) {
    try {
      const listed = await client.send(new ListBucketsCommand({}));
      const names = (listed.Buckets ?? []).map((row) => row.Name).filter(Boolean) as string[];
      if (names.includes(c.bucket)) {
        return { ok: true as const, endpoint, buckets: names };
      }
      return {
        ok: false as const,
        endpoint,
        error: `Açar işləyir, amma bucket "${c.bucket}" yoxdur. Mövcud: ${names.join(", ") || "heç biri"}.`,
      };
    } catch {
      return { ok: false as const, endpoint, error: errText(headErr) };
    }
  }
}

export async function probeR2(c: R2Creds) {
  if (!c.accessKeyId || !c.secretAccessKey || !c.bucket) {
    return { ok: false, message: "S3 Access Key ID, Secret Access Key və bucket yazın." };
  }
  if (!c.endpoint && !c.accountId) {
    return { ok: false, message: "Account ID və ya endpoint yazın." };
  }
  const tried: string[] = [];
  for (const endpoint of r2EndpointCandidates(c)) {
    const hit = await tryEndpoint(c, endpoint);
    tried.push(`${endpoint} → ${hit.ok ? "ok" : hit.error}`);
    if (hit.ok) {
      return {
        ok: true,
        endpoint: hit.endpoint,
        message: `R2 qoşuldu · bucket ${c.bucket} · ${hit.endpoint}`,
      };
    }
    if (hit.error.startsWith("Açar işləyir")) {
      return { ok: false, endpoint: hit.endpoint, message: hit.error };
    }
  }
  return {
    ok: false,
    message:
      "R2 qoşulmadı. Default endpoint istifadə edin (eu/us yox): https://ACCOUNT_ID.r2.cloudflarestorage.com. " +
      tried.join(" | "),
  };
}
