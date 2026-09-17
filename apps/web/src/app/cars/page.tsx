"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type CatalogCar } from "@/lib/api";
import { useI18n } from "@/providers/i18n-provider";

function priceText(car: CatalogCar) {
  if (car.priceLabel?.trim()) return car.priceLabel.trim();
  if (car.priceUsd != null) return `$${car.priceUsd.toLocaleString("en-US")}`;
  return "";
}

function metaText(car: CatalogCar) {
  return [car.auction, car.color].filter(Boolean).join(" · ");
}

export default function CarsPage() {
  const { t } = useI18n();
  const [cars, setCars] = useState<CatalogCar[] | null>(null);

  useEffect(() => {
    api
      .catalog()
      .then(setCars)
      .catch(() => setCars([]));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-5 pt-32 pb-24 md:px-8">
      <h1 className="font-display text-5xl">{t.pages.carsTitle}</h1>
      <p className="mt-4 max-w-xl text-muted">{t.pages.carsSubtitle}</p>
      {cars === null ? (
        <p className="mt-12 text-sm text-muted">…</p>
      ) : cars.length === 0 ? (
        <p className="mt-12 text-sm text-muted">{t.pages.carsEmpty}</p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((car) => (
            <article key={car.id} className="group overflow-hidden rounded-3xl border border-line">
              <div className="relative aspect-[16/11] overflow-hidden bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={car.imageUrl}
                  alt={car.title}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                {metaText(car) ? <p className="text-xs text-muted">{metaText(car)}</p> : null}
                <h2 className="mt-1 text-lg">{car.title}</h2>
                {priceText(car) ? <p className="mt-2 text-sm text-royal">{priceText(car)}</p> : null}
                <Link href="/contact" className="mt-4 inline-block text-xs uppercase tracking-widest">
                  {t.pages.carsEnquire}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
