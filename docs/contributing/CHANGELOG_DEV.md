# Technical changelog

Use one entry per coherent technical change: date, module, action, details/impact, and actual test status. Exclude documentation-only, context-only and comment-only updates.

## 2026-10-26 — Deployments — Add

- Details/impact: disable automatic Vercel Git deployments; deploy the `dev` Git reference after successful CI and offer manual, tested previews for `codex/*` and `feature/*` references through the Vercel Git deployment API. Keep privileged jobs on `main` workflow code and retain manual staged production.
- Test status: `node --check` and `git diff --check` passed. `pnpm check` could not finish because package downloads from the npm registry were denied with `EACCES`; GitHub Actions will run it after the PR is pushed. Vercel alias and GitHub environment settings require remote verification after the branch and credentials are configured.

## 2026-10-26 — Foundation — Add

- Details/impact: pnpm/Turborepo workspaces with cache invalidation for shared TypeScript/runtime configuration, strict TypeScript, Biome, React/Vite/Tailwind welcome shell with React Aria keyboard theme toggle, Hono liveness/404 endpoints, Vercel entry point, Vitest tests and CI/manual deployment preparation.
- Test status: Biome check, strict type checks (both workspaces), six Vitest tests (three UI and three API) and both build tasks passed locally with Node 24/pnpm 11.25.0, including a final run without cached results. Contributor/AI documentation links checked. Desktop Chrome rendering and keyboard theme control verified; the local Vite proxy returned 200 for `/api/health` and 404 for an unknown API path. GitHub CI passed. iPhone and remote Vercel deployment verification remain outstanding; no production release was claimed.

## 2026-10-26 — API deployment — Fix

- Details/impact: emit JavaScript/declarations for the API workspace, export the compiled entry point, cache/restore build outputs and build before dependent web tasks. Isolate function TypeScript ambient types from Vite, and add a native Node import/response regression test. This addresses the remote function's missing `@traveler/api/src/app.ts` runtime module and frontend ambient type diagnostics; frontend build success did not guarantee API invocation.
- Test status: Biome, strict frontend/function/API typechecks, six Vitest tests plus the native Node distribution test, and both build tasks pass locally. Remote deployment must be invoked again before claiming the incident resolved.

## 2026-10-26 — Theme controls — Fix

- Details/impact: increase the light-theme control boundary contrast and allow the header to wrap at narrow widths/large text, addressing reviewed accessibility issues.
- Test status: calculated border/surface contrast is 3.81:1 in light mode and 4.67:1 in dark mode; local checks pass. Desktop Chrome confirmed skip-link focus transfer and normal 320px reflow. 200% text and actual iPhone behavior remain unverified.

## 2026-10-26 — API tests — Fix

- Details/impact: the standalone API test command now builds the distribution before testing it, so it does not depend on a previous Turbo build or read stale output.
- Test status: `pnpm --filter @traveler/api test` and the full `pnpm check` passed.
