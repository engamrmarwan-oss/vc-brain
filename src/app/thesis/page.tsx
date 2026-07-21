import type { Metadata } from "next";

import { ThesisWorkspace } from "@/components/thesis-workspace";

export const metadata: Metadata = {
  title: "Investment thesis | VC Brain",
  description: "Configure the thesis lens that re-orders the founder pipeline.",
};

export default function ThesisPage() {
  return <ThesisWorkspace />;
}
