import { Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { requestDeviceNotificationPermission } from "@/components/notification-bridge";
import { useAgentHub } from "@/lib/agent-hub";

export default function SettingsScreen() {
  const router = useRouter();
  const { notificationPreferences, setNotificationPreference, unreadAlertCount } = useAgentHub();
  const isWeb = Platform.OS === "web";

  const toggleDevice = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationPreference("device", false);
      return;
    }
    const permission = await requestDeviceNotificationPermission();
    setNotificationPreference("device", permission === "granted");
  };

  return <ScreenContainer className="px-5" containerClassName="bg-[#F7F7FC]"><View style={styles.page}><View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Text style={styles.backText}>← العودة</Text></Pressable><View><Text style={styles.eyebrow}>تحكم شخصي</Text><Text style={styles.heading}>إعدادات الإشعارات</Text></View></View><View style={styles.intro}><View style={styles.introBadge}><Text style={styles.introBadgeText}>{unreadAlertCount}</Text></View><View style={styles.introBody}><Text style={styles.introTitle}>التنبيهات حسب تفضيلك</Text><Text style={styles.introCopy}>تغيّر هذه الخيارات ما يظهر في مركز التنبيهات وما يُرسل إلى الجهاز.</Text></View></View><Text style={styles.section}>أنواع التنبيه</Text><View style={styles.group}><SettingRow title="طلبات الموافقة" description="أظهر تنبيهات عندما تحتاج المهمة قراراً منك." value={notificationPreferences.approvals} onChange={(enabled) => setNotificationPreference("approvals", enabled)} /><View style={styles.divider} /><SettingRow title="تحذير الميزانية" description="أظهر تحذيراً عند استخدام 75% من سقف المشروع." value={notificationPreferences.budget} onChange={(enabled) => setNotificationPreference("budget", enabled)} /></View><Text style={styles.section}>إشعارات الجهاز</Text><View style={styles.group}><SettingRow title="تنبيهات الجهاز المحلية" description={isWeb ? "غير متاحة في نسخة الويب؛ سيبقى مركز التنبيهات داخل التطبيق فعالاً." : "اطلب إذن الجهاز لإظهار التنبيه عندما يكون التطبيق مفتوحاً أو في الخلفية."} value={notificationPreferences.device} disabled={isWeb} onChange={toggleDevice} /><View style={styles.divider} /><View style={styles.statusRow}><Text style={styles.statusValue}>{isWeb ? "داخل التطبيق فقط" : notificationPreferences.device ? "مفعّلة" : "غير مفعّلة"}</Text><Text style={styles.statusLabel}>الحالة</Text></View></View><View style={styles.note}><Text style={styles.noteTitle}>كيف تعمل التفضيلات؟</Text><Text style={styles.noteCopy}>إيقاف أي نوع يخفي تنبيهاته الحالية والجديدة. لا تتغير المهام أو قرارات الموافقة نفسها، بل تتغير طريقة إعلامك بها فقط.</Text></View></View></ScreenContainer>;
}

function SettingRow({ title, description, value, onChange, disabled = false }: { title: string; description: string; value: boolean; onChange: (enabled: boolean) => void; disabled?: boolean }) {
  return <View style={[styles.settingRow, disabled && styles.disabled]}><Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: "#D7DAE4", true: "#A9A4FF" }} thumbColor={value ? "#4F46E5" : "#FFFFFF"} /><View style={styles.settingCopy}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDescription}>{description}</Text></View></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 18 },
  header: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" },
  back: { paddingVertical: 7 },
  backText: { color: "#4F46E5", fontSize: 13, fontWeight: "900" },
  eyebrow: { color: "#4F46E5", fontSize: 12, fontWeight: "900", textAlign: "right" },
  heading: { color: "#171725", fontSize: 28, fontWeight: "900", marginTop: 3, textAlign: "right" },
  intro: { alignItems: "center", backgroundColor: "#EEEDFF", borderRadius: 19, flexDirection: "row-reverse", marginTop: 20, padding: 15 },
  introBadge: { alignItems: "center", backgroundColor: "#4F46E5", borderRadius: 17, height: 40, justifyContent: "center", marginLeft: 12, minWidth: 40, paddingHorizontal: 6 },
  introBadgeText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  introBody: { flex: 1 },
  introTitle: { color: "#30335C", fontSize: 14, fontWeight: "900", textAlign: "right" },
  introCopy: { color: "#5C6282", fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right" },
  section: { color: "#424557", fontSize: 14, fontWeight: "900", marginTop: 22, textAlign: "right" },
  group: { backgroundColor: "#FFFFFF", borderColor: "#E5E7EF", borderRadius: 19, borderWidth: 1, marginTop: 10, overflow: "hidden" },
  settingRow: { alignItems: "center", flexDirection: "row-reverse", padding: 15 },
  disabled: { opacity: 0.58 },
  settingCopy: { flex: 1, marginLeft: 14 },
  settingTitle: { color: "#2D3040", fontSize: 14, fontWeight: "900", textAlign: "right" },
  settingDescription: { color: "#72788B", fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" },
  divider: { backgroundColor: "#ECEEF4", height: 1, marginHorizontal: 15 },
  statusRow: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", padding: 15 },
  statusValue: { color: "#4F46E5", fontSize: 13, fontWeight: "900" },
  statusLabel: { color: "#7E8496", fontSize: 12 },
  note: { backgroundColor: "#FFF8E8", borderRadius: 17, marginTop: 18, padding: 14 },
  noteTitle: { color: "#78500E", fontSize: 13, fontWeight: "900", textAlign: "right" },
  noteCopy: { color: "#876A39", fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: "right" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
