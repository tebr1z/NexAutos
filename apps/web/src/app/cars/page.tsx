"use client";

import Image from "next/image";
import Link from "next/link";
import { IMAGES } from "@/lib/constants";
import { useI18n } from "@/providers/i18n-provider";

const CARS = [
  { title: "2021 Tesla Model 3", meta: "IAAI · Pearl White", price: "$28,450", img: IMAGES.cars[0] },
  { title: "2020 BMW X5 xDrive40i", meta: "Copart · Black Sapphire", price: "$34,900", img: IMAGES.cars[1] },
  { title: "2019 Mercedes-Benz E 300", meta: "Manheim · Polar White", price: "$26,200", img: IMAGES.cars[2] },
  { title: "2022 Hyundai Palisade", meta: "Korea · Moonlight Blue", price: "$31,100", img: IMAGES.cars[3] },
  { title: "2021 Audi Q7", meta: "Copart · Glacier White", price: "$37,800", img: IMAGES.cars[4] },
  { title: "2020 Lexus RX 350", meta: "IAAI · Eminent White", price: "$29,650", img: IMAGES.cars[0] },
];

export default function CarsPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-7xl px-5 pt-32 pb-24 md:px-8">
      <h1 className="font-display text-5xl">{t.pages.carsTitle}</h1>
      <p className="mt-4 max-w-xl text-muted">{t.pages.carsSubtitle}</p>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {CARS.map((car) => (
          <article key={car.title} className="group overflow-hidden rounded-3xl border border-line">
            <div className="relative aspect-[16/11] overflow-hidden">
              <Image
                src={car.img}
                alt={car.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
            </div>
            <div className="p-5">
              <p className="text-xs text-muted">{car.meta}</p>
              <h2 className="mt-1 text-lg">{car.title}</h2>
              <p className="mt-2 text-sm text-royal">{car.price}</p>
              <Link href="/contact" className="mt-4 inline-block text-xs uppercase tracking-widest">
                {t.pages.carsEnquire}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
