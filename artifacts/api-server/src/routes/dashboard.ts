import { and, eq, gte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { db, healthLogsTable, mealLogsTable, studyLogsTable } from "@workspace/db";
import { getAuthenticatedUserId } from "../middlewares/requireOwner";
import { getIndiaDate } from "../lib/india-time";
import { getOrCreateSettings } from "../lib/settings";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const date = getIndiaDate();
  const settings = await getOrCreateSettings(userId);
  const [todayStudyRows, [health], todayMeals, recentStudyDates] = await Promise.all([
    db
      .select({ durationMinutes: studyLogsTable.durationMinutes })
      .from(studyLogsTable)
      .where(and(eq(studyLogsTable.userId, userId), eq(studyLogsTable.date, date))),
    db
      .select()
      .from(healthLogsTable)
      .where(and(eq(healthLogsTable.userId, userId), eq(healthLogsTable.date, date)))
      .limit(1),
    db
      .select({ calories: mealLogsTable.calories })
      .from(mealLogsTable)
      .where(and(eq(mealLogsTable.userId, userId), eq(mealLogsTable.date, date))),
    db
      .select({ date: studyLogsTable.date })
      .from(studyLogsTable)
      .where(
        and(
          eq(studyLogsTable.userId, userId),
          gte(studyLogsTable.date, getIndiaDate(-100)),
        ),
      )
      .groupBy(studyLogsTable.date),
  ]);

  const studyDates = new Set(recentStudyDates.map((row) => row.date));
  let studyStreak = 0;
  for (let offset = 0; offset < 100; offset += 1) {
    if (!studyDates.has(getIndiaDate(-offset))) break;
    studyStreak += 1;
  }

  const response = {
    date,
    studyMinutesToday: todayStudyRows.reduce(
      (sum, row) => sum + row.durationMinutes,
      0,
    ),
    studyTargetMinutes: settings.dailyStudyTargetMinutes,
    studyStreak,
    waterMl: health?.waterMl ?? 0,
    waterGoalMl: settings.waterGoalMl,
    sleepHours: health?.sleepHours ?? null,
    weightKg: health?.weightKg ?? null,
    mealCalories: todayMeals.reduce((sum, row) => sum + row.calories, 0),
    steps: health?.steps ?? 0,
    stepGoal: settings.stepGoal,
  };
  GetDashboardSummaryResponse.parse({
    ...response,
    date: new Date(`${date}T00:00:00.000Z`),
  });
  res.json(response);
});

export default router;
