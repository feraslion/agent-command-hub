import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useAgentHub } from "@/lib/agent-hub";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestDeviceNotificationPermission() {
  if (Platform.OS === "web") return "unsupported" as const;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("agent-alerts", {
      name: "تنبيهات Agent Command Hub",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: "#4F46E5",
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  return status === "granted" ? "granted" as const : "denied" as const;
}

export function NotificationBridge() {
  const router = useRouter();
  const { alerts, unreadAlertCount, nativeNotificationsEnabled } = useAgentHub();
  const deliveredIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (Platform.OS === "web" || !nativeNotificationsEnabled) return;
    alerts.filter((alert) => !alert.read && !deliveredIds.current.has(alert.id)).forEach((alert) => {
      deliveredIds.current.add(alert.id);
      Notifications.scheduleNotificationAsync({
        content: {
          title: alert.title,
          body: alert.description,
          data: { destination: "alerts", alertId: alert.id },
          badge: unreadAlertCount,
          color: "#4F46E5",
        },
        trigger: null,
      }).catch(() => deliveredIds.current.delete(alert.id));
    });
  }, [alerts, nativeNotificationsEnabled, unreadAlertCount]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.content.data?.destination === "alerts") router.push("/alerts");
    });
    return () => subscription.remove();
  }, [router]);

  return null;
}
