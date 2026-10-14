import { Router, type IRouter } from "express";
import { UpdateSettingsBody, GetSettingsResponse } from "@workspace/api-zod";
import { appSettingsTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAuthenticatedUserId } from "../middlewares/requireOwner";
import { getOrCreateSettings } from "../lib/settings";

const router: IRouter = Router();

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function settingsResponse(settings: Awaited<ReturnType<typeof getOrCreateSettings>>) {
  const validated = GetSettingsResponse.parse({
    ...settings,
    spipaExamDate: new Date(`${settings.spipaExamDate}T00:00:00.000Z`),
    upscPrelimsDate: new Date(`${settings.upscPrelimsDate}T00:00:00.000Z`),
  });
  return {
    ...validated,
    spipaExamDate: settings.spipaExamDate,
    upscPrelimsDate: settings.upscPrelimsDate,
  };
}

router.get("/settings", async (req, res): Promise<void> => {
  const settings = await getOrCreateSettings(getAuthenticatedUserId(req));
  res.json(settingsResponse(settings));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const current = await getOrCreateSettings(userId);
  const nextStart = parsed.data.dayStartHour ?? current.dayStartHour;
  const nextEnd = parsed.data.dayEndHour ?? current.dayEndHour;
  if (nextStart >= nextEnd) {
    res.status(400).json({ error: "The day must end after it starts." });
    return;
  }
  const { spipaExamDate, upscPrelimsDate, ...otherUpdates } = parsed.data;
  const [settings] = await db
    .update(appSettingsTable)
    .set({
      ...otherUpdates,
      ...(spipaExamDate !== undefined
        ? { spipaExamDate: dateOnly(spipaExamDate) }
        : {}),
      ...(upscPrelimsDate !== undefined
        ? { upscPrelimsDate: dateOnly(upscPrelimsDate) }
        : {}),
    })
    .where(eq(appSettingsTable.userId, userId))
    .returning();
  res.json(settingsResponse(settings));
});

export default router;
