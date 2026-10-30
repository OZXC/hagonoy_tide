
# backend/openwaters.py

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import httpx

BASE_URL = "https://api.openwaters.io/tides"
SOURCE_ID = "ticon"
STATION_ID = "manila-370a-phl-uhslc_rq"

PH_TIMEZONE = ZoneInfo("Asia/Manila")
TIMEOUT_SECONDS = 15.0
url = (
    f"{BASE_URL}/stations/"
    f"{SOURCE_ID}/{STATION_ID}/extremes"
)

def raise_for_upstream_error(response: httpx.Response) -> None:
    try:
        response.raise_for_status()  # Check the HTTP response status
    except httpx.HTTPStatusError:
        print(
            "OpenWaters API error:",
            response.status_code,
            response.text[:1000],
        )
        raise  # Re-raise the original exception


def get_day_range(selected_date: date) -> tuple[str, str]:
    """Return the selected day's start and end in Philippine time."""
    start = datetime.combine(
        selected_date, time.min, tzinfo=PH_TIMEZONE
    )
    end = start + timedelta(days=1)

    return start.isoformat(), end.isoformat()


def to_ph_time(value: str) -> datetime:
    """Parse an ISO timestamp and convert it to Philippine time."""
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)

    # If the API omits a timezone, treat the value as Philippine time.
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=PH_TIMEZONE)

    return parsed.astimezone(PH_TIMEZONE)


async def fetch_extremes(selected_date: date) -> dict:
    start, end = get_day_range(selected_date)

    url = (
        f"{BASE_URL}/stations/"
        f"{SOURCE_ID}/{STATION_ID}/extremes"
    )

    params = {
        "start": start,
        "end": end,
        "units": "meters",
    }

    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        response = await client.get(url, params=params)
        raise_for_upstream_error(response)
        payload = response.json()

    events = []

    for item in payload.get("extremes", []):
        is_high = item.get("high", False)
        is_low = item.get("low", False)

        # Only include actual high/low tide extremes.
        if not is_high and not is_low:
            continue

        local_time = to_ph_time(item["time"])

        # The API range is based on timestamps, so filter by the
        # Philippine calendar date for the app's selected day.
        if local_time.date() != selected_date:
            continue

        events.append({
            "type": "HIGH" if is_high else "LOW",
            "time": local_time.strftime("%H:%M"),
            "height_m": float(item["level"]),
        })

    events.sort(key=lambda event: event["time"])

    return {
        "date": selected_date.isoformat(),
        "events": events,
    }


async def fetch_timeline(selected_date: date) -> dict:
    start, end = get_day_range(selected_date)

    url = (
        f"{BASE_URL}/stations/"
        f"{SOURCE_ID}/{STATION_ID}/timeline"
    )

    params = {
        "start": start,
        "end": end,
        "units": "meters",
    }

    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        response = await client.get(url, params=params)
        raise_for_upstream_error(response)
        payload = response.json()

    timeline = []

    for item in payload.get("timeline", []):
        local_time = to_ph_time(item["time"])

        if local_time.date() != selected_date:
            continue

        timeline.append({
            "time": local_time.isoformat(),
            "height_m": float(item["level"]),
        })

    timeline.sort(key=lambda item: item["time"])

    return {
        "date": selected_date.isoformat(),
        "timeline": timeline,
    }
