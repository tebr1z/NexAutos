import { nestApiBase } from "@/lib/nest-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth) return Response.json({ message: "Daxil olun." }, { status: 401 });

  const form = await req.formData();
  const orderId = String(form.get("orderId") || "").trim();
  const category = String(form.get("category") || "auction").trim() || "auction";
  const caption = String(form.get("caption") || "").trim();
  const file = form.get("file");
  const upload =
    file instanceof Blob
      ? file
      : file && typeof file === "object" && "arrayBuffer" in file
        ? (file as Blob)
        : null;
  if (!orderId || !upload) {
    return Response.json({ message: "Şəkil və sifariş lazımdır." }, { status: 400 });
  }

  const buf = Buffer.from(await upload.arrayBuffer());
  if (!buf.length) return Response.json({ message: "Boş şəkil." }, { status: 400 });
  if (buf.length > 250_000) return Response.json({ message: "Şəkil çox böyükdür — yenidən yükləyin." }, { status: 413 });

  const mime = upload.type?.startsWith("image/") ? upload.type : "image/jpeg";
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

  try {
    const res = await fetch(`${nestApiBase()}/orders/${encodeURIComponent(orderId)}/photos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({ url: dataUrl, category, caption }),
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
    });
  } catch {
    return Response.json({ message: "API unavailable" }, { status: 502 });
  }
}
