import { StyleSheet, Text, View } from "react-native";

export function SectionTitle({ title, caption }: { title: string; caption?: string }) {
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.title}>{title}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 },
  title: { color: "#171725", fontSize: 18, fontWeight: "800", textAlign: "right" },
  caption: { color: "#7A7F92", fontSize: 13, marginTop: 3, textAlign: "right" },
});
