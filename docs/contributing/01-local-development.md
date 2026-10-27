# Local development

Install Node.js 24 (tested with the version in `.node-version`) and pnpm 11.25.0. If pnpm is missing, run `npm install --global pnpm@11.25.0`. No third-party account is needed to build or test the current shell.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the local Hono server at `http://127.0.0.1:3001`; `/api/health` reports liveness and `/api/ready` checks the database connection. Both servers bind to loopback. Stop both with Ctrl+C. Ports are intentionally fixed to avoid a silently broken proxy.

To check database readiness locally, create `.env.local` from `.env.example` and fill it only with the **development** Turso URL and token. The API loads this file when it starts. Never use production credentials locally; Vercel Preview for the `dev` branch has its own development database variables. Without database configuration, `/api/ready` returns `503` while `/api/health` remains available.

| Command                                  | Purpose                                                           |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `pnpm check`                             | Lint/format check, strict types, tests, production frontend build |
| `pnpm format`                            | Apply Biome formatting and safe fixes                             |
| `pnpm --filter @traveler/web test:watch` | Watch UI tests                                                    |
| `pnpm --filter @traveler/api test:watch` | Watch API tests                                                   |
| `pnpm build --filter=@traveler/web...`   | Build the web workspace and its dependency graph                  |
| `pnpm --filter @traveler/web preview`    | Inspect the built frontend; does not start the API                |

The current shell has no authentication or email. The API uses Drizzle for its minimal trip schema and checked-in SQL migrations. From the repository root, explicitly apply migrations and manage trip records against the database configured in `.env.local`:

```sh
pnpm --filter @traveler/api db:generate
pnpm --filter @traveler/api db:migrate
pnpm --filter @traveler/api trips:create -- "Ski 2027"
pnpm --filter @traveler/api trips:list
```

`db:generate` only creates migration files from the schema. `db:migrate` applies them to the database configured by `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; it is never run automatically at startup or in CI/CD. Confirm `.env.local` points to the development database before invoking `db:migrate` or a trip record command. `.env.example` contains only safe placeholders. Keep `.env.local` out of Git and never use production data locally or in previews.

Turborepo caches builds, type checks and tests; persistent development servers are not cached. `pnpm check --` does not forward to every task: run an individual task when you need task-specific flags. A fresh install may require network access and the approved esbuild install script; do not globally allow unknown dependency scripts.
