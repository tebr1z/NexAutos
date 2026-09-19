import { nestApiBase } from "@/lib/nest-url";
import { lookupPositionByImo } from "@/lib/imo-position";

export async function GET(req: Request) {
  const src = new URL(req.url).searchParams;
  const nest = nestApiBase();
  const q = new URLSearchParams();
  for (const key of ["imo", "mmsi", "nearLat", "nearLng", "hintName", "name"] as const) {
    const value = src.get(key);
    if (value) q.set(key, value);
  }
  try {
    const res = await fetch(`${nest}/vessels?${q.toString()}`, { cache: "no-store" });
    if (res.ok) return Response.json(await res.json());
  } catch {
    /* Nest may be down — use Wikidata + Digitraffic */
  }
  const pos = await lookupPositionByImo(src.get("imo") ?? "", src.get("mmsi") ?? "");
  if (!pos) return Response.json({ message: "IMO və ya MMSI ilə gəmi tapılmadı." }, { status: 404 });
  return Response.json(pos);
}
