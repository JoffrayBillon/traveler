# Technical changelog

Use one entry per coherent technical change: date, module, action, details/impact, and actual test status. Exclude documentation-only, context-only and comment-only updates.

## 2026-10-30 — Invite-only authentication — Add

- Details/impact: add Better Auth magic-link login for pre-provisioned trip members, ten-minute single-use hashed tokens, database-backed rate limits, 30-day sessions, trip-scoped membership roles, `/api/me`, a traveler landing view, and an accessible React Aria login form. Add an explicit local first-manager provisioning command and checked-in migrations; startup and CI do not migrate the database.
- Test status: `pnpm check` passed (Biome, both strict typechecks, 13 API tests, 6 web tests, native Node distribution test and both production builds); Biome retains the pre-existing `GITHUB_REPOSITORY_ID` warning. CI and CodeRabbit review are pending.

## 2026-10-30 — Trip creation CLI — Fix

- Details/impact: ignore the leading `--` separator forwarded by pnpm so it is not included in the saved trip name; cover separated and unseparated arguments with unit tests.
- Test status: `pnpm check` passed (Biome with one pre-existing `GITHUB_REPOSITORY_ID` warning, both typechecks, 14 automated tests, and both production builds).

## 2026-10-27 — Trip persistence — Add

- Details/impact: add a minimal Drizzle `trips` table, checked-in SQL migration, and explicit commands to apply migrations and create/list trips. Startup and CI/CD do not mutate database schema.
- Test status: migration generation/metadata normalization, API typecheck/build, `pnpm lint` and `git diff --check` passed. The first PR CI run failed because Drizzle metadata lacked final newlines; `db:generate` now formats that output. Automated tests and full `pnpm check` were not run locally; CI must rerun on the latest commit.

## 2026-10-27 — CodeRabbit — Configure

- Details/impact: include `dev` as an automatic review target so feature pull requests follow the project's review workflow.
- Test status: configuration reviewed against CodeRabbit's documented `reviews.auto_review.base_branches` setting; no automated tests run.

## 2026-10-27 — API database readiness — Add

- Details/impact: add a lazy Turso/libSQL client, a no-store `/api/ready` probe with generic failure responses, local development environment loading, and Paris-region Vercel Functions for the EU database.
- Test status: `pnpm check` passed: Biome, both workspace typechecks, twelve automated tests and both production builds. Biome reports one pre-existing warning for `GITHUB_REPOSITORY_ID` in the GitHub deployment script. No live Turso connection was made.

## 2026-10-27 — API module imports — Fix

- Details/impact: keep relative TypeScript imports extensionless and bundle the API runtime entry point into Node-compatible ESM for distribution.
- Test status: `pnpm check` passed: Biome, both workspace typechecks, twelve automated tests and both production builds. The native Node distribution test confirms the bundled runtime resolves its dependencies without relative source imports. Biome reports the existing `GITHUB_REPOSITORY_ID` warning.

## 2026-10-26 — Deployments — Fix

- Details/impact: target the `dev` branch deployment to Vercel's standard Preview environment on Hobby, since custom environments are unavailable; select the branch-specific `git-dev` alias instead of assuming the first returned alias is the dev URL.
- Test status: local checks were not run; GitHub Actions CI passed for the deployment script at `534bb86` and the complete PR at `2f1ca9d` (run `40416304000`). The merged commit also passed `dev` CI (run `40416939753`) and its Vercel Preview deployment (run `40416997590`).

## 2026-10-26 — Deployments — Add

- Details/impact: disable automatic Vercel Git deployments; deploy the `dev` Git reference after successful CI and offer manual, tested previews for `codex/*` and `feature/*` references through the Vercel Git deployment API. Keep privileged jobs on `main` workflow code and retain manual staged production.
- Test status: `node --check` and `git diff --check` passed. The first PR CI run found Biome formatting issues; they are corrected and CI is being rerun. Local `pnpm check` could not finish because package downloads from the npm registry were denied with `EACCES`. Vercel alias and GitHub environment settings require remote verification after the branch and credentials are configured.

## 2026-10-26 — Foundation — Add

- Details/impact: pnpm/Turborepo workspaces with cache invalidation for shared TypeScript/runtime configuration, strict TypeScript, Biome, React/Vite/Tailwind welcome shell with React Aria keyboard theme toggle, Hono liveness/404 endpoints, Vercel function entry point, Vitest tests and CI/manual deployment preparation.
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
