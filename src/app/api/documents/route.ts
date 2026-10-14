import { identity, json, failure, databaseError } from "@/server/http";
import { searchOptions, simulatedProvider } from "@/server/provider";
export async function GET(request: Request) {
  try {
    const { db, user } = await identity(request);
    const options = searchOptions(new URL(request.url));
    const { data, error } = await db
      .from("dd_connections")
      .select("insurer_id")
      .eq("user_id", user.id)
      .eq("status", "active");
    databaseError(error);
    return json(
      await simulatedProvider.search(
        (data ?? []).map((d) => d.insurer_id),
        options,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
