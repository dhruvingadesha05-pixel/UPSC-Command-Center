import { and, desc, eq, gte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateSprintTaskBody,
  CreateSprintTaskResponse,
  CreateStudyLogBody,
  CreateStudyLogResponse,
  GetSprintTasksResponse,
  GetStudyLogsQueryParams,
  GetStudyLogsResponse,
  UpdateSprintTaskBody,
  UpdateSprintTaskParams,
  UpdateSprintTaskResponse,
} from "@workspace/api-zod";
import {
  db,
  sprintTasksTable,
  studyLogsTable,
} from "@workspace/db";
import { getAuthenticatedUserId } from "../middlewares/requireOwner";
import { getIndiaDate } from "../lib/india-time";

const router: IRouter = Router();

const defaultSprint = [
  ["Polity", "Constitution foundations", "Revise Preamble, salient features, and sources", "high"],
  ["Polity", "Fundamental Rights", "Revise Articles 12–35 and solve 25 questions", "high"],
  ["Polity", "Directive Principles", "Map DPSPs to constitutional articles", "medium"],
  ["Polity", "Parliament", "Review sessions, committees, and privileges", "high"],
  ["Polity", "Executive", "Compare President, Governor, and Council of Ministers", "medium"],
  ["History", "Modern India", "Revise 1857–1919 timeline and key acts", "high"],
  ["History", "Freedom movement", "Make a one-page movement chronology", "high"],
  ["Geography", "Indian physical geography", "Revise rivers, ranges, and monsoon systems", "medium"],
  ["Geography", "Mapping practice", "Complete one India map-recall set", "medium"],
  ["Economy", "Macroeconomic basics", "Review inflation, GDP, fiscal and monetary policy", "high"],
  ["Economy", "Budget and survey", "Summarize current-year policy highlights", "medium"],
  ["Environment", "Ecology", "Review ecosystems, biodiversity, and protected areas", "medium"],
  ["Science", "Current science", "Revise a focused set of recent science updates", "low"],
  ["CSAT", "Aptitude practice", "Complete one timed reasoning and numeracy set", "medium"],
  ["Review", "Sprint checkpoint", "Review errors and carry unfinished targets forward", "high"],
] as const;

async function ensureSprint(userId: string) {
  const existing = await db
    .select({ id: sprintTasksTable.id })
    .from(sprintTasksTable)
    .where(eq(sprintTasksTable.userId, userId))
    .limit(1);
  if (existing.length > 0) {
    return;
  }
  await db.insert(sprintTasksTable).values(
    defaultSprint.map(([subject, title, target, priority], index) => ({
      userId,
      dayNumber: index + 1,
      title,
      subject,
      target,
      priority,
      completed: false,
    })),
  );
}

router.get("/study-logs", async (req, res): Promise<void> => {
  const params = GetStudyLogsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const fromDate = getIndiaDate(-params.data.days + 1);
  const rows = await db
    .select()
    .from(studyLogsTable)
    .where(and(eq(studyLogsTable.userId, userId), gte(studyLogsTable.date, fromDate)))
    .orderBy(desc(studyLogsTable.date), desc(studyLogsTable.createdAt));
  const response = rows.map((row) => ({
    id: row.id,
    date: row.date,
    subject: row.subject,
    durationMinutes: row.durationMinutes,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }));
  GetStudyLogsResponse.parse(
    response.map((row) => ({
      ...row,
      date: new Date(`${row.date}T00:00:00.000Z`),
      createdAt: new Date(row.createdAt),
    })),
  );
  res.json(response);
});

router.post("/study-logs", async (req, res): Promise<void> => {
  const parsed = CreateStudyLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [row] = await db
    .insert(studyLogsTable)
    .values({
      ...parsed.data,
      date: parsed.data.date.toISOString().slice(0, 10),
      userId,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  const response = {
    id: row.id,
    date: row.date,
    subject: row.subject,
    durationMinutes: row.durationMinutes,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
  CreateStudyLogResponse.parse({
    ...response,
    date: new Date(`${response.date}T00:00:00.000Z`),
    createdAt: new Date(response.createdAt),
  });
  res.status(201).json(response);
});

router.get("/sprint-tasks", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  await ensureSprint(userId);
  const rows = await db
    .select()
    .from(sprintTasksTable)
    .where(eq(sprintTasksTable.userId, userId))
    .orderBy(sprintTasksTable.dayNumber, sprintTasksTable.id);
  res.json(GetSprintTasksResponse.parse(rows));
});

router.post("/sprint-tasks", async (req, res): Promise<void> => {
  const parsed = CreateSprintTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [row] = await db
    .insert(sprintTasksTable)
    .values({ ...parsed.data, userId, completed: false })
    .returning();
  res.status(201).json(CreateSprintTaskResponse.parse(row));
});

router.patch("/sprint-tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateSprintTaskParams.safeParse(req.params);
  const parsed = UpdateSprintTaskBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [row] = await db
    .update(sprintTasksTable)
    .set(parsed.data)
    .where(
      and(
        eq(sprintTasksTable.id, params.data.id),
        eq(sprintTasksTable.userId, userId),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Sprint target not found." });
    return;
  }
  res.json(UpdateSprintTaskResponse.parse(row));
});

export default router;
