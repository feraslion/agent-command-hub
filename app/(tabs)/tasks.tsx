import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/hub/status-pill";
import { useColors } from "@/hooks/use-colors";
import { useAgentHub, statusTone, type Task, type TaskStatus } from "@/lib/agent-hub";

const filters: { label: string; value: "الكل" | TaskStatus }[] = [{ label: "الكل", value: "الكل" }, { label: "نشط", value: "قيد التنفيذ" }, { label: "مراجعة", value: "مراجعة" }, { label: "مكتمل", value: "مكتمل" }];

export default function TasksScreen() {
  const colors = useColors();
  const { tasks, requestVerification } = useAgentHub();
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("الكل");
  const visibleTasks = useMemo(() => filter === "الكل" ? tasks : tasks.filter((task) => task.status === filter), [filter, tasks]);

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <FlatList
        data={visibleTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<View><Text style={[styles.eyebrow, { color: colors.primary }]}>خطة قابلة للتحقق</Text><Text style={[styles.heading, { color: colors.foreground }]}>المهام</Text><Text style={[styles.subheading, { color: colors.muted }]}>كل مهمة تملك مالكاً، مخرجاً، وحالة واضحة ضمن سلسلة التنفيذ.</Text><View style={[styles.filters, { backgroundColor: colors.subtle }]}>{filters.map((item) => <Pressable key={item.value} onPress={() => setFilter(item.value)} style={({ pressed }) => [styles.filter, { borderColor: filter === item.value ? colors.primary : "transparent", backgroundColor: filter === item.value ? colors.elevated : "transparent" }, pressed && styles.pressed]}><Text style={[styles.filterText, { color: filter === item.value ? colors.primary : colors.muted }]}>{item.label}</Text></Pressable>)}</View></View>}
        renderItem={({ item }) => <TaskCard task={item} onVerify={() => requestVerification(item.id)} colors={colors} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.emptyText, { color: colors.muted }]}>لا توجد مهام بهذه الحالة الآن.</Text></View>}
      />
    </ScreenContainer>
  );
}

function TaskCard({ task, onVerify, colors }: { task: Task; onVerify: () => void; colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.cardTop}><View style={styles.copy}><Text style={[styles.taskTitle, { color: colors.foreground }]}>{task.title}</Text><Text style={[styles.meta, { color: colors.muted }]}>{task.stage} · {task.owner}</Text></View><StatusPill label={task.status} tone={statusTone(task.status)} /></View><View style={[styles.artifact, { backgroundColor: colors.subtle }]}><Text style={[styles.artifactLabel, { color: colors.muted }]}>المخرج</Text><Text style={[styles.artifactValue, { color: colors.foreground }]}>{task.artifact}</Text></View><View style={styles.footer}><Text style={[styles.priority, { color: colors.muted }]}>أولوية {task.priority}</Text>{task.status === "قيد التنفيذ" ? <Pressable onPress={onVerify} style={({ pressed }) => [styles.verifyButton, { backgroundColor: colors.subtle }, pressed && styles.pressed]}><Text style={[styles.verifyText, { color: colors.primary }]}>طلب تحقق</Text></Pressable> : <Text style={[styles.staticAction, { color: colors.muted }]}>{task.status === "مراجعة" ? "بانتظار QA" : "عرض فقط"}</Text>}</View></View>;
}

const styles = StyleSheet.create({
  list: { paddingBottom: 104, paddingTop: 18 }, eyebrow: { fontSize: 13, fontWeight: "800", textAlign: "right" }, heading: { fontSize: 32, fontWeight: "900", marginTop: 3, textAlign: "right" }, subheading: { fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: "right" }, filters: { borderRadius: 16, flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginBottom: 20, marginTop: 16, padding: 4 }, filter: { alignItems: "center", borderRadius: 12, borderWidth: 1, flex: 1, minWidth: 64, paddingHorizontal: 10, paddingVertical: 10 }, filterText: { fontSize: 12, fontWeight: "800" }, card: { borderRadius: 20, borderWidth: 1, padding: 16 }, cardTop: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" }, copy: { flex: 1, marginLeft: 10 }, taskTitle: { fontSize: 16, fontWeight: "800", textAlign: "right" }, meta: { fontSize: 12, marginTop: 6, textAlign: "right" }, artifact: { borderRadius: 13, flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 14, paddingHorizontal: 12, paddingVertical: 10 }, artifactLabel: { fontSize: 12 }, artifactValue: { fontSize: 12, fontWeight: "800" }, footer: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 14 }, priority: { fontSize: 12 }, verifyButton: { borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 }, verifyText: { fontSize: 12, fontWeight: "800" }, staticAction: { fontSize: 12, fontWeight: "700" }, separator: { height: 11 }, pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] }, empty: { alignItems: "center", borderRadius: 18, borderWidth: 1, padding: 24 }, emptyText: { fontSize: 14 },
});
