import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { agentModelRoles, type AgentModelRole } from "@/lib/agent-model-policy";
import { trpc } from "@/lib/trpc";
import { buildRedactedArtifactExport } from "@/lib/runtime-data-policy";

type SectionKey = "brief" | "plan" | "evidence" | "agents";
const blankBrief = { goal: "", scope: "", constraints: "", assumptions: "", openQuestions: "", risks: "" };
const emptyTasks: any[] = [];

export default function ProjectGovernanceScreen() {
  const router = useRouter();
  const { projectId: projectIdParam, projectName } = useLocalSearchParams<{ projectId?: string; projectName?: string }>();
  const projectId = Number(projectIdParam);
  const colors = useColors();
  const utils = trpc.useUtils();
  const [section, setSection] = useState<SectionKey>("brief");
  const [brief, setBrief] = useState(blankBrief);
  const [planTitle, setPlanTitle] = useState("");
  const [planSummary, setPlanSummary] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [criterionText, setCriterionText] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [dependsOnTaskId, setDependsOnTaskId] = useState<number | null>(null);
  const [artifactName, setArtifactName] = useState("");
  const [artifactKind, setArtifactKind] = useState("تحقق");
  const [artifactReference, setArtifactReference] = useState("");
  const [artifactSummary, setArtifactSummary] = useState("");
  const [contextTitle, setContextTitle] = useState("حزمة سياق المشروع");
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<number[]>([]);
  const [selectedContextPackageId, setSelectedContextPackageId] = useState<number | null>(null);
  const [agentRole, setAgentRole] = useState<AgentModelRole>("planner");
  const [notice, setNotice] = useState("");

  const enabled = Number.isInteger(projectId) && projectId > 0;
  const governanceQuery = trpc.governance.get.useQuery({ projectId }, { enabled });
  const tasksQuery = trpc.tasks.list.useQuery({ projectId }, { enabled });
  const projectQuery = trpc.projects.get.useQuery({ projectId }, { enabled });
  const agentRunsQuery = trpc.agentModel.listRuns.useQuery({ projectId }, { enabled });
  const invalidate = async () => {
    await Promise.all([
      utils.governance.get.invalidate({ projectId }),
      utils.tasks.list.invalidate({ projectId }),
      utils.events.list.invalidate({ projectId }),
      utils.projects.get.invalidate({ projectId }),
      utils.agentModel.listRuns.invalidate({ projectId }),
    ]);
  };

  const storedBrief = governanceQuery.data?.brief ?? null;
  useEffect(() => {
    const saved = storedBrief;
    if (saved) setBrief({ goal: saved.goal, scope: saved.scope, constraints: saved.constraints, assumptions: saved.assumptions, openQuestions: saved.openQuestions, risks: saved.risks });
  }, [storedBrief]);

  const tasks = tasksQuery.data ?? emptyTasks;
  const plans = governanceQuery.data?.workPlans ?? [];
  const criteria = governanceQuery.data?.criteria ?? [];
  const dependencies = governanceQuery.data?.dependencyGraph.dependencies ?? [];
  const criticalPathIds = governanceQuery.data?.dependencyGraph.criticalPathTaskIds ?? [];
  const artifacts = governanceQuery.data?.artifacts ?? [];
  const contextPackages = governanceQuery.data?.contextPackages ?? [];
  const reports = governanceQuery.data?.reports ?? [];
  const timeline = governanceQuery.data?.timeline ?? [];
  const activePlan = plans.find((plan) => plan.status !== "superseded") ?? null;
  const agentRuns = agentRunsQuery.data ?? [];

  const saveBrief = trpc.governance.saveBrief.useMutation({ onSuccess: async () => { setNotice("تم حفظ موجز المشروع وتسجيله في الخط الزمني."); await invalidate(); } });
  const createPlan = trpc.governance.createPlan.useMutation({ onSuccess: async () => { setPlanTitle(""); setPlanSummary(""); setNotice("تم إنشاء خطة العمل. يمكنك الآن ربط المهام بها."); await invalidate(); } });
  const createTask = trpc.tasks.create.useMutation({ onSuccess: async () => { setNewTaskTitle(""); setNotice("تم إنشاء مهمة مرتبطة بالخطة الحالية."); await invalidate(); } });
  const createCriterion = trpc.governance.createCriterion.useMutation({ onSuccess: async () => { setCriterionText(""); setNotice("تمت إضافة معيار الإتمام للمهمة."); await invalidate(); } });
  const resolveCriterion = trpc.governance.resolveCriterion.useMutation({ onSuccess: invalidate });
  const addDependency = trpc.governance.addDependency.useMutation({ onSuccess: async () => { setDependsOnTaskId(null); setNotice("تم حفظ الاعتماد بعد فحص الدورات."); await invalidate(); } });
  const registerArtifact = trpc.governance.registerArtifact.useMutation({ onSuccess: async () => { setArtifactName(""); setArtifactReference(""); setArtifactSummary(""); setNotice("تم تسجيل الدليل وإضافته إلى الخط الزمني."); await invalidate(); } });
  const createContextPackage = trpc.governance.createContextPackage.useMutation({ onSuccess: async () => { setNotice("تم إنشاء حزمة سياق من مراجع منقحة فقط."); await invalidate(); } });
  const createReport = trpc.governance.createReport.useMutation({ onSuccess: async (_, input) => { setNotice(input.kind === "delivery" ? "تم إنشاء تقرير تسليم من الحالة الحية." : "تم إنشاء تقرير إيقاف من العوائق الحية."); await invalidate(); } });
  const runAgentRole = trpc.agentModel.run.useMutation({ onSuccess: async (_, input) => { setNotice(`اكتمل دور ${roleLabel(input.role)} بمخرج منظم محفوظ للمراجعة.`); await invalidate(); } });
  const isPending = saveBrief.isPending || createPlan.isPending || createTask.isPending || createCriterion.isPending || addDependency.isPending || registerArtifact.isPending || createContextPackage.isPending || createReport.isPending || runAgentRole.isPending;

  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId) ?? null, [tasks, selectedTaskId]);
  const error = governanceQuery.error ?? tasksQuery.error ?? projectQuery.error ?? agentRunsQuery.error;

  if (!enabled) return <GovernanceState title="مشروع غير صالح" copy="لم يتم تحديد مشروع صالح لفتح حوكمته." colors={colors} onBack={() => router.back()} />;
  if (governanceQuery.isLoading || tasksQuery.isLoading || projectQuery.isLoading) return <GovernanceState title="جارٍ تحميل الحوكمة" copy="يتم جلب الموجز والخطة والمهام من مصدر البيانات الحي." colors={colors} />;
  if (error) return <GovernanceState title="تعذر تحميل الحوكمة" copy={error.data?.code === "UNAUTHORIZED" ? "سجّل الدخول أولاً لفتح بيانات المشروع." : "تحقق من اتصالك ثم أعد فتح الشاشة."} colors={colors} onBack={() => router.back()} />;

  const title = projectQuery.data?.name ?? projectName ?? "المشروع";
  const exportArtifacts = async () => { await Share.share({ title: "سجل الأدلة المنقح", message: buildRedactedArtifactExport(title, artifacts) }); };
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}><Text style={[styles.backText, { color: colors.primary }]}>رجوع</Text></Pressable>
          <View style={styles.headerTitle}><Text style={[styles.eyebrow, { color: colors.primary }]}>قرار · خطة · دليل</Text><Text style={[styles.title, { color: colors.foreground }]}>{title}</Text></View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>حوكمة المشروع</Text>
          <Text style={[styles.summaryCopy, { color: colors.muted }]}>لا يبدأ التفويض من واجهة هذه الشاشة. هي تحفظ موجزاً وخطة ومعايير تحقق ودلائل قابلة للمراجعة.</Text>
          <View style={styles.miniStats}><MiniStat label="المهام" value={String(tasks.length)} colors={colors} /><MiniStat label="المعايير" value={String(criteria.length)} colors={colors} /><MiniStat label="المسار الحرج" value={String(criticalPathIds.length)} colors={colors} /></View>
        </View>

        <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Segment label="الموجز" active={section === "brief"} onPress={() => setSection("brief")} colors={colors} />
          <Segment label="الخطة" active={section === "plan"} onPress={() => setSection("plan")} colors={colors} />
          <Segment label="الأدلة" active={section === "evidence"} onPress={() => setSection("evidence")} colors={colors} />
          <Segment label="الوكلاء" active={section === "agents"} onPress={() => setSection("agents")} colors={colors} />
        </View>

        {notice ? <View style={[styles.notice, { backgroundColor: colors.subtle, borderColor: colors.border }]}><Text style={[styles.noticeText, { color: colors.foreground }]}>{notice}</Text></View> : null}
        {saveBrief.error || createPlan.error || createTask.error || createCriterion.error || addDependency.error || registerArtifact.error || createContextPackage.error || createReport.error || runAgentRole.error ? <View style={[styles.error, { backgroundColor: "#4A202A", borderColor: "#6C2C3B" }]}><Text style={styles.errorText}>تعذر حفظ التعديل. راجع الحقول والسياق وسقف الميزانية؛ ولا تسمح دورة الوكلاء بتطبيق أو تشغيل شيفرة مباشرة.</Text></View> : null}

        {section === "brief" ? <BriefSection brief={brief} setBrief={setBrief} colors={colors} disabled={isPending} onSave={() => saveBrief.mutate({ projectId, ...brief })} /> : null}
        {section === "plan" ? <PlanSection colors={colors} plans={plans} activePlan={activePlan} tasks={tasks} criteria={criteria} dependencies={dependencies} criticalPathIds={criticalPathIds} selectedTaskId={selectedTaskId} dependsOnTaskId={dependsOnTaskId} planTitle={planTitle} planSummary={planSummary} newTaskTitle={newTaskTitle} criterionText={criterionText} pending={isPending} onSetPlanTitle={setPlanTitle} onSetPlanSummary={setPlanSummary} onCreatePlan={() => createPlan.mutate({ projectId, title: planTitle, summary: planSummary })} onSetNewTaskTitle={setNewTaskTitle} onCreateTask={() => activePlan && createTask.mutate({ projectId, workPlanId: activePlan.id, title: newTaskTitle, stage: "planning", priority: "medium" })} onSelectTask={setSelectedTaskId} onSetCriterionText={setCriterionText} onCreateCriterion={() => selectedTask && createCriterion.mutate({ projectId, taskId: selectedTask.id, criterion: criterionText })} onResolveCriterion={(criterionId) => resolveCriterion.mutate({ projectId, criterionId, status: "verified", evidenceNote: "تم التحقق من المالك." })} onSelectDependency={setDependsOnTaskId} onAddDependency={() => selectedTask && dependsOnTaskId && addDependency.mutate({ projectId, taskId: selectedTask.id, dependsOnTaskId })} /> : null}
        {section === "evidence" ? <EvidenceSection colors={colors} tasks={tasks} activePlan={activePlan} briefExists={Boolean(governanceQuery.data?.brief)} artifacts={artifacts} contextPackages={contextPackages} reports={reports} timeline={timeline} selectedTaskId={selectedTaskId} selectedArtifactIds={selectedArtifactIds} artifactName={artifactName} artifactKind={artifactKind} artifactReference={artifactReference} artifactSummary={artifactSummary} contextTitle={contextTitle} pending={isPending} onSetArtifactName={setArtifactName} onSetArtifactKind={setArtifactKind} onSetArtifactReference={setArtifactReference} onSetArtifactSummary={setArtifactSummary} onToggleArtifact={(id: number) => setSelectedArtifactIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id].slice(0, 12))} onSetContextTitle={setContextTitle} onRegisterArtifact={() => registerArtifact.mutate({ projectId, taskId: selectedTaskId ?? undefined, name: artifactName, kind: artifactKind, reference: artifactReference, summary: artifactSummary || undefined })} onCreateContext={() => createContextPackage.mutate({ projectId, taskId: selectedTaskId ?? undefined, title: contextTitle, includeBrief: Boolean(governanceQuery.data?.brief), workPlanId: activePlan?.id, taskIds: selectedTaskId ? [selectedTaskId] : [], artifactIds: selectedArtifactIds, includeRecentEvents: true })} onExportArtifacts={exportArtifacts} onCreateReport={(kind: "delivery" | "blocked", finalize: boolean) => createReport.mutate({ projectId, kind, finalize })} /> : null}
        {section === "agents" ? <AgentCycleSection colors={colors} tasks={tasks} contextPackages={contextPackages} runs={agentRuns} selectedTaskId={selectedTaskId} selectedContextPackageId={selectedContextPackageId} selectedRole={agentRole} pending={isPending} onSelectTask={setSelectedTaskId} onSelectContext={setSelectedContextPackageId} onSelectRole={setAgentRole} onRun={() => selectedContextPackageId && runAgentRole.mutate({ projectId, taskId: selectedTaskId ?? undefined, contextPackageId: selectedContextPackageId, role: agentRole })} /> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function BriefSection({ brief, setBrief, colors, disabled, onSave }: { brief: typeof blankBrief; setBrief: (value: typeof blankBrief) => void; colors: ReturnType<typeof useColors>; disabled: boolean; onSave: () => void }) {
  const fields: [keyof typeof blankBrief, string, string][] = [["goal", "الهدف", "النتيجة التي يجب تحقيقها"], ["scope", "النطاق", "ما يشمله العمل وما لا يشمله"], ["constraints", "القيود", "ميزانية أو أمان أو منصة"], ["assumptions", "الافتراضات", "ما نفترض صحته مؤقتاً"], ["openQuestions", "الأسئلة المفتوحة", "ما يحتاج قراراً أو استيضاحاً"], ["risks", "المخاطر", "ما قد يوقف العمل أو يوسعه"]];
  return <View style={styles.section}>{fields.map(([key, label, placeholder]) => <View key={key} style={styles.field}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text><TextInput multiline value={brief[key]} onChangeText={(value) => setBrief({ ...brief, [key]: value })} placeholder={placeholder} placeholderTextColor={colors.muted} textAlign="right" style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} /></View>)}<PrimaryButton label={disabled ? "جارٍ الحفظ…" : "حفظ موجز المشروع"} onPress={onSave} disabled={disabled || brief.goal.trim().length < 2} colors={colors} /></View>;
}

function PlanSection(props: { colors: ReturnType<typeof useColors>; plans: any[]; activePlan: any; tasks: any[]; criteria: any[]; dependencies: any[]; criticalPathIds: number[]; selectedTaskId: number | null; dependsOnTaskId: number | null; planTitle: string; planSummary: string; newTaskTitle: string; criterionText: string; pending: boolean; onSetPlanTitle: (value: string) => void; onSetPlanSummary: (value: string) => void; onCreatePlan: () => void; onSetNewTaskTitle: (value: string) => void; onCreateTask: () => void; onSelectTask: (id: number) => void; onSetCriterionText: (value: string) => void; onCreateCriterion: () => void; onResolveCriterion: (id: number) => void; onSelectDependency: (id: number) => void; onAddDependency: () => void }) {
  const { colors, plans, activePlan, tasks, criteria, dependencies, criticalPathIds, selectedTaskId, dependsOnTaskId, planTitle, planSummary, newTaskTitle, criterionText, pending } = props;
  return <View style={styles.section}>
    <SectionHeading title="خطة العمل" copy="تُحفظ الخطط كمسودات أو مراجعة أو معتمدة، وتبقى المهام قابلة للتتبع بصورة مستقلة." colors={colors} />
    <TextInput value={planTitle} onChangeText={props.onSetPlanTitle} placeholder="عنوان الخطة" placeholderTextColor={colors.muted} textAlign="right" style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
    <TextInput multiline value={planSummary} onChangeText={props.onSetPlanSummary} placeholder="المراحل والنتيجة المتوقعة ومعيار المراجعة" placeholderTextColor={colors.muted} textAlign="right" style={[styles.input, styles.multiline, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
    <PrimaryButton label={pending ? "جارٍ الإنشاء…" : "إنشاء خطة عمل"} onPress={props.onCreatePlan} disabled={pending || planTitle.trim().length < 2 || planSummary.trim().length < 2} colors={colors} />
    {plans.map((plan) => <View key={plan.id} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{plan.title}</Text><Text style={[styles.itemCopy, { color: colors.muted }]}>{plan.summary}</Text><Text style={[styles.meta, { color: colors.primary }]}>{plan.status === "approved" ? "معتمدة" : plan.status === "review" ? "قيد المراجعة" : "مسودة"}</Text></View>)}

    <SectionHeading title="المهام ومعايير الإتمام" copy={activePlan ? `سترتبط المهمة الجديدة بالخطة: ${activePlan.title}` : "أنشئ خطة أولاً لربط مهمة بها."} colors={colors} />
    <TextInput value={newTaskTitle} onChangeText={props.onSetNewTaskTitle} placeholder="عنوان مهمة للخطة" placeholderTextColor={colors.muted} textAlign="right" style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
    <PrimaryButton label="إنشاء مهمة للخطة" onPress={props.onCreateTask} disabled={pending || !activePlan || newTaskTitle.trim().length < 2} colors={colors} />
    <TaskPicker label="اختر المهمة التي ستراجعها" tasks={tasks} selectedTaskId={selectedTaskId} criticalPathIds={criticalPathIds} onSelect={props.onSelectTask} colors={colors} />
    {selectedTaskId ? <><TextInput value={criterionText} onChangeText={props.onSetCriterionText} placeholder="ما الدليل الذي يثبت اكتمال هذه المهمة؟" placeholderTextColor={colors.muted} textAlign="right" style={[styles.input, styles.multiline, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} /><PrimaryButton label="إضافة معيار إتمام" onPress={props.onCreateCriterion} disabled={pending || criterionText.trim().length < 2} colors={colors} /></> : null}
    {criteria.filter((criterion) => criterion.taskId === selectedTaskId).map((criterion) => <View key={criterion.id} style={[styles.lineItem, { borderColor: colors.border }]}><View style={styles.lineCopy}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{criterion.criterion}</Text><Text style={[styles.meta, { color: criterion.status === "verified" ? colors.success : colors.muted }]}>{criterion.status === "verified" ? "موثق" : criterion.status === "waived" ? "متجاوز" : "بانتظار الدليل"}</Text></View>{criterion.status === "pending" ? <Pressable onPress={() => props.onResolveCriterion(criterion.id)} style={({ pressed }) => [styles.smallButton, { borderColor: colors.success }, pressed && styles.pressed]}><Text style={[styles.smallButtonText, { color: colors.success }]}>تحقق</Text></Pressable> : null}</View>)}

    <SectionHeading title="اعتماديات المهام" copy="يُرفض أي ربط يشكل دورة. أطول سلسلة غير مكتملة هي المسار الحرج." colors={colors} />
    {selectedTaskId ? <TaskPicker label="تعتمد المهمة المختارة على" tasks={tasks.filter((task) => task.id !== selectedTaskId)} selectedTaskId={dependsOnTaskId} criticalPathIds={[]} onSelect={props.onSelectDependency} colors={colors} /> : null}
    <PrimaryButton label="حفظ الاعتماد" onPress={props.onAddDependency} disabled={pending || !selectedTaskId || !dependsOnTaskId} colors={colors} />
    {dependencies.map((dependency) => <Text key={dependency.id} style={[styles.dependency, { color: colors.muted }]}>{dependency.taskTitle} ← يعتمد على ← {dependency.dependsOnTaskTitle}</Text>)}
  </View>;
}

function EvidenceSection({ colors, tasks, activePlan, briefExists, artifacts, contextPackages, reports, timeline, selectedTaskId, selectedArtifactIds, artifactName, artifactKind, artifactReference, artifactSummary, contextTitle, pending, onSetArtifactName, onSetArtifactKind, onSetArtifactReference, onSetArtifactSummary, onToggleArtifact, onSetContextTitle, onRegisterArtifact, onCreateContext, onExportArtifacts, onCreateReport }: { colors: ReturnType<typeof useColors>; tasks: any[]; activePlan: any; briefExists: boolean; artifacts: any[]; contextPackages: any[]; reports: any[]; timeline: any[]; selectedTaskId: number | null; selectedArtifactIds: number[]; artifactName: string; artifactKind: string; artifactReference: string; artifactSummary: string; contextTitle: string; pending: boolean; onSetArtifactName: (value: string) => void; onSetArtifactKind: (value: string) => void; onSetArtifactReference: (value: string) => void; onSetArtifactSummary: (value: string) => void; onToggleArtifact: (id: number) => void; onSetContextTitle: (value: string) => void; onRegisterArtifact: () => void; onCreateContext: () => void; onExportArtifacts: () => void; onCreateReport: (kind: "delivery" | "blocked", finalize: boolean) => void }) {
  const canCreateContext = briefExists || Boolean(activePlan) || Boolean(selectedTaskId) || selectedArtifactIds.length > 0 || timeline.length > 0;
  const selectedTaskTitle = tasks.find((task) => task.id === selectedTaskId)?.title;
  return <View style={styles.section}>
    <SectionHeading title="سجل الأدلة" copy={selectedTaskTitle ? `سيسجل الدليل للمهمة المختارة: ${selectedTaskTitle}` : "اختر مهمة من قسم الخطة لربط الدليل بها، أو سجله على مستوى المشروع."} colors={colors} />
    <TextInput value={artifactName} onChangeText={onSetArtifactName} placeholder="اسم الدليل، مثل تقرير QA" placeholderTextColor={colors.muted} textAlign="right" style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
    <TextInput value={artifactKind} onChangeText={onSetArtifactKind} placeholder="نوع الدليل، مثل تحقق أو فرق" placeholderTextColor={colors.muted} textAlign="right" style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border, marginTop: 9 }]} />
    <TextInput value={artifactReference} onChangeText={onSetArtifactReference} placeholder="مرجع آمن: مسار أو معرّف أو رابط" placeholderTextColor={colors.muted} textAlign="right" style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border, marginTop: 9 }]} />
    <TextInput multiline value={artifactSummary} onChangeText={onSetArtifactSummary} placeholder="ملخص مقتضب لما يثبته الدليل" placeholderTextColor={colors.muted} textAlign="right" style={[styles.input, styles.multiline, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border, marginTop: 9 }]} />
    <PrimaryButton label="تسجيل دليل" onPress={onRegisterArtifact} disabled={pending || artifactName.trim().length < 2 || artifactKind.trim().length < 2 || artifactReference.trim().length < 1} colors={colors} />
    {artifacts.map((artifact) => <Pressable key={artifact.id} onPress={() => onToggleArtifact(artifact.id)} style={({ pressed }) => [styles.itemCard, { backgroundColor: selectedArtifactIds.includes(artifact.id) ? colors.subtle : colors.surface, borderColor: selectedArtifactIds.includes(artifact.id) ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{artifact.name}</Text><Text style={[styles.itemCopy, { color: colors.muted }]}>{artifact.summary || artifact.kind}</Text><Text style={[styles.meta, { color: colors.primary }]}>{selectedArtifactIds.includes(artifact.id) ? "مختار لحزمة السياق" : artifact.kind}</Text></Pressable>)}
    <PrimaryButton label={`تصدير الأدلة المنقحة (${artifacts.length})`} onPress={onExportArtifacts} disabled={!artifacts.length} colors={colors} />

    <SectionHeading title="حزمة سياق منقحة" copy="تخزن الحزمة مراجع قصيرة فقط؛ لا يضاف محتوى Workspace الخام أو أسرار البيئة." colors={colors} />
    <TextInput value={contextTitle} onChangeText={onSetContextTitle} placeholder="اسم حزمة السياق" placeholderTextColor={colors.muted} textAlign="right" style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
    <View style={[styles.contextNotice, { backgroundColor: colors.subtle, borderColor: colors.border }]}><Text style={[styles.itemCopy, { color: colors.muted }]}>المصادر: {briefExists ? "الموجز" : ""}{briefExists && activePlan ? " · " : ""}{activePlan ? activePlan.title : ""}{selectedTaskTitle ? ` · ${selectedTaskTitle}` : ""}{selectedArtifactIds.length ? ` · ${selectedArtifactIds.length} أدلة` : ""} · آخر الأحداث</Text></View>
    <PrimaryButton label="إنشاء حزمة سياق" onPress={onCreateContext} disabled={pending || contextTitle.trim().length < 2 || !canCreateContext} colors={colors} />
    {contextPackages.map((contextPackage) => <View key={contextPackage.id} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{contextPackage.title}</Text><Text style={[styles.itemCopy, { color: colors.muted }]}>{contextPackage.redactionSummary}</Text><Text style={[styles.meta, { color: colors.primary }]}>{safeReferenceCount(contextPackage.sourceRefs)} مراجع · تقدير {contextPackage.tokenEstimate} رمزاً</Text></View>)}

    <SectionHeading title="الخط الزمني" copy="يضم أحداث الحوكمة والمهام والتشغيل والموافقات المرتبطة بالمشروع." colors={colors} />
    {timeline.slice(0, 12).map((event) => <View key={event.id} style={[styles.timelineItem, { borderColor: colors.border }]}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{event.label}</Text><Text style={[styles.itemCopy, { color: colors.muted }]}>{event.detail}</Text><Text style={[styles.meta, { color: colors.primary }]}>{event.actor}</Text></View>)}

    <SectionHeading title="تقرير تسليم أو إيقاف" copy="يُولد من حالة المهام والأدلة والموافقات الحية. لا ينفذ نشرًا أو تغييرًا خارجياً." colors={colors} />
    <View style={styles.twoButtons}><View style={styles.halfButton}><PrimaryButton label="مسودة تسليم" onPress={() => onCreateReport("delivery", false)} disabled={pending} colors={colors} /></View><View style={styles.halfButton}><PrimaryButton label="تقرير إيقاف نهائي" onPress={() => onCreateReport("blocked", true)} disabled={pending} colors={colors} /></View></View>
    {reports.map((report) => <View key={report.id} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{report.kind === "delivery" ? "تقرير تسليم" : "تقرير إيقاف"} · {report.status === "final" ? "نهائي" : "مسودة"}</Text><Text style={[styles.itemCopy, { color: colors.muted }]}>{report.summary}</Text><Text style={[styles.itemCopy, { color: colors.muted }]}>{report.nextStep}</Text></View>)}
  </View>;
}
function AgentCycleSection({ colors, tasks, contextPackages, runs, selectedTaskId, selectedContextPackageId, selectedRole, pending, onSelectTask, onSelectContext, onSelectRole, onRun }: { colors: ReturnType<typeof useColors>; tasks: any[]; contextPackages: any[]; runs: any[]; selectedTaskId: number | null; selectedContextPackageId: number | null; selectedRole: AgentModelRole; pending: boolean; onSelectTask: (id: number) => void; onSelectContext: (id: number) => void; onSelectRole: (role: AgentModelRole) => void; onRun: () => void }) {
  const needsTask = selectedRole === "debugger";
  const canRun = Boolean(selectedContextPackageId) && (!needsTask || Boolean(selectedTaskId));
  return <View style={styles.section}>
    <SectionHeading title="دورة الوكلاء المحكومة" copy="كل تشغيل يحجز سقف تكلفة قبل الإرسال، ويعمل من حزمة سياق منقحة. لا يملك أي دور صلاحية تطبيق تعديل أو تشغيل شيفرة." colors={colors} />
    <TaskPicker label={needsTask ? "مهمة Debugger (إلزامية)" : "مهمة مرتبطة اختيارياً"} tasks={tasks} selectedTaskId={selectedTaskId} criticalPathIds={[]} onSelect={onSelectTask} colors={colors} />
    <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 16 }]}>حزمة السياق</Text>
    {contextPackages.map((contextPackage) => <Pressable key={contextPackage.id} onPress={() => onSelectContext(contextPackage.id)} style={({ pressed }) => [styles.taskChoice, { backgroundColor: selectedContextPackageId === contextPackage.id ? colors.subtle : colors.surface, borderColor: selectedContextPackageId === contextPackage.id ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.taskChoiceText, { color: colors.foreground }]}>{contextPackage.title}</Text><Text style={[styles.critical, { color: colors.muted }]}>{contextPackage.tokenEstimate} رموز</Text></Pressable>)}
    {!contextPackages.length ? <View style={[styles.contextNotice, { backgroundColor: colors.subtle, borderColor: colors.border }]}><Text style={[styles.itemCopy, { color: colors.muted }]}>أنشئ حزمة سياق من تبويب الأدلة قبل تشغيل أي دور.</Text></View> : null}
    <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 16 }]}>الدور المطلوب</Text>
    <View style={styles.roleGrid}>{agentModelRoles.map((role) => <Pressable key={role} onPress={() => onSelectRole(role)} style={({ pressed }) => [styles.roleChoice, { backgroundColor: selectedRole === role ? colors.primary : colors.surface, borderColor: selectedRole === role ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.roleChoiceText, { color: selectedRole === role ? "#FFFFFF" : colors.foreground }]}>{roleLabel(role)}</Text></Pressable>)}</View>
    <View style={[styles.contextNotice, { backgroundColor: colors.subtle, borderColor: colors.border }]}><Text style={[styles.itemCopy, { color: colors.muted }]}>{roleAuthority(selectedRole)}</Text></View>
    <PrimaryButton label={pending ? "جارٍ تشغيل الدور…" : `تشغيل ${roleLabel(selectedRole)} بمخرج JSON`} onPress={onRun} disabled={pending || !canRun} colors={colors} />
    <SectionHeading title="المخرجات المحفوظة" copy="المخرجات المقترحة قابلة للمراجعة فقط؛ لا تُطبق تلقائياً في Workspace." colors={colors} />
    {runs.map((run) => <View key={run.id} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{roleLabel(run.role)} · {run.status}</Text><Text style={[styles.itemCopy, { color: colors.muted }]}>{run.outputSummary || run.errorSummary || run.inputSummary}</Text>{run.outputJson ? <Text style={[styles.modelOutput, { color: colors.foreground, borderColor: colors.border }]}>{safeModelOutput(run.outputJson)}</Text> : null}<Text style={[styles.meta, { color: colors.primary }]}>{run.model} · المحاولة {run.attemptNumber}</Text></View>)}
  </View>;
}
function safeReferenceCount(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.length : 0; } catch { return 0; } }
function safeModelOutput(value: string) { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return "المخرج غير قابل للعرض المنظم."; } }
function roleLabel(role: AgentModelRole) { return ({ planner: "Planner", coder: "Coder", qa: "QA", reviewer: "Reviewer", debugger: "Debugger" } as const)[role]; }
function roleAuthority(role: AgentModelRole) { return ({ planner: "ينتج خطة وأسئلة ومعايير قبول قابلة للمراجعة.", coder: "ينتج فرقاً مقترحاً فقط، بلا كتابة Workspace أو Git.", qa: "ينتج PASS أو FAIL وأدلة وفجوات؛ لا يغير حالة المهمة.", reviewer: "يراجع المخاطر والنطاق ويحدد طلب التعديل أو التحفظ.", debugger: "يقدم تشخيصاً وأصغر إصلاح مقترح بحد أقصى محاولتين لكل مهمة." } as const)[role]; }
function TaskPicker({ label, tasks, selectedTaskId, criticalPathIds, onSelect, colors }: { label: string; tasks: any[]; selectedTaskId: number | null; criticalPathIds: number[]; onSelect: (id: number) => void; colors: ReturnType<typeof useColors> }) { return <View style={styles.picker}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>{tasks.map((task) => <Pressable key={task.id} onPress={() => onSelect(task.id)} style={({ pressed }) => [styles.taskChoice, { backgroundColor: selectedTaskId === task.id ? colors.subtle : colors.surface, borderColor: selectedTaskId === task.id ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.taskChoiceText, { color: colors.foreground }]}>{task.title}</Text>{criticalPathIds.includes(task.id) ? <Text style={[styles.critical, { color: colors.warning }]}>حرج</Text> : null}</Pressable>)}</View>; }
function Segment({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void; colors: ReturnType<typeof useColors> }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.segmentItem, active && { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.segmentText, { color: active ? "#FFFFFF" : colors.muted }]}>{label}</Text></Pressable>; }
function PrimaryButton({ label, onPress, disabled, colors }: { label: string; onPress: () => void; disabled: boolean; colors: ReturnType<typeof useColors> }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, (disabled || pressed) && styles.disabled]}><Text style={styles.primaryText}>{label}</Text></Pressable>; }
function MiniStat({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) { return <View style={styles.miniStat}><Text style={[styles.miniValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.miniLabel, { color: colors.muted }]}>{label}</Text></View>; }
function SectionHeading({ title, copy, colors }: { title: string; copy: string; colors: ReturnType<typeof useColors> }) { return <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.sectionCopy, { color: colors.muted }]}>{copy}</Text></View>; }
function GovernanceState({ title, copy, colors, onBack }: { title: string; copy: string; colors: ReturnType<typeof useColors>; onBack?: () => void }) { return <ScreenContainer className="px-5" containerClassName="bg-background"><View style={[styles.state, { backgroundColor: colors.surface, borderColor: colors.border }]}>{title.includes("تحميل") ? <ActivityIndicator color={colors.primary} /> : null}<Text style={[styles.title, { color: colors.foreground }]}>{title}</Text><Text style={[styles.summaryCopy, { color: colors.muted }]}>{copy}</Text>{onBack ? <PrimaryButton label="رجوع" onPress={onBack} disabled={false} colors={colors} /> : null}</View></ScreenContainer>; }

const styles = StyleSheet.create({
  scroll: { paddingBottom: 112, paddingTop: 16 }, header: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" }, headerTitle: { flex: 1, marginLeft: 12 }, eyebrow: { fontSize: 12, fontWeight: "800", textAlign: "right" }, title: { fontSize: 26, fontWeight: "900", marginTop: 3, textAlign: "right" }, back: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 }, backText: { fontSize: 13, fontWeight: "900" }, summaryCard: { borderRadius: 20, borderWidth: 1, marginTop: 18, padding: 16 }, summaryTitle: { fontSize: 17, fontWeight: "900", textAlign: "right" }, summaryCopy: { fontSize: 13, lineHeight: 20, marginTop: 7, textAlign: "right" }, miniStats: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 15, paddingTop: 12 }, miniStat: { alignItems: "center", flex: 1 }, miniValue: { fontSize: 16, fontWeight: "900" }, miniLabel: { fontSize: 10, marginTop: 3 }, segment: { borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", flexWrap: "wrap", gap: 4, marginTop: 13, padding: 4 }, segmentItem: { alignItems: "center", borderRadius: 11, flexGrow: 1, minWidth: "22%", paddingVertical: 9 }, segmentText: { fontSize: 12, fontWeight: "900" }, notice: { borderRadius: 14, borderWidth: 1, marginTop: 14, padding: 12 }, noticeText: { fontSize: 12, lineHeight: 18, textAlign: "right" }, error: { borderRadius: 14, borderWidth: 1, marginTop: 14, padding: 12 }, errorText: { color: "#FFD7DD", fontSize: 12, lineHeight: 18, textAlign: "right" }, section: { marginTop: 20 }, sectionHeading: { marginBottom: 12 }, sectionTitle: { fontSize: 18, fontWeight: "900", textAlign: "right" }, sectionCopy: { fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" }, field: { marginBottom: 12 }, fieldLabel: { fontSize: 13, fontWeight: "900", marginBottom: 7, textAlign: "right" }, input: { borderRadius: 14, borderWidth: 1, fontSize: 14, minHeight: 48, paddingHorizontal: 13, paddingVertical: 12 }, multiline: { minHeight: 86, textAlignVertical: "top" }, primaryButton: { alignItems: "center", borderRadius: 14, justifyContent: "center", marginTop: 11, minHeight: 48, paddingHorizontal: 16 }, primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" }, disabled: { opacity: 0.55 }, itemCard: { borderRadius: 16, borderWidth: 1, marginTop: 10, padding: 13 }, itemTitle: { fontSize: 14, fontWeight: "900", textAlign: "right" }, itemCopy: { fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: "right" }, meta: { fontSize: 11, fontWeight: "800", marginTop: 8, textAlign: "right" }, picker: { marginTop: 16 }, taskChoice: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 7, minHeight: 42, paddingHorizontal: 11 }, taskChoiceText: { fontSize: 12, fontWeight: "800", flex: 1, textAlign: "right" }, critical: { fontSize: 10, fontWeight: "900", marginRight: 8 }, roleGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }, roleChoice: { alignItems: "center", borderRadius: 11, borderWidth: 1, flexGrow: 1, minWidth: "30%", paddingHorizontal: 8, paddingVertical: 10 }, roleChoiceText: { fontSize: 12, fontWeight: "900" }, modelOutput: { borderTopWidth: StyleSheet.hairlineWidth, fontFamily: "monospace", fontSize: 11, lineHeight: 17, marginTop: 10, paddingTop: 10, textAlign: "left" }, lineItem: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 11 }, lineCopy: { flex: 1, marginLeft: 10 }, smallButton: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 }, smallButtonText: { fontSize: 11, fontWeight: "900" }, dependency: { fontSize: 12, lineHeight: 19, marginTop: 8, textAlign: "right" }, contextNotice: { borderRadius: 13, borderWidth: 1, marginTop: 10, padding: 11 }, timelineItem: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 11 }, twoButtons: { flexDirection: "row-reverse", gap: 8 }, halfButton: { flex: 1 }, state: { alignItems: "center", borderRadius: 20, borderWidth: 1, gap: 10, marginTop: 90, padding: 24 }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
