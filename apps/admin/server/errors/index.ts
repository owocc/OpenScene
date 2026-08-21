export type ProblemErrorOptions = {
  type?: string;
  title: string;
  status: number;
  detail: string;
  errors?: Array<{ path: string; message: string }>;
};

export class ProblemError extends Error {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly errors?: Array<{ path: string; message: string }>;

  constructor(options: ProblemErrorOptions) {
    super(options.detail);
    this.name = "ProblemError";
    this.type = options.type ?? `https://openscene.dev/problems/${slugify(options.title)}`;
    this.title = options.title;
    this.status = options.status;
    this.detail = options.detail;
    this.errors = options.errors;
  }
}

export function notFound(detail = "The requested resource was not found"): ProblemError {
  return new ProblemError({ title: "Resource not found", status: 404, detail });
}

export function conflict(detail: string, errors?: ProblemErrorOptions["errors"]): ProblemError {
  return new ProblemError({ title: "Resource conflict", status: 409, detail, errors });
}

export function validation(detail: string, errors?: ProblemErrorOptions["errors"]): ProblemError {
  return new ProblemError({ title: "Validation failed", status: 422, detail, errors });
}

export function unauthorized(detail = "Authentication is required"): ProblemError {
  return new ProblemError({ title: "Authentication required", status: 401, detail });
}

export function forbidden(detail = "You are not allowed to perform this operation"): ProblemError {
  return new ProblemError({ title: "Forbidden", status: 403, detail });
}

export function unsupportedMediaType(
  detail = "The request Content-Type is not supported",
): ProblemError {
  return new ProblemError({ title: "Unsupported media type", status: 415, detail });
}

export function payloadTooLarge(detail = "The request payload is too large"): ProblemError {
  return new ProblemError({ title: "Payload too large", status: 413, detail });
}

export function unavailable(detail: string): ProblemError {
  return new ProblemError({ title: "Dependency unavailable", status: 503, detail });
}

export function problemResponse(error: unknown, instance: string): Response {
  const problem =
    error instanceof ProblemError
      ? error
      : error instanceof ZodError
        ? new ProblemError({
            title: "Validation failed",
            status: 422,
            detail: "The request is invalid",
            errors: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          })
        : new ProblemError({
            title: "Internal Server Error",
            status: 500,
            detail: "An unexpected error occurred",
          });
  const body = {
    type: problem.type,
    title: problem.title,
    status: problem.status,
    detail: problem.detail,
    instance,
    ...(problem.errors ? { errors: problem.errors } : {}),
  };
  return Response.json(body, {
    status: problem.status,
    headers: { "content-type": "application/problem+json" },
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
import { ZodError } from "zod";
