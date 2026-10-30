import { View, Text, StyleSheet } from "react-native";
import type { TideExtreme } from "../lib/tide";

export default function TideList({
  extremes,
  nextTime,
}: {
  extremes: TideExtreme[];
  nextTime?: string;
}) {
  return (
    <View style={styles.container}>
      {extremes.map((e, i) => (
        <View key={i} style={[styles.row, e.time === nextTime && styles.nextRow]}>
          <Text style={[styles.type, e.type === "HIGH" ? styles.high : styles.low]}>
            {e.type === "HIGH" ? "High tide" : "Low tide"}
          </Text>
          <Text style={styles.time}>
            {new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
          <Text style={styles.height}>{e.height.toFixed(1)} m</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20, paddingHorizontal: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#dcd8cf",
  },
  nextRow: { backgroundColor: "#eef4f3", borderRadius: 8 },
  type: { flex: 1, fontWeight: "600" },
  high: { color: "#1d6e63" },
  low: { color: "#8a6410" },
  time: { flex: 1, textAlign: "center", color: "#16232b" },
  height: { flex: 1, textAlign: "right", color: "#4c5b63" },
});