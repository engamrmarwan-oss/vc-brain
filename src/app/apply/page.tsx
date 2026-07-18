import type { Metadata } from "next";

import { FounderApplyForm } from "@/components/founder-apply-form";

export const metadata: Metadata = {
  title: "Founder application | VC Brain",
  description: "A focused, merit-first founder application.",
};

export default function FounderApplyPage() {
  return <FounderApplyForm />;
}
