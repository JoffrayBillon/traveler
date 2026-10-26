# Local development

Install Node.js 24 (tested with the version in `.node-version`) and pnpm 11.25.0. If pnpm is missing, run `npm install --global pnpm@11.25.0`. No third-party account is needed to build or test the current shell.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the local Hono server at `http://127.0.0.1:3001`; `/api/health` returns `{"status":"ok"}`. Both servers bind to loopback. Stop both with Ctrl+C. Ports are intentionally fixed to avoid a silently broken proxy.

| Command                                  | Purpose                                                           |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `pnpm check`                             | Lint/format check, strict types, tests, production frontend build |
| `pnpm format`                            | Apply Biome formatting and safe fixes                             |
| `pnpm --filter @traveler/web test:watch` | Watch UI tests                                                    |
| `pnpm --filter @traveler/api test:watch` | Watch API tests                                                   |
| `pnpm build --filter=@traveler/web...`   | Build the web workspace and its dependency graph                  |
| `pnpm --filter @traveler/web preview`    | Inspect the built frontend; does not start the API                |

The current shell has no environment variables, authentication, database, email, or migration command. Add an `.env.example` only when executable code starts requiring keys; use names and safe placeholders, never working secrets. Before introducing linked services, link the intended Vercel project, provision the intended development resources, verify required key names, then start service-dependent development or migrations. Never use production data locally or in previews.

Turborepo caches builds, type checks and tests; persistent development servers are not cached. `pnpm check --` does not forward to every task: run an individual task when you need task-specific flags. A fresh install may require network access and the approved esbuild install script; do not globally allow unknown dependency scripts.
