import { Hero } from "@/components/home/hero";
import { Stats } from "@/components/home/stats";
import { Why } from "@/components/home/why";
import { Partners } from "@/components/home/partners";
import { Process } from "@/components/home/process";
import { FAQ } from "@/components/home/faq";
import { CTA } from "@/components/home/cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Stats />
      <Why />
      <Partners />
      <Process />
      <FAQ />
      <CTA />
    </>
  );
}
