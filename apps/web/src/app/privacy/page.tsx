import type { Metadata } from "next";
import { PrivacyDocument } from "./privacy-document";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "Auto Nex privacy policy under Azerbaijani personal-data law: what we collect, why, how long we keep it, and your rights.",
};

export default function PrivacyPage() {
  return <PrivacyDocument />;
}
