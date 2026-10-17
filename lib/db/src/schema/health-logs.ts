import { createInsertSchema } from "drizzle-zod";
import { date, integer, numeric, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const healthLogsTable = pgTable(
  "upsc_health_logs",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2, mode: "number" }),
    waterMl: integer("water_ml").notNull().default(0),
    sleepHours: numeric("sleep_hours", { precision: 4, scale: 2, mode: "number" }),
    steps: integer("steps").notNull().default(0),
  },
  (table) => [uniqueIndex("upsc_health_logs_user_date_idx").on(table.userId, table.date)],
);

export const insertHealthLogSchema = createInsertSchema(healthLogsTable).omit({
  id: true,
});
export type InsertHealthLog = z.infer<typeof insertHealthLogSchema>;
export type HealthLog = typeof healthLogsTable.$inferSelect;
