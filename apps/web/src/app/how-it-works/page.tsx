import type { Metadata } from "next";
import { Process } from "@/components/home/process";
import { CTA } from "@/components/home/cta";

export const metadata: Metadata = {
  title: "How It Works",
  description: "Car selection, auction purchase, shipping, customs and door delivery.",
};

export default function HowItWorksPage() {
  return (
    <div className="pt-20">
      <Process />
      <CTA />
    </div>
  );
}
