import { createInsertSchema } from "drizzle-zod";
import { date, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const mealLogsTable = pgTable("upsc_meal_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  name: text("name").notNull(),
  calories: integer("calories").notNull(),
  proteinG: integer("protein_g").notNull().default(0),
  mealType: text("meal_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMealLogSchema = createInsertSchema(mealLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMealLog = z.infer<typeof insertMealLogSchema>;
export type MealLog = typeof mealLogsTable.$inferSelect;
