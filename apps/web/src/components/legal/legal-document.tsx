"use client";

import type { LegalDoc } from "@/lib/legal/types";

export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <article className="mx-auto max-w-3xl px-5 pt-32 pb-28 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.32em] text-muted">{doc.kicker}</p>
      <h1 className="font-display mt-3 text-4xl text-fg md:text-5xl">{doc.title}</h1>
      <p className="mt-3 text-xs tracking-wide text-muted">{doc.updated}</p>
      <p className="mt-8 text-sm leading-7 text-muted">{doc.intro}</p>

      <nav className="mt-12 border-t border-line pt-8" aria-label={doc.toc}>
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted">{doc.toc}</p>
        <ol className="mt-4 columns-1 gap-x-10 sm:columns-2">
          {doc.sections.map((section) => (
            <li key={section.id} className="mb-2 break-inside-avoid text-sm">
              <a href={`#${section.id}`} className="text-muted hover:text-fg">
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-16 space-y-14">
        {doc.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-28">
            <h2 className="font-display text-2xl text-fg">{section.title}</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted">
              {section.paragraphs.map((p, i) => (
                <p key={`${section.id}-${i}`}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
