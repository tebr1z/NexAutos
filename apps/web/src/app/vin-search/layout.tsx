import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VIN Search",
  description: "Decode VIN specifications, auction photos and damage history.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
