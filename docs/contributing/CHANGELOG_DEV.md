# Technical changelog

## 2026-11-02 — Organizer workspace — Keep tab content anchored to the top

- Details/impact: align the animated organizer route container to the top of the shared main region so changing tabs with different content heights no longer shifts the workspace vertically. Other routes retain their existing alignment.
- Test status: targeted Biome and web typecheck passed under the available Node 24 shell; no tests run.

## 2026-11-02 — UI tokens and translations — Normalize quiet actions and remove unused keys

- Details/impact: make the shared `quiet` button appearance neutral, reserve `quietDanger` for destructive actions, and replace all `quietNeutral` usages. Remove 138 unreferenced translation entries from both catalogs; add catalog parity and typed i18next keys so invalid/missing keys are caught during typecheck. Fix the missing trip-options label and map payment/import/room error values to valid translation keys.
- Test status: full Biome check, web/API typechecks and translation key scan passed; no test suite run.

## 2026-11-02 — Room plan — Move staff controls into organizer workspace

- Details/impact: move the complete staff rooming view into an animated “Room plan” tab in the organizer workspace and keep the participant trip page limited to traveler-facing room details and requests. Remove manual room creation and its API operations; room instances are generated from the configured inventory and use their generated numeric identifiers.
- Test status: targeted Biome and web/API TypeScript checks passed under Node 24. No tests run.

## 2026-11-02 — Room inventory — Complete translations and neutral action styles

- Details/impact: add the missing French and English room-capacity label and use neutral quiet button styling for inventory add/remove controls and room-plan cancellation. Room inventory access remains limited to accompanying staff and managers; traveler requests are rejected by the API.
- Test status: targeted Biome and web/API TypeScript checks passed under Node 24. No tests run.

## 2026-11-02 — Group transport — Complete French and English translations

- Details/impact: add the missing French and English labels and messages for transport groups, itinerary segments, traveler assignment, and carpool preferences; add localized singular/plural labels for travelers, passengers and segments.
- Test status: Biome on the repository, web TypeScript checks and `git diff --check` passed under Node 26. All 72 transport translation keys are present in both languages; automated tests were not run.

## 2026-11-02 — Group transport and rooming lifecycle — Implement

- Details/impact: add trip-scoped shared transport groups with ordered outbound/return segments, staff assignment, traveler itineraries and driver/passenger carpool choices. Replace the fixed room inventory with configurable per-trip capacity counts; add review-before-apply room generation, direct organizer moves, traveler room requests with withdrawal, rejection, seven-day expiry and composition-based approvals; preserve locked and assigned rooms. Add production ticket cleanup 90 days after trip end, guarded by `CRON_SECRET` and scheduled daily. Request states remain in-app only.
- Test status: Biome, API/web TypeScript, API/web production builds and `git diff --check` passed under Node 26. Biome excludes externally sourced agent skills/configuration and the long-form product spec. No tests were run.

## 2026-11-02 — Product specification — Close rooming request and ticket lifecycle decisions

- Details/impact: pending room requests can be withdrawn or rejected, expire after seven days, and keep their history; in-app status is the only notification. The generator fills only unassigned travelers, while assigned/locked rooms remain untouched. Ticket files and metadata expire 90 days after the trip end date.
- Test status: documentation update only.

## 2026-11-02 — Profile — Lock confirmed gender for travelers

- Details/impact: travelers can confirm an imported or entered `H`/`F` value once, then cannot change it through their profile. API updates enforce the lock transactionally; organizers can correct the value, which refreshes the assigned room's composition policy and version. Room generation still leaves unconfirmed travelers unassigned.
- Test status: Biome and API/web typechecks pass. Tests not run.

## 2026-11-02 — Product specification — Specify grouped transport and room planner

- Details/impact: specify organizer-managed group itineraries with city-based import assignment and draft groups, driver/passenger declarations, anonymous app-numbered rooms, gender-aware room generation, H/F/M badges, organizer overrides, full-room locks and mixed-room approval by every occupant. Keep in-app explanations neutral and mark gender-confirmation timing, request withdrawal/expiry and notifications open.
- Test status: documentation review only; implementation is intentionally pending the open product decisions.

## 2026-11-02 — Source imports — Batch database writes

- Details/impact: replace per-row writes with bounded SQLite upsert batches for the validated roster, detailed-order, staff and agency rooming imports; group registration cancellations and room cleanup queries. Forty rows per statement keeps the widest insert below SQLite's conservative bind-variable limit while preserving existing manual fields, traveler confirmations and role rules.
- Test status: targeted Biome, API typecheck and `git diff --check` passed under Node 24.22.1 with pnpm's engine-strict check disabled; the repository requires Node 26. Tests were not run.

## 2026-11-02 — Product specification — Align manager access actions

- Details/impact: document the agreed manager workflow: assign roles from participant profiles and generate/copy a one-time login link for support without sending an email.
- Test status: documentation consistency review only.

## 2026-11-02 — Imports — Make preview commits atomic

- Details/impact: claim the preview, verify its baseline and apply imported rows in a single database transaction. Concurrent commits now observe either the state before the import or its complete result; failed/stale commits roll back the preview claim.
- Test status: targeted Biome and API typecheck passed. Typecheck ran under Node 24.22.1 with pnpm's engine-strict check disabled because Node 26 is not installed in this shell; the repository requires Node 26. Tests were not run.

## 2026-11-01 — Frontend data and routing boundaries — Centralize TanStack Query by domain

- Details/impact: move every browser request, TanStack Query hook, query key and cache effect into `apps/web/src/api` domain modules. Add `@traveler/*` aliases for source folders, move route declarations and components under `src/routes`, and render nested routes through a persistent React Router layout and animated `<Outlet>`. Replace the broad organizer workflow hook with panel-owned import and trip-settings state so `StaffTools` no longer forwards import callbacks or values it does not use. Rename type modules to the `.types.ts` convention.
- Test status: Biome, web/API TypeScript checks, web/API production builds and `git diff --check` passed. Automated tests were not run. Builds ran under Node 24.22.1 with pnpm's engine-strict check disabled because Node 26 is not installed in this environment; the repository requires Node 26.

## 2026-11-01 — Application refactor — Complete feature and service boundaries

- Details/impact: split oversized web components into focused feature components and shared UI variants; keep feature server state in TanStack Query hooks with dedicated keys, direct cache updates for known profile/preference/trip-name results, and narrowly scoped invalidations for participant edits/imports and rooming changes. Move workbook import preview/commit, agency rooming export, rooming reads/exports/assignments, traveler profile/details updates and initial room assignment workflows behind services and datamodel repositories; keep endpoint handlers focused on authorization, payload validation and HTTP responses.
- Test status: Biome, web/API TypeScript checks, API and web production builds, and `git diff --check` passed. Automated tests were not run. Builds ran under Node 24.22.1 with pnpm's engine-strict check disabled because Node 26 is not installed in this environment; the repository requires Node 26.

## 2026-11-01 — Unsplash photo credits — Overlay attribution

- Details/impact: place photographer credits in small, legible overlays on the sign-in and trip hero photos so attribution no longer adds vertical space to the page.
- Test status: Biome, web/API TypeScript checks and `git diff --check` passed. Automated tests were not run.

## 2026-11-01 — Organizer roles — Translate French labels

- Details/impact: translate traveler, companion and manager role labels in the French catalog so directory entries, role selectors and import assignment lists display French labels.
- Test status: Biome and `git diff --check` passed.

## 2026-11-01 — Keyboard focus — Match outlines to the green theme

- Details/impact: use the theme accent green for keyboard focus outlines in light and dark mode, reduce the outline from 3px to 2px, and keep forced-colors mode on the system highlight color.
- Test status: Biome and `git diff --check` passed.

## 2026-11-01 — Organizer journey fields — Add date and time pickers

- Details/impact: add an accessible React Aria calendar popover with month navigation to date-time fields, and a keyboard-accessible time list in 15-minute increments with the currently selected custom minute retained. Keep the segmented date/time inputs available for direct keyboard entry, and localize picker controls in French and English.
- Test status: Biome, web/API TypeScript checks, Vite production build and `git diff --check` passed. Automated tests were not run. Vite reports the existing large-chunk advisory.

## 2026-11-01 — Organizer access — Generate sign-in links without email

- Details/impact: show the manager action in every environment; generate a Better Auth magic link and return it directly for clipboard use without invoking Brevo, while retaining the 10-minute single-use token, manager authorization and request cooldown. Normal sign-in requests still use email delivery; local copy requests no longer print their link to the API terminal. Declare `@internationalized/date` as a direct web dependency so React Aria date/time fields resolve after install.
- Test status: Biome, web/API TypeScript checks, Vite production build, API bundling and `git diff --check` passed. Automated tests were not run. Vite still reports the existing large-chunk advisory.

## 2026-11-01 — Organizer traveler details — Use accessible date and time fields

- Details/impact: replace native date/time inputs with React Aria DatePicker and TimeField controls; remove per-journey timezone editing and clear legacy timezone values on save while retaining the current individual journey fields ahead of the planned group-departure redesign. The local copy-link action continues to use the simulator mailer, which prints the generated link to the API terminal instead of sending email.
- Test status: Biome, web/API TypeScript checks, Vite production build and `git diff --check` passed. Automated tests were not run. Vite still reports the existing large-chunk advisory.

## 2026-11-01 — Organizer workspace — Add manual users and trip settings

- Details/impact: organize manager tools into animated users, imports/exports, and trip/options tabs; remove the separate companion-nomination form and create users as travelers before assigning roles from their profile; make detailed order imports explicit alongside recurring confirmed-roster updates; use accessible drop zones for participant workbooks and agency rooming templates; hide journey fields for users without booked transport.
- Test status: Biome, web/API TypeScript checks, Vite production build and `git diff --check` passed. Automated tests were not run. Vite still reports the existing large-chunk advisory.

## 2026-11-01 — Organizer workspace — Reorganize user management

- Details/impact: separate the organizer workspace into participant management and import/export tabs; replace the separate emergency-contact and access lists with one searchable user directory whose dialog edits profile, contact, role, email, transport and trip options. Expose registration payment details only to managers, keep role/email changes manager-only, allow organizers to copy a local debug sign-in link, and retain the existing emailed-link endpoint for configured deployments.
- Test status: Biome and API/web TypeScript checks passed. Automated tests were not run.

## 2026-11-01 — Traveler profile — Refine dialog and phone input

- Details/impact: animate profile dialog entry and exit; keep its header and action bar fixed while the inset form content scrolls; apply the themed scrollbar across the site, remove browser scrollbar arrow buttons, and inset the track from rounded corners; scope standard scrollbar styling to browsers without WebKit scrollbar pseudo-elements so Chromium can apply the arrow-removal rules; constrain language options within the viewport; render Select lists with one shared surface, separated options, and distinct selected/focused states; style the dialog close action with a neutral token; replace the duplicate gender tooltip with a concise helper description; add an accessible country picker with React flag components from `country-flag-icons`, country calling codes and French `+33 (0)` display without truncation; align the country selector and number input to avoid a hover seam; format and validate international phone numbers in the browser and normalize valid numbers to E.164 on the server.
- Test status: Biome, web/API TypeScript checks, Vite production build and `git diff --check` passed. Automated tests were not run. Vite still reports the existing large-chunk advisory.

## 2026-11-01 — Web theme — Refactor

- Details/impact: centralize semantic light/dark color, typography, radius and elevation tokens in `apps/web/src/theme/tokens.css`, expose them as Tailwind utilities, and migrate shared UI and feature styles to those names. Normalize page rhythm and form/card spacing around layout gaps, use Grid and Flex by layout purpose, and document the styling convention. CSS `light-dark()` keeps system colors and explicit theme preferences on the same token definitions.
- Test status: Biome passed for the web source and contributor docs, and `git diff --check` passed. The production build was blocked because this shell resolves Node 24.22.1 while the repository requires Node 26; automated tests were not run.

Use one entry per coherent technical change: date, module, action, details/impact, and actual test status. Exclude documentation-only, context-only and comment-only updates.

## 2026-11-01 — Traveler profile — Expand layout and allow blank dietary fields

- Details/impact: use more of the viewport for the profile modal while insetting its scroll region, make dietary requirements and allergens optional in both the form and API validation, and clarify that these fields can be left blank. The profile update endpoint is present in the current API source; the local listener on port 3001 returned 404 for that route, indicating it is serving an older or different API build.
- Test status: Biome, web/API typechecks and Vite production build passed under Node 24 with pnpm's engine guard disabled. Automated tests were not run. Node 26 is required; rerun the pipeline there before merge. Vite reports the existing large-chunk advisory.

## 2026-11-01 — Profile modal — Inset the scrollbar

- Details/impact: keep the rounded dialog as the outer frame and move the scrolling content into an inset region so the scrollbar clears the modal corners.
- Test status: Biome, web typecheck and Vite production build passed under Node 24 with pnpm's engine guard disabled. Automated tests were not run. Node 26 is required; rerun the pipeline there before merge. Vite reports the existing large-chunk advisory.

## 2026-11-01 — React Aria controls — Correct selector sizing and legend spacing

- Details/impact: keep the dietary section's original divider and add only right padding to its legend; use the actual expanded state of Select trigger buttons for shared chevron rotation; align the gender option popover to its trigger and explicitly fill the profile form column.
- Test status: Biome, web typecheck and Vite production build passed under Node 24 with pnpm's engine guard disabled. Automated tests were not run. Node 26 is required; rerun the pipeline there before merge. Vite reports the existing large-chunk advisory.

## 2026-11-01 — Profile controls — Refine selection, menus and exit behavior

- Details/impact: keep the selected appearance indicator visible whenever the account menu opens, align the language option popover with its trigger, rotate shared React Aria Select chevrons while open, allow users to leave an incomplete profile and return through browser history, style the profile dialog scrollbar, and use React Aria `Text` for associated dialog and select descriptions.
- Test status: Biome, web typecheck and Vite production build passed under Node 24 with pnpm's engine guard disabled. Automated tests were not run. Node 26 is required; rerun the pipeline there before merge. Vite reports the existing large-chunk advisory.

## 2026-11-01 — Web interface — Refine profile, language and appearance controls

- Details/impact: use English `lowerCamelCase` translation keys with matching French/English catalogs, move the language React Aria Select into the account menu, animate the theme ToggleButtonGroup selection indicator, and show traveler information behind a required first-visit profile modal with structured dietary/emergency-contact sections and room-planning guidance.
- Test status: Biome, web typecheck and Vite production build passed under Node 24 with pnpm's engine guard disabled. Automated tests were not run. Node 26 is required; rerun the pipeline there before merge. Vite reports the existing large-chunk advisory.

## 2026-11-01 — Web interface — Add French and English localization

- Details/impact: add a centralized i18next/react-i18next catalog for all traveler, sign-in, profile, rooming and organizer interface copy. Default to French, allow switching to English, persist the selection locally, update the document language, and format dates and amounts with the selected locale.
- Test status: Web TypeScript check, Biome and Vite production build passed under Node 24 with pnpm's engine guard disabled. Automated tests were not run; the build reports its existing large-chunk advisory.

## 2026-11-01 — Participant imports — Refactor

- Details/impact: add reference-keyed validated-roster snapshots with payment derivation from amounts due/paid, detailed-order enrichment, reviewed companion/VIP account linking and explicit manager assignment, profile completion, manager-only payment visibility, and agency-template rooming export plus seat-only return import. Show per-reference import changes, retain registration history and staff-entered data, and cancel missing validated registrations without deleting accounts.
- Test status: Biome, API/web TypeScript checks and API/web production builds passed under Node 24 with pnpm's engine guard disabled. Drizzle generated migration 0006 and snapshot; a follow-up schema generation reported no schema changes. Automated tests were not run. Re-run the full pipeline under the required Node 26 runtime before merge.

## 2026-11-01 — Local demo — Add sample participants

- Details/impact: seed one manager, two companions and ten fictional travelers idempotently on every local simulator startup, including existing local databases; print all demo sign-in emails in the API terminal.
- Test status: API TypeScript check and Biome passed under Node 24 with the pnpm engine guard disabled. Automated tests were not run.

## 2026-11-01 — Traveler profile — Handle missing profile response

- Details/impact: render profile onboarding with empty defaults when an API response has no profile object, avoiding a crash for accounts without a stored profile or when the API payload predates the profile fields.
- Test status: Web TypeScript check and Biome passed under Node 24 with the pnpm engine guard disabled. Automated tests were not run.

## 2026-10-31 — Local development — Simulate application services

- Details/impact: make `pnpm dev` use a local SQLite-compatible libSQL database, checked-in migrations, fictional manager/trip and local ticket files; print magic links in the API terminal and keep the simulator isolated from Turso, Brevo and Vercel Blob. Add path-safe local ticket storage and update the setup guide.
- Test status: Biome, TypeScript API build/typecheck, web typecheck, and Vite production build passed under Node 24. Local database readiness returned `ready`, and the API accepted a demo sign-in request with HTTP 200. Automated tests were not run; Node 26 is required by the project but unavailable in this host.

## 2026-10-31 — Web shell — Refine profile, theme and wide layouts

- Details/impact: replace the separate account page and prominent dark-mode switch with an accessible React Aria profile popover containing account details, system/light/dark preference controls and sign-out. Default to the system theme, keep long email addresses on one truncated line, center the main content and widen page/navigation containers for large screens.
- Test status: Biome, TypeScript web check, and Vite production build passed under Node 24. Automated tests were not run; manual keyboard/screen-reader and mobile checks remain to be done by the owner.

## 2026-10-31 — Import and environment review — Fix

- Details/impact: separate migration statements for Drizzle, validate trimmed authentication secrets and Brevo keys, enforce API auth-origin checks, and batch participant import reads/writes while preserving ticket and staff details plus optimistic room-composition checks.
- Test status: Biome, API typecheck, API Vitest (48 tests), API distribution test and API build passed under Node 24. The workspace requires Node 26, so the Node 26 pipeline remains the final environment-parity check.

## 2026-10-31 — Review follow-ups — Fix

- Details/impact: improve route focus and profile update ordering, expose missing file selections and rooming network failures, format travel dates independent of browser timezone, bound offset validation, traverse sparse import workbooks efficiently, normalize imported email matching, reject concurrent rooming changes with a composition-version check, pass authentication throttling to managers, and namespace preview tickets by branch.
- Test status: Biome, API Vitest (43 tests), web Vitest (19 tests), both workspace typechecks, API build and Vite build passed under Node 24. `pnpm check` cannot run normally in this host because the project requires Node 26; package checks were run directly or with pnpm's engine guard disabled. Re-run the full pipeline under Node 26 before merge.

## 2026-10-31 — Identity and ticket storage — Normalize

- Details/impact: normalize email addresses to lowercase across authentication, manager/companion provisioning and participant imports, and match existing accounts case-insensitively. Keep preview ticket prefixes stable per branch across deployments so redeployments preserve access to uploaded tickets.
- Test status: Biome and API suite passed under Node 24 (45 Vitest tests plus distribution test). API build passed as part of the suite. The host warns because project policy requires Node 26; full workspace validation still needs Node 26.

## 2026-10-31 — Environment configuration — Centralized validation

- Details/impact: use T3 Env and Zod to validate API and database profiles, aggregate missing and invalid settings without printing values, and report local Blob setup as an optional capability warning. Add `pnpm env:check` for local and deployment diagnosis.
- Test status: `pnpm lint`, `pnpm typecheck` and the API suite (36 Vitest tests plus distribution test) passed. Running the CLI directly was blocked in this host by `tsx` calling `os.userInfo()` and receiving `uv_os_get_passwd: ENOMEM`; validation profiles are covered by unit tests.

## 2026-10-31 — Node runtime — Upgrade

- Details/impact: set the local and CI runtime to Node 26.13.0 LTS and declare `26.x` in both the monorepo and Vercel app manifests; GitHub Actions `setup-node` downloads the version when it is absent from the runner cache.
- Test status: Node 26.13.0 verified locally; `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed under Node 26. Vitest was not run.

## 2026-10-31 — Web UI styles — Refactor

- Details/impact: replace the loose `ui-classes.ts` string collection with small per-component files in `components/ui`, using a React Aria button wrapper and typed Tailwind Variants recipes; centralize CSS reduced-motion behavior in one `prefers-reduced-motion` media query.
- Test status: `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed; automated tests were not run.

## 2026-10-31 — Dependencies — Update

- Details/impact: update Biome `2.6.3` → `2.6.4`, Vercel Blob `2.5.0` → `2.8.2`, Lucide React `1.64.0` → `1.66.0`, Motion `14.8.0` → `14.9.0`, Tailwind Variants `4.0.0` → `4.0.1`, and `@types/node` `24.19.2` → `26.6.6`. Add exact-version age-gate exceptions for the two just-published frontend packages; all their other versions and all other packages remain subject to the 24-hour delay.
- Test status: with the updated versions and Node 26, frozen install, lint, typecheck, and build passed. Vitest was not run.

## 2026-10-31 — Ticket storage — Isolate environment paths

- Details/impact: keep one private Vercel Blob store and prefix ticket paths by environment; preview paths also include the URL-encoded deployment branch, and local paths use `local/`.
- Test status: `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed; automated tests were not run.

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
