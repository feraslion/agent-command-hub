import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";

const OFFLINE_READ_CACHE_KEY = "agenthub.offline-read.v1";
const cacheableProcedureNames = ["projects.list", "tasks.list", "events.list", "approvals.list", "isolatedRuntime.listRequests", "isolatedRuntime.listForOwner"] as const;

type CachedQuery = { key: unknown[]; data: unknown; updatedAt: number };
type OfflineReadPayload = { version: 1; savedAt: number; queries: CachedQuery[] };

export function shouldCacheOfflineQuery(key: readonly unknown[]) {
  const segments = key.flat(Infinity).filter((part): part is string => typeof part === "string");
  return cacheableProcedureNames.some((procedure) => {
    const parts = procedure.split(".");
    return parts.every((part, index) => segments[index] === part || segments.join(".").includes(procedure));
  });
}

export function isSensitiveOfflineAction(action: "approval" | "command" | "workspace_write" | "pull_request" | "runtime_execution") {
  return ["approval", "command", "workspace_write", "pull_request", "runtime_execution"].includes(action);
}

export async function persistOfflineReadCache(queryClient: QueryClient) {
  const queries = queryClient.getQueryCache().getAll()
    .filter((query) => query.state.data !== undefined && shouldCacheOfflineQuery(query.queryKey))
    .slice(-80)
    .map((query) => ({ key: query.queryKey as unknown[], data: query.state.data, updatedAt: query.state.dataUpdatedAt }));
  const payload: OfflineReadPayload = { version: 1, savedAt: Date.now(), queries };
  await AsyncStorage.setItem(OFFLINE_READ_CACHE_KEY, JSON.stringify(payload));
}

export async function hydrateOfflineReadCache(queryClient: QueryClient) {
  const raw = await AsyncStorage.getItem(OFFLINE_READ_CACHE_KEY);
  if (!raw) return { restored: 0, savedAt: null as number | null };
  const parsed = JSON.parse(raw) as OfflineReadPayload;
  if (parsed.version !== 1 || !Array.isArray(parsed.queries)) return { restored: 0, savedAt: null as number | null };
  for (const query of parsed.queries) {
    if (Array.isArray(query.key) && query.data !== undefined) queryClient.setQueryData(query.key, query.data, { updatedAt: query.updatedAt });
  }
  return { restored: parsed.queries.length, savedAt: parsed.savedAt };
}
