# Architecture and code rules

- `apps/web`: React/Vite frontend and thin Vercel function entry point.
- `packages/api`: Hono application, API tests and local Node server.
- Root: pnpm workspaces, Turborepo task graph, strict TypeScript defaults, Biome and CI.

The API package emits declarations with TypeScript and bundles its runtime entry point with esbuild as a native ES module, keeping workspace-local imports extensionless in source while leaving runtime-compatible output for Node/Vercel. External packages remain external dependencies. Build, typecheck, test and development task dependencies build the API before web code resolves it; Turborepo caches and restores `dist`. Tests and the local development entry point are excluded from that runtime build. Browser code must not import the API package or server-only modules. The Vercel function is the only web workspace consumer of that package. Keep imports direct, component state local, and dependencies minimal; add a shared package only for an actual shared responsibility.

The Vercel entry point has an isolated `api/tsconfig.json` with Web API libraries and no frontend ambient type packages. Web typechecking checks both frontend and function configurations. A native Node subprocess test resolves the compiled workspace package from the web directory and verifies health and error responses; this complements, rather than replaces, remote function invocation checks.

Use runtime validation at trust boundaries and database constraints for durable invariants; TypeScript types alone are not validation. Separate global identity from membership and role within a trip. Every future room, option, ticket and request is scoped to its trip; reject IDs from another trip. Authorize every server operation rather than relying on hidden buttons.

One same-origin deployment serves static frontend assets and `/api/*`. The development proxy preserves that contract locally. `GET /api/health` is public liveness only, has no external dependencies and must reveal no configuration. `GET /api/ready` checks Turso with `SELECT 1`, returning a generic `503` when credentials are missing or the database is unreachable. Unknown API paths return JSON errors rather than the SPA document. Vercel Functions run in Paris (`cdg1`), close to the EU Turso database.

For passwordless authentication, use `BETTER_AUTH_URL` when configured. On a Vercel branch deployment, use `VERCEL_BRANCH_URL` before the unique `VERCEL_URL` so magic links verify on the stable branch alias and set the session cookie on the same host the user opened. The frontend sends its current origin as the callback URL. Trust only the configured app origin and Vercel-provided deployment/branch origins; do not accept an arbitrary redirect host.

The root TypeScript configuration is strict. Avoid `any`, non-null assertions, broad catches and hidden success fallbacks. Keep domain rules testable without React or external services. Future room exchanges must revalidate and apply within an atomic transaction; frontend warnings are feedback, not enforcement.
