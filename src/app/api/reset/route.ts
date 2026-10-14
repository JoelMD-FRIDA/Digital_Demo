import {
  identity,
  sameOrigin,
  json,
  failure,
  databaseError,
} from "@/server/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db } = await identity(request);
    const { error } = await db.rpc("dd_reset");
    databaseError(error);
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
