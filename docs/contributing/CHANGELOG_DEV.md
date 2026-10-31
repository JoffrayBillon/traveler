# Technical changelog

Use one entry per coherent technical change: date, module, action, details/impact, and actual test status. Exclude documentation-only, context-only and comment-only updates.

## 2026-10-31 — Trip operations — Add

- Details/impact: add trip-scoped travel details, role-authorized traveler management, idempotent XLSX import that preserves staff-entered data, private ticket upload/download, room creation and assignment, consent-based versioned room changes, private rooming export and React Aria controls in the trip dashboard. Vercel Blob uses the connected store's OIDC credentials; local development uses a static token.
- Test status: `pnpm check` passed (Biome, both workspace typechecks, 23 API tests plus the Node distribution test, 13 web tests, and both production builds). Live Vercel Blob upload/download and mobile device review remain unverified.

## 2026-10-31 — Brevo email configuration — Fix

- Details/impact: fail authentication initialization when the default sender lacks `BREVO_API_KEY` or `BREVO_SENDER_EMAIL`, retain injected senders for tests, and document both required variables. Add an integration-level test for the default Brevo SDK payload.
- Test status: `pnpm --filter @traveler/api exec vitest run src/auth.test.ts` and `pnpm check` passed; live Brevo delivery remains unverified.

## 2026-10-31 — Staff travel details — Add

- Details/impact: let companions and managers edit a participant's activity, ski-day option and both transport legs, including dates, timezone, meeting and departure times, locations, references and seats. Choosing no booked transport clears journey fields; switching to a booked mode clears carpool preferences.
- Test status: `pnpm check` passed (Biome, both workspace typechecks, 25 API tests plus the Node distribution test, 14 web tests, and both production builds); PR CI run 62 passed.

## 2026-10-31 — Room exchanges — Add

- Details/impact: allow a traveler with an assigned room to propose a reciprocal exchange by entering the other participant's email. Resolve the other participant only within the same trip, require consent from both travelers and everyone in a room that becomes mixed, then apply the exchange atomically. Other travelers' room rosters remain private.
- Test status: `pnpm check` passed (Biome, both workspace typechecks, 25 API tests plus the Node distribution test, 14 web tests, and both production builds); PR CI for this commit is pending.

## 2026-10-31 — Brevo email delivery — Replace SMTP with API

- Details/impact: send login links through Brevo's official Node.js SDK over HTTPS; replace SMTP credentials with an API key and verified sender email; remove Nodemailer; bound retries and timeout; classify API authorization failures and report HTTP statuses without exposing recipients or login URLs.
- Test status: `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed; `git diff --check` passed. Live email delivery has not yet been verified.

## 2026-10-31 — Authentication — Keep preview login on its branch alias

- Details/impact: generate magic links from Vercel's stable branch URL and return to the exact requesting origin so session cookies remain on the preview alias; log only the error class when background delivery fails.
- Test status: `pnpm --filter @traveler/api test -- auth.test.ts` passed, including a regression test for branch alias and callback origins.

## 2026-10-31 — Web shell — Redesign accessible sign-in and account views

- Details/impact: rebuild the sign-in and member views with React Aria forms, theme control and tabs; persist the light/dark preference and add responsive travel-themed styling.
- Test status: `pnpm --filter @traveler/web test -- App.test.tsx`, `pnpm typecheck`, and `pnpm lint` passed. Local visual review confirmed the live theme switch; the local API server could not start in this host because Node returned `uv_os_get_passwd`/`ENOMEM`.

## 2026-10-31 — GitHub deployment environments — Rename

- Details/impact: use `development` and `preview` as the GitHub deployment environment names while retaining `production`; keep deployment URLs attached to the completed deploy jobs so GitHub's Deployments interface links to Vercel.
- Test status: workflow YAML and documentation reviewed; CI validation and successful remote deployments are pending.

## 2026-10-31 — Database migrations — Fix

- Details/impact: pass the matching Turso credentials to GitHub migration jobs from environment-scoped GitHub secrets. Vercel `Secret` variables cannot be retrieved by `vercel env run`; Vercel still supplies them to application deployments.
- Test status: confirmed the failure cause in production workflow logs; `git diff --check` and PR CI are pending.

## 2026-10-31 — Database deployments — Add

- Details/impact: make GitHub Actions the only deployment trigger. After successful `main` CI, deploy that exact commit to Vercel Production; keep the checked `dev` deployment and manual feature previews, and publish their URLs to GitHub deployment environments. Disable Vercel automatic Git deployments. Vercel continues to build and apply pending Drizzle migrations before publishing production and `dev`; feature previews without database credentials skip migration. Document migration history, serialization and backward-compatible schema requirements.
- Test status: implementation pending PR CI and Vercel Preview validation; no production deployment or database migration was run during this change.

## 2026-10-31 — Authentication and traveler shell — Fix

- Details/impact: schedule magic-link email delivery with Vercel `waitUntil` so SMTP latency does not delay public acknowledgements; report delivery failures privately without logging addresses or links. Remove the fixed 500 ms response delay, add a 30-second client cooldown and a persistent per-email server cooldown, and retain the broader IP limit for abuse protection. Revalidate sessions on focus/visibility, allow long trip names to wrap, and verify a consumed magic link cannot create another session.
- Test status: `pnpm check` passed (Biome with the pre-existing `GITHUB_REPOSITORY_ID` warning, both typechecks, 15 API tests, 8 web tests, native Node distribution test and both production builds).

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
## 2026-10-31 — Deployment migrations — Change

- Run Drizzle migrations as explicit GitHub Actions steps using scoped Vercel environment variables before `dev` and production deployments; keep the Vercel build script focused on building the app.
- Test status: pending workflow and repository checks.

## 2026-10-31 — Deployment stages — Change

- Separate quality checks, migration and deployment into dependent jobs for `dev`; keep Production migration/deploy steps in one protected job so one approval gates both, and reject stale or non-push production CI runs.
- Test status: pending workflow checks.

## 2026-10-31 — Authentication response privacy — Fix

- Process magic-link requests in the background after a generic acknowledgement, derive cooldowns from an absolute deadline, and clear stale profiles after a 403 response.
- Test status: `pnpm check` passed; the existing Biome warning for `GITHUB_REPOSITORY_ID` remains.

## 2026-10-31 — Routed traveler interface and participant access — Change

- Add React Router pages with Motion transitions, feature-based UI modules, Lucide React icons, attributed Unsplash photography, self-hosted Inter Variable via Fontsource and responsive reduced-motion styling. Add manager-only participant access status and email login-link actions, with persisted login timestamps and trip-scoped authorization. Resolve Better Auth URLs against its explicit host allowlist so links created from previews return to the same preview; backfill existing login timestamps from stored sessions.
- Test status: `pnpm check` passed: Biome, workspace TypeScript checks, 42 Vitest tests plus API distribution test, and production builds. Vite splits route features into lazy-loaded chunks; no oversized entry-chunk warning remains.
