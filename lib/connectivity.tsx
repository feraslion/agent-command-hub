import type { QueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { hydrateOfflineReadCache, persistOfflineReadCache } from "./offline-read";

type ConnectivityContextValue = {
  isOnline: boolean;
  isOffline: boolean;
  isCacheHydrated: boolean;
  cachedAt: number | null;
  canPerformSensitiveActions: boolean;
};

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

export function ConnectivityProvider({ children, queryClient }: PropsWithChildren<{ queryClient: QueryClient }>) {
  const state = Network.useNetworkState();
  const [isCacheHydrated, setIsCacheHydrated] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const isOnline = state.isConnected === true && state.isInternetReachable !== false;
  const isOffline = state.isConnected === false || state.isInternetReachable === false;

  useEffect(() => {
    let active = true;
    void hydrateOfflineReadCache(queryClient).then((result) => {
      if (active) {
        setCachedAt(result.savedAt);
        setIsCacheHydrated(true);
      }
    }).catch(() => { if (active) setIsCacheHydrated(true); });
    return () => { active = false; };
  }, [queryClient]);

  useEffect(() => queryClient.getQueryCache().subscribe(() => {
    if (!isOnline) return;
    void persistOfflineReadCache(queryClient).catch(() => undefined);
  }), [isOnline, queryClient]);

  const value = useMemo(() => ({ isOnline, isOffline, isCacheHydrated, cachedAt, canPerformSensitiveActions: isOnline && isCacheHydrated }), [cachedAt, isCacheHydrated, isOffline, isOnline]);
  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity() {
  const context = useContext(ConnectivityContext);
  if (!context) throw new Error("useConnectivity must be used within ConnectivityProvider");
  return context;
}

export function OfflineReadBanner() {
  const { isOffline, cachedAt } = useConnectivity();
  if (!isOffline) return null;
  const time = cachedAt ? new Date(cachedAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : "غير متاح";
  return <View accessibilityRole="alert" accessibilityLabel="وضع قراءة دون اتصال" style={{ backgroundColor: "#4A3414", borderBottomColor: "#765724", borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 8 }}><Text style={{ color: "#FFE1A6", fontSize: 11, fontWeight: "800", textAlign: "right" }}>وضع قراءة دون اتصال · تعرض آخر حالة محفوظة ({time}). الموافقات والأوامر وتعديل الملفات وطلبات Pull Request متوقفة حتى يعود الاتصال.</Text></View>;
}
