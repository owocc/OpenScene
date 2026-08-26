import { getAuth } from "../../../../lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export function GET(request: Request) {
  return toNextJsHandler(getAuth().handler).GET(request);
}

export function POST(request: Request) {
  return toNextJsHandler(getAuth().handler).POST(request);
}
