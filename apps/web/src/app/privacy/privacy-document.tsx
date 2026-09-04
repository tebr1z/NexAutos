"use client";

import { useI18n } from "@/providers/i18n-provider";
import { PRIVACY } from "@/lib/legal/privacy";
import { LegalDocument } from "@/components/legal/legal-document";

export function PrivacyDocument() {
  const { locale } = useI18n();
  return <LegalDocument doc={PRIVACY[locale]} />;
}
