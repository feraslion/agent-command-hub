import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/hub/status-pill";
import { useAgentHub, statusTone, type Agent } from "@/lib/agent-hub";

export default function AgentsScreen() {
  const { agents } = useAgentHub();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  if (selectedAgent) return <AgentDetail agent={selectedAgent} onClose={() => setSelectedAgent(null)} />;
  return (
    <ScreenContainer className="px-5" containerClassName="bg-[#F7F7FC]">
      <FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<View><Text style={styles.eyebrow}>عقود واضحة</Text><Text style={styles.heading}>الوكلاء</Text><Text style={styles.subheading}>لكل وكيل نطاق مسؤولية وحدود ومخرج ونقطة تسليم محددة.</Text><View style={styles.legend}><View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: "#18A56B" }]} /><Text style={styles.legendText}>نشط</Text></View><View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: "#D88915" }]} /><Text style={styles.legendText}>مراجعة</Text></View><View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: "#98A0B3" }]} /><Text style={styles.legendText}>بانتظار المهمة</Text></View></View></View>}
        renderItem={({ item }) => <AgentCard agent={item} onPress={() => setSelectedAgent(item)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </ScreenContainer>
  );
}

function AgentCard({ agent, onPress }: { agent: Agent; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={[styles.avatar, { backgroundColor: agent.color }]}><Text style={styles.avatarText}>{agent.name.slice(0, 1)}</Text></View><View style={styles.cardBody}><View style={styles.cardTop}><Text style={styles.agentName}>{agent.name}</Text><StatusPill label={agent.status} tone={statusTone(agent.status)} /></View><Text style={styles.role}>{agent.role}</Text><Text numberOfLines={2} style={styles.description}>{agent.responsibility}</Text><Text style={styles.open}>عرض العقد ←</Text></View></Pressable>;
}

function AgentDetail({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const rows = [
    ["المدخلات", agent.input],
    ["المسؤولية", agent.responsibility],
    ["القيود", agent.constraints],
    ["المخرجات", agent.output],
    ["التسليم", agent.handoff],
  ];
  return <ScreenContainer className="px-5" containerClassName="bg-[#F7F7FC]"><FlatList data={rows} keyExtractor={([label]) => label} contentContainerStyle={styles.detailList} ListHeaderComponent={<View><Pressable onPress={onClose} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Text style={styles.backText}>← العودة إلى الوكلاء</Text></Pressable><View style={[styles.detailAvatar, { backgroundColor: agent.color }]}><Text style={styles.detailAvatarText}>{agent.name.slice(0, 1)}</Text></View><Text style={styles.detailName}>{agent.name}</Text><Text style={styles.detailRole}>{agent.role}</Text><StatusPill label={agent.status} tone={statusTone(agent.status)} /><View style={styles.contractBanner}><Text style={styles.contractTitle}>Agent Contract</Text><Text style={styles.contractCopy}>هذا العقد يحدّد نطاق العمل ويمنع تجاوز مسؤوليات الوكيل.</Text></View></View>} renderItem={({ item: [label, value] }) => <View style={styles.contractRow}><Text style={styles.contractLabel}>{label}</Text><Text style={styles.contractValue}>{value}</Text></View>} ItemSeparatorComponent={() => <View style={styles.separator} />} /></ScreenContainer>;
}

const styles = StyleSheet.create({
  list: { paddingTop: 18, paddingBottom: 104 },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", textAlign: "right" },
  heading: { color: "#171725", fontSize: 32, fontWeight: "900", marginTop: 3, textAlign: "right" },
  subheading: { color: "#6F7487", fontSize: 15, lineHeight: 22, marginBottom: 17, marginTop: 8, textAlign: "right" },
  legend: { backgroundColor: "#FFFFFF", borderColor: "#EAECF2", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-around", marginBottom: 18, paddingVertical: 11 },
  legendItem: { alignItems: "center", flexDirection: "row-reverse" },
  dot: { borderRadius: 50, height: 8, marginLeft: 6, width: 8 },
  legendText: { color: "#697084", fontSize: 11 },
  card: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#EAECF2", borderRadius: 20, borderWidth: 1, flexDirection: "row-reverse", padding: 14 },
  avatar: { alignItems: "center", borderRadius: 16, height: 44, justifyContent: "center", marginLeft: 12, width: 44 },
  avatarText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  cardBody: { flex: 1 },
  cardTop: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" },
  agentName: { color: "#202233", flex: 1, fontSize: 15, fontWeight: "800", textAlign: "right" },
  role: { color: "#4F46E5", fontSize: 12, fontWeight: "700", marginTop: 4, textAlign: "right" },
  description: { color: "#73798D", fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: "right" },
  open: { color: "#4F46E5", fontSize: 12, fontWeight: "800", marginTop: 10, textAlign: "right" },
  separator: { height: 10 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  detailList: { paddingBottom: 104, paddingTop: 18 },
  back: { alignSelf: "flex-end", marginBottom: 20, paddingVertical: 6 },
  backText: { color: "#4F46E5", fontSize: 14, fontWeight: "800" },
  detailAvatar: { alignItems: "center", borderRadius: 22, height: 68, justifyContent: "center", marginLeft: "auto", marginRight: "auto", width: 68 },
  detailAvatarText: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  detailName: { color: "#1A1C2A", fontSize: 24, fontWeight: "900", marginTop: 14, textAlign: "center" },
  detailRole: { color: "#6D7285", fontSize: 14, marginBottom: 10, marginTop: 5, textAlign: "center" },
  contractBanner: { backgroundColor: "#EEEDFF", borderRadius: 17, marginBottom: 18, marginTop: 18, padding: 15 },
  contractTitle: { color: "#4F46E5", fontSize: 14, fontWeight: "900", textAlign: "right" },
  contractCopy: { color: "#555174", fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: "right" },
  contractRow: { backgroundColor: "#FFFFFF", borderColor: "#EAECF2", borderRadius: 18, borderWidth: 1, padding: 15 },
  contractLabel: { color: "#4F46E5", fontSize: 12, fontWeight: "900", textAlign: "right" },
  contractValue: { color: "#3E4254", fontSize: 14, lineHeight: 21, marginTop: 7, textAlign: "right" },
});
