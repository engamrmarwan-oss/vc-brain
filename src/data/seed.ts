// Seeded founders. The contradictions here are DELIBERATE — they are the
// demo's jaw-drop moment (Trust Score catching a lie). Do not "clean" them.
// Cold-start founder (Tomas) has no GitHub/funding — only public footprint.

import type { Founder } from "@/lib/types";

export const FOUNDERS: Founder[] = [
  {
    id: "priya-nair",
    name: "Priya Nair",
    company: "Vectorplane",
    sector: "AI infra",
    geo: "Berlin",
    entry: "outbound",              // scraped, never applied — proves sourcing
    founderScore: 86,
    founderScoreConfidence: 0.9,
    deckClaims: [
      "Ex-Google, shipped vector DB used by 40 teams internally",
      "Open-source repo with 2.1k stars",
      "Enterprise pilot with a Tier-1 bank",
    ],
    githubUrl: "https://github.com/vectorplane",
  },
  {
    id: "maya-chen",
    name: "Maya Chen",
    company: "Reflex AI",
    sector: "AI infra",
    geo: "Berlin",
    entry: "inbound",              // applied — the Trust Score demo target
    founderScore: 78,
    founderScoreConfidence: 0.82,
    deckClaims: [
      "Technical founder, ex-DeepMind",         // verifiable -> TRUE
      "10,000 active users",                     // THE LIE -> contradicted by GitHub
      "AI infra market, enterprise wedge",       // verifiable -> TRUE
    ],
    githubUrl: "https://github.com/mayachen/reflex",
  },
  {
    id: "tomas-halvorsen",
    name: "Tomas Halvorsen",
    company: "(pre-company)",
    sector: "AI infra",
    geo: "Oslo",
    entry: "cold-start",          // no GitHub, no funding — footprint only
    founderScore: 64,
    founderScoreConfidence: 0.55, // WIDE band — honest uncertainty (brief Q10-11)
    deckClaims: [],
    publicFootprint: [
      "Twitter/X: 3 detailed threads on inference cost optimization",
      "Personal blog: 2 posts on LLM routing, technically deep",
      "Half-built landing page for an inference-routing idea",
    ],
  },
  {
    id: "dan-okoro",
    name: "Dan Okoro",
    company: "Ledgerloop",
    sector: "fintech infra",
    geo: "London",
    entry: "inbound",
    founderScore: 51,
    founderScoreConfidence: 0.78,
    deckClaims: [
      "First-time founder, strong technical background",
      "Crowded market: 6 well-funded incumbents",  // -> bearish market axis
      "Early prototype, no users yet",
    ],
    githubUrl: "https://github.com/danokoro/ledgerloop",
  },
];
