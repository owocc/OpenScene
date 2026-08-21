import type { NextRequest } from "next/server";
import { authenticate } from "../../server/auth";
import { initializeDatabase } from "../../server/db/client";
import { createOpenApiDocument } from "../../server/openapi/document";
import { problemResponse } from "../../server/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { db } = await initializeDatabase();
    await authenticate(request, db, "management");
    return Response.json(createOpenApiDocument(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return problemResponse(error, "/openapi.json");
  }
}
