// PostgREST can briefly reject a freshly issued JWT with PGRST303 after idle.
// Retry only that explicit pre-execution auth rejection, once. Never replay
// timeouts or ambiguous failures, and never relax token validation.
export async function resilientSupabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (response.status !== 401 || !url.pathname.startsWith("/rest/v1/"))
    return response;
  const error = await response
    .clone()
    .json()
    .catch(() => null);
  if (error?.code !== "PGRST303" || error?.message !== "JWT issued at future")
    return response;
  await new Promise((resolve) => setTimeout(resolve, 1100));
  return fetch(input, init);
}
