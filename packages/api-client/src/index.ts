import createFetchClient from "openapi-fetch";
import type { paths, components } from "./generated";

export type { paths, components } from "./generated";

export type ApiProblem = components["schemas"]["Problem"];

export function createOpenSceneClient(
  options: Parameters<typeof createFetchClient<paths>>[0] = {},
) {
  return createFetchClient<paths>(options);
}

export function isApiProblem(value: unknown): value is ApiProblem {
  if (!value || typeof value !== "object") return false;
  const problem = value as Partial<ApiProblem>;
  return (
    typeof problem.type === "string" &&
    typeof problem.title === "string" &&
    typeof problem.status === "number" &&
    typeof problem.detail === "string" &&
    typeof problem.instance === "string"
  );
}
