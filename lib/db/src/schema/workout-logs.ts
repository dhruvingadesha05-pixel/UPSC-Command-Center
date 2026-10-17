import { createInsertSchema } from "drizzle-zod";
import { date, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const workoutLogsTable = pgTable("upsc_workout_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  exerciseName: text("exercise_name").notNull(),
  sets: integer("sets").notNull(),
  repsPerSet: integer("reps_per_set").notNull(),
  weightPerSet: numeric("weight_per_set", { precision: 7, scale: 2, mode: "number" }).notNull().default(0),
  weightUnit: text("weight_unit").notNull().default("kg"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkoutLogSchema = createInsertSchema(workoutLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;
export type WorkoutLog = typeof workoutLogsTable.$inferSelect;
