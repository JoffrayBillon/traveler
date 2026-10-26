# Technical changelog

Use one entry per coherent technical change: date, module, action, details/impact, and actual test status. Exclude documentation-only, context-only and comment-only updates.

## 2026-10-26 — Foundation — Add

- Details/impact: pnpm/Turborepo workspaces with cache invalidation for shared TypeScript/runtime configuration, strict TypeScript, Biome, React/Vite/Tailwind welcome shell with React Aria keyboard theme toggle, Hono liveness/404 endpoints, Vercel entry point, Vitest tests and CI/manual deployment preparation.
- Test status: Biome check, strict type checks (both workspaces), six Vitest tests (three UI and three API) and both build tasks passed locally with Node 24/pnpm 11.25.0, including a final run without cached results. Contributor/AI documentation links checked. Desktop Chrome rendering and keyboard theme control verified; the local Vite proxy returned 200 for `/api/health` and 404 for an unknown API path. GitHub CI passed. iPhone and remote Vercel deployment verification remain outstanding; no production release was claimed.
