import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { MAX_PROJECT_ARCHIVE_BYTES } from "@/lib/project-intake-policy";
import { previewRepositoryUrl } from "@/lib/repository-url-preview";

const targets = ["web", "android", "ios", "node", "docker", "custom"] as const;
const targetLabels: Record<(typeof targets)[number], string> = { web: "ويب", android: "Android", ios: "iOS", node: "Node.js", docker: "Docker", custom: "مخصص" };

export default function ProjectIntakeScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string; projectName?: string }>();
  const projectId = Number(params.projectId);
  const projectName = params.projectName ?? "المشروع";
  const validProjectId = Number.isInteger(projectId) && projectId > 0;
  const utils = trpc.useUtils();
  const overview = trpc.projectIntake.overview.useQuery({ projectId }, { enabled: validProjectId });
  const [remoteUrl, setRemoteUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [title, setTitle] = useState("بناء تجريبي محكوم");
  const [summary, setSummary] = useState("تخطيط بناء بعد مراجعة مصدر المشروع واعتماد المالك.");
  const [target, setTarget] = useState<(typeof targets)[number]>("android");
  const repositoryPreview = useMemo(() => previewRepositoryUrl(remoteUrl), [remoteUrl]);
  const latestImportId = overview.data?.imports[0]?.id;
  const refresh = () => utils.projectIntake.overview.invalidate({ projectId });
  const archiveMutation = trpc.projectIntake.importZip.useMutation({ onSuccess: refresh });
  const repositoryMutation = trpc.projectIntake.registerRepository.useMutation({ onSuccess: refresh });
  const buildMutation = trpc.projectIntake.requestBuild.useMutation({ onSuccess: refresh });
  const busy = archiveMutation.isPending || repositoryMutation.isPending || buildMutation.isPending;
  const notice = useMemo(() => archiveMutation.error?.message || repositoryMutation.error?.message || buildMutation.error?.message || "", [archiveMutation.error, repositoryMutation.error, buildMutation.error]);

  const chooseZip = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/zip", "application/x-zip-compressed"], copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      const file = new ExpoFile(asset.uri);
      const size = asset.size ?? file.size;
      if (!size || size > MAX_PROJECT_ARCHIVE_BYTES) {
        Alert.alert("حجم غير مدعوم", "يمكن استيراد أرشيف ZIP حتى 8MB فقط في هذا الإصدار.");
        return;
      }
      const base64 = await file.base64();
      archiveMutation.mutate({ projectId, fileName: asset.name, byteSize: size, base64 });
    } catch {
      Alert.alert("تعذر قراءة الأرشيف", "تحقق من أن ملف ZIP متاح للجهاز ثم أعد المحاولة.");
    }
  };

  if (!validProjectId) return <ScreenContainer className="p-5"><Text style={[styles.error, { color: colors.error }]}>معرّف المشروع غير صالح.</Text></ScreenContainer>;
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.backText, { color: colors.primary }]}>العودة إلى المشاريع</Text></Pressable>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>بوابة استيراد محكومة</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>مصدر وبناء المشروع</Text>
        <Text style={[styles.subheading, { color: colors.muted }]}>{projectName} · يحفظ هذا المسار الأرشيف أو مرجع المستودع، ويخطط طلب البناء فقط. لا يفك ZIP ولا يستنسخ Git ولا ينفذ أو يرفع أي شيء.</Text>

        <Section title="استيراد أرشيف ZIP" colors={colors}>
          <Text style={[styles.body, { color: colors.muted }]}>حد الحجم 8MB. يفحص التطبيق الامتداد وترويسة ZIP ثم يحفظ الأرشيف كـArtifact من دون استخراجه.</Text>
          <Pressable disabled={busy} onPress={chooseZip} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, (pressed || busy) && styles.pressed]}><Text style={styles.primaryText}>{archiveMutation.isPending ? "جارٍ حفظ الأرشيف…" : "اختيار ملف ZIP"}</Text></Pressable>
        </Section>

        <Section title="تسجيل مرجع مستودع" colors={colors}>
          <TextInput value={remoteUrl} onChangeText={setRemoteUrl} autoCapitalize="none" placeholder="https://github.com/owner/repository" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} textAlign="left" />
          {repositoryPreview.state === "ready" ? <View style={[styles.repositoryPreview, { backgroundColor: colors.subtle, borderColor: colors.border }]}><View style={styles.previewIdentity}><View style={[styles.providerIcon, { backgroundColor: repositoryPreview.preview.provider === "github" ? "#24292F" : "#FC6D26" }]}><MaterialCommunityIcons name={repositoryPreview.preview.iconName} size={20} color="#FFFFFF" /></View><View><Text style={[styles.previewName, { color: colors.foreground }]}>{repositoryPreview.preview.repositoryName}</Text><Text style={[styles.previewMeta, { color: colors.muted }]}>{repositoryPreview.preview.namespace} · {repositoryPreview.preview.platformLabel}</Text></View></View><Text style={[styles.previewStatus, { color: colors.success }]}>تم التعرف</Text></View> : null}
          {repositoryPreview.state === "invalid" ? <Text style={[styles.previewError, { color: colors.warning }]}>{repositoryPreview.message}</Text> : null}
          <TextInput value={branch} onChangeText={setBranch} autoCapitalize="none" placeholder="main" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} textAlign="left" />
          <Pressable disabled={busy || repositoryPreview.state !== "ready"} onPress={() => repositoryMutation.mutate({ projectId, remoteUrl: repositoryPreview.state === "ready" ? repositoryPreview.preview.normalizedUrl : remoteUrl, defaultBranch: branch || "main" })} style={({ pressed }) => [styles.outlineButton, { borderColor: colors.primary }, (pressed || busy || repositoryPreview.state !== "ready") && styles.pressed]}><Text style={[styles.outlineText, { color: colors.primary }]}>{repositoryMutation.isPending ? "جارٍ التسجيل…" : "تسجيل المرجع فقط"}</Text></Pressable>
        </Section>

        <Section title="طلب بناء للمراجعة" colors={colors}>
          <Text style={[styles.body, { color: colors.muted }]}>ينشئ طلباً وحالة موافقة فقط. يبقى التنفيذ محجوباً إلى أن يثبت Runner المحلي ويُعتمد المسار لاحقاً.</Text>
          <View style={styles.targetRow}>{targets.map((item) => <Pressable key={item} onPress={() => setTarget(item)} style={({ pressed }) => [styles.target, { borderColor: target === item ? colors.primary : colors.border, backgroundColor: target === item ? colors.subtle : "transparent" }, pressed && styles.pressed]}><Text style={[styles.targetText, { color: target === item ? colors.primary : colors.muted }]}>{targetLabels[item]}</Text></Pressable>)}</View>
          <TextInput value={title} onChangeText={setTitle} placeholder="عنوان طلب البناء" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} textAlign="right" />
          <TextInput value={summary} onChangeText={setSummary} multiline placeholder="النطاق ومعيار النجاح" placeholderTextColor={colors.muted} style={[styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} textAlign="right" />
          <Pressable disabled={busy || !latestImportId} onPress={() => buildMutation.mutate({ projectId, importId: latestImportId, target, title, summary })} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, (pressed || busy || !latestImportId) && styles.pressed]}><Text style={styles.primaryText}>{buildMutation.isPending ? "جارٍ إنشاء الطلب…" : latestImportId ? "إنشاء طلب بناء للموافقة" : "أضف مصدراً أولاً"}</Text></Pressable>
        </Section>

        {notice ? <Text style={[styles.error, { color: colors.error }]}>{notice}</Text> : null}
        {overview.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        <Section title="المصادر المحفوظة" colors={colors}>{overview.data?.imports.length ? overview.data.imports.map((item) => <View key={item.id} style={[styles.record, { borderColor: colors.border }]}><Text style={[styles.recordTitle, { color: colors.foreground }]}>{item.displayName}</Text><Text style={[styles.recordText, { color: colors.muted }]}>{item.source === "zip" ? "أرشيف محفوظ" : `مرجع ${item.provider ?? "Git"}`} · {item.status}</Text><Text style={[styles.recordText, { color: colors.muted }]}>{item.summary}</Text></View>) : <Text style={[styles.body, { color: colors.muted }]}>لا يوجد مصدر مشروع محفوظ بعد.</Text>}</Section>
        <Section title="طلبات البناء" colors={colors}>{overview.data?.buildRequests.length ? overview.data.buildRequests.map((item) => <View key={item.id} style={[styles.record, { borderColor: colors.border }]}><Text style={[styles.recordTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.recordText, { color: colors.muted }]}>{item.target} · {item.status}</Text><Text style={[styles.recordText, { color: colors.muted }]}>{item.summary}</Text></View>) : <Text style={[styles.body, { color: colors.muted }]}>لا توجد طلبات بناء. الطلبات هنا تخطيطية فقط.</Text>}</Section>
      </ScrollView>
    </ScreenContainer>
  );
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 100, paddingTop: 18 }, back: { alignSelf: "flex-end", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, backText: { fontSize: 12, fontWeight: "800" }, eyebrow: { fontSize: 13, fontWeight: "900", textAlign: "right" }, heading: { fontSize: 29, fontWeight: "900", textAlign: "right" }, subheading: { fontSize: 14, lineHeight: 22, textAlign: "right" }, section: { borderRadius: 18, borderWidth: 1, gap: 12, padding: 15 }, sectionTitle: { fontSize: 16, fontWeight: "900", textAlign: "right" }, body: { fontSize: 13, lineHeight: 20, textAlign: "right" }, input: { borderRadius: 11, borderWidth: 1, fontSize: 14, minHeight: 46, paddingHorizontal: 12 }, textarea: { borderRadius: 11, borderWidth: 1, fontSize: 14, minHeight: 84, padding: 12, textAlignVertical: "top" }, primaryButton: { alignItems: "center", borderRadius: 12, minHeight: 46, justifyContent: "center", paddingHorizontal: 14 }, primaryText: { color: "#fff", fontSize: 13, fontWeight: "900" }, outlineButton: { alignItems: "center", borderRadius: 12, borderWidth: 1, minHeight: 46, justifyContent: "center", paddingHorizontal: 14 }, outlineText: { fontSize: 13, fontWeight: "900" }, repositoryPreview: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", padding: 11 }, previewIdentity: { alignItems: "center", flexDirection: "row-reverse", gap: 9 }, providerIcon: { alignItems: "center", borderRadius: 10, height: 36, justifyContent: "center", width: 36 }, previewName: { fontSize: 13, fontWeight: "900", textAlign: "right" }, previewMeta: { fontSize: 11, marginTop: 2, textAlign: "right" }, previewStatus: { fontSize: 11, fontWeight: "800" }, previewError: { fontSize: 12, fontWeight: "700", lineHeight: 18, textAlign: "right" }, targetRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }, target: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 }, targetText: { fontSize: 12, fontWeight: "800" }, record: { borderRadius: 12, borderWidth: 1, gap: 4, padding: 11 }, recordTitle: { fontSize: 13, fontWeight: "900", textAlign: "right" }, recordText: { fontSize: 12, lineHeight: 18, textAlign: "right" }, error: { fontSize: 13, fontWeight: "700", lineHeight: 20, textAlign: "right" }, pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
