import { identity, json, failure, databaseError } from "@/server/http";
export async function GET(request: Request) {
  try {
    const { db, user } = await identity(request);
    const [documents, connections] = await Promise.all([
      db
        .from("dd_documents")
        .select("document_id,imported_at,read_at,metadata")
        .eq("user_id", user.id)
        .order("imported_at", { ascending: false }),
      db
        .from("dd_connections")
        .select("insurer_id,status,consent_at,last_sync_at")
        .eq("user_id", user.id),
    ]);
    databaseError(documents.error);
    databaseError(connections.error);
    return json({
      email: user.email,
      documents: documents.data,
      connections: connections.data,
    });
  } catch (error) {
    return failure(error);
  }
}
