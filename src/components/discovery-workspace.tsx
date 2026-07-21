"use client";

import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { GitHubDiscoveryPanel } from "@/components/github-discovery-panel";

export function DiscoveryWorkspace() {
  return (
    <div className="min-h-screen bg-[#f3f2f2] text-[#171915]">
      <AppHeader />

      <main className="mx-auto box-border w-full max-w-[1360px] px-5 py-8 sm:px-8 lg:px-12">
        <section className="mb-5 flex flex-col justify-between gap-5 rounded-xl border border-[#dddbda] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(40,42,36,0.05)] sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#03234a] text-[#8fc2f0]">
              <DiscoveryIcon />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8b8d85]">
                Proactive sourcing
              </p>
              <h1 className="mt-0.5 text-[23px] font-semibold leading-none tracking-[-0.03em]">
                Outbound discovery
              </h1>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#73756e] sm:text-[11.5px]">
                Find public builders before they enter the inbound funnel.
              </p>
            </div>
          </div>
          <Link
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#dddbda] bg-[#fbfbfa] px-4 text-[11px] font-semibold transition-colors hover:bg-white"
            href="/"
          >
            View ranked pipeline <ArrowRightIcon />
          </Link>
        </section>

        <GitHubDiscoveryPanel onDiscovered={async () => undefined} />

        <section className="grid gap-px overflow-hidden rounded-xl border border-[#dddbda] bg-[#dddbda] sm:grid-cols-3">
          <DiscoveryPrinciple
            detail="Repository activity and ownership resolve before scoring."
            label="Public signal first"
            number="01"
          />
          <DiscoveryPrinciple
            detail="Discovered builders use the same Founder / Market / Idea screen."
            label="Same merit engine"
            number="02"
          />
          <DiscoveryPrinciple
            detail="Successful scans flow directly into the ranked pipeline."
            label="No separate funnel"
            number="03"
          />
        </section>
      </main>
    </div>
  );
}

function DiscoveryPrinciple({
  detail,
  label,
  number,
}: {
  detail: string;
  label: string;
  number: string;
}) {
  return (
    <article className="bg-white px-5 py-5">
      <p className="text-[8px] font-bold tracking-[0.12em] text-[#0b5cab]">
        {number}
      </p>
      <h2 className="mt-2 text-[12px] font-semibold">{label}</h2>
      <p className="mt-1.5 text-[9.5px] leading-relaxed text-[#85877f]">
        {detail}
      </p>
    </article>
  );
}

function DiscoveryIcon() {
  return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 18 18" width="19"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="m12.2 12.2 3.3 3.3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"/><path d="M8 5.5V8l1.8 1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/></svg>;
}
function ArrowRightIcon() {
  return <svg aria-hidden="true" fill="none" height="10" viewBox="0 0 12 10" width="11"><path d="M1 5h10m0 0L7.5 1.5M11 5 7.5 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2"/></svg>;
}
