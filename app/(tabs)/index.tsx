import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/hub/status-pill";
import { useResponsiveLayout } from "@/components/hub/responsive";
import { useAgentHub } from "@/lib/agent-hub";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * Home Screen - NativeWind Example
 *
 * This template uses NativeWind (Tailwind CSS for React Native).
 * You can use familiar Tailwind classes directly in className props.
 *
 * Key patterns:
 * - Use `className` instead of `style` for most styling
 * - Theme colors: use tokens directly (bg-background, text-foreground, bg-primary, etc.); no dark: prefix needed
 * - Responsive: standard Tailwind breakpoints work on web
 * - Custom colors defined in tailwind.config.js
 */
export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const isDark = useColorScheme() === "dark";
  const { isCompact, isWide, contentMaxWidth } = useResponsiveLayout();
  const { activeProject, events, tasks, decisions, requestVerification, unreadAlertCount } = useAgentHub();
  const activeTask = tasks.find((task) => task.status === "قيد التنفيذ");
  const doneStages = tasks.filter((task) => task.status === "مكتمل").length;
  const latestEvent = events[0];
  const priorEvent = events[1];
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, contentMaxWidth ? { maxWidth: contentMaxWidth } : undefined]}>
          <View style={[styles.topline, isCompact && styles.toplineCompact]}><View><Text style={[styles.eyebrow, { color: colors.primary }]}>لوحة قيادة التنفيذ</Text><Text style={[styles.heading, isCompact && styles.headingCompact, { color: colors.foreground }]}>مرحباً بك</Text></View><View style={styles.topActions}><Pressable onPress={() => router.push("/alerts")} style={({ pressed }) => [styles.alertButton, { backgroundColor: colors.elevated, borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.alertButtonText, { color: colors.primary }]}>التنبيهات</Text>{unreadAlertCount ? <View style={styles.alertBadge}><Text style={styles.alertBadgeText}>{unreadAlertCount}</Text></View> : null}</Pressable><View style={[styles.live, { backgroundColor: isDark ? "#123C31" : "#E9F7EF" }]}><View style={styles.liveDot} /><Text style={[styles.liveText, { color: isDark ? "#74E1B0" : "#167649" }]}>حيّ</Text></View></View></View>
          <View style={[styles.hero, isWide && styles.heroWide, { backgroundColor: colors.surface, borderColor: colors.border, shadowOpacity: isDark ? 0 : 0.07 }]}><View style={styles.heroTop}><View style={styles.heroTitleWrap}><Text style={[styles.projectCode, { color: colors.muted }]}>المشروع · {activeProject.code}</Text><Text style={[styles.projectName, { color: colors.foreground }]}>{activeProject.name}</Text></View><StatusPill label={activeProject.status} tone="primary" /></View><View style={styles.progressRow}><View><Text style={[styles.progressNumber, isWide && styles.progressNumberWide, { color: colors.primary }]}>{activeProject.progress}%</Text><Text style={[styles.progressCaption, { color: colors.muted }]}>تقدم التنفيذ</Text></View><Text style={[styles.stageLabel, { color: colors.foreground }]}>{activeProject.currentStage}</Text></View><View style={[styles.progressTrack, { backgroundColor: colors.subtle }]}><View style={[styles.progressFill, { width: `${activeProject.progress}%`, backgroundColor: colors.primary }]} /></View><View style={[styles.agentFocus, { backgroundColor: colors.subtle }]}><View style={styles.agentMark}><Text style={styles.agentMarkText}>B</Text></View><View style={styles.agentDetails}><Text style={[styles.currentLabel, { color: colors.muted }]}>الوكيل الحالي</Text><Text style={[styles.agentName, { color: colors.foreground }]}>{activeProject.currentAgent}</Text></View><Text style={[styles.now, { color: colors.success }]}>الآن</Text></View></View>
          <View style={[styles.metricStrip, isWide && styles.metricStripWide, { backgroundColor: colors.elevated, borderColor: colors.border }]}><Metric label="المهام المكتملة" value={`${doneStages}/${tasks.length}`} colors={colors} /><Metric label="الحالة" value="قيد البناء" accent colors={colors} /><Metric label="الأحداث الحديثة" value={`${events.length}`} colors={colors} /></View>
          <View style={[styles.dashboardGrid, isWide && styles.dashboardGridWide]}><View style={styles.primaryColumn}><View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>سلسلة التنفيذ</Text><Text style={[styles.sectionMeta, { color: colors.muted }]}>{doneStages} مكتملة من {tasks.length}</Text></View><View style={[styles.pipeline, { backgroundColor: colors.surface, borderColor: colors.border }]}><PipelineRow label="المتطلبات" status="مكتمل" active={false} colors={colors} /><PipelineRow label="المعمارية" status="مكتمل" active={false} colors={colors} /><PipelineRow label="بناء الواجهة" status="مكتمل" active={false} colors={colors} /><PipelineRow label="بناء الخلفية" status="قيد التنفيذ" active colors={colors} /><PipelineRow label="التحقق" status="قادم" active={false} colors={colors} /><PipelineRow label="المراجعة" status="قادم" active={false} colors={colors} /></View>{activeTask ? <Pressable onPress={() => requestVerification(activeTask.id)} style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={styles.actionText}>إرسال المهمة الحالية إلى التحقق</Text><Text style={styles.actionArrow}>←</Text></Pressable> : null}</View><View style={[styles.secondaryColumn, isWide && styles.secondaryColumnWide]}><View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>سجل التنفيذ</Text><Text style={[styles.sectionMeta, { color: colors.muted }]}>منظم وقابل للتتبع</Text></View>{latestEvent ? <EventRow label={latestEvent.label} actor={latestEvent.actor} time={latestEvent.time} detail={latestEvent.detail} colors={colors} /> : null}{priorEvent ? <EventRow label={priorEvent.label} actor={priorEvent.actor} time={priorEvent.time} detail={priorEvent.detail} muted colors={colors} /> : null}<View style={[styles.decision, { backgroundColor: isDark ? "#242041" : "#EEF0FF" }]}><View><Text style={[styles.decisionCode, { color: colors.primary }]}>{decisions[0].code}</Text><Text style={[styles.decisionTitle, { color: colors.foreground }]}>ذاكرة القرار</Text></View><Text style={[styles.decisionText, { color: colors.foreground }]}>{decisions[0].decision}</Text><Text style={[styles.decisionReason, { color: colors.muted }]}>{decisions[0].reason}</Text></View></View></View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function PipelineRow({ label, status, active, colors }: { label: string; status: string; active: boolean; colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.pipelineRow, { borderBottomColor: colors.border }]}><View style={[styles.step, active ? [styles.stepActive, { backgroundColor: colors.primary }] : status === "مكتمل" ? [styles.stepDone, { backgroundColor: "#E7F8EE" }] : [styles.stepUpcoming, { backgroundColor: colors.subtle }]]}><Text style={[styles.stepText, active || status === "مكتمل" ? styles.stepTextOn : styles.stepTextOff]}>{status === "مكتمل" ? "✓" : active ? "→" : "○"}</Text></View><Text style={[styles.pipelineLabel, active && styles.pipelineLabelActive, { color: active ? colors.primary : colors.foreground }]}>{label}</Text><Text style={[styles.pipelineStatus, active && styles.pipelineStatusActive, { color: active ? colors.primary : colors.muted }]}>{status}</Text></View>;
}

function EventRow({ label, actor, time, detail, muted = false, colors }: { label: string; actor: string; time: string; detail: string; muted?: boolean; colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.event, muted && styles.eventMuted, { backgroundColor: muted ? colors.elevated : colors.surface, borderColor: colors.border }]}><View style={styles.eventTop}><Text style={[styles.eventLabel, { color: colors.primary }]}>{label}</Text><Text style={[styles.eventTime, { color: colors.muted }]}>{time}</Text></View><Text style={[styles.eventActor, { color: colors.foreground }]}>{actor}</Text><Text style={[styles.eventDetail, { color: colors.muted }]}>{detail}</Text></View>;
}

function Metric({ label, value, accent = false, colors }: { label: string; value: string; accent?: boolean; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, accent && styles.metricValueAccent, { color: accent ? colors.primary : colors.foreground }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 104, paddingTop: 18 },
  content: { alignSelf: "center", width: "100%" },
  topline: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" },
  toplineCompact: { alignItems: "flex-end", gap: 10 },
  topActions: { alignItems: "center", flexDirection: "row-reverse", gap: 7, marginTop: 4 },
  alertButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E5E7EF", borderRadius: 99, borderWidth: 1, flexDirection: "row-reverse", paddingHorizontal: 9, paddingVertical: 6 },
  alertButtonText: { color: "#4F46E5", fontSize: 11, fontWeight: "900" },
  alertBadge: { alignItems: "center", backgroundColor: "#D94A5A", borderRadius: 9, height: 17, justifyContent: "center", marginRight: 5, minWidth: 17, paddingHorizontal: 3 },
  alertBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", textAlign: "right" },
  heading: { color: "#191A28", fontSize: 30, fontWeight: "900", marginTop: 3, textAlign: "right" },
  headingCompact: { fontSize: 27 },
  live: { alignItems: "center", backgroundColor: "#E9F7EF", borderRadius: 99, flexDirection: "row-reverse", marginTop: 7, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { backgroundColor: "#18A56B", borderRadius: 10, height: 7, marginLeft: 5, width: 7 },
  liveText: { color: "#167649", fontSize: 11, fontWeight: "800" },
  hero: { backgroundColor: "#FFFFFF", borderColor: "#E9EAF1", borderRadius: 24, borderWidth: 1, marginTop: 19, padding: 19, shadowColor: "#26324A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 18, elevation: 3 },
  heroWide: { padding: 28 },
  heroTop: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" },
  projectCode: { color: "#777D91", fontSize: 12, textAlign: "right" },
  heroTitleWrap: { flex: 1, marginLeft: 12 },
  projectName: { color: "#202231", fontSize: 19, fontWeight: "900", marginTop: 5, textAlign: "right" },
  progressRow: { alignItems: "flex-end", flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 25 },
  progressNumber: { color: "#4F46E5", fontSize: 29, fontWeight: "900", textAlign: "right" },
  progressNumberWide: { fontSize: 34 },
  progressCaption: { color: "#8B90A2", fontSize: 11, marginTop: 2, textAlign: "right" },
  stageLabel: { color: "#36394A", fontSize: 13, fontWeight: "800" },
  progressTrack: { backgroundColor: "#E9EAF2", borderRadius: 99, height: 9, marginTop: 10, overflow: "hidden" },
  progressFill: { backgroundColor: "#4F46E5", borderRadius: 99, height: "100%" },
  agentFocus: { alignItems: "center", backgroundColor: "#F7F7FC", borderRadius: 15, flexDirection: "row-reverse", marginTop: 18, padding: 11 },
  agentMark: { alignItems: "center", backgroundColor: "#0369A1", borderRadius: 11, height: 33, justifyContent: "center", marginLeft: 9, width: 33 },
  agentMarkText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  agentDetails: { flex: 1 },
  currentLabel: { color: "#888EA0", fontSize: 11, textAlign: "right" },
  agentName: { color: "#333648", fontSize: 13, fontWeight: "800", marginTop: 2, textAlign: "right" },
  now: { color: "#18A56B", fontSize: 11, fontWeight: "800" },
  metricStrip: { backgroundColor: "#FFFFFF", borderColor: "#E9EAF1", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 12, paddingHorizontal: 14, paddingVertical: 13 },
  metricStripWide: { paddingHorizontal: 22, paddingVertical: 15 },
  metric: { alignItems: "flex-end", flex: 1 },
  metricValue: { color: "#2C3041", fontSize: 16, fontWeight: "900" },
  metricValueAccent: { color: "#4F46E5" },
  metricLabel: { color: "#868C9E", fontSize: 10, marginTop: 4, textAlign: "right" },
  dashboardGrid: { flexDirection: "column" },
  dashboardGridWide: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 18 },
  primaryColumn: { flex: 1, width: "100%" },
  secondaryColumn: { width: "100%" },
  secondaryColumnWide: { flex: 0.9 },
  sectionHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 11, marginTop: 24 },
  sectionTitle: { color: "#252737", fontSize: 18, fontWeight: "900", textAlign: "right" },
  sectionMeta: { color: "#858B9D", fontSize: 11, textAlign: "left" },
  pipeline: { backgroundColor: "#FFFFFF", borderColor: "#E9EAF1", borderRadius: 20, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 8 },
  pipelineRow: { alignItems: "center", borderBottomColor: "#EFF0F4", borderBottomWidth: 1, flexDirection: "row-reverse", minHeight: 45 },
  step: { alignItems: "center", borderRadius: 50, height: 23, justifyContent: "center", marginLeft: 9, width: 23 },
  stepDone: { backgroundColor: "#E7F8EE" },
  stepActive: { backgroundColor: "#4F46E5" },
  stepUpcoming: { backgroundColor: "#EEF0F5" },
  stepText: { fontSize: 12, fontWeight: "900" },
  stepTextOn: { color: "#FFFFFF" },
  stepTextOff: { color: "#969CAD" },
  pipelineLabel: { color: "#3A3D4F", flex: 1, fontSize: 14, fontWeight: "700", textAlign: "right" },
  pipelineLabelActive: { color: "#4F46E5", fontWeight: "900" },
  pipelineStatus: { color: "#9197A7", fontSize: 11 },
  pipelineStatusActive: { color: "#4F46E5", fontWeight: "800" },
  action: { alignItems: "center", backgroundColor: "#4F46E5", borderRadius: 16, flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 16, paddingHorizontal: 17, paddingVertical: 15 },
  actionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  actionArrow: { color: "#FFFFFF", fontSize: 19 },
  event: { backgroundColor: "#FFFFFF", borderColor: "#E9EAF1", borderRadius: 17, borderWidth: 1, marginBottom: 9, padding: 14 },
  eventMuted: { backgroundColor: "#FCFCFD" },
  eventTop: { flexDirection: "row-reverse", justifyContent: "space-between" },
  eventLabel: { color: "#4F46E5", fontSize: 12, fontWeight: "900" },
  eventTime: { color: "#8F95A5", fontSize: 11 },
  eventActor: { color: "#343749", fontSize: 12, fontWeight: "800", marginTop: 5, textAlign: "right" },
  eventDetail: { color: "#747A8C", fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" },
  decision: { backgroundColor: "#EEF0FF", borderRadius: 18, marginTop: 15, padding: 15 },
  decisionCode: { color: "#4F46E5", fontSize: 12, fontWeight: "900", textAlign: "right" },
  decisionTitle: { color: "#313456", fontSize: 15, fontWeight: "900", marginTop: 3, textAlign: "right" },
  decisionText: { color: "#3B3D56", fontSize: 13, fontWeight: "700", lineHeight: 19, marginTop: 9, textAlign: "right" },
  decisionReason: { color: "#656983", fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: "right" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
