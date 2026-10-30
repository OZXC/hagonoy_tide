
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, {Circle,Line,Polyline,Text as SvgText,} from "react-native-svg";
import type { TideTimelinePoint } from "../lib/tide";

type WeeklyDay = {
  date: string;
  timeline: TideTimelinePoint[];
  error: boolean;
};

type Props = {
  days: WeeklyDay[];
};

const CHART_WIDTH = 340;
const CHART_HEIGHT = 220;
const LEFT = 42;
const RIGHT = 12;
const TOP = 18;
const BOTTOM = 42;

function getTimestamp(value: string): number {
  // API timestamps should include their timezone offset.
  // If the API sends a date without a timezone, JavaScript may
  // interpret it differently depending on the runtime.
  return new Date(value).getTime();
}

function formatDay(date: string): string {
  const parsed = new Date(`${date}T12:00:00+08:00`);

  return parsed.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short",
  });
}

export default function WeeklyTideChart({ days }: Props) {
  const points = days
    .flatMap((day) =>
      day.timeline.map((point) => ({
        date: day.date,
        timestamp: getTimestamp(point.time),
        height: Number(point.height_m),
      }))
    )
    .filter(
      (point) =>
        Number.isFinite(point.timestamp) &&
        Number.isFinite(point.height)
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  if (points.length < 2) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>7-Day Tide Comparison</Text>
        <Text style={styles.message}>
          Not enough tide predictions are available to draw the graph.
          Check your API connection and try again.
        </Text>
      </View>
    );
  }

  const firstTimestamp = points[0].timestamp;
  const lastTimestamp = points[points.length - 1].timestamp;
  const heights = points.map((point) => point.height);

  const rawMin = Math.min(...heights);
  const rawMax = Math.max(...heights);
  const range = rawMax - rawMin || 1;
  const minHeight = rawMin - range * 0.1;
  const maxHeight = rawMax + range * 0.1;

  const plotWidth = CHART_WIDTH - LEFT - RIGHT;
  const plotHeight = CHART_HEIGHT - TOP - BOTTOM;

  const xFor = (timestamp: number) =>
    LEFT +
    ((timestamp - firstTimestamp) /
      Math.max(1, lastTimestamp - firstTimestamp)) *
      plotWidth;

  const yFor = (height: number) =>
    TOP +
    ((maxHeight - height) / (maxHeight - minHeight)) *
      plotHeight;

  const polylinePoints = points
    .map(
      (point) =>
        `${xFor(point.timestamp).toFixed(2)},${yFor(point.height).toFixed(2)}`
    )
    .join(" ");

  // Label each day's position using noon in Manila.
  const dayLabels = days.map((day) => {
    const noon = new Date(`${day.date}T12:00:00+08:00`).getTime();

    return {
      date: day.date,
      label: formatDay(day.date),
      x: xFor(noon),
    };
  });

  const yLabels = [0, 1, 2, 3, 4].map((index) => {
    const value = maxHeight - (index / 4) * (maxHeight - minHeight);

    return {
      value,
      y: TOP + (index / 4) * plotHeight,
    };
  });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>7-Day Tide Comparison</Text>
      <Text style={styles.subtitle}>
        Predicted water height · meters
      </Text>

      <View style={styles.chartContainer}>
        <Svg
          width="100%"
          height={CHART_HEIGHT}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        >
          {yLabels.map((label, index) => (
            <React.Fragment key={index}>
              <Line
                x1={LEFT}
                y1={label.y}
                x2={CHART_WIDTH - RIGHT}
                y2={label.y}
                stroke="#303044"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText
                x={LEFT - 8}
                y={label.y + 4}
                fontSize="10"
                fill="#A6A6BD"
                textAnchor="end"
              >
                {label.value.toFixed(1)}
              </SvgText>
            </React.Fragment>
          ))}

          {dayLabels.map((day) => (
            <Line
              key={day.date}
              x1={day.x}
              y1={TOP}
              x2={day.x}
              y2={CHART_HEIGHT - BOTTOM}
              stroke="#28283A"
              strokeWidth={1}
            />
          ))}

          <Line
            x1={LEFT}
            y1={TOP}
            x2={LEFT}
            y2={CHART_HEIGHT - BOTTOM}
            stroke="#77778F"
            strokeWidth={1}
          />

          <Polyline
            points={polylinePoints}
            fill="none"
            stroke="#8B7CFF"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((point, index) => (
            <Circle
              key={`${point.timestamp}-${index}`}
              cx={xFor(point.timestamp)}
              cy={yFor(point.height)}
              r={index % 4 === 0 ? 2.8 : 1.5}
              fill="#68D9FF"
            />
          ))}

          {dayLabels.map((day) => (
            <SvgText
              key={day.date}
              x={day.x}
              y={CHART_HEIGHT - 17}
              fontSize="10"
              fill="#C3C3D8"
              textAnchor="middle"
            >
              {day.label}
            </SvgText>
          ))}
        </Svg>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.purpleLine} />
          <Text style={styles.legendText}>Predicted tide</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.blueDot} />
          <Text style={styles.legendText}>Prediction points</Text>
        </View>
      </View>

      <Text style={styles.note}>
        Predictions are estimates, not live sensor measurements.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#171725",
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#2C2C43",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: "#A6A6BD",
    fontSize: 12,
    marginTop: 5,
    marginBottom: 8,
  },
  chartContainer: {
    width: "100%",
    marginTop: 8,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  purpleLine: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#8B7CFF",
  },
  blueDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#68D9FF",
  },
  legendText: {
    color: "#C3C3D8",
    fontSize: 11,
  },
  note: {
    color: "#85859D",
    fontSize: 11,
    marginTop: 14,
    lineHeight: 16,
  },
  message: {
    color: "#A6A6BD",
    fontSize: 13,
    marginTop: 12,
    lineHeight: 20,
  },
});
