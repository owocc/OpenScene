"use client";

import { createOpenSceneClient, isApiProblem } from "@openscene-ai/api-client";
import createClient from "openapi-react-query";

const fetchClient = createOpenSceneClient({
  baseUrl: "",
  credentials: "include",
  fetch: async (input: Request) => {
    const response = await fetch(input);
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
    return response;
  },
});

export const api = createClient(fetchClient);
export { fetchClient, isApiProblem };
