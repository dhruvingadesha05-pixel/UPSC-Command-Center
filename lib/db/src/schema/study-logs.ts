import { createInsertSchema } from "drizzle-zod";
import { date, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const studyLogsTable = pgTable("upsc_study_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  subject: text("subject").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStudyLogSchema = createInsertSchema(studyLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStudyLog = z.infer<typeof insertStudyLogSchema>;
export type StudyLog = typeof studyLogsTable.$inferSelect;
