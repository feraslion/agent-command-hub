import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/hub/status-pill";
import { useAgentHub, statusTone, type Task, type TaskStatus } from "@/lib/agent-hub";

const filters: { label: string; value: "الكل" | TaskStatus }[] = [{ label: "الكل", value: "الكل" }, { label: "نشط", value: "قيد التنفيذ" }, { label: "مراجعة", value: "مراجعة" }, { label: "مكتمل", value: "مكتمل" }];

export default function TasksScreen() {
  const { tasks, requestVerification } = useAgentHub();
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("الكل");
  const visibleTasks = useMemo(() => filter === "الكل" ? tasks : tasks.filter((task) => task.status === filter), [filter, tasks]);
  return <ScreenContainer className="px-5" containerClassName="bg-[#F7F7FC]"><FlatList data={visibleTasks} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<View><Text style={styles.eyebrow}>خطة قابلة للتحقق</Text><Text style={styles.heading}>المهام</Text><Text style={styles.subheading}>كل مهمة تملك مالكاً، مخرجاً، وحالة واضحة ضمن سلسلة التنفيذ.</Text><View style={styles.filters}>{filters.map((item) => <Pressable key={item.value} onPress={() => setFilter(item.value)} style={({ pressed }) => [styles.filter, filter === item.value && styles.filterActive, pressed && styles.pressed]}><Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View></View>} renderItem={({ item }) => <TaskCard task={item} onVerify={() => requestVerification(item.id)} />} ItemSeparatorComponent={() => <View style={styles.separator} />} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>لا توجد مهام بهذه الحالة الآن.</Text></View>} /></ScreenContainer>;
}

function TaskCard({ task, onVerify }: { task: Task; onVerify: () => void }) {
  return <View style={styles.card}><View style={styles.cardTop}><View><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.meta}>{task.stage} · {task.owner}</Text></View><StatusPill label={task.status} tone={statusTone(task.status)} /></View><View style={styles.artifact}><Text style={styles.artifactLabel}>المخرج</Text><Text style={styles.artifactValue}>{task.artifact}</Text></View><View style={styles.footer}><Text style={styles.priority}>أولوية {task.priority}</Text>{task.status === "قيد التنفيذ" ? <Pressable onPress={onVerify} style={({ pressed }) => [styles.verifyButton, pressed && styles.pressed]}><Text style={styles.verifyText}>طلب تحقق</Text></Pressable> : <Text style={styles.staticAction}>{task.status === "مراجعة" ? "بانتظار QA" : "عرض فقط"}</Text>}</View></View>;
}

const styles = StyleSheet.create({
  list: { paddingBottom: 104, paddingTop: 18 },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", textAlign: "right" },
  heading: { color: "#171725", fontSize: 32, fontWeight: "900", marginTop: 3, textAlign: "right" },
  subheading: { color: "#6F7487", fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: "right" },
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 20, marginTop: 16 },
  filter: { backgroundColor: "#FFFFFF", borderColor: "#E4E6EE", borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 },
  filterActive: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  filterText: { color: "#6D7285", fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: "#FFFFFF" },
  card: { backgroundColor: "#FFFFFF", borderColor: "#EAECF2", borderRadius: 20, borderWidth: 1, padding: 16 },
  cardTop: { flexDirection: "row-reverse", justifyContent: "space-between" },
  taskTitle: { color: "#212334", fontSize: 16, fontWeight: "800", maxWidth: 220, textAlign: "right" },
  meta: { color: "#777D91", fontSize: 12, marginTop: 6, textAlign: "right" },
  artifact: { backgroundColor: "#F7F7FC", borderRadius: 13, flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 14, paddingHorizontal: 12, paddingVertical: 10 },
  artifactLabel: { color: "#7D8295", fontSize: 12 },
  artifactValue: { color: "#414558", fontSize: 12, fontWeight: "800" },
  footer: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 14 },
  priority: { color: "#8A6272", fontSize: 12 },
  verifyButton: { backgroundColor: "#EEEDFF", borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 },
  verifyText: { color: "#4F46E5", fontSize: 12, fontWeight: "800" },
  staticAction: { color: "#8A90A3", fontSize: 12, fontWeight: "700" },
  separator: { height: 11 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  empty: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 18, padding: 24 },
  emptyText: { color: "#7A7F91", fontSize: 14 },
});
