# UPSC 2028 & SPIPA 2027 Command Center

An owner-only study and lifestyle command center for UPSC CSE 2028 and SPIPA 2027 preparation, with Notion and Google Calendar connections.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/upsc-command-center/` — React dashboard, voice manager, analytics, sprint, calendar, wellness, and settings UI
- `artifacts/api-server/src/routes/` — Express API routes for study, sprint, wellness, Notion, and Google Calendar
- `lib/api-spec/openapi.yaml` — API contract source of truth; regenerate clients with the codegen command above
- `lib/api-client-react/src/generated/` — generated typed React Query client
- `lib/db/src/schema/` — Drizzle schema for user-scoped study, sprint, wellness, and settings records

## Architecture decisions

- The app is restricted to one owner because Notion and Google Calendar connectors are attached to the project, not individual app accounts.
- Server routes verify both the Clerk session and the configured `UPSC_ALLOWED_EMAIL`; the browser allowlist only controls presentation.
- Notion and Google Calendar requests go through Replit-managed connector proxies so OAuth tokens remain server-side.
- Study and wellness dates use `Asia/Kolkata`; date-only records are stored without timezone shifts.

## Product

The command center includes an exam countdown and daily quote, Aira voice/text study commands, a 15-day sprint, study analytics, free-slot discovery, health and meal tracking, Notion task/schedule views, and Google Calendar synchronization.

## User preferences

- Executive light theme with `#F8FAFC` background, white cards, royal blue `#1E3A8A`, gold `#D97706`, and an Ashoka Lion Capital motif.

## Gotchas

- Configure `UPSC_ALLOWED_EMAIL` and the matching `VITE_UPSC_ALLOWED_EMAIL` before opening the app.
- Select shared Notion task and schedule databases in Settings before using the Notion views or automated sync.
- Calendar event writes and the bidirectional sync operate on the connected owner's Google Calendar.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
