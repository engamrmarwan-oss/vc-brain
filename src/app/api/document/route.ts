// GET /api/document?id=<founderId>&type=deck|resume -> the original file.
// Session-scoped (in-memory, no DB — by design): originals survive as long
// as the server instance, same as every other piece of demo state.

import { NextResponse } from "next/server";
import { getDocument, type DocumentType } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const type = url.searchParams.get("type");
  if (!id || (type !== "deck" && type !== "resume")) {
    return NextResponse.json(
      { error: "query params required: id, type=deck|resume" },
      { status: 400 }
    );
  }

  const doc = getDocument(id, type as DocumentType);
  if (!doc) {
    return NextResponse.json({ error: `no ${type} stored for: ${id}` }, { status: 404 });
  }

  return new NextResponse(Buffer.from(doc.data, "base64"), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `inline; filename="${doc.filename.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
