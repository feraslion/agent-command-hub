import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/hub/status-pill";
import { useColors } from "@/hooks/use-colors";
import { getTaskPriorityLabel, getTaskStatusPresentation, isActiveTaskStatus } from "@/lib/live-project-presentation";
import { trpc } from "@/lib/trpc";

type TaskFilter = "all" | "active" | "verifying" | "completed";

const filters: { label: string; value: TaskFilter }[] = [
  { label: "الكل", value: "all" },
  { label: "نشط", value: "active" },
  { label: "تحقق", value: "verifying" },
  { label: "مكتمل", value: "completed" },
];

type LiveTask = { id: number; title: string; description: string | null; stage: string; status: string; priority: string; assignedAgentId: number | null };
type LiveAgent = { id: number; name: string };
const emptyTasks: LiveTask[] = [];
const emptyAgents: LiveAgent[] = [];

export default function TasksScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<TaskFilter>("all");
  const projectsQuery = trpc.projects.list.useQuery();
  const project = projectsQuery.data?.[0];
  const projectId = project?.id ?? 1;
  const tasksQuery = trpc.tasks.list.useQuery({ projectId }, { enabled: Boolean(project) });
  const agentsQuery = trpc.agents.list.useQuery({ projectId }, { enabled: Boolean(project) });
  const verifyTask = trpc.tasks.setStatus.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ projectId });
      utils.events.list.invalidate({ projectId });
      utils.projects.list.invalidate();
    },
  });
  const tasks = (tasksQuery.data ?? emptyTasks) as LiveTask[];
  const agents = (agentsQuery.data ?? emptyAgents) as LiveAgent[];
  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.name])), [agents]);
  const visibleTasks = useMemo(() => tasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "active") return isActiveTaskStatus(task.status);
    return task.status === filter;
  }), [filter, tasks]);

  return <ScreenContainer className="px-5" containerClassName="bg-background"><FlatList data={visibleTasks} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} ListHeaderComponent={<View><Text style={[styles.eyebrow, { color: colors.primary }]}>خطة قابلة للتحقق</Text><Text style={[styles.heading, { color: colors.foreground }]}>المهام</Text><Text style={[styles.subheading, { color: colors.muted }]}>{project ? `مهام ${project.code} تأتي من مصدر البيانات الحي وتعرض حالتها الفعلية.` : "جارٍ تحميل مشاريع المالك والمهام المرتبطة بها."}</Text><View style={[styles.filters, { backgroundColor: colors.subtle }]}>{filters.map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === item.value }} key={item.value} onPress={() => setFilter(item.value)} style={({ pressed }) => [styles.filter, { borderColor: filter === item.value ? colors.primary : "transparent", backgroundColor: filter === item.value ? colors.elevated : "transparent" }, pressed && styles.pressed]}><Text style={[styles.filterText, { color: filter === item.value ? colors.primary : colors.muted }]}>{item.label}</Text></Pressable>)}</View></View>} renderItem={({ item }) => <TaskCard task={item} owner={item.assignedAgentId ? agentsById.get(item.assignedAgentId) ?? `وكيل #${item.assignedAgentId}` : "غير معيّن"} onVerify={() => verifyTask.mutate({ projectId, taskId: item.id, status: "verifying" })} verifying={verifyTask.isPending} colors={colors} />} ItemSeparatorComponent={() => <View style={styles.separator} />} ListEmptyComponent={<TaskListState loading={projectsQuery.isLoading || tasksQuery.isLoading} error={Boolean(projectsQuery.error || tasksQuery.error)} hasProject={Boolean(project)} colors={colors} />} /></ScreenContainer>;
}

function TaskCard({ task, owner, onVerify, verifying, colors }: { task: LiveTask; owner: string; onVerify: () => void; verifying: boolean; colors: ReturnType<typeof useColors> }) {
  const presentation = getTaskStatusPresentation(task.status);
  const canRequestVerification = task.status === "running";
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.cardTop}><View style={styles.copy}><Text style={[styles.taskTitle, { color: colors.foreground }]}>{task.title}</Text><Text style={[styles.meta, { color: colors.muted }]}>{task.stage} · {owner}</Text></View><StatusPill label={presentation.label} tone={presentation.tone} /></View><View style={[styles.artifact, { backgroundColor: colors.subtle }]}><Text style={[styles.artifactLabel, { color: colors.muted }]}>تفاصيل المهمة</Text><Text numberOfLines={2} style={[styles.artifactValue, { color: colors.foreground }]}>{task.description?.trim() || "لا يوجد وصف إضافي مسجل بعد."}</Text></View><View style={styles.footer}><Text style={[styles.priority, { color: colors.muted }]}>أولوية {getTaskPriorityLabel(task.priority)}</Text>{canRequestVerification ? <Pressable disabled={verifying} onPress={onVerify} style={({ pressed }) => [styles.verifyButton, { backgroundColor: colors.subtle }, (pressed || verifying) && styles.pressed]}><Text style={[styles.verifyText, { color: colors.primary }]}>{verifying ? "جارٍ الطلب…" : "طلب تحقق"}</Text></Pressable> : <Text style={[styles.staticAction, { color: colors.muted }]}>{task.status === "verifying" ? "بانتظار QA" : "عرض مباشر"}</Text>}</View></View>;
}

function TaskListState({ loading, error, hasProject, colors }: { loading: boolean; error: boolean; hasProject: boolean; colors: ReturnType<typeof useColors> }) {
  if (loading) return <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><ActivityIndicator color={colors.primary} /><Text style={[styles.emptyText, { color: colors.muted }]}>جارٍ تحميل المهام الحية…</Text></View>;
  const message = error ? "تعذر تحميل المهام. تحقق من الجلسة والاتصال ثم أعد المحاولة." : hasProject ? "لا توجد مهام مسجلة لهذا المشروع بعد." : "لا يوجد مشروع حي للمالك بعد. أنشئ مشروعاً من تبويب المشاريع لتظهر مهامه هنا.";
  return <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.emptyText, { color: colors.muted }]}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  list: { paddingBottom: 104, paddingTop: 18 }, eyebrow: { fontSize: 13, fontWeight: "800", textAlign: "right" }, heading: { fontSize: 32, fontWeight: "900", marginTop: 3, textAlign: "right" }, subheading: { fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: "right" }, filters: { borderRadius: 16, flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginBottom: 20, marginTop: 16, padding: 4 }, filter: { alignItems: "center", borderRadius: 12, borderWidth: 1, flex: 1, minWidth: 64, paddingHorizontal: 10, paddingVertical: 10 }, filterText: { fontSize: 12, fontWeight: "800" }, card: { borderRadius: 20, borderWidth: 1, padding: 16 }, cardTop: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" }, copy: { flex: 1, marginLeft: 10 }, taskTitle: { fontSize: 16, fontWeight: "800", textAlign: "right" }, meta: { fontSize: 12, marginTop: 6, textAlign: "right" }, artifact: { borderRadius: 13, flexDirection: "row-reverse", gap: 10, justifyContent: "space-between", marginTop: 14, paddingHorizontal: 12, paddingVertical: 10 }, artifactLabel: { fontSize: 12 }, artifactValue: { flex: 1, fontSize: 12, fontWeight: "800", textAlign: "right" }, footer: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 14 }, priority: { fontSize: 12 }, verifyButton: { borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 }, verifyText: { fontSize: 12, fontWeight: "800" }, staticAction: { fontSize: 12, fontWeight: "700" }, separator: { height: 11 }, pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] }, empty: { alignItems: "center", borderRadius: 18, borderWidth: 1, gap: 10, padding: 24 }, emptyText: { fontSize: 14, textAlign: "center" },
});
