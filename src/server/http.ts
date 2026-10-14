import { serverClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/supabase/config";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export async function identity(request: Request) {
  const db = await serverClient(request);
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (error || !user) throw new HttpError(401, "UNAUTHORIZED");
  return { db, user };
}
export function sameOrigin(request: Request) {
  // Mutations come from the first-party UI, not the provider's read-only API.
  if (request.headers.get("origin") !== siteOrigin())
    throw new HttpError(403, "ORIGIN_REJECTED");
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.code }, error.status);
  if (error instanceof Error && error.message === "NOT_CONFIGURED")
    return json({ error: "NOT_CONFIGURED" }, 503);
  if (error instanceof Error && error.message === "UNAUTHORIZED")
    return json({ error: "UNAUTHORIZED" }, 401);
  return json({ error: "REQUEST_FAILED" }, 500);
}
export function databaseError(error: { message: string } | null) {
  if (!error) return;
  if (error.message.includes("CONNECTION_INACTIVE"))
    throw new HttpError(409, "CONNECTION_INACTIVE");
  if (error.message.includes("INVALID_INPUT"))
    throw new HttpError(400, "INVALID_INPUT");
  console.error("Database operation failed:", error.message);
  throw new HttpError(500, "DATABASE_ERROR");
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw 0;
    return value;
  } catch {
    throw new HttpError(400, "INVALID_INPUT");
  }
}
