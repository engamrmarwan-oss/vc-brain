import type { Metadata } from "next";

import { FounderMemo } from "@/components/founder-memo";

export const metadata: Metadata = {
  title: "Founder memo | VC Brain",
  description: "Evidence-backed founder screening and investment recommendation.",
};

export default async function FounderMemoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <FounderMemo founderId={id} />;
}
