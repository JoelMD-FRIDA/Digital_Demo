import { identity, failure, HttpError } from "@/server/http";
import { canDownload } from "@/server/documents";
import { simulatedProvider } from "@/server/provider";
export async function GET(
  request: Request,
  context: { params: Promise<{ uuid: string }> },
) {
  try {
    const { user } = await identity(request);
    const { uuid } = await context.params;
    const document = await simulatedProvider.fileInfo(uuid);
    if (!document) throw new HttpError(404, "NOT_FOUND");
    if(!await canDownload(user.id,document.documentId,document.insurerId))throw new HttpError(404,"NOT_FOUND");
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
