import type { Metadata } from "next";

import { FounderPipeline } from "@/components/founder-pipeline";
import { allFounders } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Opportunity pipeline | VC Brain",
  description: "Ranked, evidence-backed founder screening pipeline.",
};

export default function Home() {
  const founders = allFounders().sort(
    (a, b) => b.founderScore - a.founderScore,
  );

  return <FounderPipeline founders={founders} />;
}
