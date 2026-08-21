import type { NextRequest } from "next/server";
import { ApiReference } from "@scalar/nextjs-api-reference";
import { authenticate } from "../../server/auth";
import { initializeDatabase } from "../../server/db/client";
import { problemResponse } from "../../server/errors";

export const runtime = "nodejs";

const renderReference = ApiReference({
  url: "/openapi.json",
  pageTitle: "OpenScene Admin API Reference",
  hideModels: false,
});

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { db } = await initializeDatabase();
    await authenticate(request, db, "management");
    return renderReference();
  } catch (error) {
    return problemResponse(error, "/reference");
  }
}
