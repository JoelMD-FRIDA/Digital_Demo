import { identity, failure, databaseError, HttpError } from "@/server/http";
import { simulatedProvider } from "@/server/provider";
export async function GET(
  request: Request,
  context: { params: Promise<{ uuid: string }> },
) {
  try {
    const { db, user } = await identity(request);
    const { uuid } = await context.params;
    const document = await simulatedProvider.fileInfo(uuid);
    if (!document) throw new HttpError(404, "NOT_FOUND");
    const [saved, connection] = await Promise.all([
      db
        .from("dd_documents")
        .select("document_id")
        .eq("user_id", user.id)
        .eq("document_id", document.documentId)
        .maybeSingle(),
      db
        .from("dd_connections")
        .select("status")
        .eq("user_id", user.id)
        .eq("insurer_id", document.insurerId)
        .eq("status", "active")
        .maybeSingle(),
    ]);
    databaseError(saved.error);
    databaseError(connection.error);
    if (!saved.data && !connection.data) throw new HttpError(404, "NOT_FOUND");
    const url = new URL(request.url),
      locale = url.searchParams.get("locale") === "en" ? "en" : "de";
    const bytes = await simulatedProvider.fileContents(uuid, locale);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type":
          url.searchParams.get("preview") === "1"
            ? "application/pdf"
            : "application/octet-stream",
        "Content-Disposition": `${url.searchParams.get("preview") === "1" ? "inline" : "attachment"}; filename="SAMPLE-${document.file.fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
