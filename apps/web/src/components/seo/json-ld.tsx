"use client";

import { useEffect } from "react";

/** Inserts JSON-LD via the DOM so React 19 never sees a JSX <script>. */
export function JsonLd({ data }: { data: unknown }) {
  useEffect(() => {
    const existing = document.getElementById("json-ld");
    const script = existing instanceof HTMLScriptElement ? existing : document.createElement("script");
    script.id = "json-ld";
    script.type = "application/ld+json";
    script.text = JSON.stringify(data);
    if (!existing) document.head.appendChild(script);
    return () => script.remove();
  }, [data]);
  return null;
}
