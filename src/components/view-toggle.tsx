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
      className="flex items-center rounded-full border border-[#dddbda] bg-[#f3f3f3] p-[3px]"
      role="group"
    >
      <ToggleLink active={activeView === "vc"} href="/" icon={<VcIcon />}>
        VC
      </ToggleLink>
      <ToggleLink
        active={activeView === "founder"}
        href="/apply"
        icon={<FounderIcon />}
      >
        Founder
      </ToggleLink>
    </div>
  );
}

function ToggleLink({
  active,
  children,
  href,
  icon,
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-[29px] items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold tracking-[-0.01em] transition-colors sm:px-3 sm:text-[11px] ${
        active
          ? "bg-[#03234a] text-white shadow-[0_1px_3px_rgba(3,35,74,0.22)]"
          : "text-[#6f7169] hover:bg-white/65 hover:text-[#03234a]"
      }`}
      href={href}
    >
      {icon}
      {children}
    </Link>
  );
}

function VcIcon() {
  return <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 16 16" width="13"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.3"/><path d="m9.5 6.5 3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/></svg>;
}

function FounderIcon() {
  return <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 16 16" width="13"><path d="M8 8.6a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6ZM3 13.4c.6-2.1 2.5-3.4 5-3.4s4.4 1.3 5 3.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/></svg>;
}
