"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { ViewToggle } from "@/components/view-toggle";

type NavKey = "pipeline" | "discovery" | "thesis" | "sourcing";

const NAV_ITEMS: Array<{
  href: string;
  icon: React.ReactNode;
  key: NavKey;
  label: string;
}> = [
  {
    href: "/",
    icon: <PipelineIcon />,
    key: "pipeline",
    label: "Opportunity pipeline",
  },
  {
    href: "/#github-discovery",
    icon: <DiscoveryIcon />,
    key: "discovery",
    label: "Outbound discovery",
  },
  {
    href: "/?panel=thesis",
    icon: <ThesisIcon />,
    key: "thesis",
    label: "Decision thesis",
  },
  {
    href: "/sourcing",
    icon: <SourcingIcon />,
    key: "sourcing",
    label: "Sourcing intelligence",
  },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [selectedRootTab, setSelectedRootTab] = useState<NavKey>();
  const founderView = pathname.startsWith("/apply");
  const activeTab: NavKey | undefined = pathname.startsWith("/sourcing")
    ? "sourcing"
    : pathname.startsWith("/founder")
      ? "pipeline"
      : pathname === "/"
        ? selectedRootTab ?? "pipeline"
        : undefined;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    setSelectedRootTab("pipeline");
    router.push(query ? `/?q=${encodeURIComponent(query)}` : "/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#e5e5e5] bg-[#fbfbfa]/95 backdrop-blur-[10px]">
      <div className="mx-auto flex h-14 w-full max-w-[1360px] items-center gap-2.5 px-4 sm:gap-4 sm:px-5 lg:px-12">
        <Link
          aria-label="Opportunity pipeline"
          className="vc-header-button hidden size-[34px] shrink-0 place-items-center rounded-lg text-[#5b5d56] hover:bg-[#f0f0ed] sm:grid"
          href="/"
          onClick={() => setSelectedRootTab("pipeline")}
        >
          <LauncherIcon />
        </Link>
        <span className="hidden h-[26px] w-px shrink-0 bg-[#dbd9d1] sm:block" />

        <Link
          aria-label="Protegis — The VC Brain home"
          className="vc-header-mark flex shrink-0 items-center gap-2.5"
          href="/"
          onClick={() => setSelectedRootTab("pipeline")}
        >
          <LogoMark className="size-[30px]" />
          <span className="hidden min-[360px]:block">
            <span className="block text-[14px] font-bold leading-none tracking-[-0.03em] text-[#171915]">
              Protegis
            </span>
            <span className="mt-[3px] block text-[8px] font-semibold uppercase leading-none tracking-[0.16em] text-[#989991] sm:text-[9px]">
              The VC Brain
            </span>
          </span>
        </Link>

        <form
          className="mx-2 hidden h-9 max-w-[420px] flex-1 items-center gap-2 rounded-md border border-[#dddbda] bg-white px-3 md:flex"
          onSubmit={submitSearch}
          role="search"
        >
          <span className="text-[#969890]">
            <SearchIcon />
          </span>
          <label className="sr-only" htmlFor="global-founder-search">
            Search founders, companies, or sectors
          </label>
          <input
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[#30322c] outline-none placeholder:text-[#969890]"
            id="global-founder-search"
            name="q"
            placeholder="Search founders, companies, sectors…"
            type="search"
          />
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3.5">
          <span className="hidden items-center gap-1.5 text-[11px] font-medium text-[#7a7c74] xl:flex">
            <span className="size-1.5 rounded-full bg-[#54a079] shadow-[0_0_0_3px_rgba(84,160,121,0.12)]" />
            Live
          </span>
          <ViewToggle />
          <div className="hidden size-8 place-items-center rounded-full bg-[#e8e4da] text-[11px] font-bold text-[#4b4d47] lg:grid">
            AM
          </div>
        </div>
      </div>

      {!founderView && (
        <nav
          aria-label="VC workspace"
          className="overflow-x-auto border-t border-[#eae8e1] bg-[#f2f7f4] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="mx-auto flex min-w-max max-w-[1360px] items-center gap-5 px-4 sm:gap-6 sm:px-5 lg:px-12">
            {NAV_ITEMS.map((item) => (
              <Link
                aria-current={activeTab === item.key ? "page" : undefined}
                className={`vc-header-tab inline-flex h-[47px] items-center gap-2 border-b-[2.5px] px-1 text-[12px] tracking-[-0.01em] sm:text-[13px] ${
                  activeTab === item.key
                    ? "border-[#0176d3] font-semibold text-[#03234a]"
                    : "border-transparent font-medium text-[#7a7c74] hover:text-[#03234a]"
                }`}
                href={item.href}
                key={item.key}
                onClick={() => setSelectedRootTab(item.key)}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

function LogoMark({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`${className} shrink-0 drop-shadow-[0_4px_12px_rgba(23,25,21,0.16)]`}
      viewBox="0 0 40 40"
    >
      <rect fill="#171915" height="38" rx="11" width="38" x="1" y="1" />
      <circle
        className="vc-header-ring"
        cx="20"
        cy="20"
        fill="none"
        r="9"
        stroke="#fff"
        strokeDasharray="126"
        strokeLinecap="round"
        strokeWidth="3"
        transform="rotate(-90 20 20)"
      />
      <circle
        className="vc-header-dot"
        cx="31"
        cy="9"
        fill="#ef5b42"
        r="4.4"
        stroke="#171915"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function LauncherIcon() {
  return <svg aria-hidden="true" fill="currentColor" height="16" viewBox="0 0 16 16" width="16"><circle cx="3" cy="3" r="1.5"/><circle cx="8" cy="3" r="1.5"/><circle cx="13" cy="3" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/><circle cx="3" cy="13" r="1.5"/><circle cx="8" cy="13" r="1.5"/><circle cx="13" cy="13" r="1.5"/></svg>;
}
function SearchIcon() {
  return <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="m10.5 10.5 3 3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/></svg>;
}
function PipelineIcon() {
  return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 18 18" width="15"><path d="M2.5 4h13M2.5 9h13M2.5 14h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"/></svg>;
}
function DiscoveryIcon() {
  return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 18 18" width="15"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="m12.2 12.2 3.3 3.3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"/><path d="M8 5.5V8l1.8 1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/></svg>;
}
function ThesisIcon() {
  return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 18 18" width="15"><circle cx="8.5" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="8.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.4"/><path d="m10.2 7.3 4.8-4.8m0 0v3.1m0-3.1h-3.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4"/></svg>;
}
function SourcingIcon() {
  return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 18 18" width="15"><circle cx="3.5" cy="9" r="1.7" stroke="currentColor" strokeWidth="1.3"/><circle cx="13.5" cy="4" r="1.7" stroke="currentColor" strokeWidth="1.3"/><circle cx="13.5" cy="14" r="1.7" stroke="currentColor" strokeWidth="1.3"/><path d="m5.1 8.2 6.8-3.4M5.1 9.8l6.8 3.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/></svg>;
}
