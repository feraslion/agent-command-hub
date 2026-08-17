import { StyleSheet, Text, View } from "react-native";

const palettes = {
  success: { background: "#E8F7EF", color: "#137B50" },
  primary: { background: "#EEEDFF", color: "#4F46E5" },
  warning: { background: "#FFF4DF", color: "#A95E00" },
  error: { background: "#FFE9EC", color: "#B4233B" },
  muted: { background: "#EEF0F5", color: "#667085" },
};

export function StatusPill({ label, tone = "muted" }: { label: string; tone?: keyof typeof palettes }) {
  const palette = palettes[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.background }]}>
      <Text style={[styles.text, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  text: { fontSize: 12, fontWeight: "700", textAlign: "center" },
});
