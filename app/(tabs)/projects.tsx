import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/hub/status-pill";
import { SectionTitle } from "@/components/hub/section-title";
import { trpc } from "@/lib/trpc";

const statusLabel = {
  planning: "قيد التخطيط",
  active: "نشط",
  paused: "متوقف",
  completed: "مكتمل",
  archived: "مؤرشف",
} as const;

const statusTone = {
  planning: "warning",
  active: "primary",
  paused: "muted",
  completed: "success",
  archived: "muted",
} as const;

export default function ProjectsScreen() {
  const projectsQuery = trpc.projects.list.useQuery();
  const utils = trpc.useUtils();
  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => utils.projects.list.invalidate(),
  });
  const projects = projectsQuery.data ?? [];

  const createProject = () => {
    const nextNumber = projects.length + 1;
    createMutation.mutate({
      name: `مشروع جديد ${nextNumber}`,
      code: `P${String(nextNumber).padStart(3, "0")}`,
      budgetLimit: 2.5,
    });
  };

  const errorText = projectsQuery.error?.data?.code === "UNAUTHORIZED"
    ? "سجّل الدخول أولاً لعرض مشاريعك المحفوظة."
    : projectsQuery.error ? "تعذر تحميل المشاريع من الخادم. حاول مجدداً." : "";

  return (
    <ScreenContainer className="px-5" containerClassName="bg-[#F7F7FC]">
      <FlatList
        data={projects}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>محفظة التنفيذ</Text>
            <Text style={styles.heading}>المشاريع</Text>
            <Text style={styles.subheading}>تُعرض هنا المشاريع المحفوظة في قاعدة البيانات وحالتها الفعلية.</Text>
            <Pressable disabled={createMutation.isPending || Boolean(errorText)} onPress={createProject} style={({ pressed }) => [styles.createButton, (pressed || createMutation.isPending || Boolean(errorText)) && styles.pressed]}>
              <Text style={styles.createButtonText}>{createMutation.isPending ? "جارٍ الإنشاء…" : "إنشاء مشروع"}</Text>
              <Text style={styles.plus}>＋</Text>
            </Pressable>
            {errorText ? <View style={styles.error}><Text style={styles.errorText}>{errorText}</Text></View> : null}
            {createMutation.error ? <View style={styles.error}><Text style={styles.errorText}>تعذر إنشاء المشروع. تحقق من اتصالك ثم أعد المحاولة.</Text></View> : null}
            <SectionTitle title="كل المشاريع" caption={projectsQuery.isLoading ? "جارٍ التحميل من قاعدة البيانات…" : `${projects.length} مشاريع محفوظة`} />
          </View>
        }
        renderItem={({ item }) => <ProjectCard project={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={!projectsQuery.isLoading && !errorText ? <View style={styles.empty}><Text style={styles.emptyTitle}>لا توجد مشاريع محفوظة بعد</Text><Text style={styles.emptyText}>أنشئ مشروعاً ليصبح نقطة البداية للمهام والأحداث والموافقات الفعلية.</Text></View> : null}
      />
    </ScreenContainer>
  );
}

function ProjectCard({ project }: { project: { id: number; name: string; code: string; status: keyof typeof statusLabel; progress: number; currentStage: string; updatedAt: Date } }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.code}><Text style={styles.codeText}>{project.code}</Text></View>
        <StatusPill label={statusLabel[project.status]} tone={statusTone[project.status]} />
      </View>
      <Text style={styles.projectTitle}>{project.name}</Text>
      <Text style={styles.stage}>المرحلة الحالية · {project.currentStage}</Text>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${project.progress}%` }]} /></View>
      <View style={styles.cardBottom}><Text style={styles.updated}>{formatUpdatedAt(project.updatedAt)}</Text><Text style={styles.progressLabel}>{project.progress}% مكتمل</Text></View>
    </View>
  );
}

function formatUpdatedAt(value: Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "غير معروف" : `آخر تحديث ${date.toLocaleDateString("ar")}`;
}

const styles = StyleSheet.create({
  list: { paddingTop: 18, paddingBottom: 104 },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", textAlign: "right" },
  heading: { color: "#171725", fontSize: 32, fontWeight: "900", marginTop: 3, textAlign: "right" },
  subheading: { color: "#6F7487", fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: "right" },
  createButton: { alignItems: "center", backgroundColor: "#4F46E5", borderRadius: 16, flexDirection: "row-reverse", justifyContent: "center", marginBottom: 20, marginTop: 20, paddingHorizontal: 16, paddingVertical: 15 },
  createButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  plus: { color: "#FFFFFF", fontSize: 20, fontWeight: "400", marginLeft: 8 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
  error: { backgroundColor: "#FFF0F2", borderColor: "#FFC7CF", borderRadius: 14, borderWidth: 1, marginBottom: 20, padding: 12 },
  errorText: { color: "#B4233B", fontSize: 13, lineHeight: 19, textAlign: "right" },
  card: { backgroundColor: "#FFFFFF", borderColor: "#EAECF2", borderRadius: 20, borderWidth: 1, padding: 17 },
  cardTop: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  code: { backgroundColor: "#F0EFFF", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  codeText: { color: "#4F46E5", fontSize: 12, fontWeight: "800" },
  projectTitle: { color: "#1E2030", fontSize: 18, fontWeight: "800", marginTop: 15, textAlign: "right" },
  stage: { color: "#777C90", fontSize: 13, marginTop: 6, textAlign: "right" },
  progressTrack: { backgroundColor: "#EBEDF3", borderRadius: 99, height: 8, marginTop: 18, overflow: "hidden" },
  progressFill: { backgroundColor: "#4F46E5", borderRadius: 99, height: "100%" },
  cardBottom: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 10 },
  updated: { color: "#8A90A3", fontSize: 12 },
  progressLabel: { color: "#3D4052", fontSize: 12, fontWeight: "700" },
  separator: { height: 12 },
  empty: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#EAECF2", borderRadius: 20, borderWidth: 1, padding: 24 },
  emptyTitle: { color: "#353747", fontSize: 16, fontWeight: "900" },
  emptyText: { color: "#757B8E", fontSize: 13, lineHeight: 20, marginTop: 7, textAlign: "center" },
});
