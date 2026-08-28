import { endOfDay, format, startOfDay } from "date-fns";
import { deviceApi } from "@/api/client";
import { ACS_EVENT_PATH } from "@/lib/hikvisionConfig";
import type { AcsEventInfo, AcsEventResponse, AttendanceRow, AttendanceStats } from "@/types/acsEvent";

const WORK_START_HOUR = Number(import.meta.env.VITE_WORK_START_HOUR ?? 9);
const WORK_START_MINUTE = Number(import.meta.env.VITE_WORK_START_MINUTE ?? 0);
const EXPECTED_EMPLOYEES = Number(import.meta.env.VITE_EXPECTED_EMPLOYEES ?? 0);
const PAGE_SIZE = 30;
const HIKVISION_TIMEZONE = (import.meta.env.VITE_HIKVISION_TIMEZONE as string | undefined)?.trim() || "+05:00";

export function buildTodayRange(date = new Date()) {
  const start = startOfDay(date);
  const end = endOfDay(date);
  return {
    startTime: `${format(start, "yyyy-MM-dd")}T00:00:00${HIKVISION_TIMEZONE}`,
    endTime: `${format(end, "yyyy-MM-dd")}T23:59:59${HIKVISION_TIMEZONE}`,
  };
}

export function buildAcsEventPayload(
  date = new Date(),
  maxResults = PAGE_SIZE,
  searchResultPosition = 0,
) {
  const { startTime, endTime } = buildTodayRange(date);
  return {
    startTime,
    endTime,
    maxResults,
    searchResultPosition,
    major: 5,
    minor: 75,
  };
}

function normalizeInfoList(list: AcsEventInfo | AcsEventInfo[] | undefined): AcsEventInfo[] {
  if (!list) return [];
  return Array.isArray(list) ? list : [list];
}

export async function fetchAcsEvents(date = new Date()) {
  const allEvents: AcsEventInfo[] = [];
  let position = 0;
  let totalMatches = 0;
  let status = "UNKNOWN";
  let mock: false | "force" | "fallback" = false;

  while (true) {
    const result = await deviceApi<AcsEventResponse>(ACS_EVENT_PATH, {
      method: "POST",
      body: JSON.stringify(buildAcsEventPayload(date, PAGE_SIZE, position)),
    });

    mock = result.mock;
    const acs = result.data.AcsEvent;

    if (!acs || acs.responseStatusStrg === "NO MATCHES") {
      break;
    }

    if (acs.responseStatusStrg && acs.responseStatusStrg !== "OK") {
      throw new Error(`Kamera javobi: ${acs.responseStatusStrg}`);
    }

    totalMatches = acs.totalMatches ?? 0;
    status = acs.responseStatusStrg ?? status;

    const page = normalizeInfoList(acs.InfoList);
    allEvents.push(...page);

    if (page.length === 0 || allEvents.length >= totalMatches || page.length < PAGE_SIZE) {
      break;
    }

    position += page.length;
  }

  return {
    data: {
      AcsEvent: {
        searchID: "1",
        totalMatches: totalMatches || allEvents.length,
        responseStatusStrg: status,
        numOfMatches: allEvents.length,
        InfoList: allEvents,
      },
    } satisfies AcsEventResponse,
    mock,
  };
}

function splitName(fullName: string): { surname: string; firstName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { surname: "—", firstName: "—" };
  if (parts.length === 1) return { surname: parts[0], firstName: "—" };
  return { surname: parts[0], firstName: parts.slice(1).join(" ") };
}

function parseEventTime(value: string): Date {
  return new Date(value);
}

function formatClock(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return format(date, "HH:mm");
}

function isLateArrival(date: Date): boolean {
  const threshold = new Date(date);
  threshold.setHours(WORK_START_HOUR, WORK_START_MINUTE, 0, 0);
  return date.getTime() > threshold.getTime();
}

function extractPicturePath(pictureURL: string): string {
  // @ path ichida bo'lgani uchun URL() ishlatilmaydi
  const path = pictureURL.replace(/^https?:\/\/[^/]+/, "");
  return path.startsWith("/") ? path : `/${path}`;
}

function pictureProxyPath(pictureURL?: string): string | null {
  if (!pictureURL) return null;
  return `/api/picture?path=${encodeURIComponent(extractPicturePath(pictureURL))}`;
}

function groupEventsByEmployee(events: AcsEventInfo[]): Map<string, AcsEventInfo[]> {
  const grouped = new Map<string, AcsEventInfo[]>();
  for (const event of events) {
    const key = event.employeeNoString || event.name || String(event.serialNo ?? "");
    if (!key) continue;
    const list = grouped.get(key) ?? [];
    list.push(event);
    grouped.set(key, list);
  }
  return grouped;
}

export function mapEventsToAttendance(events: AcsEventInfo[]): { rows: AttendanceRow[]; stats: AttendanceStats } {
  const grouped = groupEventsByEmployee(events);
  const rows: AttendanceRow[] = [];

  for (const [employeeNo, employeeEvents] of grouped) {
    const sorted = [...employeeEvents].sort(
      (a, b) => parseEventTime(a.time).getTime() - parseEventTime(b.time).getTime(),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const arrival = parseEventTime(first.time);
    const departure = sorted.length > 1 ? parseEventTime(last.time) : null;
    const fullName = first.name?.trim() || employeeNo;
    const { surname, firstName } = splitName(fullName);

    rows.push({
      id: employeeNo,
      employeeNo,
      surname,
      firstName,
      department: "—",
      arrivalTime: formatClock(arrival),
      departureTime: formatClock(departure),
      picturePath: pictureProxyPath(first.pictureURL),
      isLate: isLateArrival(arrival),
    });
  }

  rows.sort((a, b) => (a.arrivalTime ?? "").localeCompare(b.arrivalTime ?? ""));

  const arrived = rows.length;
  const late = rows.filter(row => row.isLate).length;
  const onTime = arrived - late;
  const totalEmployees = EXPECTED_EMPLOYEES > 0 ? EXPECTED_EMPLOYEES : arrived;
  const absent = EXPECTED_EMPLOYEES > 0 ? Math.max(EXPECTED_EMPLOYEES - arrived, 0) : 0;

  return {
    rows,
    stats: {
      totalEmployees,
      arrived: onTime,
      late,
      absent,
    },
  };
}

export async function fetchTodayAttendance(date = new Date()) {
  const { data: response, mock } = await fetchAcsEvents(date);
  const events = normalizeInfoList(response.AcsEvent?.InfoList);
  const mapped = mapEventsToAttendance(events);
  return {
    ...mapped,
    rawTotalMatches: response.AcsEvent?.totalMatches ?? events.length,
    status: response.AcsEvent?.responseStatusStrg ?? "UNKNOWN",
    isDemo: mock !== false,
    demoReason: mock,
  };
}
