import type { Metadata } from "next";

export const metadata: Metadata = { title: "Article" };

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <article className="mx-auto max-w-3xl px-5 pt-32 pb-24 md:px-8">
      <p className="text-xs uppercase tracking-widest text-muted">{slug.replace(/-/g, " ")}</p>
      <h1 className="font-display mt-3 text-4xl">A quieter import is a documented import.</h1>
      <p className="mt-8 text-lg leading-8 text-muted">
        Every Auto Nex shipment is a sequence of timestamps: purchase, payment, pickup, export,
        ocean, destination, customs, delivery. If a status does not have a time, it is not a status.
      </p>
    </article>
  );
}
