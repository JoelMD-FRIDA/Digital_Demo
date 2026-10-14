import { identity, json, failure, databaseError } from "@/server/http";
import { simulatedProvider } from "@/server/provider";
export async function GET(request: Request) {
  try {
    const { db, user } = await identity(request);
    const { data, error } = await db
      .from("dd_connections")
      .select("insurer_id")
      .eq("user_id", user.id)
      .eq("status", "active");
    databaseError(error);
    return json(
      await simulatedProvider.insuranceInfos(
        (data ?? []).map((d) => d.insurer_id),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
