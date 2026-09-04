"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Preloader } from "@/components/layout/preloader";
import { Cursor } from "@/components/layout/cursor";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";
import { Assistant } from "@/components/layout/assistant";
import { SmoothScroll } from "@/providers/smooth-scroll";
import "@/lib/gsap";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isContract = pathname.startsWith("/contract");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <SmoothScroll>
      <Preloader />
      <Cursor />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      {!isContract && <WhatsAppButton />}
      {!isContract && <Assistant />}
    </SmoothScroll>
  );
}
