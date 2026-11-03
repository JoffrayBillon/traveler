---
name: traveler-tanstack-query
description: Use when adding or reviewing TanStack Query data fetching, queries, mutations, cache keys, invalidation, optimistic updates, retries, or query tests in Traveler's React app.
---

# TanStack Query in Traveler

Use this skill for server state in `apps/web`. Follow the version installed in `apps/web/package.json` and the lockfile. Check version-sensitive details in the official React Query documentation before applying an API or behavior.

## Traveler's boundaries

- Read `docs/contributing/02-architecture.md` first. Keep query keys, query client defaults, request functions, and query/mutation definitions under `apps/web/src/api`, grouped by domain.
- Keep components focused on display and local interaction state. They consume domain APIs; they do not construct network requests or choose cache invalidations.
- Follow the existing files and naming in `apps/web/src/api`. Do not introduce a broad query workflow hook or move unrelated state through page/layout props.
- Keep server state in TanStack Query. Use component state for short-lived UI state such as an open menu or an unsaved form draft.

## Query and mutation rules

- Give every resource a stable query key. Include every input that changes the returned data, including the trip identity and list filters. Do not place credentials or other rotating secrets in query keys.
- Query functions must reject failed HTTP responses and pass TanStack Query's `AbortSignal` to the request layer when supported.
- Model writes with mutations. In the API domain, choose the narrowest correct invalidation after success. Return the invalidation promise when the mutation should remain pending until refreshed data is available.
- Prefer invalidation when the server owns the final representation. Write directly to cache only when the response contains the complete updated representation. Use optimistic updates only when the interaction needs them and rollback is well-defined.
- Avoid invalidating on failure unless the server may have partially committed the operation. Never use broad invalidation as a substitute for understanding the affected data.
- Keep user-facing messages in the UI layer. Preserve useful typed errors from the request/API layer.

## Verify against official docs

Use the React Query v5 docs for the installed version:

- [Overview](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)
- [Query functions and cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions)
- [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
- [Invalidation from mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)
- [Testing](https://tanstack.com/query/latest/docs/framework/react/guides/testing)

When an official document and a secondary skill disagree, follow the installed package's official documentation and Traveler's architecture guide.
