import { eq } from "drizzle-orm";
import { appSettingsTable, db } from "@workspace/db";

export async function getOrCreateSettings(userId: string) {
  await db
    .insert(appSettingsTable)
    .values({ userId })
    .onConflictDoNothing();
  const [settings] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.userId, userId))
    .limit(1);
  if (!settings) {
    throw new Error("Could not load command center settings.");
  }
  return settings;
}
