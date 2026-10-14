import { Router, type IRouter } from "express";
import {
  CreateCalendarEventBody,
  CreateCalendarEventResponse,
  GetCalendarEventsQueryParams,
  GetCalendarEventsResponse,
  GetFreeSlotsQueryParams,
  GetFreeSlotsResponse,
  SyncNotionAndCalendarResponse,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { appSettingsTable, db } from "@workspace/db";
import { getAuthenticatedUserId } from "../middlewares/requireOwner";
import { connectorRequest } from "../lib/connectors";
import {
  addCalendarDays,
  getIndiaDate,
  getIndiaDateTimeBounds,
  INDIA_TIME_ZONE,
  indiaDateTime,
} from "../lib/india-time";
import { getOrCreateSettings } from "../lib/settings";
import {
  getNotionDatabase,
  makeNotionPageProperties,
  pageToNotionItem,
  queryNotionDatabase,
  validateNotionDatabaseId,
  type NotionPage,
} from "../lib/notion";

const router: IRouter = Router();

type GoogleEvent = {
  id?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  updated?: string;
  status?: string;
  extendedProperties?: { private?: Record<string, string> };
};

type GoogleEventsPage = {
  items?: GoogleEvent[];
  nextPageToken?: string;
};

function getCalendarPath(calendarId: string): string {
  return `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
}

function normalizeCalendarTime(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return `${value.length === 16 ? `${value}:00` : value}+05:30`;
  }
  throw new Error("Calendar event times must be ISO date-time values.");
}

function calendarEventStart(event: GoogleEvent): string {
  if (event.start?.dateTime) {
    return event.start.dateTime;
  }
  if (event.start?.date) {
    return new Date(`${event.start.date}T00:00:00+05:30`).toISOString();
  }
  return new Date(0).toISOString();
}

function calendarEventEnd(event: GoogleEvent): string {
  if (event.end?.dateTime) {
    return event.end.dateTime;
  }
  if (event.end?.date) {
    return new Date(`${event.end.date}T00:00:00+05:30`).toISOString();
  }
  return calendarEventStart(event);
}

function toCalendarEvent(event: GoogleEvent) {
  return {
    id: event.id ?? "",
    title: event.summary ?? "Untitled event",
    start: new Date(calendarEventStart(event)),
    end: new Date(calendarEventEnd(event)),
    allDay: Boolean(event.start?.date),
    description: event.description ?? null,
  };
}

async function listGoogleEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  privateExtendedProperty?: string,
): Promise<GoogleEvent[]> {
  const allEvents: GoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({
      timeMin,
      timeMax,
      timeZone: INDIA_TIME_ZONE,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
    });
    if (pageToken) query.set("pageToken", pageToken);
    if (privateExtendedProperty) {
      query.set("privateExtendedProperty", privateExtendedProperty);
    }
    const page = await connectorRequest<GoogleEventsPage>(
      "google-calendar",
      `${getCalendarPath(calendarId)}?${query.toString()}`,
      "GET",
    );
    allEvents.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return allEvents;
}

function indiaTimeParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
  };
}

function getEventStartDate(event: GoogleEvent): string | null {
  return event.start?.dateTime ?? event.start?.date ?? null;
}

function taskCalendarDate(dueDate: string) {
  const isDateOnly = dueDate.endsWith("T00:00:00.000Z");
  const date = dueDate.slice(0, 10);
  if (isDateOnly) {
    return {
      start: { date },
      end: { date: addCalendarDays(date, 1) },
    };
  }
  const start = normalizeCalendarTime(dueDate);
  const end = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
  return {
    start: { dateTime: start, timeZone: INDIA_TIME_ZONE },
    end: { dateTime: end, timeZone: INDIA_TIME_ZONE },
  };
}

router.get("/calendar/events", async (req, res): Promise<void> => {
  const params = GetCalendarEventsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const settings = await getOrCreateSettings(getAuthenticatedUserId(req));
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + params.data.days * 24 * 60 * 60 * 1000).toISOString();
  const events = await listGoogleEvents(settings.calendarId, timeMin, timeMax);
  res.json(
    GetCalendarEventsResponse.parse(
      events
        .filter((event) => event.status !== "cancelled")
        .map((event) => toCalendarEvent(event)),
    ),
  );
});

router.post("/calendar/events", async (req, res): Promise<void> => {
  const parsed = CreateCalendarEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const start = normalizeCalendarTime(parsed.data.start);
  const end = normalizeCalendarTime(parsed.data.end);
  if (new Date(start).getTime() >= new Date(end).getTime()) {
    res.status(400).json({ error: "The event must end after it starts." });
    return;
  }
  const settings = await getOrCreateSettings(getAuthenticatedUserId(req));
  const event = await connectorRequest<GoogleEvent>(
    "google-calendar",
    getCalendarPath(settings.calendarId),
    "POST",
    {
      summary: parsed.data.title,
      description: parsed.data.description ?? "",
      start: { dateTime: start, timeZone: INDIA_TIME_ZONE },
      end: { dateTime: end, timeZone: INDIA_TIME_ZONE },
    },
  );
  res.status(201).json(
    CreateCalendarEventResponse.parse(toCalendarEvent(event)),
  );
});

router.get("/calendar/free-slots", async (req, res): Promise<void> => {
  const params = GetFreeSlotsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const settings = await getOrCreateSettings(getAuthenticatedUserId(req));
  const firstDate = getIndiaDate();
  const lastDate = getIndiaDate(params.data.days);
  const { start: rangeStart, end: rangeEnd } = getIndiaDateTimeBounds(
    firstDate,
    settings.dayStartHour,
    24,
  );
  const endOfRange = getIndiaDateTimeBounds(
    lastDate,
    settings.dayStartHour,
    24,
  ).end;
  const events = await listGoogleEvents(
    settings.calendarId,
    rangeStart.toISOString(),
    endOfRange.toISOString(),
  );
  const slots: Array<{ start: Date; end: Date; durationMinutes: number }> = [];

  for (let dayOffset = 0; dayOffset < params.data.days; dayOffset += 1) {
    const date = getIndiaDate(dayOffset);
    const window = getIndiaDateTimeBounds(
      date,
      settings.dayStartHour,
      settings.dayEndHour,
    );
    let start = window.start;
    if (dayOffset === 0) {
      const now = indiaTimeParts();
      const nowMinutes = now.hour * 60 + now.minute;
      const roundedMinutes = Math.ceil(nowMinutes / 30) * 30;
      if (roundedMinutes >= 24 * 60) {
        continue;
      }
      const nextStart = new Date(
        indiaDateTime(date, Math.floor(roundedMinutes / 60), roundedMinutes % 60),
      );
      if (nextStart > start) {
        start = nextStart;
      }
    }
    const end = window.end;
    if (start >= end) continue;

    const occupied = events
      .filter((event) => event.status !== "cancelled" && event.start && event.end)
      .map((event) => ({
        start: new Date(calendarEventStart(event)),
        end: new Date(calendarEventEnd(event)),
      }))
      .filter((event) => event.start < end && event.end > start)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let cursor = start;
    for (const event of occupied) {
      const busyStart = event.start < start ? start : event.start;
      const busyEnd = event.end > end ? end : event.end;
      const durationMinutes = Math.floor((busyStart.getTime() - cursor.getTime()) / 60000);
      if (durationMinutes >= 30) {
        slots.push({
          start: cursor,
          end: busyStart,
          durationMinutes,
        });
      }
      if (busyEnd > cursor) {
        cursor = busyEnd;
      }
    }
    const remainingMinutes = Math.floor((end.getTime() - cursor.getTime()) / 60000);
    if (remainingMinutes >= 30) {
      slots.push({
        start: cursor,
        end,
        durationMinutes: remainingMinutes,
      });
    }
  }

  res.json(GetFreeSlotsResponse.parse(slots));
});

router.post("/calendar/sync", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const settings = await getOrCreateSettings(userId);
  const tasksDatabaseId = validateNotionDatabaseId(settings.notionTasksDatabaseId);
  const database = await getNotionDatabase(tasksDatabaseId);
  const notionPages = await queryNotionDatabase(tasksDatabaseId);
  const pages = notionPages.map((page) => ({
    page,
    item: pageToNotionItem(page),
  }));

  const eventStart = new Date(`${getIndiaDate(-30)}T00:00:00+05:30`);
  const eventEnd = new Date(`${getIndiaDate(365)}T23:59:00+05:30`);
  const events = await listGoogleEvents(
    settings.calendarId,
    eventStart.toISOString(),
    eventEnd.toISOString(),
    "syncSource=notion",
  );
  const eventByPageId = new Map<string, GoogleEvent>();
  for (const event of events) {
    const pageId = event.extendedProperties?.private?.notionPageId;
    if (pageId && event.id) eventByPageId.set(pageId, event);
  }

  let notionToCalendarCreated = 0;
  let notionToCalendarUpdated = 0;
  let calendarToNotionUpdated = 0;
  let unchanged = 0;

  for (const { page, item } of pages) {
    if (!item.dueDate) {
      unchanged += 1;
      continue;
    }
    const existing = eventByPageId.get(page.id);
    const scheduled = taskCalendarDate(item.dueDate);
    const privateProperties = {
      notionPageId: page.id,
      syncSource: "notion",
    };

    if (!existing?.id) {
      await connectorRequest<GoogleEvent>(
        "google-calendar",
        getCalendarPath(settings.calendarId),
        "POST",
        {
          summary: item.title,
          description: page.url ? `Notion task: ${page.url}` : "",
          ...scheduled,
          extendedProperties: { private: privateProperties },
        },
      );
      notionToCalendarUpdated += 1;
      continue;
    }

    const existingStart = getEventStartDate(existing);
    const notionDueDate = item.dueDate.slice(0, 10);
    const calendarDate = existingStart?.slice(0, 10);
    const contentMatches =
      (existing.summary ?? "") === item.title && calendarDate === notionDueDate;
    if (contentMatches) {
      unchanged += 1;
      continue;
    }

    const notionUpdatedAt = new Date(page.last_edited_time ?? 0).getTime();
    const calendarUpdatedAt = new Date(existing.updated ?? 0).getTime();
    if (notionUpdatedAt >= calendarUpdatedAt) {
      await connectorRequest<GoogleEvent>(
        "google-calendar",
        `${getCalendarPath(settings.calendarId)}/${encodeURIComponent(existing.id)}`,
        "PATCH",
        { summary: item.title, ...scheduled },
      );
      notionToCalendarCreated += 1;
      continue;
    }

    const calendarDueDate =
      existing.start?.dateTime ?? existing.start?.date ?? item.dueDate;
    const updateProperties = makeNotionPageProperties(database, {
      title: existing.summary ?? item.title,
      dueDate: calendarDueDate,
    });
    await connectorRequest<NotionPage>(
      "notion",
      `/v1/pages/${encodeURIComponent(page.id)}`,
      "PATCH",
      { properties: updateProperties },
    );
    calendarToNotionUpdated += 1;
  }

  res.json(
    SyncNotionAndCalendarResponse.parse({
      notionToCalendarCreated,
      notionToCalendarUpdated,
      calendarToNotionUpdated,
      unchanged,
      message: "Notion tasks and linked Google Calendar events are up to date.",
    }),
  );
});

export default router;
