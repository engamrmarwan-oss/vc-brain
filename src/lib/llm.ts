// Thin LLM caller. Routes to OpenAI (default) or Anthropic via models.ts.
// Keep this the ONLY place that talks to a model provider — one swap point.

import { MODEL_CONFIG, pickModel } from "@/lib/models";

interface CallOpts {
  system: string;
  user: string;
  tier?: "reasoning" | "volume";
  json?: boolean;
}

export async function callLLM(opts: CallOpts): Promise<string> {
  const model = pickModel(opts.tier ?? "reasoning");

  if (MODEL_CONFIG.backend === "openai") {
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

  // Anthropic fallback
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
