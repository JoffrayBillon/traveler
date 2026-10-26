# Traveler agent entry point

Before planning, implementing, or reviewing, read [the AI workflow](context/IA_WORKFLOW.md), [contributor guide](docs/CONTRIBUTING.md), and [current product specification](docs/PRODUCT_SPEC.md). Follow the linked guides relevant to the change. The original mission is historical, not the current contract.

Use the repository package manager and scripts. Report checks actually run and blockers. Keep real participant data, transport tickets, credentials, and private logs outside this public repository.

For delegated tasks, pass the repository root, starting commit, scope, relevant canonical documents, and outstanding decisions. Concurrent editors need separate worktrees. Do not merge important changes or perform definitive integration without the owner's agreement; preserve worktrees unless asked to delete them.

## Code review rules

Flag missing server-side authorization and cross-trip data access, stale consent or non-atomic room assignments, secret or personal-data exposure, and inaccessible interactions. Assess behavior and relevant evidence, not only passing tool output.
