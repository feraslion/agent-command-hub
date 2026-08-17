import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/hub/status-pill";
import { approvalTone, getBudgetSummary, useAgentHub, type ApprovalLevel, type ApprovalRequest, type CostEntry } from "@/lib/agent-hub";

type ControlView = "cost" | "approvals";

const levelCopy: Record<ApprovalLevel, string> = {
  AUTO: "تنفيذ داخلي تلقائي",
  REVIEW: "تنفيذ مع مراجعة",
  APPROVAL: "قرار يدوي مطلوب",
};

export default function ControlScreen() {
  const [view, setView] = useState<ControlView>("cost");
  const { costEntries, approvals, budgetLimit } = useAgentHub();
  const pendingCount = approvals.filter((item) => item.status === "قيد الانتظار").length;
  const budget = useMemo(() => getBudgetSummary(costEntries, budgetLimit), [costEntries, budgetLimit]);
  const header = (
    <View>
      <Text style={styles.eyebrow}>حوكمة التنفيذ</Text>
      <Text style={styles.heading}>مركز التحكم</Text>
      <Text style={styles.subheading}>راقب الاستهلاك، وامنح الموافقة المناسبة قبل تنفيذ الإجراءات ذات الأثر.</Text>
      <View style={styles.switcher}>
        <Pressable onPress={() => setView("cost")} style={({ pressed }) => [styles.switchButton, view === "cost" && styles.switchActive, pressed && styles.pressed]}><Text style={[styles.switchText, view === "cost" && styles.switchTextActive]}>سجل التكلفة</Text></Pressable>
        <Pressable onPress={() => setView("approvals")} style={({ pressed }) => [styles.switchButton, view === "approvals" && styles.switchActive, pressed && styles.pressed]}><Text style={[styles.switchText, view === "approvals" && styles.switchTextActive]}>الموافقات{pendingCount ? ` · ${pendingCount}` : ""}</Text></Pressable>
      </View>
      {view === "cost" ? <BudgetSummary spent={budget.spent} remaining={budget.remaining} percent={budget.percent} budgetLimit={budgetLimit} /> : <ApprovalSummary pendingCount={pendingCount} />}
    </View>
  );

  return (
    <ScreenContainer className="px-5" containerClassName="bg-[#F7F7FC]">
      {view === "cost" ? <FlatList<CostEntry> data={costEntries} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListHeaderComponent={header} renderItem={({ item }) => <CostRow entry={item} />} ItemSeparatorComponent={() => <View style={styles.separator} />} ListFooterComponent={<Text style={styles.localNote}>هذه قيَم تشغيلية محلية للنسخة الأولى، وليست فاتورة أو خصماً خارجياً.</Text>} /> : <FlatList<ApprovalRequest> data={approvals} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListHeaderComponent={header} renderItem={({ item }) => <ApprovalRow request={item} />} ItemSeparatorComponent={() => <View style={styles.separator} />} ListFooterComponent={<ApprovalFootnote />} />}
    </ScreenContainer>
  );
}

function BudgetSummary({ spent, remaining, percent, budgetLimit }: { spent: number; remaining: number; percent: number; budgetLimit: number }) {
  const alert = percent >= 85;
  return <View style={[styles.budgetCard, alert && styles.budgetCardAlert]}><View style={styles.budgetTop}><View><Text style={styles.budgetLabel}>استهلاك المشروع</Text><Text style={styles.budgetValue}>${spent.toFixed(2)} <Text style={styles.budgetUnit}>من ${budgetLimit.toFixed(2)}</Text></Text></View><StatusPill label={alert ? "قريب من الحد" : "ضمن الحد"} tone={alert ? "warning" : "success"} /></View><View style={styles.track}><View style={[styles.fill, { width: `${percent}%`, backgroundColor: alert ? "#D88915" : "#4F46E5" }]} /></View><View style={styles.budgetBottom}><Text style={styles.budgetHint}>متبقي ${remaining.toFixed(2)}$ قبل سقف الميزانية</Text><Text style={styles.budgetPercent}>{percent}%</Text></View></View>;
}

function ApprovalSummary({ pendingCount }: { pendingCount: number }) {
  return <View style={styles.approvalSummary}><View style={styles.summaryNumber}><Text style={styles.summaryNumberText}>{pendingCount}</Text></View><View style={styles.summaryBody}><Text style={styles.summaryTitle}>طلبات بانتظار قرارك</Text><Text style={styles.summaryCopy}>تفصل السياسة بين الإجراء التلقائي والمراجعة والقرار اليدوي.</Text></View></View>;
}

function CostRow({ entry }: { entry: CostEntry }) {
  return <View style={styles.card}><View style={styles.costTop}><View><Text style={styles.rowTitle}>{entry.task}</Text><Text style={styles.rowSubtitle}>{entry.agent}</Text></View><Text style={styles.costValue}>${entry.cost.toFixed(2)}</Text></View><View style={styles.metricStrip}><Metric label="النموذج" value={entry.model} /><Metric label="الرموز" value={formatTokens(entry.tokens)} /><Metric label="المدة" value={entry.duration} /></View></View>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function ApprovalRow({ request }: { request: ApprovalRequest }) {
  const { approveRequest, rejectRequest } = useAgentHub();
  const pending = request.status === "قيد الانتظار";
  const levelColor = request.level === "APPROVAL" ? "#B4233B" : request.level === "REVIEW" ? "#A95E00" : "#137B50";
  return <View style={styles.card}><View style={styles.approvalTop}><View style={styles.approvalHeading}><Text style={styles.rowTitle}>{request.title}</Text><Text style={styles.rowSubtitle}>{request.requestedBy} · {request.createdAt}</Text></View><StatusPill label={request.status} tone={approvalTone(request.status)} /></View><Text style={styles.requestDetail}>{request.detail}</Text><View style={styles.levelBox}><Text style={[styles.levelBadge, { color: levelColor }]}>{request.level}</Text><Text style={styles.levelText}>{levelCopy[request.level]}</Text><Text style={styles.impact}>{request.impact}</Text></View>{pending ? <View style={styles.actions}><Pressable onPress={() => rejectRequest(request.id)} style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed]}><Text style={styles.rejectText}>رفض</Text></Pressable><Pressable onPress={() => approveRequest(request.id)} style={({ pressed }) => [styles.approveButton, pressed && styles.pressed]}><Text style={styles.approveText}>اعتماد</Text></Pressable></View> : <Text style={styles.resolved}>{request.status === "تلقائي" ? "سُجّل تلقائياً وفق سياسة الإجراء الداخلي." : "تم تسجيل القرار ضمن سجل أحداث المشروع."}</Text>}</View>;
}

function ApprovalFootnote() {
  return <View style={styles.footnote}><Text style={styles.footnoteTitle}>سياسة المستويات</Text><Text style={styles.footnoteCopy}>AUTO للإجراءات الداخلية منخفضة الأثر، REVIEW للإجراءات التي تتطلب مراجعة، وAPPROVAL للميزانية أو تغيير بيانات حساسة أو النشر.</Text></View>;
}

function formatTokens(tokens: number) { return `${(tokens / 1000).toFixed(1)}k`; }

const styles = StyleSheet.create({
  list: { paddingBottom: 104, paddingTop: 18 },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", textAlign: "right" },
  heading: { color: "#171725", fontSize: 32, fontWeight: "900", marginTop: 3, textAlign: "right" },
  subheading: { color: "#6F7487", fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: "right" },
  switcher: { backgroundColor: "#EAEBF2", borderRadius: 15, flexDirection: "row-reverse", marginBottom: 16, marginTop: 18, padding: 4 },
  switchButton: { alignItems: "center", borderRadius: 12, flex: 1, paddingVertical: 10 },
  switchActive: { backgroundColor: "#FFFFFF" },
  switchText: { color: "#777D91", fontSize: 13, fontWeight: "800" },
  switchTextActive: { color: "#4F46E5" },
  budgetCard: { backgroundColor: "#FFFFFF", borderColor: "#E9EAF1", borderRadius: 20, borderWidth: 1, marginBottom: 20, padding: 16 },
  budgetCardAlert: { borderColor: "#F5D8A6" },
  budgetTop: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" },
  budgetLabel: { color: "#747A8D", fontSize: 12, fontWeight: "700", textAlign: "right" },
  budgetValue: { color: "#252738", fontSize: 26, fontWeight: "900", marginTop: 4, textAlign: "right" },
  budgetUnit: { color: "#858B9D", fontSize: 13, fontWeight: "700" },
  track: { backgroundColor: "#ECEEF4", borderRadius: 99, height: 9, marginTop: 17, overflow: "hidden" },
  fill: { borderRadius: 99, height: "100%" },
  budgetBottom: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 9 },
  budgetHint: { color: "#777D91", fontSize: 11 },
  budgetPercent: { color: "#4F46E5", fontSize: 11, fontWeight: "900" },
  approvalSummary: { alignItems: "center", backgroundColor: "#FFF8E8", borderColor: "#F4DFB0", borderRadius: 19, borderWidth: 1, flexDirection: "row-reverse", marginBottom: 20, padding: 15 },
  summaryNumber: { alignItems: "center", backgroundColor: "#D88915", borderRadius: 18, height: 42, justifyContent: "center", marginLeft: 12, width: 42 },
  summaryNumberText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  summaryBody: { flex: 1 },
  summaryTitle: { color: "#66420A", fontSize: 14, fontWeight: "900", textAlign: "right" },
  summaryCopy: { color: "#886A35", fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right" },
  card: { backgroundColor: "#FFFFFF", borderColor: "#E9EAF1", borderRadius: 20, borderWidth: 1, padding: 16 },
  costTop: { flexDirection: "row-reverse", justifyContent: "space-between" },
  rowTitle: { color: "#282A3A", fontSize: 15, fontWeight: "900", maxWidth: 225, textAlign: "right" },
  rowSubtitle: { color: "#777D91", fontSize: 12, marginTop: 5, textAlign: "right" },
  costValue: { color: "#4F46E5", fontSize: 21, fontWeight: "900" },
  metricStrip: { backgroundColor: "#F7F7FC", borderRadius: 14, flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 15, padding: 11 },
  metric: { alignItems: "flex-end", flex: 1 },
  metricValue: { color: "#434658", fontSize: 11, fontWeight: "800", textAlign: "right" },
  metricLabel: { color: "#9298A9", fontSize: 10, marginTop: 3, textAlign: "right" },
  separator: { height: 11 },
  localNote: { color: "#8C91A2", fontSize: 11, lineHeight: 17, marginHorizontal: 10, marginTop: 15, textAlign: "center" },
  approvalTop: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" },
  approvalHeading: { flex: 1, marginLeft: 10 },
  requestDetail: { color: "#646A7D", fontSize: 13, lineHeight: 20, marginTop: 13, textAlign: "right" },
  levelBox: { alignItems: "center", backgroundColor: "#F7F7FC", borderRadius: 14, flexDirection: "row-reverse", flexWrap: "wrap", marginTop: 14, padding: 11 },
  levelBadge: { fontSize: 12, fontWeight: "900", marginLeft: 8 },
  levelText: { color: "#4D5264", fontSize: 12, fontWeight: "700" },
  impact: { color: "#858B9D", fontSize: 11, marginRight: "auto" },
  actions: { flexDirection: "row-reverse", gap: 9, justifyContent: "flex-start", marginTop: 15 },
  approveButton: { alignItems: "center", backgroundColor: "#4F46E5", borderRadius: 12, flex: 1, paddingVertical: 11 },
  approveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  rejectButton: { alignItems: "center", backgroundColor: "#FFF0F2", borderRadius: 12, flex: 1, paddingVertical: 11 },
  rejectText: { color: "#B4233B", fontSize: 13, fontWeight: "900" },
  resolved: { color: "#5F6678", fontSize: 12, lineHeight: 18, marginTop: 15, textAlign: "right" },
  footnote: { backgroundColor: "#EEF0FF", borderRadius: 17, marginTop: 15, padding: 14 },
  footnoteTitle: { color: "#4F46E5", fontSize: 13, fontWeight: "900", textAlign: "right" },
  footnoteCopy: { color: "#5E6380", fontSize: 12, lineHeight: 19, marginTop: 5, textAlign: "right" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
