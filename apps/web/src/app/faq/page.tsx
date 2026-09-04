import type { Metadata } from "next";
import { FAQ } from "@/components/home/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Auto Nex: hərrac, daşınma müddəti, izləmə kodu, elektron müqavilə, gömrük və əlaqə — tez-tez verilən suallar.",
};

export default function FaqPage() {
  return <FAQ standalone />;
}
