import { createInsertSchema } from "drizzle-zod";
import { boolean, date, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const habitCheckinsTable = pgTable(
  "upsc_habit_checkins",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    habitId: integer("habit_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    completed: boolean("completed").notNull().default(false),
  },
  (table) => [
    uniqueIndex("upsc_habit_checkins_user_habit_date_idx").on(
      table.userId,
      table.habitId,
      table.date,
    ),
  ],
);

export const insertHabitCheckinSchema = createInsertSchema(habitCheckinsTable).omit({
  id: true,
});
export type InsertHabitCheckin = z.infer<typeof insertHabitCheckinSchema>;
export type HabitCheckin = typeof habitCheckinsTable.$inferSelect;
