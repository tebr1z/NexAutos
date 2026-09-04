"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useI18n } from "@/providers/i18n-provider";

export function CTA() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden px-5 py-28 md:px-8">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2000&q=80)",
        }}
      />
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative mx-auto max-w-3xl text-center text-white">
        <h2 className="font-display text-4xl md:text-6xl">{t.cta.title}</h2>
        <p className="mt-5 text-zinc-300">{t.cta.subtitle}</p>
        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
          <Link
            href="/contact"
            className="mt-10 inline-flex rounded-full bg-white px-8 py-3 text-sm font-medium text-black"
          >
            {t.cta.button}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
