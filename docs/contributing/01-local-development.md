# Local development

Install Node.js 26.13.0 LTS (the version in `.node-version`) and pnpm 11.25.0. If pnpm is missing, run `npm install --global pnpm@11.25.0`. No third-party account, cloud database, email provider or `.env.local` is needed to run the local simulator.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the local Hono simulator at `http://127.0.0.1:3001`; `/api/health` reports liveness and `/api/ready` checks its local database. Both servers bind to loopback. Stop both with Ctrl+C. Ports are intentionally fixed to avoid a silently broken proxy.

The API creates `.local/traveler.db`, applies the checked-in migrations there, and idempotently seeds a fictional trip with 1 manager, 2 companions and 10 travelers. The demo emails are printed in the API terminal at startup. Request a sign-in link from the web page using any demo address; the one-time link appears in the API terminal instead of being emailed. The message in the page points to that terminal. The simulator stores uploaded tickets under `.local/tickets`. These local records and files are disposable; they never connect to Turso, Brevo or Vercel Blob. Delete `.local/` to reset the demo database and files. Do not use real participant details or tickets in the simulator.

Run `pnpm env:check` from the repository root to validate the complete API configuration used for deployment. It reports every missing or invalid setting together without printing values. Use `pnpm env:check -- database` to validate only Turso settings for explicit database administration commands. These commands are separate from `pnpm dev`, which always uses its local simulator. Vercel deployments use the connected Blob store's OIDC credentials.

The local simulator does not load credentials from `.env.local`. For explicit database administration, create `.env.local` from `.env.example` and fill it only with the **development** Turso URL and token. If the Development variables are configured in Vercel, an authorized project user can link the local `apps/web` directory and run `vercel env pull ../../.env.local --environment=development --yes` from there. This writes plaintext credentials to the gitignored file; access to the Vercel project is required. Never use production credentials locally; Vercel Preview for the `dev` branch has its own development database variables. Deployment authentication requires `BETTER_AUTH_SECRET` (at least 32 random characters), `BETTER_AUTH_URL`, `BREVO_API_KEY` and `BREVO_SENDER_EMAIL`. On Vercel, `VERCEL_URL` supplies the deployment origin if `BETTER_AUTH_URL` is unset; `VERCEL_BRANCH_URL` is also trusted for branch aliases. The sender email must be verified in Brevo before live mail can be delivered.

| Command                                  | Purpose                                                           |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `pnpm check`                             | Lint/format check, strict types, tests, production frontend build |
| `pnpm env:check`                         | Validate the complete API environment without revealing values    |
| `pnpm env:check -- database`             | Validate only the Turso environment for database commands         |
| `pnpm format`                            | Apply Biome formatting and safe fixes                             |
| `pnpm --filter @traveler/web test:watch` | Watch UI tests                                                    |
| `pnpm --filter @traveler/api test:watch` | Watch API tests                                                   |
| `pnpm build --filter=@traveler/web...`   | Build the web workspace and its dependency graph                  |
| `pnpm --filter @traveler/web preview`    | Inspect the built frontend; does not start the API                |

The API uses Drizzle for its trip and authentication schema with checked-in SQL migrations. From the repository root, explicitly apply migrations and manage records against the database configured in `.env.local`:

```sh
pnpm --filter @traveler/api db:generate
pnpm --filter @traveler/api db:migrate
pnpm --filter @traveler/api trips:create -- "Ski 2027"
pnpm --filter @traveler/api trips:list
pnpm --filter @traveler/api managers:create -- <trip-id> <email> <first-name> <last-name>
```

`db:generate` only creates migration files from the schema. Locally, `db:migrate` applies pending SQL migrations to the database configured by `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. The `deploy-dev.yml` and `deploy.yml` GitHub workflows run this command explicitly before requesting the Vercel deployment, using `vercel env run` to fetch the `dev` Preview or Production variables without writing them to a file. Feature-branch previews do not run migrations; do not point them at the shared dev or production database. Confirm `.env.local` points to the development database before running the local command or an operator command. The bootstrap migration creates a blank trip if none exists and provisions the initial manager if the user table is empty. To provision another manager, use the target trip ID and their name/email. This command creates an unverified, invite-only account with the `manager` role for that trip; it does not send an email or grant roles elsewhere. `.env.example` contains only safe placeholders. Keep `.env.local` out of Git and never use production data locally or in previews.

Drizzle records applied migrations and runs only pending files on later deployments. Keep each committed migration immutable after it has run in any environment. Serialize deployments per database, and make production schema changes backward-compatible with the currently deployed application: prefer additive changes first, then remove obsolete schema in a later deployment after the old code is gone. A deployment rollback does not reverse a database migration; destructive migrations require a separate recovery plan.

Turborepo caches builds, type checks and tests; persistent development servers are not cached. `pnpm check --` does not forward to every task: run an individual task when you need task-specific flags. A fresh install may require network access and the approved esbuild install script; do not globally allow unknown dependency scripts.
