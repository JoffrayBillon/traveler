# Architecture decisions

## 2026-10-26 — Initial foundation

Accepted by the owner: a small Turborepo using pnpm; React 19, Vite, Tailwind and React Aria Components; Hono; TypeScript, Biome and Vitest. The code is public to try CodeRabbit; data and tickets remain private. Use one same-origin Vercel project rather than separate frontend/API deployments. The owner can install, read and run everything manually with documented commands.

Two workspaces carry actual code: `apps/web` and `packages/api`. React Aria controls live in the web app until sharing warrants a UI package. The source API package is typechecked and bundled by Vercel. No empty database/domain/design-system package, microservice or generic workflow engine is introduced.

Planned later: Turso/libSQL with Drizzle, Better Auth Magic Link and Brevo, ExcelJS, private ticket storage, trip-scoped membership/roles and requests. The original schema/configuration is illustrative and must not be copied blindly. Generate the authentication schema from the selected version/configuration. No service-dependent code, secret, migration or participant fixture is part of this foundation.

Public code does not imply an open-source license grant; no license has been chosen. Reassess hosting plans if the owner changes from personal use to professional/commercial use.
