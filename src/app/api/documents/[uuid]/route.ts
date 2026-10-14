import {
  identity,
  sameOrigin,
  json,
  failure,
  databaseError,
  HttpError,
} from "@/server/http";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ uuid: string }> },
) {
  try {
    sameOrigin(request);
    const { db, user } = await identity(request);
    const { uuid } = await context.params;
    const { data, error } = await db
      .from("dd_documents")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("document_id", uuid)
      .select("document_id");
    databaseError(error);
    if (!data?.length) throw new HttpError(404, "NOT_FOUND");
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
