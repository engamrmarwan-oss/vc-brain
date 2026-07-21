// Deploy-green proof. Hit this FIRST after every deploy (Operon lesson:
// deploy an empty app to production before building features).
// No DB to ping — just confirms the server and store boot.

import { NextResponse } from "next/server";
import { dbEnabled } from "@/lib/db";
import { allFounders, hydrateStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  await hydrateStore();
  const count = allFounders().length;
  return NextResponse.json({
    ok: true,
    service: "vc-brain",
    seededFounders: count,
    persistence: dbEnabled() ? "postgres" : "memory-only",
    backend: process.env.MODEL_BACKEND || "openai",
    time: new Date().toISOString(),
  });
}
