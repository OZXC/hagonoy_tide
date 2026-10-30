
import { View, Text, StyleSheet } from "react-native";
import {
  formatCountdown,
  type TideDirection,
  type TideStatus,
} from "../lib/tide";

export default function TideStatusCard({
  status,
  direction,
  nowMs,
}: {
  status: TideStatus | null;
  direction: TideDirection | null;
  nowMs: number;
}) {
  const rising = direction === "rising";
  const falling = direction === "falling";
    
  const color = rising
    ? "#1D6E63"
    : falling
      ? "#8A6410"
      : "#526B73";

  const bg = rising
    ? "#E3F0EA"
    : falling
      ? "#F6EFDC"
      : "#E9EEF0";

  const label = rising
    ? "Tide is rising"
    : falling
      ? "Tide is falling"
      : "Tide direction unavailable";

  let detail = "Not enough prediction data to determine the next tide.";

  if (status && status.next) {
    const t = new Date(status.next.time);

    const time = t.toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
    });

    const type = status.next.type === "HIGH" ? "High" : "Low";

    detail = `Next: ${type} tide at ${time} · in ${formatCountdown(
      t.getTime() - nowMs
    )}`;
  } else if (status) {
    detail = "No more tides in today's data";
  }

  return (
    <View
      style={[styles.card, { backgroundColor: bg }]}
      accessible
      accessibilityLabel={`${label}. ${detail}`}
    >
      <View style={styles.iconBox}>
        <Text style={[styles.arrow, { color }]}>
          {rising ? "▲" : falling ? "▼" : "—"}
        </Text>
      </View>

      <View style={styles.textBox}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 19,
    marginBottom: 17,
    gap: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: { fontSize: 20 },
  textBox: { flex: 1 },
  label: { fontSize: 17, fontWeight: "800" },
  detail: { marginTop: 3, fontSize: 12, color: "#5F706A" },
});
