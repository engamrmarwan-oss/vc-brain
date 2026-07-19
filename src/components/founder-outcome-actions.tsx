"use client";

import Link from "next/link";
import { useState } from "react";

import {
  postFounderOutcome,
  type ChannelQuality,
} from "@/components/sourcing-intelligence";

export function FounderOutcomeActions({ founderId }: { founderId: string }) {
  const [pendingStage, setPendingStage] = useState<"funded" | "passed">();
  const [feedback, setFeedback] = useState<{
    stage: "funded" | "passed";
    quality: ChannelQuality[];
  }>();
  const [error, setError] = useState("");

  async function record(stage: "funded" | "passed") {
    setPendingStage(stage);
    setFeedback(undefined);
    setError("");

    try {
      const response = await postFounderOutcome(founderId, stage);
      setFeedback({ stage, quality: response.quality });
    } catch {
      setError("Outcome feedback could not be recorded. The sourcing model is unchanged.");
    } finally {
      setPendingStage(undefined);
    }
  }

  return (
    <>
      <div className="flex items-center rounded-xl border border-[#d4d2cb] bg-[#f8f7f3] p-1">
        <button
          className="h-8 rounded-lg px-3 text-[9px] font-bold uppercase tracking-[0.06em] text-[#47745a] transition-colors hover:bg-[#e4eee6] disabled:cursor-wait disabled:opacity-50"
          disabled={Boolean(pendingStage)}
          onClick={() => void record("funded")}
          type="button"
        >
          {pendingStage === "funded" ? "Recording…" : "Mark funded"}
        </button>
        <span className="h-4 w-px bg-[#d9d6cd]" />
        <button
          className="h-8 rounded-lg px-3 text-[9px] font-bold uppercase tracking-[0.06em] text-[#777970] transition-colors hover:bg-[#eceae4] disabled:cursor-wait disabled:opacity-50"
          disabled={Boolean(pendingStage)}
          onClick={() => void record("passed")}
          type="button"
        >
          {pendingStage === "passed" ? "Recording…" : "Mark passed"}
        </button>
      </div>

      {(feedback || error) && (
        <aside
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[60] w-[calc(100%-2rem)] max-w-[380px] overflow-hidden rounded-[18px] border border-[#d2d0c7] bg-[#faf9f6] shadow-[0_24px_70px_rgba(23,25,21,0.2)]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[#e0ded6] px-4 py-4">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#66806f]">
                Sourcing feedback loop
              </p>
              <p className="mt-1 text-[12px] font-semibold">
                {feedback
                  ? `Outcome marked ${feedback.stage}`
                  : "Outcome not recorded"}
              </p>
            </div>
            <button
              aria-label="Close outcome feedback"
              className="grid size-7 place-items-center rounded-full bg-[#eceae4] text-[#74766e]"
              onClick={() => {
                setFeedback(undefined);
                setError("");
              }}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          {feedback ? (
            <div className="px-4 py-4">
              <p className="text-[9px] leading-relaxed text-[#74766e]">
                Channel quality was recomputed directly from this outcome. The
                leading channels are now:
              </p>
              <ol className="mt-3 space-y-2">
                {feedback.quality.slice(0, 3).map((channel, index) => (
                  <li
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#f0efe9] px-3 py-2.5"
                    key={channel.nodeId}
                  >
                    <span className="min-w-0 truncate text-[9.5px] font-semibold">
                      {index + 1}. {channel.name}
                    </span>
                    <span className="shrink-0 text-[10px] font-bold tabular-nums text-[#47745a]">
                      {Math.round(channel.qualityScore)} ±{Math.round(channel.band)}
                    </span>
                  </li>
                ))}
              </ol>
              <Link
                className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#252821] text-[9.5px] font-semibold text-white"
                href="/sourcing"
              >
                Open sourcing intelligence
              </Link>
            </div>
          ) : (
            <p className="px-4 py-4 text-[9.5px] leading-relaxed text-[#8a6535]">
              {error}
            </p>
          )}
        </aside>
      )}
    </>
  );
}

function CloseIcon() {
  return <svg aria-hidden="true" fill="none" height="11" viewBox="0 0 12 12" width="11"><path d="m3 3 6 6m0-6L3 9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/></svg>;
}
