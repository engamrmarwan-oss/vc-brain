import type { Metadata } from "next";

import { FounderPipeline } from "@/components/founder-pipeline";
import { allFounders, hydrateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Opportunity pipeline | VC Brain",
  description: "Ranked, evidence-backed founder screening pipeline.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string; q?: string }>;
}) {
  const { panel, q } = await searchParams;
  await hydrateStore();
  const founders = allFounders().sort(
    (a, b) => b.founderScore - a.founderScore,
  );

  return (
    <FounderPipeline
      founders={founders}
      initialQuery={q ?? ""}
      initialThesisOpen={panel === "thesis"}
      key={`${q ?? ""}:${panel ?? ""}`}
    />
  );
}
