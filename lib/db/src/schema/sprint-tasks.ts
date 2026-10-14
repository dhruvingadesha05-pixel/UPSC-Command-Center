import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const sprintTasksTable = pgTable("upsc_sprint_tasks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  dayNumber: integer("day_number").notNull(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  target: text("target").notNull(),
  completed: boolean("completed").notNull().default(false),
  priority: text("priority").notNull().default("medium"),
});

export const insertSprintTaskSchema = createInsertSchema(sprintTasksTable).omit({
  id: true,
});
export type InsertSprintTask = z.infer<typeof insertSprintTaskSchema>;
export type SprintTask = typeof sprintTasksTable.$inferSelect;
