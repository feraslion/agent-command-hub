import { assertManualHostingCheckEndpoint, formatHostingCheckResult, type HostingProvider } from "../lib/server-hosting-policy";

export type HostingCheckOutcome = ReturnType<typeof formatHostingCheckResult> & { durationMs: number };

export async function runManualHostingCheck(input: { provider: HostingProvider; endpoint: string | null }, dependencies: { fetchImplementation?: typeof fetch; now?: () => number } = {}): Promise<HostingCheckOutcome> {
  const endpoint = assertManualHostingCheckEndpoint(input);
  const fetchImplementation = dependencies.fetchImplementation ?? fetch;
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetchImplementation(endpoint, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "text/plain, application/json;q=0.9, */*;q=0.1" },
    });
    await response.body?.cancel();
    return { ...formatHostingCheckResult({ status: response.status }), durationMs: Math.max(0, now() - startedAt) };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return { ...formatHostingCheckResult({ timedOut }), durationMs: Math.max(0, now() - startedAt) };
  } finally {
    clearTimeout(timeout);
  }
}
