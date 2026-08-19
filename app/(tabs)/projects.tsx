import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/hub/status-pill";
import { SectionTitle } from "@/components/hub/section-title";
import { trpc } from "@/lib/trpc";
import { useResponsiveLayout } from "@/components/hub/responsive";
import { useColors } from "@/hooks/use-colors";

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
  const colors = useColors();
  const { isWide, contentMaxWidth } = useResponsiveLayout();
  const utils = trpc.useUtils();
  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => utils.projects.list.invalidate(),
  });
  const [commandNotice, setCommandNotice] = useState("");
  const commandMutation = trpc.commands.enqueue.useMutation({
    onSuccess: (_, input) => {
      setCommandNotice(`تم وضع أمر تشغيل المشروع في قائمة الانتظار. معرّف المشروع: ${input.projectId}.`);
      utils.projects.list.invalidate();
      utils.commands.list.invalidate({ projectId: input.projectId });
    },
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

  const enqueueProjectRun = (projectId: number) => {
    setCommandNotice("");
    commandMutation.mutate({ projectId, command: "run_project" });
  };

  const errorText = projectsQuery.error?.data?.code === "UNAUTHORIZED"
    ? "سجّل الدخول أولاً لعرض مشاريعك المحفوظة."
    : projectsQuery.error ? "تعذر تحميل المشاريع من الخادم. حاول مجدداً." : "";

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <FlatList
        key={isWide ? "projects-wide" : "projects-compact"}
        data={projects}
        numColumns={isWide ? 2 : 1}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" } : undefined]}
        columnWrapperStyle={isWide && projects.length > 0 ? styles.gridRow : undefined}
        ListHeaderComponent={
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>محفظة التنفيذ</Text>
            <Text style={[styles.heading, { color: colors.foreground }]}>المشاريع</Text>
            <Text style={[styles.subheading, { color: colors.muted }]}>تُعرض هنا المشاريع المحفوظة في قاعدة البيانات وحالتها الفعلية.</Text>
            <Pressable disabled={createMutation.isPending || Boolean(errorText)} onPress={createProject} style={({ pressed }) => [styles.createButton, (pressed || createMutation.isPending || Boolean(errorText)) && styles.pressed]}>
              <Text style={styles.createButtonText}>{createMutation.isPending ? "جارٍ الإنشاء…" : "إنشاء مشروع"}</Text>
              <Text style={styles.plus}>＋</Text>
            </Pressable>
            {errorText ? <View style={[styles.error, { backgroundColor: "#4A202A", borderColor: "#6C2C3B" }]}><Text style={styles.errorText}>{errorText}</Text></View> : null}
            {createMutation.error ? <View style={[styles.error, { backgroundColor: "#4A202A", borderColor: "#6C2C3B" }]}><Text style={styles.errorText}>تعذر إنشاء المشروع. تحقق من اتصالك ثم أعد المحاولة.</Text></View> : null}
            {commandMutation.error ? <View style={[styles.error, { backgroundColor: "#4A202A", borderColor: "#6C2C3B" }]}><Text style={styles.errorText}>تعذر إرسال أمر التشغيل. تحقق من صلاحية المشروع ثم أعد المحاولة.</Text></View> : null}
            {commandNotice ? <View style={[styles.notice, { backgroundColor: colors.subtle, borderColor: colors.border }]}><Text style={[styles.noticeText, { color: colors.foreground }]}>{commandNotice}</Text></View> : null}
            <SectionTitle title="كل المشاريع" caption={projectsQuery.isLoading ? "جارٍ التحميل من قاعدة البيانات…" : `${projects.length} مشاريع محفوظة`} />
          </View>
        }
        renderItem={({ item }) => <ProjectCard project={item} wide={isWide} colors={colors} onRun={() => enqueueProjectRun(item.id)} isSubmitting={commandMutation.isPending} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={!projectsQuery.isLoading && !errorText ? <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.emptyTitle, { color: colors.foreground }]}>لا توجد مشاريع محفوظة بعد</Text><Text style={[styles.emptyText, { color: colors.muted }]}>أنشئ مشروعاً ليصبح نقطة البداية للمهام والأحداث والموافقات الفعلية.</Text></View> : null}
      />
    </ScreenContainer>
  );
}

function ProjectCard({ project, wide, colors, onRun, isSubmitting }: { project: { id: number; name: string; code: string; status: keyof typeof statusLabel; progress: number; currentStage: string; updatedAt: Date }; wide: boolean; colors: ReturnType<typeof useColors>; onRun: () => void; isSubmitting: boolean }) {
  const plansQuery = trpc.runtime.listPlans.useQuery({ projectId: project.id, limit: 1 }, { refetchInterval: 10_000 });
  const latestPlan = plansQuery.data?.[0];
  const stepCount = latestPlan ? readPlanStepCount(latestPlan.steps) : 0;
  return (
    <View style={[styles.card, wide && styles.cardWide, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.code, { backgroundColor: colors.subtle }]}><Text style={[styles.codeText, { color: colors.primary }]}>{project.code}</Text></View>
        <StatusPill label={statusLabel[project.status]} tone={statusTone[project.status]} />
      </View>
      <Text style={[styles.projectTitle, { color: colors.foreground }]}>{project.name}</Text>
      <Text style={[styles.stage, { color: colors.muted }]}>المرحلة الحالية · {project.currentStage}</Text>
      <View style={[styles.progressTrack, { backgroundColor: colors.subtle }]}><View style={[styles.progressFill, { width: `${project.progress}%`, backgroundColor: colors.primary }]} /></View>
      <View style={styles.cardBottom}><Text style={[styles.updated, { color: colors.muted }]}>{formatUpdatedAt(project.updatedAt)}</Text><Text style={[styles.progressLabel, { color: colors.foreground }]}>{project.progress}% مكتمل</Text></View>
      <View style={[styles.runtimeCard, { backgroundColor: colors.subtle, borderColor: colors.border }]}><Text style={[styles.runtimeValue, { color: colors.primary }]}>{latestPlan ? `${stepCount} خطوات · ${runtimePlanStatusLabel(latestPlan.status)}` : "بانتظار أمر محجوز"}</Text><Text style={[styles.runtimeLabel, { color: colors.muted }]}>Runtime الجاف</Text></View>
      <Pressable disabled={isSubmitting} onPress={onRun} style={({ pressed }) => [styles.runButton, { backgroundColor: colors.primary }, (pressed || isSubmitting) && styles.pressed]}><Text style={styles.runButtonText}>{isSubmitting ? "جارٍ إرسال الأمر…" : "إرسال إلى العامل"}</Text><Text style={styles.runArrow}>←</Text></Pressable>
    </View>
  );
}

function formatUpdatedAt(value: Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "غير معروف" : `آخر تحديث ${date.toLocaleDateString("ar")}`;
}

function readPlanStepCount(serializedSteps: string) {
  try {
    const value = JSON.parse(serializedSteps);
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
}

function runtimePlanStatusLabel(status: "ready" | "blocked" | "superseded") {
  return status === "ready" ? "خطة جاهزة" : status === "blocked" ? "تحتاج مراجعة" : "تم استبدالها";
}

const styles = StyleSheet.create({
  list: { paddingBottom: 104, paddingTop: 18 },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", textAlign: "right" },
  heading: { color: "#171725", fontSize: 32, fontWeight: "900", marginTop: 3, textAlign: "right" },
  subheading: { color: "#6F7487", fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: "right" },
  createButton: { alignItems: "center", backgroundColor: "#4F46E5", borderRadius: 16, flexDirection: "row-reverse", justifyContent: "center", marginBottom: 20, marginTop: 20, minHeight: 52, paddingHorizontal: 16, paddingVertical: 15, shadowColor: "#3730A3", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 3 },
  createButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  plus: { color: "#FFFFFF", fontSize: 20, fontWeight: "400", marginLeft: 8 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
  error: { backgroundColor: "#FFF0F2", borderColor: "#FFC7CF", borderRadius: 14, borderWidth: 1, marginBottom: 20, padding: 12 },
  errorText: { color: "#B4233B", fontSize: 13, lineHeight: 19, textAlign: "right" },
  notice: { borderRadius: 14, borderWidth: 1, marginBottom: 16, padding: 12 },
  noticeText: { fontSize: 13, lineHeight: 19, textAlign: "right" },
  card: { backgroundColor: "#FFFFFF", borderColor: "#EAECF2", borderRadius: 20, borderWidth: 1, padding: 17, shadowColor: "#26324A", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  cardWide: { flex: 1 },
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
  runtimeCard: { borderRadius: 12, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 14, paddingHorizontal: 11, paddingVertical: 10 },
  runtimeLabel: { fontSize: 11, fontWeight: "800" },
  runtimeValue: { fontSize: 11, fontWeight: "900" },
  runButton: { alignItems: "center", borderRadius: 13, flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 15, minHeight: 44, paddingHorizontal: 14 },
  runButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  runArrow: { color: "#FFFFFF", fontSize: 17 },
  separator: { height: 12 },
  gridRow: { gap: 12, marginBottom: 12 },
  empty: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#EAECF2", borderRadius: 20, borderWidth: 1, padding: 24 },
  emptyTitle: { color: "#353747", fontSize: 16, fontWeight: "900" },
  emptyText: { color: "#757B8E", fontSize: 13, lineHeight: 20, marginTop: 7, textAlign: "center" },
});
