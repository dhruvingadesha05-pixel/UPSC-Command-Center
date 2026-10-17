import { and, asc, eq, gte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AutoScheduleSubjectsResponse,
  CreateSubjectBody,
  CreateSubjectResponse,
  CreateSubjectTopicBody,
  CreateSubjectTopicResponse,
  GetSubjectsResponse,
  UpdateSubjectBody,
  UpdateSubjectParams,
  UpdateSubjectResponse,
  UpdateSubjectTopicBody,
  UpdateSubjectTopicParams,
  UpdateSubjectTopicResponse,
} from "@workspace/api-zod";
import {
  db,
  subjectModulesTable,
  subjectTopicsTable,
} from "@workspace/db";
import { getAuthenticatedUserId } from "../middlewares/requireOwner";
import { connectorRequest } from "../lib/connectors";
import {
  addCalendarDays,
  getIndiaDate,
  INDIA_TIME_ZONE,
  indiaDateTime,
} from "../lib/india-time";
import { getOrCreateSettings } from "../lib/settings";

const router: IRouter = Router();

type GoogleEvent = {
  id?: string;
  summary?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

function dateOnly(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function moduleResponse(
  module: typeof subjectModulesTable.$inferSelect,
  topics: Array<typeof subjectTopicsTable.$inferSelect>,
) {
  return {
    id: module.id,
    title: module.title,
    startDate: module.startDate,
    endDate: module.endDate,
    estimatedHours: module.estimatedHours,
    status: module.status as "planned" | "in-progress" | "complete",
    topics: topics.map((topic) => ({
      id: topic.id,
      moduleId: topic.moduleId,
      title: topic.title,
      completed: topic.completed,
      estimatedHours: topic.estimatedHours,
    })),
  };
}

async function getModule(userId: string, moduleId: number) {
  const [module] = await db
    .select()
    .from(subjectModulesTable)
    .where(
      and(
        eq(subjectModulesTable.id, moduleId),
        eq(subjectModulesTable.userId, userId),
      ),
    )
    .limit(1);
  if (!module) return null;
  const topics = await db
    .select()
    .from(subjectTopicsTable)
    .where(
      and(
        eq(subjectTopicsTable.moduleId, moduleId),
        eq(subjectTopicsTable.userId, userId),
      ),
    )
    .orderBy(asc(subjectTopicsTable.id));
  return moduleResponse(module, topics);
}

function dateRangeValid(start: string, end: string) {
  return start <= end;
}

router.get("/subjects", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const [modules, topics] = await Promise.all([
    db
      .select()
      .from(subjectModulesTable)
      .where(eq(subjectModulesTable.userId, userId))
      .orderBy(asc(subjectModulesTable.startDate)),
    db
      .select()
      .from(subjectTopicsTable)
      .where(eq(subjectTopicsTable.userId, userId))
      .orderBy(asc(subjectTopicsTable.id)),
  ]);
  const response = modules.map((module) =>
    moduleResponse(
      module,
      topics.filter((topic) => topic.moduleId === module.id),
    ),
  );
  GetSubjectsResponse.parse(
    response.map((module) => ({
      ...module,
      startDate: new Date(`${module.startDate}T00:00:00.000Z`),
      endDate: new Date(`${module.endDate}T00:00:00.000Z`),
    })),
  );
  res.json(response);
});

router.post("/subjects", async (req, res): Promise<void> => {
  const parsed = CreateSubjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const startDate = dateOnly(parsed.data.startDate);
  const endDate = dateOnly(parsed.data.endDate);
  if (!dateRangeValid(startDate, endDate)) {
    res.status(400).json({ error: "The subject must end on or after its start date." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [moduleId] = await db.transaction(async (tx) => {
    const [module] = await tx
      .insert(subjectModulesTable)
      .values({
        userId,
        title: parsed.data.title.trim(),
        startDate,
        endDate,
        estimatedHours: parsed.data.estimatedHours,
        status: "planned",
      })
      .returning({ id: subjectModulesTable.id });
    const topics = (parsed.data.topics ?? [])
      .map((title) => title.trim())
      .filter(Boolean);
    if (topics.length) {
      await tx.insert(subjectTopicsTable).values(
        topics.map((title) => ({
          userId,
          moduleId: module.id,
          title,
          completed: false,
          estimatedHours: null,
        })),
      );
    }
    return [module.id];
  });
  const response = await getModule(userId, moduleId);
  if (!response) {
    res.status(500).json({ error: "The subject could not be loaded after saving." });
    return;
  }
  res.status(201).json(
    CreateSubjectResponse.parse({
      ...response,
      startDate: new Date(`${response.startDate}T00:00:00.000Z`),
      endDate: new Date(`${response.endDate}T00:00:00.000Z`),
    }),
  );
});

router.patch("/subjects/:id", async (req, res): Promise<void> => {
  const params = UpdateSubjectParams.safeParse(req.params);
  const parsed = UpdateSubjectBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [current] = await db
    .select()
    .from(subjectModulesTable)
    .where(
      and(
        eq(subjectModulesTable.id, params.data.id),
        eq(subjectModulesTable.userId, userId),
      ),
    )
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Subject module not found." });
    return;
  }
  const { startDate, endDate, ...otherChanges } = parsed.data;
  const nextStartDate = startDate ? dateOnly(startDate) : current.startDate;
  const nextEndDate = endDate ? dateOnly(endDate) : current.endDate;
  if (!dateRangeValid(nextStartDate, nextEndDate)) {
    res.status(400).json({ error: "The subject must end on or after its start date." });
    return;
  }
  await db
    .update(subjectModulesTable)
    .set({
      ...otherChanges,
      ...(startDate ? { startDate: nextStartDate } : {}),
      ...(endDate ? { endDate: nextEndDate } : {}),
    })
    .where(
      and(
        eq(subjectModulesTable.id, params.data.id),
        eq(subjectModulesTable.userId, userId),
      ),
    );
  const response = await getModule(userId, params.data.id);
  if (!response) {
    res.status(404).json({ error: "Subject module not found." });
    return;
  }
  res.json(
    UpdateSubjectResponse.parse({
      ...response,
      startDate: new Date(`${response.startDate}T00:00:00.000Z`),
      endDate: new Date(`${response.endDate}T00:00:00.000Z`),
    }),
  );
});

router.post("/subject-topics", async (req, res): Promise<void> => {
  const parsed = CreateSubjectTopicBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [module] = await db
    .select({ id: subjectModulesTable.id })
    .from(subjectModulesTable)
    .where(
      and(
        eq(subjectModulesTable.id, parsed.data.moduleId),
        eq(subjectModulesTable.userId, userId),
      ),
    )
    .limit(1);
  if (!module) {
    res.status(404).json({ error: "Subject module not found." });
    return;
  }
  const [topic] = await db
    .insert(subjectTopicsTable)
    .values({
      userId,
      moduleId: module.id,
      title: parsed.data.title.trim(),
      completed: false,
      estimatedHours: parsed.data.estimatedHours ?? null,
    })
    .returning();
  const response = {
    id: topic.id,
    moduleId: topic.moduleId,
    title: topic.title,
    completed: topic.completed,
    estimatedHours: topic.estimatedHours,
  };
  res.status(201).json(CreateSubjectTopicResponse.parse(response));
});

router.patch("/subject-topics/:id", async (req, res): Promise<void> => {
  const params = UpdateSubjectTopicParams.safeParse(req.params);
  const parsed = UpdateSubjectTopicBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [topic] = await db
    .update(subjectTopicsTable)
    .set(parsed.data)
    .where(
      and(
        eq(subjectTopicsTable.id, params.data.id),
        eq(subjectTopicsTable.userId, userId),
      ),
    )
    .returning();
  if (!topic) {
    res.status(404).json({ error: "Subject topic not found." });
    return;
  }
  res.json(
    UpdateSubjectTopicResponse.parse({
      id: topic.id,
      moduleId: topic.moduleId,
      title: topic.title,
      completed: topic.completed,
      estimatedHours: topic.estimatedHours,
    }),
  );
});

router.post("/subjects/auto-schedule", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const settings = await getOrCreateSettings(userId);
  const [modules, topics] = await Promise.all([
    db.select().from(subjectModulesTable).where(eq(subjectModulesTable.userId, userId)),
    db.select().from(subjectTopicsTable).where(eq(subjectTopicsTable.userId, userId)),
  ]);
  const moduleMap = new Map(modules.map((module) => [module.id, module]));
  const candidates = topics
    .filter((topic) => !topic.completed)
    .map((topic) => ({ topic, module: moduleMap.get(topic.moduleId) }))
    .filter((item): item is { topic: typeof topics[number]; module: typeof modules[number] } => Boolean(item.module))
    .sort((a, b) => a.module.startDate.localeCompare(b.module.startDate));

  const today = getIndiaDate();
  const calendarStart = new Date(`${today}T00:00:00+05:30`).toISOString();
  const calendarEnd = new Date(`${getIndiaDate(365)}T23:59:00+05:30`).toISOString();
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({
      timeMin: calendarStart,
      timeMax: calendarEnd,
      timeZone: INDIA_TIME_ZONE,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
    });
    if (pageToken) query.set("pageToken", pageToken);
    const page = await connectorRequest<{ items?: GoogleEvent[]; nextPageToken?: string }>(
      "google-calendar",
      `/calendar/v3/calendars/${encodeURIComponent(settings.calendarId)}/events?${query.toString()}`,
      "GET",
    );
    events.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  const alreadyScheduled = new Set(
    events
      .map((event) => event.extendedProperties?.private?.upscSubjectTopicId)
      .filter((id): id is string => Boolean(id)),
  );
  const busy = events
    .filter((event) => event.status !== "cancelled")
    .map((event) => {
      const start = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
          ? new Date(`${event.start.date}T00:00:00+05:30`)
          : null;
      const end = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : event.end?.date
          ? new Date(`${event.end.date}T00:00:00+05:30`)
          : null;
      return start && end ? { start, end } : null;
    })
    .filter((item): item is { start: Date; end: Date } => Boolean(item));

  const assignments: Array<{
    topicId: number;
    topicTitle: string;
    subjectTitle: string;
    eventId: string;
    start: string;
    end: string;
  }> = [];
  const scheduledTopics = new Set(alreadyScheduled);

  for (const { topic, module } of candidates) {
    if (scheduledTopics.has(String(topic.id))) continue;
    const moduleTopics = topics.filter(
      (item) => item.moduleId === module.id && !item.completed,
    );
    const durationHours =
      topic.estimatedHours ??
      Math.max(1, module.estimatedHours / Math.max(1, moduleTopics.length));
    const durationMinutes = Math.ceil(durationHours * 60 / 30) * 30;
    const dayWindowMinutes =
      (settings.dayEndHour - settings.dayStartHour) * 60;
    if (durationMinutes > dayWindowMinutes) continue;

    let assignedStart: Date | null = null;
    for (
      let date = module.startDate < today ? today : module.startDate;
      date <= module.endDate && date <= getIndiaDate(365);
      date = addCalendarDays(date, 1)
    ) {
      let startMinute = settings.dayStartHour * 60;
      if (date === today) {
        const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone: INDIA_TIME_ZONE,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).formatToParts(new Date());
        const currentMinutes =
          Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 +
          Number(parts.find((part) => part.type === "minute")?.value ?? 0);
        startMinute = Math.max(
          startMinute,
          Math.ceil(currentMinutes / 30) * 30,
        );
      }
      for (
        let minute = startMinute;
        minute + durationMinutes <= settings.dayEndHour * 60;
        minute += 30
      ) {
        const start = new Date(
          indiaDateTime(date, Math.floor(minute / 60), minute % 60),
        );
        const end = new Date(start.getTime() + durationMinutes * 60000);
        if (!busy.some((block) => block.start < end && block.end > start)) {
          assignedStart = start;
          break;
        }
      }
      if (assignedStart) break;
    }
    if (!assignedStart) continue;
    const assignedEnd = new Date(
      assignedStart.getTime() + durationMinutes * 60000,
    );
    const event = await connectorRequest<GoogleEvent>(
      "google-calendar",
      `/calendar/v3/calendars/${encodeURIComponent(settings.calendarId)}/events`,
      "POST",
      {
        summary: `${module.title}: ${topic.title}`,
        description: `Auto-scheduled study topic. ${durationHours.toFixed(1)} estimated hours.`,
        start: {
          dateTime: assignedStart.toISOString(),
          timeZone: INDIA_TIME_ZONE,
        },
        end: {
          dateTime: assignedEnd.toISOString(),
          timeZone: INDIA_TIME_ZONE,
        },
        extendedProperties: {
          private: {
            upscSubjectTopicId: String(topic.id),
            upscSubjectModuleId: String(module.id),
          },
        },
      },
    );
    if (!event.id) continue;
    busy.push({ start: assignedStart, end: assignedEnd });
    scheduledTopics.add(String(topic.id));
    assignments.push({
      topicId: topic.id,
      topicTitle: topic.title,
      subjectTitle: module.title,
      eventId: event.id,
      start: assignedStart.toISOString(),
      end: assignedEnd.toISOString(),
    });
  }
  const message = assignments.length
    ? `Added ${assignments.length} topic ${assignments.length === 1 ? "session" : "sessions"} to Google Calendar.`
    : "No unassigned topics could be placed in the available calendar window.";
  res.json(
    AutoScheduleSubjectsResponse.parse({
      createdEvents: assignments.length,
      assignments: assignments.map((item) => ({
        ...item,
        start: new Date(item.start),
        end: new Date(item.end),
      })),
      message,
    }),
  );
});

export default router;
