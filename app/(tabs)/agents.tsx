import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/hub/status-pill";
import { useAgentHub, statusTone, type Agent } from "@/lib/agent-hub";
import { trpc } from "@/lib/trpc";

type PromptTemplateKey = "planner" | "coder" | "qa" | "debugger";
type PromptTemplateLocale = "ar" | "en";
type TemplateOption = {
  key: PromptTemplateKey;
  title: string;
  arabicTitle: string;
  description: string;
  documentPaths: Record<PromptTemplateLocale, string>;
};
type PromptAssignment = { agentKey: string; templateKey: PromptTemplateKey; templateLocale: PromptTemplateLocale; customInstructions: string };

const fallbackTemplates: TemplateOption[] = [
  { key: "planner", title: "Planner", arabicTitle: "المخطط", description: "خطة، تبعيات، ومعايير قرار واضحة.", documentPaths: { ar: "docs/prompts/planner-system-prompt-ar.md", en: "docs/prompts/planner-system-prompt-en.md" } },
  { key: "coder", title: "Coder", arabicTitle: "المبرمج", description: "مسودات مقيدة ومراجعة فروقات قبل الحفظ.", documentPaths: { ar: "docs/prompts/coder-system-prompt-ar.md", en: "docs/prompts/coder-system-prompt-en.md" } },
  { key: "qa", title: "QA", arabicTitle: "مختبر الجودة", description: "تحقق منطقي وملاحظات قابلة للتتبع.", documentPaths: { ar: "docs/prompts/qa-system-prompt-ar.md", en: "docs/prompts/qa-system-prompt-en.md" } },
  { key: "debugger", title: "Debugger", arabicTitle: "محلل الأعطال", description: "فرضيات وأدلة وخطة عزل آمنة للأعطال والتعارضات.", documentPaths: { ar: "docs/prompts/debugger-system-prompt-ar.md", en: "docs/prompts/debugger-system-prompt-en.md" } },
];

function defaultTemplateForAgent(agentKey: string): PromptTemplateKey {
  if (agentKey === "planner" || agentKey === "requirements" || agentKey === "architect") return "planner";
  if (agentKey === "qa" || agentKey === "reviewer") return "qa";
  if (agentKey === "debug" || agentKey === "debugger" || agentKey === "incident") return "debugger";
  return "coder";
}

function templateLabel(template: PromptTemplateKey) {
  return template === "planner" ? "Planner" : template === "qa" ? "QA" : template === "debugger" ? "Debugger" : "Coder";
}

export default function AgentsScreen() {
  const { agents } = useAgentHub();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const utils = trpc.useUtils();
  const libraryQuery = trpc.agentPrompts.library.useQuery();
  const assignmentsQuery = trpc.agentPrompts.list.useQuery();
  const saveMutation = trpc.agentPrompts.save.useMutation({ onSuccess: () => utils.agentPrompts.list.invalidate() });
  const templates = (libraryQuery.data ?? fallbackTemplates) as TemplateOption[];
  const assignmentByAgent = useMemo(() => {
    const assignments = (assignmentsQuery.data ?? []) as PromptAssignment[];
    return new Map(assignments.map((item) => [item.agentKey, item]));
  }, [assignmentsQuery.data]);

  if (selectedAgent) {
    return <AgentDetail
      agent={selectedAgent}
      assignment={assignmentByAgent.get(selectedAgent.id)}
      templates={templates}
      loading={assignmentsQuery.isLoading || libraryQuery.isLoading}
      saving={saveMutation.isPending}
      saveError={saveMutation.error?.message}
      onSave={(input) => saveMutation.mutate(input)}
      onClose={() => setSelectedAgent(null)}
    />;
  }

  return <ScreenContainer className="px-5" containerClassName="bg-[#F7F7FC]"><FlatList data={agents} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<View><Text style={styles.eyebrow}>عقود واضحة</Text><Text style={styles.heading}>الوكلاء</Text><Text style={styles.subheading}>لكل وكيل نطاق مسؤولية وحدود ومخرج وقالب System Prompt قابل للتعيين.</Text><View style={styles.legend}><Legend color="#18A56B" label="نشط" /><Legend color="#D88915" label="مراجعة" /><Legend color="#98A0B3" label="بانتظار المهمة" /></View></View>} renderItem={({ item }) => <AgentCard agent={item} template={assignmentByAgent.get(item.id)?.templateKey ?? defaultTemplateForAgent(item.id)} locale={assignmentByAgent.get(item.id)?.templateLocale ?? "ar"} onPress={() => setSelectedAgent(item)} />} ItemSeparatorComponent={() => <View style={styles.separator} />} /></ScreenContainer>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

function AgentCard({ agent, template, locale, onPress }: { agent: Agent; template: PromptTemplateKey; locale: PromptTemplateLocale; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={[styles.avatar, { backgroundColor: agent.color }]}><Text style={styles.avatarText}>{agent.name.slice(0, 1)}</Text></View><View style={styles.cardBody}><View style={styles.cardTop}><Text style={styles.agentName}>{agent.name}</Text><StatusPill label={agent.status} tone={statusTone(agent.status)} /></View><Text style={styles.role}>{agent.role}</Text><Text numberOfLines={2} style={styles.description}>{agent.responsibility}</Text><View style={styles.templateBadge}><Text style={styles.templateBadgeText}>قالب: {templateLabel(template)} · {locale === "ar" ? "عربي" : "EN"}</Text></View><Text style={styles.open}>إدارة القالب والعقد ←</Text></View></Pressable>;
}

function AgentDetail({ agent, assignment, templates, loading, saving, saveError, onSave, onClose }: {
  agent: Agent;
  assignment?: PromptAssignment;
  templates: TemplateOption[];
  loading: boolean;
  saving: boolean;
  saveError?: string;
  onSave: (input: { agentKey: string; templateKey: PromptTemplateKey; templateLocale: PromptTemplateLocale; customInstructions: string }) => void;
  onClose: () => void;
}) {
  const initialTemplate = assignment?.templateKey ?? defaultTemplateForAgent(agent.id);
  const initialLocale = assignment?.templateLocale ?? "ar";
  const [templateKey, setTemplateKey] = useState<PromptTemplateKey>(initialTemplate);
  const [templateLocale, setTemplateLocale] = useState<PromptTemplateLocale>(initialLocale);
  const [customInstructions, setCustomInstructions] = useState(assignment?.customInstructions ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewQuery = trpc.agentPrompts.preview.useQuery({ templateKey, templateLocale, customInstructions }, { enabled: previewOpen });

  useEffect(() => {
    setTemplateKey(assignment?.templateKey ?? defaultTemplateForAgent(agent.id));
    setTemplateLocale(assignment?.templateLocale ?? "ar");
    setCustomInstructions(assignment?.customInstructions ?? "");
  }, [agent.id, assignment?.templateKey, assignment?.templateLocale, assignment?.customInstructions]);

  const rows = [["المدخلات", agent.input], ["المسؤولية", agent.responsibility], ["القيود", agent.constraints], ["المخرجات", agent.output], ["التسليم", agent.handoff]];
  const selectedTemplate = templates.find((item) => item.key === templateKey);
  const hasChanges = templateKey !== initialTemplate || templateLocale !== initialLocale || customInstructions !== (assignment?.customInstructions ?? "");

  return <ScreenContainer className="px-5" containerClassName="bg-[#F7F7FC]"><><FlatList data={rows} keyExtractor={([label]) => label} contentContainerStyle={styles.detailList} ListHeaderComponent={<View><Pressable onPress={onClose} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Text style={styles.backText}>← العودة إلى الوكلاء</Text></Pressable><View style={[styles.detailAvatar, { backgroundColor: agent.color }]}><Text style={styles.detailAvatarText}>{agent.name.slice(0, 1)}</Text></View><Text style={styles.detailName}>{agent.name}</Text><Text style={styles.detailRole}>{agent.role}</Text><StatusPill label={agent.status} tone={statusTone(agent.status)} /><View style={styles.contractBanner}><Text style={styles.contractTitle}>Agent Contract</Text><Text style={styles.contractCopy}>هذا العقد يحدّد نطاق العمل ويمنع تجاوز مسؤوليات الوكيل.</Text></View><PromptAssignmentEditor templates={templates} selectedTemplate={selectedTemplate} templateKey={templateKey} templateLocale={templateLocale} customInstructions={customInstructions} loading={loading} saving={saving} saveError={saveError} hasChanges={hasChanges} onTemplateChange={setTemplateKey} onLocaleChange={setTemplateLocale} onInstructionsChange={setCustomInstructions} onPreview={() => setPreviewOpen(true)} onSave={() => onSave({ agentKey: agent.id, templateKey, templateLocale, customInstructions })} /></View>} renderItem={({ item: [label, value] }) => <View style={styles.contractRow}><Text style={styles.contractLabel}>{label}</Text><Text style={styles.contractValue}>{value}</Text></View>} ItemSeparatorComponent={() => <View style={styles.separator} />} /><PromptPreviewModal visible={previewOpen} loading={previewQuery.isLoading || previewQuery.isFetching} finalPrompt={previewQuery.data?.finalPrompt ?? ""} error={previewQuery.error?.message} onClose={() => setPreviewOpen(false)} /></></ScreenContainer>;
}

function PromptAssignmentEditor({ templates, selectedTemplate, templateKey, templateLocale, customInstructions, loading, saving, saveError, hasChanges, onTemplateChange, onLocaleChange, onInstructionsChange, onPreview, onSave }: {
  templates: TemplateOption[];
  selectedTemplate?: TemplateOption;
  templateKey: PromptTemplateKey;
  templateLocale: PromptTemplateLocale;
  customInstructions: string;
  loading: boolean;
  saving: boolean;
  saveError?: string;
  hasChanges: boolean;
  onTemplateChange: (value: PromptTemplateKey) => void;
  onLocaleChange: (value: PromptTemplateLocale) => void;
  onInstructionsChange: (value: string) => void;
  onPreview: () => void;
  onSave: () => void;
}) {
  return <View style={styles.promptPanel}><View style={styles.promptHeader}><View><Text style={styles.promptTitle}>System Prompt</Text><Text style={styles.promptCopy}>اختر الدور واللغة ثم راجع النص النهائي قبل الحفظ.</Text></View><View style={styles.promptStatus}><Text style={styles.promptStatusText}>{loading ? "جارٍ التحميل" : "مقيد بالسياسة"}</Text></View></View><View style={styles.templateChoices}>{templates.map((template) => <Pressable key={template.key} onPress={() => onTemplateChange(template.key)} style={({ pressed }) => [styles.templateChoice, templateKey === template.key && styles.templateChoiceActive, pressed && styles.pressed]}><Text style={[styles.templateChoiceTitle, templateKey === template.key && styles.templateChoiceTitleActive]}>{template.title}</Text><Text style={[styles.templateChoiceCopy, templateKey === template.key && styles.templateChoiceCopyActive]}>{template.arabicTitle}</Text></Pressable>)}</View><View style={styles.localeRow}><Text style={styles.localeLabel}>لغة القالب</Text><View style={styles.localeChoices}><Pressable onPress={() => onLocaleChange("ar")} style={({ pressed }) => [styles.localeChoice, templateLocale === "ar" && styles.localeChoiceActive, pressed && styles.pressed]}><Text style={[styles.localeText, templateLocale === "ar" && styles.localeTextActive]}>العربية</Text></Pressable><Pressable onPress={() => onLocaleChange("en")} style={({ pressed }) => [styles.localeChoice, templateLocale === "en" && styles.localeChoiceActive, pressed && styles.pressed]}><Text style={[styles.localeText, templateLocale === "en" && styles.localeTextActive]}>English</Text></Pressable></View></View><View style={styles.templateSummary}><Text style={styles.templateSummaryTitle}>{selectedTemplate?.arabicTitle ?? "قالب الدور"}</Text><Text style={styles.templateSummaryCopy}>{selectedTemplate?.description ?? "اختر قالباً لتظهر تفاصيله."}</Text><Text style={styles.templatePath}>{selectedTemplate?.documentPaths[templateLocale]}</Text></View><Text style={styles.instructionsLabel}>تعليمات مخصصة إضافية</Text><TextInput value={customInstructions} onChangeText={onInstructionsChange} multiline maxLength={4000} placeholder="مثال: أعط أولوية لاختبارات وحدات واجهة API قبل إغلاق المهمة." placeholderTextColor="#9AA0B3" textAlign="right" textAlignVertical="top" style={styles.instructionsInput} /><Text style={styles.instructionsHint}>تُلحق هذه التعليمات بالقالب الأساسي؛ لا تزيل حدود Workspace أو الموافقات أو Sandbox.</Text><Pressable disabled={loading} onPress={onPreview} style={({ pressed }) => [styles.previewButton, loading && styles.previewButtonDisabled, pressed && !loading && styles.pressed]}><Text style={styles.previewButtonText}>معاينة النص النهائي</Text></Pressable>{saveError ? <Text style={styles.errorText}>تعذر الحفظ: {saveError}</Text> : null}<Pressable disabled={!hasChanges || saving || loading} onPress={onSave} style={({ pressed }) => [styles.savePromptButton, (!hasChanges || saving || loading) && styles.savePromptButtonDisabled, pressed && hasChanges && styles.pressed]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.savePromptButtonText}>{hasChanges ? "حفظ تعيين القالب" : "التخصيص محفوظ"}</Text>}</Pressable></View>;
}

function PromptPreviewModal({ visible, loading, finalPrompt, error, onClose }: { visible: boolean; loading: boolean; finalPrompt: string; error?: string; onClose: () => void }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.previewSheet}><View style={styles.previewSheetHeader}><Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><Text style={styles.closeButtonText}>إغلاق</Text></Pressable><View><Text style={styles.previewTitle}>معاينة النص النهائي</Text><Text style={styles.previewSubtitle}>القالب الأساسي مع تعليماتك المخصصة</Text></View></View>{loading ? <View style={styles.previewLoading}><ActivityIndicator color="#5146D9" /><Text style={styles.previewLoadingText}>جارٍ تركيب المعاينة...</Text></View> : error ? <Text style={styles.previewError}>تعذر تحميل المعاينة: {error}</Text> : <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewScrollContent}><Text selectable style={styles.previewText}>{finalPrompt}</Text></ScrollView>}<Text style={styles.previewNotice}>هذه معاينة للرسالة المرسلة إلى الوكيل؛ الحفظ وحده لا يمنح صلاحيات تنفيذ إضافية.</Text></View></View></Modal>;
}

const styles = StyleSheet.create({
  list: { paddingTop: 18, paddingBottom: 104 }, eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", textAlign: "right" }, heading: { color: "#171725", fontSize: 32, fontWeight: "900", marginTop: 3, textAlign: "right" }, subheading: { color: "#6F7487", fontSize: 15, lineHeight: 22, marginBottom: 17, marginTop: 8, textAlign: "right" }, legend: { backgroundColor: "#FFFFFF", borderColor: "#EAECF2", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-around", marginBottom: 18, paddingVertical: 11 }, legendItem: { alignItems: "center", flexDirection: "row-reverse" }, dot: { borderRadius: 50, height: 8, marginLeft: 6, width: 8 }, legendText: { color: "#697084", fontSize: 11 }, card: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#EAECF2", borderRadius: 20, borderWidth: 1, flexDirection: "row-reverse", padding: 14 }, avatar: { alignItems: "center", borderRadius: 16, height: 44, justifyContent: "center", marginLeft: 12, width: 44 }, avatarText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" }, cardBody: { flex: 1 }, cardTop: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" }, agentName: { color: "#202233", flex: 1, fontSize: 15, fontWeight: "800", textAlign: "right" }, role: { color: "#4F46E5", fontSize: 12, fontWeight: "700", marginTop: 4, textAlign: "right" }, description: { color: "#73798D", fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: "right" }, templateBadge: { alignSelf: "flex-end", backgroundColor: "#F0EFFF", borderRadius: 8, marginTop: 9, paddingHorizontal: 8, paddingVertical: 4 }, templateBadgeText: { color: "#5A51C7", fontSize: 11, fontWeight: "800" }, open: { color: "#4F46E5", fontSize: 12, fontWeight: "800", marginTop: 10, textAlign: "right" }, separator: { height: 10 }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] }, detailList: { paddingBottom: 104, paddingTop: 18 }, back: { alignSelf: "flex-end", marginBottom: 20, paddingVertical: 6 }, backText: { color: "#4F46E5", fontSize: 14, fontWeight: "800" }, detailAvatar: { alignItems: "center", borderRadius: 22, height: 68, justifyContent: "center", marginLeft: "auto", marginRight: "auto", width: 68 }, detailAvatarText: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" }, detailName: { color: "#1A1C2A", fontSize: 24, fontWeight: "900", marginTop: 14, textAlign: "center" }, detailRole: { color: "#6D7285", fontSize: 14, marginBottom: 10, marginTop: 5, textAlign: "center" }, contractBanner: { backgroundColor: "#EEEDFF", borderRadius: 17, marginBottom: 18, marginTop: 18, padding: 15 }, contractTitle: { color: "#4F46E5", fontSize: 14, fontWeight: "900", textAlign: "right" }, contractCopy: { color: "#555174", fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: "right" }, contractRow: { backgroundColor: "#FFFFFF", borderColor: "#EAECF2", borderRadius: 18, borderWidth: 1, padding: 15 }, contractLabel: { color: "#4F46E5", fontSize: 12, fontWeight: "900", textAlign: "right" }, contractValue: { color: "#3E4254", fontSize: 14, lineHeight: 21, marginTop: 7, textAlign: "right" }, promptPanel: { backgroundColor: "#FFFFFF", borderColor: "#E1E0FA", borderRadius: 19, borderWidth: 1, marginBottom: 18, padding: 15 }, promptHeader: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" }, promptTitle: { color: "#24233E", fontSize: 16, fontWeight: "900", textAlign: "right" }, promptCopy: { color: "#686C80", fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" }, promptStatus: { backgroundColor: "#EAF8F0", borderRadius: 8, marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4 }, promptStatusText: { color: "#178457", fontSize: 10, fontWeight: "800" }, templateChoices: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginTop: 15 }, templateChoice: { borderColor: "#E3E5EC", borderRadius: 12, borderWidth: 1, flexGrow: 1, flexBasis: "44%", paddingHorizontal: 6, paddingVertical: 10 }, templateChoiceActive: { backgroundColor: "#5146D9", borderColor: "#5146D9" }, templateChoiceTitle: { color: "#34364C", fontSize: 12, fontWeight: "900", textAlign: "center" }, templateChoiceTitleActive: { color: "#FFFFFF" }, templateChoiceCopy: { color: "#7B8092", fontSize: 10, marginTop: 3, textAlign: "center" }, templateChoiceCopyActive: { color: "#E8E6FF" }, localeRow: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 14 }, localeLabel: { color: "#3E4254", fontSize: 12, fontWeight: "900" }, localeChoices: { flexDirection: "row-reverse", gap: 6 }, localeChoice: { borderColor: "#E1E3EB", borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 }, localeChoiceActive: { backgroundColor: "#EEEDFF", borderColor: "#5146D9" }, localeText: { color: "#696D7F", fontSize: 11, fontWeight: "800" }, localeTextActive: { color: "#4F46E5" }, templateSummary: { backgroundColor: "#F8F8FD", borderRadius: 12, marginTop: 12, padding: 11 }, templateSummaryTitle: { color: "#4F46E5", fontSize: 12, fontWeight: "900", textAlign: "right" }, templateSummaryCopy: { color: "#585D70", fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" }, templatePath: { color: "#8A8FA1", fontSize: 10, marginTop: 7, textAlign: "left" }, instructionsLabel: { color: "#3E4254", fontSize: 12, fontWeight: "900", marginTop: 15, textAlign: "right" }, instructionsInput: { backgroundColor: "#FBFBFE", borderColor: "#E1E3EB", borderRadius: 12, borderWidth: 1, color: "#25273A", fontSize: 13, lineHeight: 20, marginTop: 7, minHeight: 104, padding: 11 }, instructionsHint: { color: "#777C91", fontSize: 11, lineHeight: 17, marginTop: 7, textAlign: "right" }, previewButton: { alignItems: "center", backgroundColor: "#EEEDFF", borderColor: "#5146D9", borderRadius: 12, borderWidth: 1, justifyContent: "center", marginTop: 14, minHeight: 43, paddingHorizontal: 14 }, previewButtonDisabled: { borderColor: "#C9C7E8", opacity: 0.65 }, previewButtonText: { color: "#4F46E5", fontSize: 13, fontWeight: "900" }, errorText: { color: "#C33A4D", fontSize: 11, lineHeight: 17, marginTop: 8, textAlign: "right" }, savePromptButton: { alignItems: "center", backgroundColor: "#5146D9", borderRadius: 12, justifyContent: "center", marginTop: 10, minHeight: 45, paddingHorizontal: 14 }, savePromptButtonDisabled: { backgroundColor: "#B9B6D7" }, savePromptButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, modalOverlay: { backgroundColor: "rgba(20, 21, 33, 0.52)", flex: 1, justifyContent: "flex-end" }, previewSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: "84%", minHeight: "54%", paddingBottom: 28, paddingHorizontal: 18, paddingTop: 16 }, previewSheetHeader: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" }, previewTitle: { color: "#22233A", fontSize: 17, fontWeight: "900", textAlign: "right" }, previewSubtitle: { color: "#777C90", fontSize: 11, marginTop: 4, textAlign: "right" }, closeButton: { backgroundColor: "#F0F0FA", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 }, closeButtonText: { color: "#4F46E5", fontSize: 12, fontWeight: "900" }, previewLoading: { alignItems: "center", justifyContent: "center", minHeight: 220 }, previewLoadingText: { color: "#686C80", fontSize: 13, marginTop: 10 }, previewError: { color: "#C33A4D", fontSize: 13, lineHeight: 20, marginTop: 24, textAlign: "right" }, previewScroll: { backgroundColor: "#141821", borderRadius: 14, marginTop: 16 }, previewScrollContent: { padding: 14 }, previewText: { color: "#E9EBF4", fontFamily: "monospace", fontSize: 12, lineHeight: 19, textAlign: "left" }, previewNotice: { color: "#747A8F", fontSize: 11, lineHeight: 17, marginTop: 11, textAlign: "right" },
});
