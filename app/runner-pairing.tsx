import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useConnectivity } from "@/lib/connectivity";
import { trpc } from "@/lib/trpc";

const serverUrl = "https://agenthub-gkta8g2i.manus.space";

type Pairing = { runner: { id: number; runnerKey: string; label: string; status: string }; token: string };

function configFor(pairing: Pairing) {
  return [
    `AGENTHUB_SERVER=${serverUrl}`,
    `AGENTHUB_RUNNER_KEY=${pairing.runner.runnerKey}`,
    `AGENTHUB_RUNNER_TOKEN=${pairing.token}`,
    "AGENTHUB_RUN_ONCE=false",
  ].join("\n");
}

export default function RunnerPairingScreen() {
  const router = useRouter();
  const colors = useColors();
  const { canPerformSensitiveActions } = useConnectivity();
  const utils = trpc.useUtils();
  const [label, setLabel] = useState("جهاز Docker الشخصي");
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [notice, setNotice] = useState("");
  const runnersQuery = trpc.localRunners.list.useQuery(undefined, { refetchInterval: 12_000 });
  const createPairing = trpc.localRunners.createPairing.useMutation({
    onSuccess: async (result) => {
      setPairing(result as Pairing);
      setNotice("تم إنشاء بيانات الإقران. انسخها الآن إلى جهاز Docker، ولا تشارك الرمز أو تحفظه في Git.");
      await utils.localRunners.list.invalidate();
    },
  });

  const copyPairing = async () => {
    if (!pairing) return;
    try {
      await Clipboard.setStringAsync(configFor(pairing));
      setNotice("نُسخت التهيئة. الصقها مباشرة في runner/device/.env.runner على جهازك ثم امسح الحافظة عند الانتهاء.");
    } catch {
      setNotice("تعذر النسخ إلى الحافظة. انسخ القيم يدوياً من البطاقة، ثم امسحها من الجهاز بعد الاستخدام.");
    }
  };

  const active = runnersQuery.data?.filter((runner) => runner.status !== "revoked") ?? [];
  const blocked = !canPerformSensitiveActions || createPairing.isPending || label.trim().length < 2;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="رجوع إلى التحكم" onPress={() => router.back()} style={({ pressed }) => [styles.back, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.backText, { color: colors.primary }]}>رجوع</Text></Pressable>
          <View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: colors.primary }]}>Runtime · Runner</Text><Text style={[styles.title, { color: colors.foreground }]}>إقران جهاز Docker</Text></View>
        </View>

        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>أكمل من الهاتف الآن</Text>
          <Text style={[styles.heroCopy, { color: colors.muted }]}>أنشئ بيانات إقران لمرة واحدة، ثم انسخ ملف الإعداد إلى جهاز Docker عندما يتوفر لديك. لا ينفذ هذا الإجراء أي شيفرة ولا يمنح التطبيق وصولاً إلى ملفات جهازك.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>1. أنشئ بيانات الإقران</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>استخدم اسماً يعرّف الجهاز لاحقاً في سجل Runtime.</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>اسم جهاز Docker</Text>
          <TextInput value={label} onChangeText={setLabel} editable={!createPairing.isPending} placeholder="مثال: MacBook Docker" placeholderTextColor={colors.muted} textAlign="right" style={[styles.input, { color: colors.foreground, backgroundColor: colors.subtle, borderColor: colors.border }]} />
          <Pressable accessibilityRole="button" disabled={blocked} onPress={() => createPairing.mutate({ label: label.trim() })} style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary }, (pressed || blocked) && styles.disabled]}><Text style={styles.primaryText}>{createPairing.isPending ? "جارٍ إنشاء الإقران…" : canPerformSensitiveActions ? "إنشاء إقران آمن" : "يتطلب اتصالاً"}</Text></Pressable>
          {createPairing.error ? <Text style={[styles.error, { color: colors.error }]}>تعذر إنشاء الإقران. تحقق من الجلسة والاتصال ثم أعد المحاولة.</Text> : null}
        </View>

        {pairing ? <View style={[styles.pairingCard, { backgroundColor: colors.subtle, borderColor: colors.warning }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>2. انسخ إلى جهاز Docker</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>هذه القيم تظهر في هذه الجلسة فقط. الصقها في الملف المحلي `runner/device/.env.runner` ثم امسح الحافظة.</Text>
          <Text selectable style={[styles.secretBlock, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}>{configFor(pairing)}</Text>
          <Pressable accessibilityRole="button" onPress={copyPairing} style={({ pressed }) => [styles.copyButton, { borderColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.copyButtonText, { color: colors.primary }]}>نسخ التهيئة الآمنة</Text></Pressable>
          <Text style={[styles.command, { color: colors.muted }]}>على جهاز Docker: `chmod 600 runner/device/.env.runner` ثم `./runner/device/run-local-runner.sh --check-config`</Text>
        </View> : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>3. ما ينتظر جهازك لاحقاً</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>ابنِ صورة TypeScript المقيدة، شغّل Smoke Test، ثم تحقق من heartbeat. التنفيذ الفعلي يتطلب طلباً معتمداً منفصلاً ولا يبدأ تلقائياً.</Text>
          <Text style={[styles.command, { color: colors.muted }]}>./runner/device/build-typescript-image.sh{"\n"}./runner/device/smoke-test-typescript.sh{"\n"}./runner/device/verify-compose-runner.sh heartbeat</Text>
        </View>

        {active.length ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>أجهزة مسجلة</Text>{active.map((runner) => <Text key={runner.id} style={[styles.runnerRow, { color: colors.muted }]}>{runner.label} · {runner.status}</Text>)}</View> : null}
        {notice ? <Text accessibilityLiveRegion="polite" style={[styles.notice, { color: colors.foreground, backgroundColor: colors.subtle, borderColor: colors.border }]}>{notice}</Text> : null}
        {runnersQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 14, paddingBottom: 44, paddingTop: 14 }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, headerCopy: { alignItems: "flex-end", flex: 1, marginLeft: 12 }, eyebrow: { fontSize: 11, fontWeight: "900" }, title: { fontSize: 24, fontWeight: "900", marginTop: 3, textAlign: "right" }, back: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 }, backText: { fontSize: 13, fontWeight: "900" }, hero: { borderRadius: 20, borderWidth: 1, gap: 6, padding: 16 }, heroTitle: { fontSize: 18, fontWeight: "900", textAlign: "right" }, heroCopy: { fontSize: 13, lineHeight: 20, textAlign: "right" }, card: { borderRadius: 18, borderWidth: 1, gap: 9, padding: 15 }, pairingCard: { borderRadius: 18, borderWidth: 1, gap: 10, padding: 15 }, sectionTitle: { fontSize: 15, fontWeight: "900", textAlign: "right" }, copy: { fontSize: 12, lineHeight: 19, textAlign: "right" }, label: { fontSize: 12, fontWeight: "800", textAlign: "right" }, input: { borderRadius: 12, borderWidth: 1, fontSize: 14, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 }, primary: { alignItems: "center", borderRadius: 12, justifyContent: "center", minHeight: 47, paddingHorizontal: 12 }, primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, secretBlock: { borderRadius: 12, borderWidth: 1, fontFamily: "monospace", fontSize: 11, lineHeight: 18, padding: 11, textAlign: "left" }, copyButton: { alignItems: "center", borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 43, paddingHorizontal: 12 }, copyButtonText: { fontSize: 13, fontWeight: "900" }, command: { fontFamily: "monospace", fontSize: 11, lineHeight: 19, textAlign: "left" }, notice: { borderRadius: 13, borderWidth: 1, fontSize: 12, lineHeight: 19, padding: 12, textAlign: "right" }, runnerRow: { borderTopWidth: StyleSheet.hairlineWidth, fontSize: 12, paddingVertical: 9, textAlign: "right" }, error: { fontSize: 12, lineHeight: 18, textAlign: "right" }, disabled: { opacity: 0.52 }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
