import { connectorRequest } from "./connectors";

export type NotionDatabase = {
  id: string;
  title: string;
  properties?: Record<string, { id?: string; type?: string; [key: string]: unknown }>;
};

export type NotionPage = {
  id: string;
  url?: string;
  last_edited_time?: string;
  properties?: Record<string, Record<string, unknown>>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function richTextValue(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      const item = asRecord(part);
      return typeof item.plain_text === "string"
        ? item.plain_text
        : typeof asRecord(item.text).content === "string"
          ? String(asRecord(item.text).content)
          : "";
    })
    .join("");
}

function dateTimeValue(value: unknown): string | null {
  const start = asRecord(value).start;
  if (typeof start !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(start)
    ? `${start}T00:00:00.000Z`
    : start;
}

export function getDatabaseTitle(database: Record<string, unknown>): string {
  return richTextValue(database.title);
}

export function pageToNotionItem(page: NotionPage) {
  const properties = page.properties ?? {};
  let title = "";
  let dueDate: string | null = null;
  let status: string | null = null;

  for (const property of Object.values(properties)) {
    const type = String(property.type ?? "");
    if (type === "title") {
      title = richTextValue(property.title);
    } else if (type === "date" && !dueDate) {
      dueDate = dateTimeValue(property.date);
    } else if (type === "status") {
      const name = asRecord(property.status).name;
      status = typeof name === "string" ? name : null;
    } else if (type === "select" && !status) {
      const name = asRecord(property.select).name;
      status = typeof name === "string" ? name : null;
    }
  }

  return {
    id: page.id,
    title,
    dueDate,
    status,
    url: page.url ?? "",
    lastEditedTime: page.last_edited_time ?? new Date(0).toISOString(),
  };
}

export async function getNotionDatabase(databaseId: string): Promise<NotionDatabase> {
  return connectorRequest<NotionDatabase>(
    "notion",
    `/v1/databases/${encodeURIComponent(databaseId)}`,
    "GET",
  );
}

export async function queryNotionDatabase(databaseId: string): Promise<NotionPage[]> {
  const allPages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const page = await connectorRequest<{
      results?: NotionPage[];
      has_more?: boolean;
      next_cursor?: string | null;
    }>(
      "notion",
      `/v1/databases/${encodeURIComponent(databaseId)}/query`,
      "POST",
      { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    );
    allPages.push(...(page.results ?? []));
    cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
  } while (cursor);
  return allPages;
}

export function getDatabasePropertyNames(database: NotionDatabase) {
  const properties = database.properties ?? {};
  const titleProperty = Object.entries(properties).find(
    ([, property]) => property.type === "title",
  )?.[0];
  const dateProperty = Object.entries(properties).find(
    ([, property]) => property.type === "date",
  )?.[0];
  const statusEntry = Object.entries(properties).find(
    ([, property]) => property.type === "status" || property.type === "select",
  );
  return { titleProperty, dateProperty, statusEntry };
}

export function makeNotionPageProperties(
  database: NotionDatabase,
  input: { title?: string; dueDate?: string | null; status?: string },
) {
  const { titleProperty, dateProperty, statusEntry } =
    getDatabasePropertyNames(database);
  const properties: Record<string, unknown> = {};
  if (input.title !== undefined && titleProperty) {
    properties[titleProperty] = {
      title: [{ text: { content: input.title } }],
    };
  }
  if (input.dueDate !== undefined && dateProperty) {
    properties[dateProperty] = input.dueDate
      ? { date: { start: input.dueDate } }
      : { date: null };
  }
  if (input.status !== undefined && statusEntry) {
    const [name, definition] = statusEntry;
    const valueKey = definition.type === "status" ? "status" : "select";
    const options = asRecord(definition[valueKey]).options;
    const availableNames = Array.isArray(options)
      ? options
          .map((option) => asRecord(option).name)
          .filter((option): option is string => typeof option === "string")
      : [];
    const selectedName = availableNames.includes(input.status)
      ? input.status
      : availableNames[0];
    if (selectedName) {
      properties[name] = { [valueKey]: { name: selectedName } };
    }
  }
  return properties;
}

export function validateNotionDatabaseId(value: string | null | undefined): string {
  const id = value?.trim();
  if (!id || !/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Choose a valid Notion database in Settings.");
  }
  return id;
}
