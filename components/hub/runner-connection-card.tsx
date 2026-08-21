import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getRunnerConnectionPresentation, type RunnerConnectionInput } from "@/lib/runner-connection-presentation";

export function RunnerConnectionCard({
  runner,
  loading = false,
  error = false,
  onPress,
}: {
  runner: RunnerConnectionInput | null | undefined;
  loading?: boolean;
  error?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const isDark = useColorScheme() === "dark";
  const presentation = getRunnerConnectionPresentation(runner);
  const shown = loading
    ? { title: "جارٍ فحص Runner", detail: "تُحمّل حالة الجهاز من مصدر التشغيل الحي.", heartbeatLabel: "بانتظار الاستجابة", tone: "neutral" as const }
    : error
      ? { title: "تعذر فحص Runner", detail: "تحقق من الاتصال أو افتح الإعدادات للمحاولة لاحقاً.", heartbeatLabel: "حالة غير متاحة", tone: "offline" as const }
      : presentation;
  const toneColor = shown.tone === "ready" ? colors.success : shown.tone === "working" ? colors.primary : shown.tone === "pending" ? colors.warning : shown.tone === "offline" ? colors.error : colors.muted;
  const toneBackground = shown.tone === "ready" ? (isDark ? "#123C31" : "#E9F7EF") : shown.tone === "working" ? (isDark ? "#1A3252" : "#EAF3FF") : shown.tone === "pending" ? (isDark ? "#433112" : "#FFF4DA") : shown.tone === "offline" ? (isDark ? "#401F29" : "#FDECEF") : colors.subtle;

  return <Pressable accessibilityRole="button" accessibilityLabel={`${shown.title}. ${shown.detail}. ${shown.heartbeatLabel}. فتح إعدادات Runner.`} onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><View style={[styles.indicator, { backgroundColor: toneBackground }]}><View style={[styles.dot, { backgroundColor: toneColor }]} /></View><View style={styles.copy}><View style={styles.titleRow}><Text style={[styles.title, { color: colors.foreground }]}>{shown.title}</Text><Text style={[styles.link, { color: colors.primary }]}>الإعدادات ←</Text></View><Text numberOfLines={1} style={[styles.detail, { color: colors.muted }]}>{shown.detail}</Text><Text style={[styles.heartbeat, { color: toneColor }]}>{shown.heartbeatLabel}</Text></View></Pressable>;
}

const styles = StyleSheet.create({
  card: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", marginTop: 12, paddingHorizontal: 14, paddingVertical: 13 },
  indicator: { alignItems: "center", borderRadius: 14, height: 44, justifyContent: "center", marginLeft: 11, width: 44 },
  dot: { borderRadius: 8, height: 12, width: 12 },
  copy: { flex: 1 },
  titleRow: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  title: { fontSize: 14, fontWeight: "900", textAlign: "right" },
  link: { fontSize: 11, fontWeight: "800", textAlign: "left" },
  detail: { fontSize: 11, marginTop: 3, textAlign: "right" },
  heartbeat: { fontSize: 10, fontWeight: "800", marginTop: 5, textAlign: "right" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
