/** Server-side Nest origin. Never return a relative /api/v1 path here — that loops the Next proxy. */
export function nestApiBase() {
  for (const raw of [process.env.INTERNAL_API_URL, process.env.API_PROXY_URL]) {
    const value = raw?.trim();
    if (value && /^https?:\/\//i.test(value)) return value.replace(/\/$/, "");
  }
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (pub && /^https?:\/\//i.test(pub)) return pub.replace(/\/$/, "");
  return "http://127.0.0.1:5002/api/v1";
}

/** Browser talks to the Next.js origin so one public port is enough. */
export function browserApiBase() {
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!pub) return "/api/v1";
  if (pub.startsWith("/")) return pub.replace(/\/$/, "") || "/api/v1";
  if (/^https?:\/\//i.test(pub)) return pub.replace(/\/$/, "");
  return "/api/v1";
}
