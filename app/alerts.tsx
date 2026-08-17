import { useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/hub/status-pill";
import { requestDeviceNotificationPermission } from "@/components/notification-bridge";
import { alertTone, useAgentHub, type HubAlert } from "@/lib/agent-hub";

export default function AlertsScreen() {
  const router = useRouter();
  const { alerts, unreadAlertCount, markAlertRead, markAllAlertsRead, setNativeNotificationsEnabled } = useAgentHub();
  const [deviceStatus, setDeviceStatus] = useState<"idle" | "enabled" | "denied" | "unsupported">("idle");

  const enableDeviceAlerts = async () => {
    const result = await requestDeviceNotificationPermission();
    if (result === "granted") {
      setNativeNotificationsEnabled(true);
      setDeviceStatus("enabled");
    } else if (result === "unsupported") {
      setDeviceStatus("unsupported");
    } else {
      setDeviceStatus("denied");
    }
  };

  const openAlert = (alert: HubAlert) => {
    markAlertRead(alert.id);
    router.replace("/control");
  };

  return <ScreenContainer className="px-5" containerClassName="bg-[#F7F7FC]"><FlatList data={alerts} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<View><View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Text style={styles.backText}>← العودة</Text></Pressable><View><Text style={styles.eyebrow}>استجابة سريعة</Text><Text style={styles.heading}>التنبيهات</Text></View></View><View style={styles.summary}><View style={styles.summaryNumber}><Text style={styles.summaryNumberText}>{unreadAlertCount}</Text></View><View style={styles.summaryBody}><Text style={styles.summaryTitle}>تنبيهات تحتاج انتباهك</Text><Text style={styles.summaryCopy}>يظهر التنبيه فوراً عند وجود موافقة معلقة أو بلوغ 75% من سقف الميزانية.</Text></View></View><View style={styles.buttons}><Pressable onPress={markAllAlertsRead} style={({ pressed }) => [styles.readAll, pressed && styles.pressed]}><Text style={styles.readAllText}>تمييز الكل كمقروء</Text></Pressable><Pressable onPress={enableDeviceAlerts} style={({ pressed }) => [styles.enable, pressed && styles.pressed]}><Text style={styles.enableText}>{Platform.OS === "web" ? "تنبيهات داخلية" : "تفعيل تنبيهات الجهاز"}</Text></Pressable></View>{deviceStatus !== "idle" ? <Text style={styles.statusText}>{deviceStatus === "enabled" ? "تم تفعيل تنبيهات الجهاز لهذه الجلسة." : deviceStatus === "denied" ? "لم تُمنح صلاحية تنبيهات الجهاز؛ ستبقى التنبيهات داخل التطبيق فعالة." : "تنبيهات الجهاز غير مدعومة على الويب؛ استخدم مركز التنبيهات داخل التطبيق."}</Text> : null}</View>} renderItem={({ item }) => <AlertCard alert={item} onPress={() => openAlert(item)} />} ItemSeparatorComponent={() => <View style={styles.separator} />} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>لا توجد تنبيهات جديدة</Text><Text style={styles.emptyText}>ستظهر هنا طلبات الموافقة والتنبيهات الخاصة بالميزانية عند تحققها.</Text></View>} /></ScreenContainer>;
}

function AlertCard({ alert, onPress }: { alert: HubAlert; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, !alert.read && styles.cardUnread, pressed && styles.pressed]}><View style={styles.cardTop}><View style={styles.titleWrap}><View style={[styles.dot, { backgroundColor: alert.severity === "budget" ? "#D88915" : "#4F46E5" }]} /><Text style={styles.cardTitle}>{alert.title}</Text></View><StatusPill label={alert.read ? "مقروء" : "جديد"} tone={alert.read ? "muted" : alertTone(alert.severity)} /></View><Text style={styles.cardDescription}>{alert.description}</Text><View style={styles.cardBottom}><Text style={styles.time}>{alert.time}</Text><Text style={styles.open}>فتح مركز التحكم ←</Text></View></Pressable>;
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40, paddingTop: 18 },
  header: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" },
  back: { paddingVertical: 7 },
  backText: { color: "#4F46E5", fontSize: 13, fontWeight: "900" },
  eyebrow: { color: "#4F46E5", fontSize: 12, fontWeight: "900", textAlign: "right" },
  heading: { color: "#171725", fontSize: 30, fontWeight: "900", marginTop: 2, textAlign: "right" },
  summary: { alignItems: "center", backgroundColor: "#EEEDFF", borderRadius: 19, flexDirection: "row-reverse", marginTop: 18, padding: 15 },
  summaryNumber: { alignItems: "center", backgroundColor: "#4F46E5", borderRadius: 18, height: 42, justifyContent: "center", marginLeft: 12, width: 42 },
  summaryNumberText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  summaryBody: { flex: 1 },
  summaryTitle: { color: "#32345E", fontSize: 14, fontWeight: "900", textAlign: "right" },
  summaryCopy: { color: "#5E6382", fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right" },
  buttons: { flexDirection: "row-reverse", gap: 9, marginBottom: 8, marginTop: 13 },
  enable: { alignItems: "center", backgroundColor: "#4F46E5", borderRadius: 12, flex: 1, paddingVertical: 11 },
  enableText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  readAll: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DFE1EB", borderRadius: 12, borderWidth: 1, flex: 1, paddingVertical: 11 },
  readAllText: { color: "#555A6D", fontSize: 12, fontWeight: "900" },
  statusText: { color: "#71768A", fontSize: 11, lineHeight: 17, marginBottom: 15, marginTop: 3, textAlign: "right" },
  card: { backgroundColor: "#FFFFFF", borderColor: "#E5E7EF", borderRadius: 19, borderWidth: 1, padding: 15 },
  cardUnread: { borderColor: "#C9C6FF", borderWidth: 1.3 },
  cardTop: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" },
  titleWrap: { alignItems: "center", flex: 1, flexDirection: "row-reverse", marginLeft: 8 },
  dot: { borderRadius: 9, height: 8, marginLeft: 7, width: 8 },
  cardTitle: { color: "#2B2D3E", flex: 1, fontSize: 15, fontWeight: "900", textAlign: "right" },
  cardDescription: { color: "#6E7486", fontSize: 13, lineHeight: 20, marginTop: 10, textAlign: "right" },
  cardBottom: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 12 },
  time: { color: "#9398A9", fontSize: 11 },
  open: { color: "#4F46E5", fontSize: 11, fontWeight: "900" },
  separator: { height: 10 },
  empty: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 18, padding: 24 },
  emptyTitle: { color: "#343748", fontSize: 15, fontWeight: "900" },
  emptyText: { color: "#7D8294", fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
