import { and, desc, eq, gte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateMealLogBody,
  CreateMealLogResponse,
  DeleteMealLogParams,
  GetHealthLogsQueryParams,
  GetHealthLogsResponse,
  GetMealLogsQueryParams,
  GetMealLogsResponse,
  SaveHealthLogBody,
  SaveHealthLogResponse,
} from "@workspace/api-zod";
import { db, healthLogsTable, mealLogsTable } from "@workspace/db";
import { getAuthenticatedUserId } from "../middlewares/requireOwner";
import { getIndiaDate } from "../lib/india-time";

const router: IRouter = Router();

router.get("/health-logs", async (req, res): Promise<void> => {
  const params = GetHealthLogsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const fromDate = getIndiaDate(-params.data.days + 1);
  const rows = await db
    .select()
    .from(healthLogsTable)
    .where(and(eq(healthLogsTable.userId, userId), gte(healthLogsTable.date, fromDate)))
    .orderBy(desc(healthLogsTable.date));
  GetHealthLogsResponse.parse(
    rows.map((row) => ({
      ...row,
      date: new Date(`${row.date}T00:00:00.000Z`),
    })),
  );
  res.json(rows);
});

router.post("/health-logs", async (req, res): Promise<void> => {
  const parsed = SaveHealthLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const { date: parsedDate, ...changes } = parsed.data;
  const date = parsedDate.toISOString().slice(0, 10);
  const updateValues: Partial<typeof healthLogsTable.$inferInsert> = {};
  if ("weightKg" in changes) updateValues.weightKg = changes.weightKg ?? null;
  if ("waterMl" in changes) updateValues.waterMl = changes.waterMl;
  if ("sleepHours" in changes) updateValues.sleepHours = changes.sleepHours ?? null;
  const [row] = await db
    .insert(healthLogsTable)
    .values({ userId, date, ...changes })
    .onConflictDoUpdate({
      target: [healthLogsTable.userId, healthLogsTable.date],
      set: updateValues,
    })
    .returning();
  SaveHealthLogResponse.parse({
    ...row,
    date: new Date(`${row.date}T00:00:00.000Z`),
  });
  res.json(row);
});

router.get("/meal-logs", async (req, res): Promise<void> => {
  const params = GetMealLogsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const date = params.data.date?.toISOString().slice(0, 10) ?? getIndiaDate();
  const rows = await db
    .select()
    .from(mealLogsTable)
    .where(and(eq(mealLogsTable.userId, userId), eq(mealLogsTable.date, date)))
    .orderBy(desc(mealLogsTable.createdAt));
  GetMealLogsResponse.parse(
    rows.map((row) => ({
      ...row,
      date: new Date(`${row.date}T00:00:00.000Z`),
      createdAt: row.createdAt,
    })),
  );
  res.json(
    rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
  );
});

router.post("/meal-logs", async (req, res): Promise<void> => {
  const parsed = CreateMealLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [row] = await db
    .insert(mealLogsTable)
    .values({
      ...parsed.data,
      date: parsed.data.date.toISOString().slice(0, 10),
      userId,
    })
    .returning();
  CreateMealLogResponse.parse({
    ...row,
    date: new Date(`${row.date}T00:00:00.000Z`),
    createdAt: row.createdAt,
  });
  res.status(201).json({
    ...row,
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/meal-logs/:id", async (req, res): Promise<void> => {
  const params = DeleteMealLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [row] = await db
    .delete(mealLogsTable)
    .where(
      and(
        eq(mealLogsTable.id, params.data.id),
        eq(mealLogsTable.userId, userId),
      ),
    )
    .returning({ id: mealLogsTable.id });
  if (!row) {
    res.status(404).json({ error: "Meal record not found." });
    return;
  }
  res.sendStatus(204);
});

export default router;
