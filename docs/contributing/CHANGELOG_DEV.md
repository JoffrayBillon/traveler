# Technical changelog

Use one entry per coherent technical change: date, module, action, details/impact, and actual test status. Exclude documentation-only, context-only and comment-only updates.

## 2026-10-26 — Foundation — Add

- Details/impact: pnpm/Turborepo workspaces with cache invalidation for shared TypeScript/runtime configuration, strict TypeScript, Biome, React/Vite/Tailwind welcome shell with React Aria keyboard theme toggle, Hono liveness/404 endpoints, Vercel entry point, Vitest tests and CI/manual deployment preparation.
- Test status: Biome check, strict type checks (both workspaces), six Vitest tests (three UI and three API) and both build tasks passed locally on Node 24.17.0/pnpm 11.25.0. Contributor/AI documentation links checked. Real-browser, iPhone and remote Vercel deployment verification remain outstanding; no services or production release were claimed.
