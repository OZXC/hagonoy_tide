
import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Pressable,
} from "react-native";
import {fetchTodayTides, fetchTodayTimeline, getCurrentPredictedLevel, getManilaDate, shiftDate, type TideExtreme,} from "./lib/tide";
import TideList from "./components/TideList";
import WaveAnimation from "./components/WaveAnimation";
import { useNow } from "./lib/useNow";
import {
  getTideStatus,
  getTideDirection,
} from "./lib/tide";

import TideStatusCard from "./components/TideStatusCard";

type ViewMode = "daily" | "weekly";

type WeeklyDay = {
  date: string;
  events: TideExtreme[];
  timeline: Awaited<ReturnType<typeof fetchTodayTimeline>>;
  error: boolean;
};

function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00+08:00`).toLocaleDateString(
    "en-PH",
    {
      timeZone: "Asia/Manila",
      ...options,
    }
  );
}

function getDateLabel(date: string) {
  const today = getManilaDate();

  if (date === today) return "Today";
  if (date === shiftDate(today, 1)) return "Tomorrow";

  return formatDate(date, { weekday: "short" });
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [selectedDate, setSelectedDate] = useState(getManilaDate);

  const [extremes, setExtremes] = useState<TideExtreme[]>([]);
  const [timeline, setTimeline] = useState<
    Awaited<ReturnType<typeof fetchTodayTimeline>>
    
  >([]);

  const [weeklyDays, setWeeklyDays] = useState<WeeklyDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [reloadKey, setReloadKey] = useState(0);
  const nowMs = useNow();
  const todayDate = getManilaDate();
  const isToday = selectedDate === todayDate;
  const nextTideStatus = getTideStatus(extremes, nowMs);

const tideDirection =
  selectedDate === getManilaDate()
    ? getTideDirection(timeline, nowMs)
    : null;
  const displayDate = formatDate(selectedDate, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Keep the current-level estimate updated.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Load the selected day's tide events and timeline.
  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [events, points] = await Promise.all([
          fetchTodayTides(selectedDate),
          fetchTodayTimeline(selectedDate),
        ]);

        if (active) {
          setExtremes(events);
          setTimeline(points);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load tide predictions."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [selectedDate, reloadKey]);

  // Load today plus the next six days for the weekly view.
  useEffect(() => {
    if (viewMode !== "weekly") return;

    let active = true;

    async function loadWeek() {
      setWeeklyLoading(true);

      const dates = Array.from({ length: 7 }, (_, index) =>
        shiftDate(getManilaDate(), index)
      );

      const results = await Promise.all(
  dates.map(async (date): Promise<WeeklyDay> => {
    try {
      const [events, timeline] = await Promise.all([
        fetchTodayTides(date),
        fetchTodayTimeline(date),
      ]);

      return { date, events, timeline, error: false };
    } catch {
      return {
        date,
        events: [],
        timeline: [],
        error: true,
      };
    }
  })
);

      if (active) {
        setWeeklyDays(results);
        setWeeklyLoading(false);
      }
    }

    loadWeek();

    return () => {
      active = false;
    };
  }, [viewMode, reloadKey]);

  const currentLevel = isToday
    ? getCurrentPredictedLevel(timeline, now)
    : null;

  // Estimate tide direction from adjacent predictions in the timeline.
  const currentTimelineIndex = timeline.reduce((latestIndex, point, index) => {
    return new Date(point.time).getTime() <= now.getTime() ? index : latestIndex;
  }, -1);
  const previousTimelinePoint = currentTimelineIndex > 0
    ? timeline[currentTimelineIndex - 1]
    : null;
  const currentTimelinePoint = currentTimelineIndex >= 0
    ? timeline[currentTimelineIndex]
    : null;
  const tideTrend = currentTimelinePoint && previousTimelinePoint
    ? currentTimelinePoint.height_m - previousTimelinePoint.height_m > 0.015
      ? "RISING"
      : currentTimelinePoint.height_m - previousTimelinePoint.height_m < -0.015
        ? "FALLING"
        : "STEADY"
    : null;
  const nearestTideExtreme = isToday
    ? extremes
        .map((event) => ({
          event,
          difference: Math.abs(new Date(event.time).getTime() - now.getTime()),
        }))
        .filter(({ difference }) => difference <= 30 * 60 * 1000)
        .sort((a, b) => a.difference - b.difference)[0]?.event
    : null;
 const tideStatusLabel = nearestTideExtreme
  ? nearestTideExtreme.type === "LOW"
    ? "LOW TIDE"
    : "HIGH TIDE"
  : tideTrend
    ? `${tideTrend} TIDE`
    : null;
  const highTides = extremes.filter((event) => event.type === "HIGH");
  const lowTides = extremes.filter((event) => event.type === "LOW");

  function openDay(date: string) {
    setSelectedDate(date);
    setViewMode("daily");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F1E8" />

      <ScrollView contentContainerStyle={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandContainer}>
            <Text style={styles.brand}>SOLUNE</Text>
            <Text style={styles.tagline}>
              Your tides, at a glance.
            </Text>
          </View>
    
          <View style={styles.locationBadge}>
            <Text style={styles.locationIcon}>⌖</Text>
            <Text style={styles.locationText}>Hagonoy, Bulacan</Text>
          </View>
        </View>

        {/* Daily / weekly toggle */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              viewMode === "daily" && styles.modeButtonActive,
            ]}
            onPress={() => setViewMode("daily")}
          >
            <Text
              style={[
                styles.modeText,
                viewMode === "daily" && styles.modeTextActive,
              ]}
            >
              Daily
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              viewMode === "weekly" && styles.modeButtonActive,
            ]}
            onPress={() => setViewMode("weekly")}
          >
            <Text
              style={[
                styles.modeText,
                viewMode === "weekly" && styles.modeTextActive,
              ]}
            >
              7 Days
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === "daily" ? (
          <>
            {/* Date selector */}
            <View style={styles.dateSelector}>
              <TouchableOpacity
                style={styles.dateArrow}
                onPress={() =>
                  setSelectedDate((date) => shiftDate(date, -1))
                }
                accessibilityLabel="Previous day"
              >
                <Text style={styles.arrowText}>‹</Text>
              </TouchableOpacity>

              <View style={styles.dateInfo}>
                <Text style={styles.dateTitle}>{displayDate}</Text>
                <Text style={styles.dateSubtitle}>
                  {isToday ? "Today · Philippine Time" : "Tide forecast"}
                </Text>

                {!isToday && (
                  <TouchableOpacity
                    onPress={() => setSelectedDate(getManilaDate())}
                  >
                    <Text style={styles.todayButton}>Back to Today</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.dateArrow}
                onPress={() =>
                  setSelectedDate((date) => shiftDate(date, 1))
                }
                accessibilityLabel="Next day"
              >
                <Text style={styles.arrowText}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dateRow}>
              <Text style={styles.sectionEyebrow}>TIDE OVERVIEW</Text>
              <Text style={styles.date}>{displayDate}</Text>
            </View>

            {/* Daily water-level card */}
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>WATER LEVEL</Text> 
                  <TideStatusCard status={nextTideStatus} direction={tideDirection} nowMs={nowMs} />
                  <Text style={styles.heroTitle}>Bay conditions</Text>
                </View>

                <View
                    style={[
                      styles.liveBadge,
                      (tideTrend === "RISING" || tideStatusLabel === "HIGH TIDE") &&
                        styles.risingBadge,
                      (tideTrend === "FALLING" || tideStatusLabel === "LOW TIDE") &&
                        styles.fallingBadge,
                    ]}
                  >
                    <Text style={styles.trendArrow}>
                      {tideStatusLabel === "LOW TIDE" ||
                      tideStatusLabel === "HIGH TIDE"
                        ? "•"
                        : tideTrend === "RISING"
                          ? "↑"
                          : tideTrend === "FALLING"
                            ? "↓"
                            : "→"}
                    </Text>

                    <Text style={styles.liveText}>
                      {tideStatusLabel ?? "TIDE TREND"}
                    </Text>
                </View>
              </View>          
              {loading ? (
                <View style={styles.feedback}>
                  <ActivityIndicator color="#1D6E63" size="large" />
                  <Text style={styles.feedbackText}>
                    Loading tide data...
                  </Text>
                </View>
              ) : error ? (
                <View style={styles.feedback}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable
                    style={styles.retryButton}
                    onPress={() => setReloadKey((key) => key + 1)}
                  >
                    <Text style={styles.retryText}>Try again</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {isToday && currentLevel !== null ? (
                    <>
                      <View style={styles.levelRow}>
                        <Text style={styles.levelNumber}>
                          {currentLevel.toFixed(2)}
                        </Text>
                        <Text style={styles.levelUnit}>m</Text>
                      </View>

                      <Text style={styles.levelCaption}>
                        Predicted water level · Philippine time
                      </Text>

                      <View style={styles.waveCard}>
                        <WaveAnimation level={currentLevel} />
                      </View>
                    </>
                  ) : (
                    <View style={styles.feedback}>
                      <Text style={styles.feedbackText}>
                        {isToday
                          ? "Current water-level prediction is unavailable."
                          : "Select Today to see the current predicted water level."}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.disclaimer}>
                    Prediction from the connected tide station; not a live
                    sensor reading.
                  </Text>
                </>
              )}
            </View>

            {!loading && !error && (
              extremes.length > 0 ? (
                <>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>HIGH TIDES</Text>
                      <Text style={styles.summaryCount}>
                        {highTides.length}
                      </Text>
                      <Text style={styles.summaryHint}>
                        Selected day's events
                      </Text>
                    </View>

                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>LOW TIDES</Text>
                      <Text style={styles.summaryCount}>
                        {lowTides.length}
                      </Text>
                      <Text style={styles.summaryHint}>
                        Selected day's events
                      </Text>
                    </View>
                  </View>

                  <View style={styles.tideSection}>
                    <View style={styles.sectionHeader}>
                      <View>
                        <Text style={styles.sectionTitle}>Tide events</Text>
                        <Text style={styles.sectionSubtitle}>
                          Predicted high and low points
                        </Text>
                      </View>

                      <View style={styles.eventBadge}>
                        <Text style={styles.eventBadgeText}>
                          {extremes.length} EVENTS
                        </Text>
                      </View>
                    </View>

                    <View style={styles.listCard}>
                      <TideList extremes={extremes} />
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.feedback}>
                  <Text style={styles.feedbackText}>
                    No tide events are available for this date.
                  </Text>
                </View>
              )
            )}
          </>
        ) : (
          <>
            {/* Weekly overview */}
            <View style={styles.weekHeading}>
              <Text style={styles.sectionEyebrow}>TIDE FORECAST</Text>
              <Text style={styles.sectionTitle}>The next 7 days</Text>
              <Text style={styles.sectionSubtitle}>
                {formatDate(todayDate, { month: "short", day: "numeric" })}
                {" – "}
                {formatDate(shiftDate(todayDate, 6), {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>

            {weeklyLoading ? (
              <View style={styles.feedback}>
                <ActivityIndicator color="#1D6E63" size="large" />
                <Text style={styles.feedbackText}>
                  Loading your weekly forecast...
                </Text>
              </View>
            ) : (
              <View style={styles.weekList}>
                {weeklyDays.map((day) => {
                  const highs = day.events.filter(
                    (event) => event.type === "HIGH"
                  );
                  const lows = day.events.filter(
                    (event) => event.type === "LOW"
                  );

                  const highest = highs.length
                    ? Math.max(...highs.map((event) => event.height))
                    : null;

                  const lowest = lows.length
                    ? Math.min(...lows.map((event) => event.height))
                    : null;

                  return (
                    <Pressable
                      key={day.date}
                      style={styles.weekCard}
                      onPress={() => openDay(day.date)}
                    >
                      <View style={styles.weekCardTop}>
                        <View>
                          <Text style={styles.weekDayName}>
                            {getDateLabel(day.date)}
                          </Text>
                          <Text style={styles.weekDate}>
                            {formatDate(day.date, {
                              month: "short",
                              day: "numeric",
                            })}
                          </Text>
                        </View>

                        <View style={styles.weekArrow}>
                          <Text style={styles.weekArrowText}>›</Text>
                        </View>
                      </View>

                      {day.error ? (
                        <Text style={styles.weekUnavailable}>
                          Forecast unavailable
                        </Text>
                      ) : day.events.length === 0 ? (
                        <Text style={styles.weekUnavailable}>
                          No tide events returned
                        </Text>
                      ) : (
                        <>
                          <View style={styles.weekStats}>
                            <View style={styles.weekStat}>
                              <Text style={styles.weekStatLabel}>
                                HIGH TIDES
                              </Text>
                              <Text style={styles.weekStatValue}>
                                {highs.length}
                              </Text>
                            </View>

                            <View style={styles.weekStat}>
                              <Text style={styles.weekStatLabel}>
                                LOW TIDES
                              </Text>
                              <Text style={styles.weekStatValue}>
                                {lows.length}
                              </Text>
                            </View>

                            <View style={styles.weekStat}>
                              <Text style={styles.weekStatLabel}>
                                HIGHEST
                              </Text>
                              <Text style={styles.weekHeight}>
                                {highest !== null
                                  ? `${highest.toFixed(2)} m`
                                  : "—"}
                              </Text>
                            </View>

                            <View style={styles.weekStat}>
                              <Text style={styles.weekStatLabel}>
                                LOWEST
                              </Text>
                              <Text style={styles.weekHeight}>
                                {lowest !== null
                                  ? `${lowest.toFixed(2)} m`
                                  : "—"}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.weekTapHint}>
                            Tap to view tide times
                          </Text>
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Text style={styles.weekDisclaimer}>
              Heights are predictions from the connected tide station.
              Actual conditions in Hagonoy may differ.
            </Text>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>SOLUNE</Text>
          <Text style={styles.footerText}>
            Observe the tides. Plan your day.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F1E8",
  },
  page: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 22,
  },
  brandContainer: {
    flexShrink: 1,
  },
  brand: {
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: 4,
    color: "#102D35",
  },
  tagline: {
    fontSize: 12,
    color: "#73817D",
    marginTop: 5,
    letterSpacing: 0.2,
  },
  locationBadge: {
    backgroundColor: "#E6E9E0",
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
    borderWidth: 1,
    borderColor: "#D8DED4",
  },
  locationIcon: {
    fontSize: 17,
    color: "#1D6E63",
  },
  locationText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#31534B",
  },
  modeSelector: {
    flexDirection: "row",
    backgroundColor: "#E5E8DF",
    borderRadius: 15,
    padding: 4,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#DDE1D7",
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 11,
  },
  modeButtonActive: {
    backgroundColor: "#123640",
    shadowColor: "#102D35",
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modeText: {
    color: "#61736C",
    fontSize: 13,
    fontWeight: "700",
  },
  modeTextActive: {
    color: "#FFFFFF",
  },
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E5E2D8",
    shadowColor: "#243C39",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  dateArrow: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#EDF1EE",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: {
    fontSize: 30,
    lineHeight: 34,
    color: "#163740",
  },
  dateInfo: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 5,
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#16333A",
    textAlign: "center",
  },
  dateSubtitle: {
    marginTop: 5,
    fontSize: 11,
    color: "#7B8983",
  },
  todayButton: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#197768",
  },
  dateRow: {
    marginBottom: 13,
    gap: 5,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#82908A",
  },
  date: {
    fontSize: 15,
    color: "#344C47",
    fontWeight: "600",
  },
  heroCard: {
    backgroundColor: "#12343D",
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: "#214852",
    marginBottom: 17,
    shadowColor: "#102D35",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    color: "#A7C2BB",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F8F7F0",
    marginTop: 6,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#214A48",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#32615A",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#9DDBB6",
  },
  liveText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#C4E7D1",
    letterSpacing: 0.8,
  },
  risingBadge: {
    backgroundColor: "#244F43",
    borderColor: "#4B8C70",
  },
  fallingBadge: {
    backgroundColor: "#493B35",
    borderColor: "#80604E",
  },
  trendArrow: {
    fontSize: 14,
    lineHeight: 14,
    fontWeight: "900",
    color: "#D4F0E6",
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 24,
  },
  levelNumber: {
    fontSize: 54,
    fontWeight: "700",
    color: "#D4F0E6",
    letterSpacing: -2,
  },
  levelUnit: {
    fontSize: 20,
    fontWeight: "700",
    color: "#A7CFC3",
    marginLeft: 7,
  },
  levelCaption: {
    fontSize: 11,
    color: "#B2C9C4",
    marginTop: 2,
    marginBottom: 19,
  },
  waveCard: {
    backgroundColor: "#DDECE7",
    borderRadius: 19,
    paddingVertical: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#BFD9D0",
  },
  disclaimer: {
    fontSize: 10,
    lineHeight: 15,
    color: "#B0C5C0",
    marginTop: 13,
  },
  feedback: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 12,
  },
  feedbackText: {
    fontSize: 13,
    color: "#697A73",
    textAlign: "center",
  },
  errorText: {
    fontSize: 13,
    color: "#B42318",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#D7EEE5",
    borderWidth: 1,
    borderColor: "#A9D4C5",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: {
    color: "#15584E",
    fontWeight: "800",
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E2D8",
    shadowColor: "#243C39",
    shadowOpacity: 0.035,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  summaryLabel: {
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: "800",
    color: "#7B8982",
  },
  summaryCount: {
    fontSize: 31,
    fontWeight: "800",
    color: "#153E42",
    marginTop: 9,
  },
  summaryHint: {
    fontSize: 10,
    color: "#84918A",
    marginTop: 4,
  },
  tideSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#16343B",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#7A8982",
    marginTop: 4,
  },
  eventBadge: {
    backgroundColor: "#E3EAE3",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D7E0D8",
  },
  eventBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#355B53",
    letterSpacing: 0.6,
  },
  listCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#E5E2D8",
    overflow: "hidden",
  },
  weekHeading: {
    marginBottom: 18,
    gap: 5,
  },
  weekList: {
    gap: 12,
  },
  weekCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E5E2D8",
    padding: 16,
  },
  weekCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  weekDayName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#16343B",
  },
  weekDate: {
    fontSize: 12,
    color: "#7A8982",
    marginTop: 3,
  },
  weekArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#E6ECE6",
    alignItems: "center",
    justifyContent: "center",
  },
  weekArrowText: {
    fontSize: 25,
    lineHeight: 28,
    color: "#1D6E63",
  },
  weekStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 16,
  },
  weekStat: {
    width: "50%",
    gap: 4,
  },
  weekStatLabel: {
    fontSize: 9,
    letterSpacing: 0.8,
    fontWeight: "800",
    color: "#7A8982",
  },
  weekStatValue: {
    fontSize: 23,
    fontWeight: "700",
    color: "#1D6E63",
  },
  weekHeight: {
    fontSize: 17,
    fontWeight: "700",
    color: "#31534B",
  },
  weekUnavailable: {
    fontSize: 13,
    color: "#8A6550",
    paddingVertical: 8,
  },
  weekTapHint: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EDF0E8",
    fontSize: 11,
    fontWeight: "700",
    color: "#197768",
  },
  weekDisclaimer: {
    fontSize: 11,
    lineHeight: 17,
    color: "#7A8982",
    marginTop: 18,
  },
  footer: {
    alignItems: "center",
    paddingTop: 26,
    gap: 5,
  },
  footerBrand: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#48675F",
  },
  footerText: {
    fontSize: 11,
    color: "#87928A",
  },
});
