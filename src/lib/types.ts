// Core domain types. Mirror the brief's scoring model exactly.

export type Trend = "up" | "flat" | "down";
export type AxisVerdict = "bullish" | "neutral" | "bear";
export type Entry = "inbound" | "outbound" | "cold-start";

// A single claim traced to evidence — the Trust Score unit (brief Q7).
export interface Claim {
  text: string;                 // what was claimed
  status: "verified" | "contradicted" | "unverifiable";
  confidence: number;           // 0..1
  evidence: string;             // the exact source that supports/refutes it
  source: string;               // e.g. "GitHub", "deck", "web:tavily"
}

// One of the three independent axes — NEVER averaged (brief Q5).
export interface Axis {
  verdict: AxisVerdict;
  trend: Trend;
  rationale: string;
}

export interface Founder {
  id: string;
  name: string;
  company: string;
  sector: string;
  geo: string;
  entry: Entry;
  // Founder Score: persists in Memory, one input to the Founder axis (brief Q6).
  founderScore: number;
  founderScoreConfidence: number; // wide bands for cold-start
  deckClaims: string[];           // raw claims from the application
  githubUrl?: string;
  publicFootprint?: string[];     // for cold-start scoring via Tavily
}

// Output of the scoring engine for one opportunity.
export interface Assessment {
  founderId: string;
  axes: { founder: Axis; market: Axis; ideaVsMarket: Axis };
  claims: Claim[];
  recommendation: "invest" | "conditional" | "pass";
  conviction: "high" | "medium" | "low";
  checkSize: string;
  speedSeconds: number;           // signal -> decision, instrumented (brief 30%)
  flags: number;
}
