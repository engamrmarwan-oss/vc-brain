// Single source of truth for model routing.
// Swap any model in one place if credits run dry mid-sprint (Operon lesson).
// Default backend: OpenAI. Claude kept as fallback via env.

export type Backend = "openai" | "anthropic";

export const MODEL_CONFIG = {
  backend: (process.env.MODEL_BACKEND as Backend) || "openai",
  openai: {
    reasoning: process.env.OPENAI_REASONING_MODEL || "gpt-4o",
    volume: process.env.OPENAI_VOLUME_MODEL || "gpt-4o-mini",
  },
  anthropic: {
    reasoning: process.env.ANTHROPIC_REASONING_MODEL || "claude-sonnet-4-5",
    volume: process.env.ANTHROPIC_VOLUME_MODEL || "claude-haiku-4-5",
  },
} as const;

// tier "reasoning" = hard scoring/memo; "volume" = cheap high-count passes
export function pickModel(tier: "reasoning" | "volume" = "reasoning"): string {
  const b = MODEL_CONFIG.backend;
  return MODEL_CONFIG[b][tier];
}
