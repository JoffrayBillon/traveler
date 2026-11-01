# Architecture and code rules

- `apps/web`: React/Vite frontend and thin Vercel function entry point.
- `packages/api`: Hono application, API tests and local Node server.
- Root: pnpm workspaces, Turborepo task graph, strict TypeScript defaults, Biome and CI.

The API package emits declarations with TypeScript and bundles its runtime entry point with esbuild as a native ES module, keeping workspace-local imports extensionless in source while leaving runtime-compatible output for Node/Vercel. External packages remain external dependencies. Build, typecheck, test and development task dependencies build the API before web code resolves it; Turborepo caches and restores `dist`. Tests and the local development entry point are excluded from that runtime build. Browser code must not import the API package or server-only modules. The Vercel function is the only web workspace consumer of that package. Keep dependencies minimal; add a shared package only for an actual shared responsibility.

## Frontend boundaries

- Put request functions and all TanStack Query query/mutation definitions under `apps/web/src/api`, grouped by domain (`auth`, `imports`, `participants`, `profile`, `rooming`, `tickets`, `trips`). Keep query-key construction and QueryClient defaults in this API layer. Components consume domain hooks and do not assemble requests or choose cache invalidations.
- Each domain hook owns its request, retry behavior and cache effects. Invalidate the narrowest affected query-key prefixes after success; use `onSettled` only when a request may have partially changed server state before failing. Keep cache updates close to the query data they update.
- Components own presentation and short-lived interaction state. Store import selection, file, preview and mapping state in the import panel that uses it. Do not create a broad workflow hook that passes unrelated state through a page or layout; pass only the props each child actually consumes.
- Use the `@traveler/*` aliases configured by `apps/web/tsconfig.json` and `apps/web/vite.config.ts` for cross-folder source imports. Keep `./` imports for files in the same directory. Name domain type modules with the `.types.ts` convention (`import.types.ts`, `trip.types.ts`, and similar).
- Keep the router entry in `apps/web/src/router.tsx`, route declarations and route components under `apps/web/src/routes`, and persistent shared chrome in the route layout. Use React Router's `<Outlet>` for nested routes. Keep route transitions in the layout so routing remains animated without putting route composition in feature components.
- Prefer one primary component per file. Split a large component by user-visible responsibility (for example list, editor, preview, transport section), not by arbitrary line ranges. Keep page composition separate from form state, mutations and repeated row rendering.
- Keep reusable visual behavior in `components/ui` and its Tailwind Variants recipes. Feature components should use semantic theme tokens and UI variants; page-specific composition and artwork can stay local.
- Translation keys remain English `camelCase`; maintain locale dictionaries separately in `i18n/en.ts` and `i18n/fr.ts`.

## API boundaries

- `endpoints/` registers HTTP routes, reads request parameters, authenticates/authorizes, validates the transport shape and maps domain outcomes to status codes. Avoid embedding multi-step business workflows or long database queries in handlers.
- `services/` owns domain operations and workflows, including transaction boundaries and coordination between repositories or ports.
- `datamodel/` owns database reads and writes. Keep SQL and Drizzle schema knowledge out of route handlers where a repository/service boundary is useful.
- `ports/` describes external capabilities; `adapters/` implements them (email, object storage, schedulers and similar services). Inject adapters through composition rather than importing providers into domain services.
- Keep one route module focused on a cohesive endpoint family. A long handler should be split by its domain responsibilities, not hidden behind generic helper layers.
- Keep import parsing in `source-import/`, import preview/commit workflows in `services/imports/`, and database read models in `datamodel/`. Keep room consent, initial placement, rooming reads and workbook preparation in the rooming services/repositories; endpoints retain session and role checks, request parsing and HTTP response mapping.

The Vercel entry point has an isolated `api/tsconfig.json` with Web API libraries and no frontend ambient type packages. Web typechecking checks both frontend and function configurations. A native Node subprocess test resolves the compiled workspace package from the web directory and verifies health and error responses; this complements, rather than replaces, remote function invocation checks.

The shared web UI lives in `apps/web/src/components/ui`: React Aria wrappers preserve accessible interaction behavior, and Tailwind Variants recipes define reusable styles and typed visual variants. Keep view-specific layout classes in their feature components; promote styles to shared recipes only when they represent a repeated UI pattern.

The web theme has one source of truth in `apps/web/src/theme/tokens.css`. Define semantic color, typography, radius and elevation tokens there, then use the matching Tailwind utilities (for example `bg-surface`, `text-content-muted`, `rounded-card` and `shadow-panel`) in components. Do not add component-level theme colors or reintroduce aliases such as `--ink` and `--surface-soft`; keep photography overlays and other page-specific artwork local when they are not part of the shared theme. Use `rounded-control` (12px), `rounded-card` (16px) and `rounded-feature` (24px) consistently. For layout, use Grid for two-dimensional columns and Flex for one-dimensional rows or flows. Use Tailwind's spacing scale with `gap-2` for control contents, `gap-4` for cards and form groups, and `gap-6`/`gap-8` between sections; prefer `gap` between siblings and reserve margins for separation outside a layout container. Keep page vertical rhythm in container padding rather than stacked child margins.

Use runtime validation at trust boundaries and database constraints for durable invariants; TypeScript types alone are not validation. Separate global identity from membership and role within a trip. Every future room, option, ticket and request is scoped to its trip; reject IDs from another trip. Authorize every server operation rather than relying on hidden buttons.

One same-origin deployment serves static frontend assets and `/api/*`. The development proxy preserves that contract locally. `GET /api/health` is public liveness only, has no external dependencies and must reveal no configuration. `GET /api/ready` checks Turso with `SELECT 1`, returning a generic `503` when credentials are missing or the database is unreachable. Unknown API paths return JSON errors rather than the SPA document. Vercel Functions run in Paris (`cdg1`), close to the EU Turso database.

For passwordless authentication, use `BETTER_AUTH_URL` when configured. On a Vercel branch deployment, use `VERCEL_BRANCH_URL` before the unique `VERCEL_URL` so magic links verify on the stable branch alias and set the session cookie on the same host the user opened. The frontend sends its current origin as the callback URL. Trust only the configured app origin and Vercel-provided deployment/branch origins; do not accept an arbitrary redirect host.

The root TypeScript configuration is strict. Avoid `any`, non-null assertions, broad catches and hidden success fallbacks. Keep domain rules testable without React or external services. Future room exchanges must revalidate and apply within an atomic transaction; frontend warnings are feedback, not enforcement.
