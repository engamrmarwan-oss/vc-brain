"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type View = "vc" | "founder";

export function ViewToggle() {
  const pathname = usePathname();
  const activeView: View = pathname.startsWith("/apply") ? "founder" : "vc";

  return (
    <div
      aria-label="Choose workspace view"
      className="flex items-center rounded-full border border-[#d8d6cf] bg-[#f3f2ed] p-1"
      role="group"
    >
      <ToggleLink active={activeView === "vc"} href="/">
        VC view
      </ToggleLink>
      <ToggleLink active={activeView === "founder"} href="/apply">
        Founder view
      </ToggleLink>
    </div>
  );
}

function ToggleLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-[-0.01em] transition-colors ${
        active
          ? "bg-[#171915] text-white shadow-sm"
          : "text-[#787a72] hover:text-[#171915]"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}
