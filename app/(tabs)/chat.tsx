import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAgentHub, type ChatMessage } from "@/lib/agent-hub";

export default function ChatScreen() {
  const { messages, sendMessage } = useAgentHub();
  const [draft, setDraft] = useState("");
  const submit = () => { sendMessage(draft); setDraft(""); };
  return <ScreenContainer className="px-5" containerClassName="bg-[#F7F7FC]"><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><FlatList data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<View><Text style={styles.eyebrow}>سياق التنفيذ</Text><Text style={styles.heading}>المحادثة</Text><Text style={styles.subheading}>دوّن توجيهات المشروع. تُحفظ الرسائل محلياً في هذه النسخة ولا تشغّل وكلاء خلف الكواليس.</Text><View style={styles.info}><Text style={styles.infoTitle}>مستوى الموافقة</Text><Text style={styles.infoText}>توجيهاتك تُوثَّق أولاً، بينما الحذف والنشر والإجراءات عالية الأثر تتطلب موافقة صريحة في محرك التنفيذ المستقبلي.</Text></View></View>} renderItem={({ item }) => <MessageBubble message={item} />} ItemSeparatorComponent={() => <View style={styles.separator} />} ListFooterComponent={<View style={styles.footerSpace} />} /></KeyboardAvoidingView><View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} onSubmitEditing={submit} placeholder="اكتب توجيهاً للمشروع…" placeholderTextColor="#9BA0AF" returnKeyType="done" style={styles.input} textAlign="right" /><Pressable disabled={!draft.trim()} onPress={submit} style={({ pressed }) => [styles.send, !draft.trim() && styles.sendDisabled, pressed && styles.pressed]}><Text style={styles.sendText}>إرسال</Text></Pressable></View></ScreenContainer>;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const mine = message.sender === "أنت";
  return <View style={[styles.bubble, mine ? styles.myBubble : styles.systemBubble]}><View style={styles.messageMeta}><Text style={[styles.sender, mine ? styles.myText : styles.systemText]}>{message.sender}</Text><Text style={[styles.time, mine ? styles.myTime : styles.systemTime]}>{message.time}</Text></View><Text style={[styles.message, mine ? styles.myText : styles.systemText]}>{message.text}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 10, paddingTop: 18 },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", textAlign: "right" },
  heading: { color: "#171725", fontSize: 32, fontWeight: "900", marginTop: 3, textAlign: "right" },
  subheading: { color: "#6F7487", fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: "right" },
  info: { backgroundColor: "#EEEDFF", borderRadius: 16, marginBottom: 20, marginTop: 15, padding: 14 },
  infoTitle: { color: "#4F46E5", fontSize: 13, fontWeight: "900", textAlign: "right" },
  infoText: { color: "#565274", fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" },
  bubble: { borderRadius: 18, maxWidth: "88%", padding: 13 },
  myBubble: { alignSelf: "flex-start", backgroundColor: "#4F46E5" },
  systemBubble: { alignSelf: "flex-end", backgroundColor: "#FFFFFF", borderColor: "#E7E9F0", borderWidth: 1 },
  messageMeta: { flexDirection: "row-reverse", justifyContent: "space-between" },
  sender: { fontSize: 11, fontWeight: "900" },
  time: { fontSize: 10 },
  message: { fontSize: 14, lineHeight: 20, marginTop: 5, textAlign: "right" },
  myText: { color: "#FFFFFF" },
  systemText: { color: "#333648" },
  myTime: { color: "#D8D6FF" },
  systemTime: { color: "#9197A8" },
  separator: { height: 9 },
  footerSpace: { height: 8 },
  composer: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E5E7EF", borderRadius: 17, borderWidth: 1, flexDirection: "row-reverse", marginBottom: 10, padding: 7 },
  input: { color: "#252738", flex: 1, fontSize: 14, minHeight: 38, paddingHorizontal: 8 },
  send: { backgroundColor: "#4F46E5", borderRadius: 12, marginRight: 6, paddingHorizontal: 13, paddingVertical: 10 },
  sendDisabled: { backgroundColor: "#C7C7D5" },
  sendText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
