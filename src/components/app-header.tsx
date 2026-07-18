import Link from "next/link";

import { ViewToggle } from "@/components/view-toggle";

export function AppHeader() {
  return (
    <header className="border-b border-[#dfded8] bg-[#f8f7f3]/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] w-full max-w-[1360px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link
          aria-label="VC Brain home"
          className="group flex items-center gap-3"
          href="/"
        >
          <span className="relative grid size-8 place-items-center rounded-[10px] bg-[#171915] text-white shadow-[0_4px_12px_rgba(23,25,21,0.16)]">
            <span className="h-3.5 w-3.5 rounded-full border-[3px] border-white" />
            <span className="absolute right-[5px] top-[5px] size-1.5 rounded-full bg-[#ef5b42] ring-2 ring-[#171915]" />
          </span>
          <span>
            <span className="block text-[14px] font-bold leading-none tracking-[-0.035em] text-[#171915]">
              VC BRAIN
            </span>
            <span className="mt-1 block text-[9px] font-semibold uppercase leading-none tracking-[0.2em] text-[#989991]">
              Signal intelligence
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-5">
          <span className="hidden items-center gap-2 text-[11px] font-medium text-[#7a7c74] md:flex">
            <span className="size-1.5 rounded-full bg-[#42a275] shadow-[0_0_0_3px_rgba(66,162,117,0.12)]" />
            Live screening
          </span>
          <ViewToggle />
          <div className="hidden size-8 place-items-center rounded-full bg-[#e8e4da] text-[11px] font-bold text-[#4b4d47] sm:grid">
            AM
          </div>
        </div>
      </div>
    </header>
  );
}
