import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getClerkProxyHost } from "./clerkProxyMiddleware";

const authorizedUserCache = new Map<string, { allowed: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function getAuthenticatedUserId(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) {
    throw new Error("Authenticated user ID is missing.");
  }
  return userId;
}

export async function requireOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access this command center." });
    return;
  }

  const allowedEmail = process.env.UPSC_ALLOWED_EMAIL?.trim().toLowerCase();
  if (!allowedEmail) {
    req.log.error("UPSC_ALLOWED_EMAIL is not configured");
    res.status(503).json({ error: "Command center access is not configured." });
    return;
  }

  const cached = authorizedUserCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.allowed) {
      res.status(403).json({ error: "This command center is private." });
      return;
    }
    next();
    return;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.primaryEmailAddress?.emailAddress.trim().toLowerCase();
    const allowed = Boolean(email && email === allowedEmail);
    authorizedUserCache.set(userId, {
      allowed,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    if (!allowed) {
      req.log.warn({ userId }, "Blocked non-owner command center access");
      res.status(403).json({ error: "This command center is private." });
      return;
    }
    next();
  } catch (error) {
    req.log.error({ err: error, userId }, "Failed to verify command center access");
    res.status(503).json({ error: "Could not verify command center access." });
  }
}

export const requireSameOrigin: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  const origin = req.get("origin");
  const requestHost = getClerkProxyHost(req) ?? req.get("host");
  if (!origin || !requestHost) {
    res.status(403).json({ error: "This request is not allowed." });
    return;
  }
  try {
    if (new URL(origin).host !== requestHost) {
      res.status(403).json({ error: "This request is not allowed." });
      return;
    }
  } catch {
    res.status(403).json({ error: "This request is not allowed." });
    return;
  }
  next();
};
