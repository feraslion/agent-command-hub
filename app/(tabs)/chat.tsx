import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAgentHub, type ChatMessage } from "@/lib/agent-hub";

export default function ChatScreen() {
  const colors = useColors();
  const isDark = useColorScheme() === "dark";
  const { messages, sendMessage } = useAgentHub();
  const [draft, setDraft] = useState("");
  const submit = () => { sendMessage(draft); setDraft(""); };
  return <ScreenContainer className="px-5" containerClassName="bg-background"><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><FlatList data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<View><Text style={[styles.eyebrow, { color: colors.primary }]}>سياق التنفيذ</Text><Text style={[styles.heading, { color: colors.foreground }]}>المحادثة</Text><Text style={[styles.subheading, { color: colors.muted }]}>دوّن توجيهات المشروع. تُحفظ الرسائل محلياً في هذه النسخة ولا تشغّل وكلاء خلف الكواليس.</Text><View style={[styles.info, { backgroundColor: isDark ? "#242041" : "#EEEDFF" }]}><Text style={[styles.infoTitle, { color: colors.primary }]}>مستوى الموافقة</Text><Text style={[styles.infoText, { color: isDark ? "#C8C4FF" : "#565274" }]}>توجيهاتك تُوثَّق أولاً، بينما الحذف والنشر والإجراءات عالية الأثر تتطلب موافقة صريحة في محرك التنفيذ المستقبلي.</Text></View></View>} renderItem={({ item }) => <MessageBubble message={item} colors={colors} />} ItemSeparatorComponent={() => <View style={styles.separator} />} ListFooterComponent={<View style={styles.footerSpace} />} /></KeyboardAvoidingView><View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}><TextInput value={draft} onChangeText={setDraft} onSubmitEditing={submit} placeholder="اكتب توجيهاً للمشروع…" placeholderTextColor={colors.muted} returnKeyType="done" style={[styles.input, { color: colors.foreground }]} textAlign="right" /><Pressable disabled={!draft.trim()} onPress={submit} style={({ pressed }) => [styles.send, { backgroundColor: colors.primary }, !draft.trim() && { backgroundColor: colors.subtle }, pressed && styles.pressed]}><Text style={[styles.sendText, !draft.trim() && { color: colors.muted }]}>إرسال</Text></Pressable></View></ScreenContainer>;
}

function MessageBubble({ message, colors }: { message: ChatMessage; colors: ReturnType<typeof useColors> }) {
  const mine = message.sender === "أنت";
  return <View style={[styles.bubble, mine ? [styles.myBubble, { backgroundColor: colors.primary }] : [styles.systemBubble, { backgroundColor: colors.surface, borderColor: colors.border }]]}><View style={styles.messageMeta}><Text style={[styles.sender, { color: mine ? "#FFFFFF" : colors.foreground }]}>{message.sender}</Text><Text style={[styles.time, { color: mine ? "#DDD9FF" : colors.muted }]}>{message.time}</Text></View><Text style={[styles.message, { color: mine ? "#FFFFFF" : colors.foreground }]}>{message.text}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, list: { paddingBottom: 10, paddingTop: 18 }, eyebrow: { fontSize: 13, fontWeight: "800", textAlign: "right" }, heading: { fontSize: 32, fontWeight: "900", marginTop: 3, textAlign: "right" }, subheading: { fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: "right" }, info: { borderRadius: 16, marginBottom: 20, marginTop: 15, padding: 14 }, infoTitle: { fontSize: 13, fontWeight: "900", textAlign: "right" }, infoText: { fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" }, bubble: { borderRadius: 18, maxWidth: "88%", padding: 13 }, myBubble: { alignSelf: "flex-start" }, systemBubble: { alignSelf: "flex-end", borderWidth: 1 }, messageMeta: { flexDirection: "row-reverse", justifyContent: "space-between" }, sender: { fontSize: 11, fontWeight: "900" }, time: { fontSize: 10 }, message: { fontSize: 14, lineHeight: 20, marginTop: 5, textAlign: "right" }, separator: { height: 9 }, footerSpace: { height: 8 }, composer: { alignItems: "center", borderRadius: 17, borderWidth: 1, flexDirection: "row-reverse", marginBottom: 10, padding: 7 }, input: { flex: 1, fontSize: 14, minHeight: 38, paddingHorizontal: 8 }, send: { borderRadius: 12, marginRight: 6, paddingHorizontal: 13, paddingVertical: 10 }, sendText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" }, pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
