import { Router, type IRouter } from "express";
import {
  CreateNotionTaskBody,
  CreateNotionTaskResponse,
  GetNotionDatabasesResponse,
  GetNotionScheduleResponse,
  GetNotionTasksResponse,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { appSettingsTable, db } from "@workspace/db";
import { getAuthenticatedUserId } from "../middlewares/requireOwner";
import { connectorRequest } from "../lib/connectors";
import {
  getDatabasePropertyNames,
  getDatabaseTitle,
  getNotionDatabase,
  makeNotionPageProperties,
  pageToNotionItem,
  queryNotionDatabase,
  validateNotionDatabaseId,
  type NotionPage,
} from "../lib/notion";

const router: IRouter = Router();

async function selectedDatabase(userId: string, kind: "tasks" | "schedule") {
  const [settings] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.userId, userId))
    .limit(1);
  return validateNotionDatabaseId(
    kind === "tasks"
      ? settings?.notionTasksDatabaseId
      : settings?.notionScheduleDatabaseId,
  );
}

function responseItem(page: NotionPage) {
  const item = pageToNotionItem(page);
  return {
    ...item,
    dueDate: item.dueDate ? new Date(item.dueDate) : null,
    lastEditedTime: new Date(item.lastEditedTime),
  };
}

router.get("/notion/databases", async (_req, res): Promise<void> => {
  const results: Array<Record<string, unknown>> = [];
  let cursor: string | undefined;
  do {
    const result = await connectorRequest<{
      results?: Array<Record<string, unknown>>;
      has_more?: boolean;
      next_cursor?: string | null;
    }>("notion", "/v1/search", "POST", {
      filter: { property: "object", value: "database" },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    results.push(...(result.results ?? []));
    cursor = result.has_more ? result.next_cursor ?? undefined : undefined;
  } while (cursor);

  const databases = results
    .filter((item) => item.object === "database" && typeof item.id === "string")
    .map((item) => ({ id: String(item.id), title: getDatabaseTitle(item) }));
  res.json(GetNotionDatabasesResponse.parse(databases));
});

router.get("/notion/tasks", async (req, res): Promise<void> => {
  const databaseId = await selectedDatabase(getAuthenticatedUserId(req), "tasks");
  const pages = await queryNotionDatabase(databaseId);
  res.json(
    GetNotionTasksResponse.parse(
      pages.map(responseItem),
    ),
  );
});

router.post("/notion/tasks", async (req, res): Promise<void> => {
  const parsed = CreateNotionTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const databaseId = await selectedDatabase(getAuthenticatedUserId(req), "tasks");
  const database = await getNotionDatabase(databaseId);
  const { titleProperty } = getDatabasePropertyNames(database);
  if (!titleProperty) {
    res.status(422).json({ error: "The selected Notion database has no title field." });
    return;
  }
  const page = await connectorRequest<NotionPage>(
    "notion",
    "/v1/pages",
    "POST",
    {
      parent: { database_id: databaseId },
      properties: makeNotionPageProperties(database, {
        ...parsed.data,
        dueDate:
          parsed.data.dueDate instanceof Date
            ? parsed.data.dueDate.toISOString()
            : parsed.data.dueDate,
      }),
    },
  );
  res.status(201).json(
    CreateNotionTaskResponse.parse(responseItem(page)),
  );
});

router.get("/notion/schedule", async (req, res): Promise<void> => {
  const databaseId = await selectedDatabase(getAuthenticatedUserId(req), "schedule");
  const pages = await queryNotionDatabase(databaseId);
  res.json(
    GetNotionScheduleResponse.parse(
      pages.map(responseItem),
    ),
  );
});

export default router;
