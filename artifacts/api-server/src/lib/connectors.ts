import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

export class IntegrationRequestError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "IntegrationRequestError";
  }
}

export async function connectorRequest<T>(
  provider: "notion" | "google-calendar",
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const response = await connectors.proxy(provider, path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : undefined;
  } catch {
    payload = raw;
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `The ${provider} request failed.`;
    throw new IntegrationRequestError(provider, response.status, detail);
  }

  return payload as T;
}
