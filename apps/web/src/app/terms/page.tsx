import type { Metadata } from "next";
import { TermsDocument } from "./terms-document";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "Auto Nex terms: import agency, auctions, ocean freight, customs, tracking and delivery. Transit follows the vessel; dates are indicative.",
};

export default function TermsPage() {
  return <TermsDocument />;
}
