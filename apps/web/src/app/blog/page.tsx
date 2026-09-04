"use client";

import Link from "next/link";
import { useI18n } from "@/providers/i18n-provider";

export default function BlogPage() {
  const { t } = useI18n();
  const posts = [
    { slug: "usa-to-baku-timeline", title: t.pages.blog1t, excerpt: t.pages.blog1e },
    { slug: "reading-copart-photos", title: t.pages.blog2t, excerpt: t.pages.blog2e },
    { slug: "korea-vs-usa", title: t.pages.blog3t, excerpt: t.pages.blog3e },
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 pt-32 pb-24 md:px-8">
      <h1 className="font-display text-5xl">{t.pages.journalTitle}</h1>
      <div className="mt-12 space-y-8">
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="block border-b border-line pb-8">
            <h2 className="text-2xl">{p.title}</h2>
            <p className="mt-2 text-sm text-muted">{p.excerpt}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
