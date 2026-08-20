import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useConnectivity } from "@/lib/connectivity";

function safeList(value: string, fallback: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.join(" · ") : fallback;
  } catch {
    return fallback;
  }
}

function safeRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, number>;
    const values = Object.entries(parsed).filter(([, count]) => Number.isFinite(count) && count > 0);
    return values.length > 0 ? values.map(([language, count]) => `${language} (${count})`).join(" · ") : "لم تُرصد امتدادات معروفة";
  } catch {
    return "لم تُرصد امتدادات معروفة";
  }
}

export default function RepositoryScanScreen() {
  const router = useRouter();
  const colors = useColors();
  const { canPerformSensitiveActions } = useConnectivity();
  const params = useLocalSearchParams<{ projectId?: string; projectName?: string }>();
  const projectId = Number(params.projectId);
  const scansQuery = trpc.repositoryScans.list.useQuery(Number.isInteger(projectId) && projectId > 0 ? { projectId } : undefined, { refetchInterval: 8_000 });
  const latestScan = scansQuery.data?.[0];
  const command = Number.isInteger(projectId) && projectId > 0 ? `./runner/device/run-local-runner.sh --scan-dir "/مسار/المشروع" --project ${projectId}` : "اختر مشروعاً صالحاً أولاً";
  const [headBranch, setHeadBranch] = useState("agenthub/");
  const [title, setTitle] = useState(`مراجعة ${params.projectName ?? "تغييرات المشروع"}`);
  const [summary, setSummary] = useState("");
  const [notice, setNotice] = useState("");
  const pullRequestMutation = trpc.gitGate.requestPullRequest.useMutation({
    onSuccess: () => setNotice("تم إنشاء طلب موافقة لمراجعة Pull Request فقط. لن يُنفذ push أو merge تلقائياً."),
    onError: (error) => setNotice(error.message || "تعذر إنشاء طلب مراجعة Pull Request."),
  });

  const requestPullRequest = () => {
    if (!Number.isInteger(projectId) || projectId <= 0) return;
    setNotice("");
    pullRequestMutation.mutate({ projectId, headBranch, baseBranch: "main", title, summary });
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="العودة إلى المشاريع"><Text style={[styles.backText, { color: colors.primary }]}>← العودة</Text></Pressable>
          <View><Text style={[styles.eyebrow, { color: colors.primary }]}>ربط محلي مقيد</Text><Text style={[styles.title, { color: colors.foreground }]}>فحص المستودع</Text></View>
        </View>
        <Text style={[styles.projectName, { color: colors.muted }]}>{params.projectName ?? "المشروع"} · المعرّف {Number.isInteger(projectId) ? projectId : "غير صالح"}</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>ما الذي يرسله الفحص؟</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>عدد الملفات والمجلدات، اللغات، ملفات البناء والاختبار، وإشارات أسماء حساسة فقط. لا يقرأ المحتوى ولا يرفع المسارات الكاملة أو ملفات الإعداد.</Text>
          <Text selectable style={[styles.command, { backgroundColor: colors.subtle, color: colors.foreground }]}>{command}</Text>
          <Pressable onPress={() => router.push("/settings")} style={({ pressed }) => [styles.button, { borderColor: colors.border }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="فتح إعدادات Runner المحلي"><Text style={[styles.buttonText, { color: colors.primary }]}>فتح إعدادات Runner</Text></Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>بوابة Pull Request</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>تنشئ هذه البوابة طلب موافقة لمراجعة Pull Request من الفرع المحدد إلى `main`. لا تنفذ دفعاً أو دمجاً أو حذفاً.</Text>
          <TextInput value={headBranch} onChangeText={setHeadBranch} autoCapitalize="none" autoCorrect={false} placeholder="agenthub/feature" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.subtle, borderColor: colors.border, color: colors.foreground }]} textAlign="left" accessibilityLabel="فرع التغييرات" />
          <TextInput value={title} onChangeText={setTitle} placeholder="عنوان Pull Request" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.subtle, borderColor: colors.border, color: colors.foreground }]} textAlign="right" accessibilityLabel="عنوان طلب المراجعة" />
          <TextInput value={summary} onChangeText={setSummary} multiline placeholder="ملخص الاختلافات المقترحة" placeholderTextColor={colors.muted} style={[styles.summaryInput, { backgroundColor: colors.subtle, borderColor: colors.border, color: colors.foreground }]} textAlignVertical="top" textAlign="right" accessibilityLabel="ملخص Pull Request" />
          <Pressable disabled={!canPerformSensitiveActions || pullRequestMutation.isPending || !headBranch.trim() || !title.trim()} onPress={requestPullRequest} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, (pressed || !canPerformSensitiveActions || pullRequestMutation.isPending || !headBranch.trim() || !title.trim()) && styles.disabledButton]} accessibilityRole="button" accessibilityLabel="طلب مراجعة Pull Request"><Text style={styles.primaryButtonText}>{pullRequestMutation.isPending ? "جارٍ إنشاء طلب الموافقة…" : canPerformSensitiveActions ? "طلب مراجعة Pull Request" : "يتطلب اتصالاً"}</Text></Pressable>
          {notice ? <Text style={[styles.notice, { color: notice.startsWith("تم") ? colors.success : colors.error }]}>{notice}</Text> : null}
        </View>

        <Text style={[styles.section, { color: colors.foreground }]}>آخر نتيجة</Text>
        {scansQuery.isLoading ? <Text style={[styles.copy, { color: colors.muted }]}>جارٍ تحميل ملخص الفحص…</Text> : null}
        {latestScan ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}><Text style={[styles.value, { color: colors.foreground }]}>{latestScan.scan.displayName}</Text><Text style={[styles.label, { color: colors.muted }]}>المجلد المسمى</Text></View>
            <View style={styles.divider} />
            <View style={styles.row}><Text style={[styles.value, { color: colors.foreground }]}>{latestScan.scan.fileCount} ملف · {latestScan.scan.directoryCount} مجلد</Text><Text style={[styles.label, { color: colors.muted }]}>الحجم الوصفي</Text></View>
            <View style={styles.divider} />
            <Text style={[styles.label, { color: colors.muted }]}>اللغات</Text><Text style={[styles.detail, { color: colors.foreground }]}>{safeRecord(latestScan.scan.languageSummary)}</Text>
            <Text style={[styles.label, { color: colors.muted }]}>البناء والاختبار</Text><Text style={[styles.detail, { color: colors.foreground }]}>{safeList(latestScan.scan.manifestSummary, "لا توجد ملفات بناء معروفة")} · {safeList(latestScan.scan.testSummary, "لا توجد إشارات اختبار")}</Text>
            <Text style={[styles.label, { color: colors.muted }]}>إشارات حساسة</Text><Text style={[styles.detail, { color: latestScan.scan.sensitiveSummary === "[]" ? colors.success : colors.warning }]}>{safeList(latestScan.scan.sensitiveSummary, "لم تُرصد أسماء حساسة")}</Text>
            <Text style={[styles.timestamp, { color: colors.muted }]}>وردت من {latestScan.runner.label} في {new Date(latestScan.scan.createdAt).toLocaleString("ar-SA")}</Text>
          </View>
        ) : !scansQuery.isLoading ? <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.emptyTitle, { color: colors.foreground }]}>لا توجد نتيجة بعد</Text><Text style={[styles.copy, { color: colors.muted }]}>نفّذ الأمر أعلاه من جهاز Runner المرتبط بعد استبدال مسار المشروع المحلي.</Text></View> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40, paddingTop: 18 },
  header: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" },
  back: { paddingVertical: 7 },
  backText: { fontSize: 13, fontWeight: "900" },
  eyebrow: { fontSize: 12, fontWeight: "900", textAlign: "right" },
  title: { fontSize: 28, fontWeight: "900", marginTop: 3, textAlign: "right" },
  projectName: { fontSize: 13, marginTop: 12, textAlign: "right" },
  card: { borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 15 },
  cardTitle: { fontSize: 15, fontWeight: "900", textAlign: "right" },
  copy: { fontSize: 12, lineHeight: 19, marginTop: 7, textAlign: "right" },
  command: { borderRadius: 11, fontFamily: "monospace", fontSize: 11, lineHeight: 17, marginTop: 13, padding: 11, textAlign: "left" },
  input: { borderRadius: 11, borderWidth: 1, fontSize: 12, marginTop: 10, minHeight: 42, paddingHorizontal: 11 },
  summaryInput: { borderRadius: 11, borderWidth: 1, fontSize: 12, lineHeight: 18, marginTop: 10, minHeight: 74, padding: 11 },
  button: { alignItems: "center", borderRadius: 11, borderWidth: 1, marginTop: 12, paddingVertical: 10 },
  buttonText: { fontSize: 12, fontWeight: "900" },
  primaryButton: { alignItems: "center", borderRadius: 11, marginTop: 12, minHeight: 42, paddingVertical: 10 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  disabledButton: { opacity: 0.64 },
  notice: { fontSize: 11, lineHeight: 17, marginTop: 10, textAlign: "right" },
  section: { fontSize: 16, fontWeight: "900", marginTop: 24, textAlign: "right" },
  row: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  label: { fontSize: 11, fontWeight: "800", marginTop: 13, textAlign: "right" },
  value: { fontSize: 13, fontWeight: "900", textAlign: "right" },
  detail: { fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: "right" },
  divider: { backgroundColor: "#E7E8F0", height: 1, marginTop: 12 },
  timestamp: { fontSize: 10, marginTop: 14, textAlign: "right" },
  empty: { borderRadius: 18, borderWidth: 1, marginTop: 12, padding: 18 },
  emptyTitle: { fontSize: 14, fontWeight: "900", textAlign: "right" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
