import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export function SectionTitle({ title, caption }: { title: string; caption?: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {caption ? <Text style={[styles.caption, { color: colors.muted }]}>{caption}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "800", textAlign: "right" },
  caption: { fontSize: 13, marginTop: 3, textAlign: "right" },
});
