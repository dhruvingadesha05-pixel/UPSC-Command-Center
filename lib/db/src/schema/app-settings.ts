import { createInsertSchema } from "drizzle-zod";
import { integer, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const appSettingsTable = pgTable("upsc_app_settings", {
  userId: text("user_id").primaryKey(),
  dailyStudyTargetMinutes: integer("daily_study_target_minutes").notNull().default(360),
  waterGoalMl: integer("water_goal_ml").notNull().default(2500),
  sleepGoalHours: numeric("sleep_goal_hours", { precision: 4, scale: 2, mode: "number" }).notNull().default(8),
  notionTasksDatabaseId: text("notion_tasks_database_id"),
  notionScheduleDatabaseId: text("notion_schedule_database_id"),
  calendarId: text("calendar_id").notNull().default("primary"),
  dayStartHour: integer("day_start_hour").notNull().default(7),
  dayEndHour: integer("day_end_hour").notNull().default(22),
  spipaExamDate: text("spipa_exam_date").notNull().default("2027-05-16"),
  upscPrelimsDate: text("upsc_prelims_date").notNull().default("2028-05-28"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable);
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;
