import {
  identity,
  sameOrigin,
  json,
  failure,
  body,
  databaseError,
  HttpError,
} from "@/server/http";
import { insurerById } from "@/lib/catalog";
import { retrieveAll, simulatedProvider } from "@/server/provider";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db } = await identity(request);
    const input = await body(request);
    if (typeof input.insurerId !== "string" || !insurerById(input.insurerId))
      throw new HttpError(400, "INVALID_INPUT");
    if (input.action === "connect") {
      if (
        input.accepted !== true ||
        !["de", "en"].includes(String(input.locale))
      )
        throw new HttpError(400, "INVALID_INPUT");
      const { error } = await db.rpc("dd_connect", {
        p_insurer: input.insurerId,
        p_locale: input.locale,
      });
      databaseError(error);
      return json({ ok: true });
    }
    if (input.action === "disconnect") {
      const { error } = await db.rpc("dd_disconnect", {
        p_insurer: input.insurerId,
      });
      databaseError(error);
      return json({ ok: true });
    }
    if (input.action === "sync") {
      const documents = await retrieveAll(simulatedProvider, input.insurerId);
      const { error } = await db.rpc("dd_import", {
        p_insurer: input.insurerId,
        p_documents: documents.map((d) => d.uuid),
      });
      databaseError(error);
      return json({ ok: true });
    }
    throw new HttpError(400, "INVALID_INPUT");
  } catch (error) {
    return failure(error);
  }
}
