import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/hub/status-pill";
import { SectionTitle } from "@/components/hub/section-title";
import { useAgentHub, statusTone, type Project } from "@/lib/agent-hub";

export default function ProjectsScreen() {
  const { projects, addProject } = useAgentHub();
  const [notice, setNotice] = useState("");
  const createProject = () => {
    addProject();
    setNotice("تم إنشاء مشروع محلي جديد. يبدأ من مرحلة تحليل المتطلبات.");
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-[#F7F7FC]">
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>محفظة التنفيذ</Text>
            <Text style={styles.heading}>المشاريع</Text>
            <Text style={styles.subheading}>تابع الأعمال النشطة ومراحلها ووكيل التنفيذ الحالي.</Text>
            <Pressable onPress={createProject} style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
              <Text style={styles.createButtonText}>إنشاء مشروع محلي</Text>
              <Text style={styles.plus}>＋</Text>
            </Pressable>
            {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}
            <SectionTitle title="كل المشاريع" caption={`${projects.length} مشاريع في الذاكرة المحلية`} />
          </View>
        }
        renderItem={({ item }) => <ProjectCard project={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </ScreenContainer>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.code}><Text style={styles.codeText}>{project.code}</Text></View>
        <StatusPill label={project.status} tone={statusTone(project.status)} />
      </View>
      <Text style={styles.projectTitle}>{project.name}</Text>
      <Text style={styles.stage}>{project.currentStage} · {project.currentAgent}</Text>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${project.progress}%` }]} /></View>
      <View style={styles.cardBottom}><Text style={styles.updated}>{project.updatedAt}</Text><Text style={styles.progressLabel}>{project.progress}% مكتمل</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 18, paddingBottom: 104 },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", textAlign: "right" },
  heading: { color: "#171725", fontSize: 32, fontWeight: "900", marginTop: 3, textAlign: "right" },
  subheading: { color: "#6F7487", fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: "right" },
  createButton: { alignItems: "center", backgroundColor: "#4F46E5", borderRadius: 16, flexDirection: "row-reverse", justifyContent: "center", marginBottom: 20, marginTop: 20, paddingHorizontal: 16, paddingVertical: 15 },
  createButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  plus: { color: "#FFFFFF", fontSize: 20, fontWeight: "400", marginLeft: 8 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  notice: { backgroundColor: "#EDF9F1", borderColor: "#C5EFD6", borderRadius: 14, borderWidth: 1, marginBottom: 20, padding: 12 },
  noticeText: { color: "#176C47", fontSize: 13, lineHeight: 19, textAlign: "right" },
  card: { backgroundColor: "#FFFFFF", borderColor: "#EAECF2", borderRadius: 20, borderWidth: 1, padding: 17 },
  cardTop: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  code: { backgroundColor: "#F0EFFF", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  codeText: { color: "#4F46E5", fontSize: 12, fontWeight: "800" },
  projectTitle: { color: "#1E2030", fontSize: 18, fontWeight: "800", marginTop: 15, textAlign: "right" },
  stage: { color: "#777C90", fontSize: 13, marginTop: 6, textAlign: "right" },
  progressTrack: { backgroundColor: "#EBEDF3", borderRadius: 99, height: 8, marginTop: 18, overflow: "hidden" },
  progressFill: { backgroundColor: "#4F46E5", borderRadius: 99, height: "100%" },
  cardBottom: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 10 },
  updated: { color: "#8A90A3", fontSize: 12 },
  progressLabel: { color: "#3D4052", fontSize: 12, fontWeight: "700" },
  separator: { height: 12 },
});
