import type { Metadata } from "next";

import { SourcingWorkspace } from "@/components/sourcing-workspace";

export const metadata: Metadata = {
  title: "Sourcing intelligence | VC Brain",
  description:
    "Outcome-aware sourcing channel performance and network intelligence.",
};

export default function SourcingPage() {
  return <SourcingWorkspace />;
}
