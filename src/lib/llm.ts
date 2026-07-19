// Thin LLM caller. Routes to OpenAI (default) or Anthropic via models.ts.
// Keep this the ONLY place that talks to a model provider — one swap point.
//
// Resilience lives HERE, not in callers: OpenAI intermittently rejects
// parallel calls with a bogus "insufficient permissions" error, so every
// call gets up to 3 attempts with jittered backoff (the jitter de-collides
// concurrent requests). If the primary backend is still failing and the
// other backend has a key configured, we cross over once — the brief's
// "Anthropic is fallback" made real.

import { MODEL_CONFIG, pickModel, type Backend } from "@/lib/models";

interface CallOpts {
  system: string;
  user: string;
  tier?: "reasoning" | "volume";
  json?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callOpenAI(opts: CallOpts, model: string): Promise<string> {
  // gpt-5.x / o-series reasoning models only accept the default temperature.
  const fixedTemperature = /^(gpt-5|o\d)/.test(model);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      ...(fixedTemperature ? {} : { temperature: 0.2 }),
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`openai: ${data.error.message}`);
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(opts: CallOpts, model: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`anthropic: ${data.error.message}`);
  return data.content?.[0]?.text ?? "";
}

function hasKey(backend: Backend): boolean {
  return backend === "openai"
    ? !!process.env.OPENAI_API_KEY
    : !!process.env.ANTHROPIC_API_KEY;
}

function callBackend(backend: Backend, opts: CallOpts, model: string): Promise<string> {
  return backend === "openai" ? callOpenAI(opts, model) : callAnthropic(opts, model);
}

export async function callLLM(opts: CallOpts): Promise<string> {
  const tier = opts.tier ?? "reasoning";
  const primary = MODEL_CONFIG.backend;
  const model = pickModel(tier);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callBackend(primary, opts, model);
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await sleep(600 * 2 ** attempt + Math.random() * 400);
    }
  }

  // Primary exhausted — cross to the other backend if it's configured.
  const fallback: Backend = primary === "openai" ? "anthropic" : "openai";
  if (hasKey(fallback)) {
    console.warn(`callLLM: ${primary} failed 3x, falling back to ${fallback}`);
    return callBackend(fallback, opts, MODEL_CONFIG[fallback][tier]);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
