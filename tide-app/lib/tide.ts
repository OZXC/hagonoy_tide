
const API_BASE_URL = "http://192.168.100.4:8000";

export type TideExtreme = {
  type: "HIGH" | "LOW";
  time: string;
  height: number;
};

type TideApiResponse = {
  location: {
    id: string;
    name: string;
    province: string;
    country: string;
  };
  date: string;
  timezone: string;
  events: {
    type: "HIGH" | "LOW";
    time: string;
    height_m: number;
  }[];
};

export type TideTimelinePoint = {
  time: string;
  height_m: number;
};

type TideTimelineResponse = {
  date: string;
  timeline: TideTimelinePoint[];
};

export function getManilaDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));

  return [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, "0"),
    String(result.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export async function fetchTodayTides(
  date: string = getManilaDate()
): Promise<TideExtreme[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/tides/hagonoy?date=${date}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch tides: ${response.status}`);
  }

  const data: TideApiResponse = await response.json();

  return data.events.map((event) => ({
    type: event.type,
    time: event.time,
    height: event.height_m,
  }));
}

export async function fetchTodayTimeline(
  date: string = getManilaDate()
): Promise<TideTimelinePoint[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/tides/hagonoy/timeline?date=${date}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch tide timeline: ${response.status}`
    );
  }

  const data: TideTimelineResponse = await response.json();

  return data.timeline;
}

export function getCurrentPredictedLevel(
  timeline: TideTimelinePoint[],
  now: Date = new Date()
): number | null {
  const targetTime = now.getTime();

  const validPoints = timeline
    .map((point) => ({
      ...point,
      timestamp: new Date(point.time).getTime(),
    }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (validPoints.length === 0) {
    return null;
  }

  let closest = validPoints[0];
  let closestDifference = Math.abs(
    closest.timestamp - targetTime
  );

  for (const point of validPoints.slice(1)) {
    const difference = Math.abs(
      point.timestamp - targetTime
    );

    if (difference < closestDifference) {
      closest = point;
      closestDifference = difference;
    }
  }

  // Don't present an old or distant reading as the current level.
  if (closestDifference > 90 * 60 * 1000) {
    return null;
  }

  return closest.height_m;
}

export type TideDirection = "rising" | "falling";

export type TideStatus = {
  direction: TideDirection;
  next: TideExtreme | null;
};

export function getTideStatus(
  extremes: TideExtreme[],
  nowMs: number = Date.now()
): TideStatus | null {
  if (extremes.length === 0) return null;

  const sorted = [...extremes].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  const next = sorted.find((e) => new Date(e.time).getTime() > nowMs) ?? null;

  if (next) {
    return { direction: next.type === "HIGH" ? "rising" : "falling", next };
  }

  const last = sorted[sorted.length - 1];
  return { direction: last.type === "HIGH" ? "falling" : "rising", next: null };
}

export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}


export function getTideDirection(
  timeline: TideTimelinePoint[],
  nowMs: number = Date.now()
): TideDirection | null {
  const points = timeline
    .map((point) => ({
      time: new Date(point.time).getTime(),
      height: point.height_m,
    }))
    .filter(
      (point) =>
        Number.isFinite(point.time) &&
        Number.isFinite(point.height)
    )
    .sort((a, b) => a.time - b.time);

  if (points.length < 2) return null;

  // Find the most recent point at or before now,
  // and the next predicted point after now.
  let previous = -1;

  for (let i = 0; i < points.length; i++) {
    if (points[i].time <= nowMs) {
      previous = i;
    } else {
      break;
    }
  }

  let first: number;
  let second: number;

  if (previous >= 0 && previous < points.length - 1) {
    first = previous;
    second = previous + 1;
  } else if (previous === -1) {
    first = 0;
    second = 1;
  } else {
    first = points.length - 2;
    second = points.length - 1;
  }

  const difference =
    points[second].height - points[first].height;

  if (difference > 0.015) return "rising";
  if (difference < -0.015) return "falling";

  // Avoid claiming a direction when the change is negligible.
  return null;
}
