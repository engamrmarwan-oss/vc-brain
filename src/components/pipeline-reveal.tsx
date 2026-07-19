"use client";

import { useEffect, useState } from "react";

const REVEAL_KEY = "vcbrain_pipeline_reveal_v1";
const REVEAL_DURATION_MS = 2500;

export function PipelineReveal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let alreadyPlayed = false;

    try {
      alreadyPlayed = window.sessionStorage.getItem(REVEAL_KEY) === "played";
      if (!alreadyPlayed) {
        window.sessionStorage.setItem(REVEAL_KEY, "played");
      }
    } catch {
      // Storage can be unavailable in locked-down browsers; the reveal remains safe.
    }

    if (alreadyPlayed || reduceMotion.matches) return;

    const showFrame = window.requestAnimationFrame(() => setVisible(true));
    const hideTimer = window.setTimeout(
      () => setVisible(false),
      REVEAL_DURATION_MS,
    );
    const skip = () => setVisible(false);

    document.addEventListener("pointerdown", skip, { capture: true });
    document.addEventListener("keydown", skip, { capture: true });

    return () => {
      window.cancelAnimationFrame(showFrame);
      window.clearTimeout(hideTimer);
      document.removeEventListener("pointerdown", skip, { capture: true });
      document.removeEventListener("keydown", skip, { capture: true });
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="vc-reveal-overlay pointer-events-none fixed inset-0 z-[90] grid place-items-center overflow-hidden bg-[#03234a]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(40,110,190,0.16),transparent_60%)]" />
      <div className="relative flex flex-col items-center gap-[30px]">
        <div className="relative grid size-[132px] place-items-center">
          <div className="absolute inset-0 grid place-items-center">
            <span className="vc-reveal-pulse absolute size-[132px] rounded-full border-[1.5px] border-[#2a6fb5]" />
            <span className="vc-reveal-pulse vc-reveal-pulse-delay-1 absolute size-[132px] rounded-full border-[1.5px] border-[#2a6fb5]" />
            <span className="vc-reveal-pulse vc-reveal-pulse-delay-2 absolute size-[132px] rounded-full border-[1.5px] border-[#2a6fb5]" />
          </div>

          <svg
            className="vc-reveal-mark size-[118px]"
            viewBox="0 0 40 40"
          >
            <rect fill="#171915" height="38" rx="11" width="38" x="1" y="1" />
            <circle
              className="vc-reveal-ring"
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
              className="vc-reveal-dot"
              cx="31"
              cy="9"
              fill="#ef5b42"
              r="4.4"
              stroke="#171915"
              strokeWidth="2.4"
            />
          </svg>
        </div>

        <div className="overflow-hidden text-center">
          <div className="flex justify-center">
            <span className="vc-reveal-word text-[34px] font-bold tracking-[-0.03em] text-white">
              Protegis
            </span>
          </div>
          <p className="vc-reveal-subtitle mt-3 text-[10px] font-semibold uppercase tracking-[0.34em] text-[#8fc2f0]">
            The VC Brain
          </p>
        </div>
      </div>
    </div>
  );
}
