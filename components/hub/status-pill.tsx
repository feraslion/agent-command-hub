import { StyleSheet, Text, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

const palettes = {
  success: { light: { background: "#E8F7EF", color: "#137B50" }, dark: { background: "#123C31", color: "#74E1B0" } },
  primary: { light: { background: "#EEEDFF", color: "#4F46E5" }, dark: { background: "#302B67", color: "#C2BFFF" } },
  warning: { light: { background: "#FFF4DF", color: "#A95E00" }, dark: { background: "#4A3414", color: "#FFD07B" } },
  error: { light: { background: "#FFE9EC", color: "#B4233B" }, dark: { background: "#4A202A", color: "#FFACB7" } },
  muted: { light: { background: "#EEF0F5", color: "#667085" }, dark: { background: "#2A2E40", color: "#B5BACE" } },
};

export function StatusPill({ label, tone = "muted" }: { label: string; tone?: keyof typeof palettes }) {
  const colorScheme = useColorScheme();
  const palette = palettes[tone][colorScheme];
  return (
    <View style={[styles.pill, { backgroundColor: palette.background }]}>
      <Text style={[styles.text, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: "center", alignSelf: "flex-start", borderRadius: 999, justifyContent: "center", minHeight: 26, paddingHorizontal: 11, paddingVertical: 5 },
  text: { fontSize: 11, fontWeight: "800", letterSpacing: 0.1, textAlign: "center" },
});
