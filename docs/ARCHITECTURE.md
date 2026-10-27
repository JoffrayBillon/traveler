# Architecture decisions

## 2026-10-26 — Initial foundation

Accepted by the owner: a small Turborepo using pnpm; React 19, Vite, Tailwind and React Aria Components; Hono; TypeScript, Biome and Vitest. The code is public to try CodeRabbit; data and tickets remain private. Use one same-origin Vercel project rather than separate frontend/API deployments. The owner can install, read and run everything manually with documented commands.

Two workspaces carry actual code: `apps/web` and `packages/api`. React Aria controls live in the web app until sharing warrants a UI package. The API package emits native JavaScript/declarations before the web build so Vercel can trace its runtime export. No empty database/domain/design-system package, microservice or generic workflow engine is introduced.

This infrastructure increment adds a lazy Turso/libSQL client and a read-only readiness probe; no business schema, migration, Drizzle layer, authentication, email, ticket storage, trip membership or request processing is introduced yet. The original schema/configuration is illustrative and must not be copied blindly. Generate the authentication schema from the selected version/configuration when authentication is approved. No secret, migration or participant fixture is committed.

Public code does not imply an open-source license grant; no license has been chosen. Reassess hosting plans if the owner changes from personal use to professional/commercial use.
