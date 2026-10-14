import express, { type Express } from "express";
import type { ErrorRequestHandler } from "express";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { IntegrationRequestError } from "./lib/connectors";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk's frontend API proxy must run before body parsing so streamed requests
// reach Clerk unchanged. It is a no-op in development.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

const apiErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof IntegrationRequestError) {
    req.log.warn(
      { provider: error.provider, status: error.status },
      "External integration request failed",
    );
    const providerName =
      error.provider === "notion" ? "Notion" : "Google Calendar";
    res.status(502).json({
      error: `${providerName} could not complete the request. Check the connection and its shared-resource permissions.`,
    });
    return;
  }
  if (
    error instanceof Error &&
    error.message === "Choose a valid Notion database in Settings."
  ) {
    res.status(422).json({ error: error.message });
    return;
  }
  req.log.error({ err: error }, "Unhandled API request failure");
  res.status(500).json({ error: "The request could not be completed." });
};

app.use(apiErrorHandler);

export default app;
