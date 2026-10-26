# Architecture and code rules

- `apps/web`: React/Vite frontend and thin Vercel function entry point.
- `packages/api`: Hono application, API tests and local Node server.
- Root: pnpm workspaces, Turborepo task graph, strict TypeScript defaults, Biome and CI.

The API is a source package consumed by the platform bundler. Its `build` task verifies types and intentionally emits no independent bundle. Browser code must not import the API package or server-only modules. The Vercel function is the only web workspace consumer of that package. Keep imports direct, component state local, and dependencies minimal; add a shared package only for an actual shared responsibility.

Use runtime validation at trust boundaries and database constraints for durable invariants; TypeScript types alone are not validation. Separate global identity from membership and role within a trip. Every future room, option, ticket and request is scoped to its trip; reject IDs from another trip. Authorize every server operation rather than relying on hidden buttons.

One same-origin deployment serves static frontend assets and `/api/*`. The development proxy preserves that contract locally. `GET /api/health` is public liveness only, has no external dependencies and must reveal no configuration. Unknown API paths return JSON errors rather than the SPA document.

The root TypeScript configuration is strict. Avoid `any`, non-null assertions, broad catches and hidden success fallbacks. Keep domain rules testable without React or external services. Future room exchanges must revalidate and apply within an atomic transaction; frontend warnings are feedback, not enforcement.
