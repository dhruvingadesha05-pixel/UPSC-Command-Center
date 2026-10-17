import { and, desc, eq, gte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateHabitBody,
  CreateHabitResponse,
  GetHabitsQueryParams,
  GetHabitsResponse,
  SaveHabitCheckinBody,
  SaveHabitCheckinResponse,
  UpdateHabitBody,
  UpdateHabitParams,
  UpdateHabitResponse,
} from "@workspace/api-zod";
import { db, habitCheckinsTable, habitsTable } from "@workspace/db";
import { getAuthenticatedUserId } from "../middlewares/requireOwner";
import { getIndiaDate } from "../lib/india-time";

const router: IRouter = Router();

function habitResponse(habit: typeof habitsTable.$inferSelect) {
  return {
    id: habit.id,
    name: habit.name,
    category: habit.category as "good" | "bad",
    description: habit.description,
    active: habit.active,
    createdAt: habit.createdAt.toISOString(),
  };
}

router.get("/habits", async (req, res): Promise<void> => {
  const params = GetHabitsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const fromDate = getIndiaDate(-params.data.days + 1);
  const [habits, checkins] = await Promise.all([
    db.select().from(habitsTable).where(eq(habitsTable.userId, userId)).orderBy(habitsTable.id),
    db
      .select()
      .from(habitCheckinsTable)
      .where(
        and(
          eq(habitCheckinsTable.userId, userId),
          gte(habitCheckinsTable.date, fromDate),
        ),
      )
      .orderBy(desc(habitCheckinsTable.date)),
  ]);
  const response = {
    habits: habits.map(habitResponse),
    checkins: checkins.map((checkin) => ({
      id: checkin.id,
      habitId: checkin.habitId,
      date: checkin.date,
      completed: checkin.completed,
    })),
  };
  GetHabitsResponse.parse({
    habits: response.habits.map((habit) => ({
      ...habit,
      createdAt: new Date(habit.createdAt),
    })),
    checkins: response.checkins.map((checkin) => ({
      ...checkin,
      date: new Date(`${checkin.date}T00:00:00.000Z`),
    })),
  });
  res.json(response);
});

router.post("/habits", async (req, res): Promise<void> => {
  const parsed = CreateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const existing = await db
    .select({ id: habitsTable.id })
    .from(habitsTable)
    .where(eq(habitsTable.userId, userId));
  if (existing.length >= 20) {
    res.status(409).json({ error: "The habit list is limited to 20 items." });
    return;
  }
  const [habit] = await db
    .insert(habitsTable)
    .values({
      userId,
      name: parsed.data.name.trim(),
      category: parsed.data.category,
      description: parsed.data.description?.trim() || null,
    })
    .returning();
  const response = habitResponse(habit);
  res.status(201).json(
    CreateHabitResponse.parse({
      ...response,
      createdAt: new Date(response.createdAt),
    }),
  );
});

router.patch("/habits/:id", async (req, res): Promise<void> => {
  const params = UpdateHabitParams.safeParse(req.params);
  const parsed = UpdateHabitBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const changes = {
    ...parsed.data,
    ...(parsed.data.name !== undefined
      ? { name: parsed.data.name.trim() }
      : {}),
    ...(parsed.data.description !== undefined
      ? { description: parsed.data.description?.trim() || null }
      : {}),
  };
  const [habit] = await db
    .update(habitsTable)
    .set(changes)
    .where(
      and(
        eq(habitsTable.id, params.data.id),
        eq(habitsTable.userId, getAuthenticatedUserId(req)),
      ),
    )
    .returning();
  if (!habit) {
    res.status(404).json({ error: "Habit not found." });
    return;
  }
  const response = habitResponse(habit);
  res.json(
    UpdateHabitResponse.parse({
      ...response,
      createdAt: new Date(response.createdAt),
    }),
  );
});

router.post("/habit-checkins", async (req, res): Promise<void> => {
  const parsed = SaveHabitCheckinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [habit] = await db
    .select({ id: habitsTable.id, active: habitsTable.active })
    .from(habitsTable)
    .where(
      and(
        eq(habitsTable.id, parsed.data.habitId),
        eq(habitsTable.userId, userId),
      ),
    )
    .limit(1);
  if (!habit || !habit.active) {
    res.status(404).json({ error: "Active habit not found." });
    return;
  }
  const date = parsed.data.date.toISOString().slice(0, 10);
  const [checkin] = await db
    .insert(habitCheckinsTable)
    .values({
      userId,
      habitId: habit.id,
      date,
      completed: parsed.data.completed,
    })
    .onConflictDoUpdate({
      target: [
        habitCheckinsTable.userId,
        habitCheckinsTable.habitId,
        habitCheckinsTable.date,
      ],
      set: { completed: parsed.data.completed },
    })
    .returning();
  const response = {
    id: checkin.id,
    habitId: checkin.habitId,
    date: checkin.date,
    completed: checkin.completed,
  };
  res.json(
    SaveHabitCheckinResponse.parse({
      ...response,
      date: new Date(`${response.date}T00:00:00.000Z`),
    }),
  );
});

export default router;
