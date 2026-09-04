"use client";

import { MessageCircle } from "lucide-react";
import { SITE } from "@/lib/constants";

export function WhatsAppButton() {
  return (
    <a
      href={`https://wa.me/${SITE.whatsapp}`}
      target="_blank"
      rel="noreferrer"
      className="fixed right-6 bottom-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#111] text-[#25D366] shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition hover:border-[#25D366]/40"
      aria-label="WhatsApp"
    >
      <MessageCircle size={22} />
    </a>
  );
}
