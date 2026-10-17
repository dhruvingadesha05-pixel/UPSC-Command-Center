import { and, desc, eq, gte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateWorkoutLogBody,
  CreateWorkoutLogResponse,
  GetWorkoutLogsQueryParams,
  GetWorkoutLogsResponse,
} from "@workspace/api-zod";
import { db, workoutLogsTable } from "@workspace/db";
import { getAuthenticatedUserId } from "../middlewares/requireOwner";
import { getIndiaDate } from "../lib/india-time";

const router: IRouter = Router();

router.get("/workout-logs", async (req, res): Promise<void> => {
  const params = GetWorkoutLogsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const fromDate = getIndiaDate(-params.data.days + 1);
  const rows = await db
    .select()
    .from(workoutLogsTable)
    .where(
      and(
        eq(workoutLogsTable.userId, getAuthenticatedUserId(req)),
        gte(workoutLogsTable.date, fromDate),
      ),
    )
    .orderBy(desc(workoutLogsTable.date), desc(workoutLogsTable.createdAt));
  const response = rows.map((row) => ({
    id: row.id,
    date: row.date,
    exerciseName: row.exerciseName,
    sets: row.sets,
    repsPerSet: row.repsPerSet,
    weightPerSet: row.weightPerSet,
    weightUnit: row.weightUnit as "kg" | "lbs",
    createdAt: row.createdAt.toISOString(),
  }));
  GetWorkoutLogsResponse.parse(
    response.map((row) => ({
      ...row,
      date: new Date(`${row.date}T00:00:00.000Z`),
      createdAt: new Date(row.createdAt),
    })),
  );
  res.json(response);
});

router.post("/workout-logs", async (req, res): Promise<void> => {
  const parsed = CreateWorkoutLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(workoutLogsTable)
    .values({
      userId: getAuthenticatedUserId(req),
      date: parsed.data.date.toISOString().slice(0, 10),
      exerciseName: parsed.data.exerciseName,
      sets: parsed.data.sets,
      repsPerSet: parsed.data.repsPerSet,
      weightPerSet: parsed.data.weightPerSet,
      weightUnit: parsed.data.weightUnit,
    })
    .returning();
  const response = {
    id: row.id,
    date: row.date,
    exerciseName: row.exerciseName,
    sets: row.sets,
    repsPerSet: row.repsPerSet,
    weightPerSet: row.weightPerSet,
    weightUnit: row.weightUnit as "kg" | "lbs",
    createdAt: row.createdAt.toISOString(),
  };
  CreateWorkoutLogResponse.parse({
    ...response,
    date: new Date(`${response.date}T00:00:00.000Z`),
    createdAt: new Date(response.createdAt),
  });
  res.status(201).json(response);
});

export default router;
