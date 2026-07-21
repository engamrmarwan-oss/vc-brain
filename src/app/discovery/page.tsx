import type { Metadata } from "next";

import { DiscoveryWorkspace } from "@/components/discovery-workspace";

export const metadata: Metadata = {
  title: "Outbound discovery | VC Brain",
  description: "Discover and screen founders from live public GitHub signals.",
};

export default function DiscoveryPage() {
  return <DiscoveryWorkspace />;
}
