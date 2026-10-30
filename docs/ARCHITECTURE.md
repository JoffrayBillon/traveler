# Architecture decisions

## 2026-10-26 — Initial foundation

Accepted by the owner: a small Turborepo using pnpm; React 19, Vite, Tailwind and React Aria Components; Hono; TypeScript, Biome and Vitest. The code is public to try CodeRabbit; data and tickets remain private. Use one same-origin Vercel project rather than separate frontend/API deployments. The owner can install, read and run everything manually with documented commands.

Two workspaces carry actual code: `apps/web` and `packages/api`. React Aria controls live in the web app until sharing warrants a UI package. The API package emits native JavaScript/declarations before the web build so Vercel can trace its runtime export. No empty database/domain/design-system package, microservice or generic workflow engine is introduced.

The foundation now includes a lazy Turso/libSQL client, a read-only readiness probe, and the first minimal `trips` table (`id`, `name`) managed by checked-in Drizzle SQL migrations. Database changes run only through explicit operator commands; application startup and deployment do not apply migrations. No identity, membership, role, authentication, email, ticket storage or request processing is introduced yet. The original schema/configuration is illustrative and must not be copied blindly. Generate the authentication schema from the selected version/configuration when authentication is approved. No secret, participant fixture or real trip record is committed.

## 2026-10-27 — Trip persistence foundation

Add a minimal trip identity and name, SQL migration generation, explicit migration and local operator create/list commands. Keep the table free of speculative dates, status, ownership and membership fields. Authentication, membership and trip management UI remain separate reviewed work.

Public code does not imply an open-source license grant; no license has been chosen. Reassess hosting plans if the owner changes from personal use to professional/commercial use.
