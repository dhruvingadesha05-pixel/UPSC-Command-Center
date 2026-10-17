import { createInsertSchema } from "drizzle-zod";
import { date, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const subjectModulesTable = pgTable("upsc_subject_modules", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  estimatedHours: numeric("estimated_hours", { precision: 7, scale: 2, mode: "number" }).notNull(),
  status: text("status").notNull().default("planned"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubjectModuleSchema = createInsertSchema(subjectModulesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSubjectModule = z.infer<typeof insertSubjectModuleSchema>;
export type SubjectModule = typeof subjectModulesTable.$inferSelect;
