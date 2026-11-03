# Traveler agent entry point

Before planning, implementing, or reviewing, read [the AI workflow](context/IA_WORKFLOW.md), [contributor guide](docs/CONTRIBUTING.md), and [current product specification](docs/PRODUCT_SPEC.md). Follow the linked guides relevant to the change. The original mission is historical, not the current contract.

Use the repository package manager and scripts. Report checks actually run and blockers. Keep real participant data, transport tickets, credentials, and private logs outside this public repository.

## Specialized agent skills

Load the matching project skill from `.agents/skills/` before work in its area. Claude Code also has a copy under `.claude/skills/`; keep both locations in sync when updating skills. These skills provide library guidance and do not override this file, the contributor guides, the product specification, or established project conventions.

- React performance and data-fetching patterns: `vercel-react-best-practices`.
- React component composition and architecture: `vercel-composition-patterns`.
- Accessible components built with React Aria: `react-aria`.
- TanStack Query reads, mutations, cache keys, invalidation, and error handling: `traveler-tanstack-query`. It records Traveler's architecture and links to official TanStack documentation; verify version-sensitive details against the installed package.
- Motion and CSS animations: `motion`. Its free documentation MCP is available to configured agents. Motion+ tools require separate account access; do not assume those features are available.

The skill CLI lock for skills installed through that CLI is `skills-lock.json`. Motion AI Kit is maintained by Motion and can be updated with `npx motion-ai@latest` from the project root.

For delegated tasks, pass the repository root, starting commit, scope, relevant canonical documents, and outstanding decisions. Concurrent editors need separate worktrees. Do not merge important changes or perform definitive integration without the owner's agreement; preserve worktrees unless asked to delete them.

## Code review rules

Flag missing server-side authorization and cross-trip data access, stale consent or non-atomic room assignments, secret or personal-data exposure, and inaccessible interactions. Assess behavior and relevant evidence, not only passing tool output.
