import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, numeric, pgTable, serial, text } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { subjectModulesTable } from "./subject-modules";

export const subjectTopicsTable = pgTable("upsc_subject_topics", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  moduleId: integer("module_id").notNull().references(() => subjectModulesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  estimatedHours: numeric("estimated_hours", { precision: 5, scale: 2, mode: "number" }),
});

export const insertSubjectTopicSchema = createInsertSchema(subjectTopicsTable).omit({
  id: true,
});
export type InsertSubjectTopic = z.infer<typeof insertSubjectTopicSchema>;
export type SubjectTopic = typeof subjectTopicsTable.$inferSelect;
