import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { apiConnectionCatalog, apiConnectionProviderValues, type ApiConnectionProvider } from "@/lib/api-connection-policy";
import { trpc } from "@/lib/trpc";

type ApiConnection = {
  id: number;
  provider: ApiConnectionProvider;
  authMode: "oauth" | "api_key" | "none";
  status: "awaiting_setup" | "linked";
  lastRequestedAt: Date;
  updatedAt: Date;
};

export default function ApiConnectionsScreen() {
  const colors = useColors();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [notice, setNotice] = useState("");
  const [pendingProvider, setPendingProvider] = useState<ApiConnectionProvider | null>(null);
  const [removeCandidate, setRemoveCandidate] = useState<number | null>(null);
  const connectionsQuery = trpc.apiConnections.list.useQuery(undefined, { enabled: isAuthenticated });
  const requestSetup = trpc.apiConnections.requestSetup.useMutation({
    onSuccess: async (connection) => {
      setPendingProvider(null);
      const provider = apiConnectionCatalog[connection.provider];
      setNotice(connection.status === "linked" ? `${provider.label} أصبح جاهزاً كمصدر قراءة محكوم بلا مفتاح.` : `سُجل طلب ربط ${provider.label}. ${provider.setupCopy}`);
      await utils.apiConnections.list.invalidate();
    },
    onError: (error) => { setPendingProvider(null); setNotice(error.data?.code === "UNAUTHORIZED" ? "سجّل الدخول أولاً لإدارة الاتصالات." : error.message || "تعذر حفظ طلب الربط."); },
  });
  const removeConnection = trpc.apiConnections.remove.useMutation({
    onSuccess: async () => { setRemoveCandidate(null); setNotice("أُزيل إعداد الربط من التطبيق فقط؛ لم يُلغ حسابك أو أي تفويض خارجي."); await utils.apiConnections.list.invalidate(); },
    onError: () => setNotice("تعذر إزالة إعداد الربط الآن."),
  });
  const connections = useMemo(() => (connectionsQuery.data ?? []) as ApiConnection[], [connectionsQuery.data]);

  if (authLoading) return <ScreenContainer className="px-5"><View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={[styles.stateText, { color: colors.muted }]}>جارٍ التحقق من الجلسة…</Text></View></ScreenContainer>;
  if (!isAuthenticated) return <ScreenContainer className="px-5"><View style={[styles.state, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.stateTitle, { color: colors.foreground }]}>تسجيل الدخول مطلوب</Text><Text style={[styles.stateText, { color: colors.muted }]}>اتصالات API مملوكة لحسابك ولا يمكن حفظها في المعاينة غير المسجلة.</Text></View></ScreenContainer>;

  const header = <View><Text style={[styles.eyebrow, { color: colors.primary }]}>مصادر وحسابات</Text><Text style={[styles.heading, { color: colors.foreground }]}>تكاملات API</Text><Text style={[styles.subheading, { color: colors.muted }]}>اختر مصدراً ثم سجّل طلب الربط. التطبيق لا ينسخ مفاتيح من حساباتك ولا يخزنها في قاعدة البيانات أو مرفقات الدردشة.</Text><View style={[styles.guard, { backgroundColor: colors.subtle, borderColor: colors.border }]}><Text style={[styles.guardTitle, { color: colors.foreground }]}>كيف يعمل الربط الآمن؟</Text><Text style={[styles.guardCopy, { color: colors.muted }]}>GitHub يحتاج تطبيقاً أو OAuth بصلاحيات دقيقة. OpenRouter يحتاج مفتاحاً خادمياً أو OAuth PKCE. عند توفر الإعداد من حسابك، يُدخل عبر إعداد آمن خارج هذه الشاشة. Public APIs لا يحتاج مفتاحاً.</Text></View>{apiConnectionProviderValues.map((provider) => <ProviderCard key={provider} provider={provider} pending={pendingProvider === provider && requestSetup.isPending} onRequest={() => { setPendingProvider(provider); requestSetup.mutate({ provider }); }} colors={colors} />)}{notice ? <Text accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: colors.subtle, borderColor: colors.border, color: colors.foreground }]}>{notice}</Text> : null}<View style={styles.listHeader}><Text style={[styles.listTitle, { color: colors.foreground }]}>طلبات الربط المحفوظة</Text><Text style={[styles.listCount, { color: colors.muted }]}>{connections.length}</Text></View></View>;
  return <ScreenContainer className="px-5" containerClassName="bg-background"><FlatList data={connections} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} ListHeaderComponent={header} renderItem={({ item }) => <ConnectionRow connection={item} deleting={removeCandidate === item.id} pending={removeConnection.isPending} onRemove={() => removeCandidate === item.id ? removeConnection.mutate({ connectionId: item.id }) : setRemoveCandidate(item.id)} colors={colors} />} ItemSeparatorComponent={() => <View style={styles.separator} />} ListEmptyComponent={<View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{connectionsQuery.isLoading ? "جارٍ تحميل الاتصالات…" : connectionsQuery.error ? "تعذر تحميل الاتصالات" : "لا توجد طلبات ربط محفوظة"}</Text><Text style={[styles.emptyCopy, { color: colors.muted }]}>{connectionsQuery.error ? "تحقق من الجلسة والاتصال ثم أعد فتح الصفحة." : "اختر GitHub أو OpenRouter أو Public APIs من البطاقات أعلاه."}</Text></View>} ListFooterComponent={<Text style={[styles.footer, { color: colors.muted }]}>لا ينشئ هذا الإجراء حسابات خارجية ولا يبدأ نشر أو تنفيذ أو قراءة لمستودعاتك. تفويض الحسابات يكون في صفحة المزوّد الرسمية وبموافقتك.</Text>} /></ScreenContainer>;
}

function ProviderCard({ provider, pending, onRequest, colors }: { provider: ApiConnectionProvider; pending: boolean; onRequest: () => void; colors: ReturnType<typeof useColors> }) {
  const config = apiConnectionCatalog[provider];
  const action = config.authMode === "none" ? "تفعيل المصدر" : "طلب إعداد آمن";
  return <View style={[styles.providerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.providerTop}><View style={styles.providerCopy}><Text style={[styles.providerName, { color: colors.foreground }]}>{config.label}</Text><Text style={[styles.providerSummary, { color: colors.muted }]}>{config.summary}</Text></View><View style={[styles.modeBadge, { backgroundColor: colors.subtle }]}><Text style={[styles.modeBadgeText, { color: colors.primary }]}>{config.authMode === "oauth" ? "OAuth" : config.authMode === "api_key" ? "API Key" : "بدون مفتاح"}</Text></View></View><Text style={[styles.setupCopy, { color: colors.muted }]}>{config.setupCopy}</Text><Pressable disabled={pending} onPress={onRequest} style={({ pressed }) => [styles.requestAction, { borderColor: colors.primary }, (pressed || pending) && styles.pressed]}><Text style={[styles.requestActionText, { color: colors.primary }]}>{pending ? "جارٍ حفظ الطلب…" : action}</Text></Pressable></View>;
}

function ConnectionRow({ connection, deleting, pending, onRemove, colors }: { connection: ApiConnection; deleting: boolean; pending: boolean; onRemove: () => void; colors: ReturnType<typeof useColors> }) {
  const config = apiConnectionCatalog[connection.provider];
  const linked = connection.status === "linked";
  return <View style={[styles.connectionCard, { backgroundColor: colors.surface, borderColor: linked ? colors.success : colors.border }]}><View style={styles.providerTop}><View style={styles.providerCopy}><Text style={[styles.providerName, { color: colors.foreground }]}>{config.label}</Text><Text style={[styles.providerSummary, { color: colors.muted }]}>{linked ? "مصدر قراءة محكوم جاهز." : "بانتظار إعداد المالك الآمن؛ لا يوجد مفتاح محفوظ."}</Text></View><Text style={[styles.connectionStatus, { color: linked ? colors.success : colors.warning }]}>{linked ? "جاهز" : "يحتاج إعداداً"}</Text></View><Text style={[styles.connectionMeta, { color: colors.muted }]}>آخر طلب: {new Date(connection.lastRequestedAt).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}</Text><Pressable disabled={pending && !deleting} onPress={onRemove} style={({ pressed }) => [styles.removeAction, { borderColor: deleting ? colors.error : colors.border }, pressed && styles.pressed]}><Text style={[styles.removeActionText, { color: deleting ? colors.error : colors.muted }]}>{deleting ? (pending ? "جارٍ الإزالة…" : "تأكيد الإزالة") : "إزالة الإعداد"}</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  list: { paddingBottom: 106, paddingTop: 18 }, eyebrow: { fontSize: 13, fontWeight: "800", textAlign: "right" }, heading: { fontSize: 29, fontWeight: "900", marginTop: 3, textAlign: "right" }, subheading: { fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: "right" }, guard: { borderRadius: 17, borderWidth: 1, marginTop: 18, padding: 14 }, guardTitle: { fontSize: 13, fontWeight: "900", textAlign: "right" }, guardCopy: { fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: "right" }, providerCard: { borderRadius: 18, borderWidth: 1, marginTop: 12, padding: 14 }, providerTop: { flexDirection: "row-reverse", justifyContent: "space-between" }, providerCopy: { flex: 1, marginLeft: 10 }, providerName: { fontSize: 16, fontWeight: "900", textAlign: "right" }, providerSummary: { fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" }, modeBadge: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 }, modeBadgeText: { fontSize: 10, fontWeight: "900" }, setupCopy: { fontSize: 12, lineHeight: 18, marginTop: 11, textAlign: "right" }, requestAction: { alignItems: "center", borderRadius: 11, borderWidth: 1, marginTop: 12, paddingVertical: 10 }, requestActionText: { fontSize: 12, fontWeight: "900" }, notice: { borderRadius: 13, borderWidth: 1, fontSize: 12, lineHeight: 18, marginTop: 12, padding: 11, textAlign: "right" }, listHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 10, marginTop: 22 }, listTitle: { fontSize: 17, fontWeight: "900" }, listCount: { fontSize: 12, fontWeight: "800" }, connectionCard: { borderRadius: 18, borderWidth: 1, padding: 14 }, connectionStatus: { fontSize: 11, fontWeight: "900" }, connectionMeta: { fontSize: 11, marginTop: 10, textAlign: "right" }, removeAction: { alignSelf: "flex-end", borderRadius: 10, borderWidth: 1, marginTop: 12, paddingHorizontal: 10, paddingVertical: 7 }, removeActionText: { fontSize: 11, fontWeight: "900" }, separator: { height: 9 }, empty: { alignItems: "center", borderRadius: 18, borderWidth: 1, padding: 20 }, emptyTitle: { fontSize: 15, fontWeight: "900", textAlign: "center" }, emptyCopy: { fontSize: 12, lineHeight: 19, marginTop: 6, textAlign: "center" }, footer: { fontSize: 11, lineHeight: 18, marginTop: 18, textAlign: "center" }, state: { alignItems: "center", alignSelf: "center", borderRadius: 18, borderWidth: 1, gap: 9, marginTop: 80, maxWidth: 420, padding: 22, width: "100%" }, stateTitle: { fontSize: 17, fontWeight: "900", textAlign: "center" }, stateText: { fontSize: 13, lineHeight: 20, textAlign: "center" }, pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
