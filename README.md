# Traveler

Personal trip management, starting with a ski trip. This repository currently contains the technical foundation; trip management, authentication, tickets and room requests are not implemented yet.

## Run locally

Install Node.js 24 (tested with 24.17.0) and pnpm 11.25.0, then from the repository root:

`sh
pnpm install --frozen-lockfile
pnpm dev
`

Open **http://127.0.0.1:5173**. The local Hono API runs on port 3001; Vite proxies `/api` to it. No external service or secret is required for this shell. See [local development](docs/contributing/01-local-development.md) for setup and individual commands.

`sh
pnpm check
`

This runs Biome, strict TypeScript, Vitest and the production frontend build. `pnpm format` applies formatting. To inspect the built frontend, run `pnpm --filter @traveler/web preview`; it does not start the API.

## Repository

| Path                     | Responsibility                                                  |
| ------------------------ | --------------------------------------------------------------- |
| `apps/web`               | React/Vite/Tailwind, React Aria controls, Vercel function entry |
| `packages/api`           | Hono application, local server and API tests                    |
| `docs`                   | Current product contract and contributor guides                 |
| `context/IA_WORKFLOW.md` | Canonical AI workflow shared by tool entry points               |

Read [the current specification](docs/PRODUCT_SPEC.md), [contributor guide](docs/CONTRIBUTING.md), [architecture](docs/ARCHITECTURE.md) and [accessibility guide](docs/contributing/04-accessibility-rgaa.md). The original mission is preserved for traceability, with current decisions maintained separately.

## Delivery

CI validates pull requests and pushes to `main` and `dev`. A successful push to `dev` deploys that exact commit to Vercel's standard Preview environment and provides the stable branch alias. Feature previews can be started manually from the `main` GitHub Actions ref for `codex/*` and `feature/*` branches. On the Vercel Hobby plan, `dev` is a branch-specific Preview rather than a separate custom environment; use Preview variables scoped to the `dev` branch when it needs different values. Production remains manually staged and is never promoted automatically. See [delivery instructions](docs/contributing/03-testing-delivery.md).

CodeRabbit configuration is included; the GitHub App must be authorized separately. Agent entry files point to the shared workflow for Codex, Claude Code, Antigravity, Copilot and Cursor. Their discovery mechanisms vary; validate each client rather than assuming all sessions load every linked document.

This repository is public. **Never commit real traveler data, spreadsheets, tickets, credentials or private logs.** No open-source license has been selected; making code public does not itself grant a reuse license.
