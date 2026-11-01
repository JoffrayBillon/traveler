# Contributing to Traveler

This is the canonical engineering guide. The [product specification](PRODUCT_SPEC.md) defines behavior; [the AI workflow](../context/IA_WORKFLOW.md) defines assistant conduct. The original mission is archived as [MISSION_ORIGINAL.md](MISSION_ORIGINAL.md).

- [Local setup and commands](contributing/01-local-development.md)
- [Architecture and code rules](contributing/02-architecture.md)
- [Tests and delivery](contributing/03-testing-delivery.md)
- [Accessibility](contributing/04-accessibility-rgaa.md)
- [Security and operations](contributing/05-security-operations.md)
- [Participant and rooming import sources](contributing/06-import-sources.md)
- [Technical changelog](contributing/CHANGELOG_DEV.md)

Keep code, identifiers, comments, filenames, and commit messages in English. Use English `lowerCamelCase` keys for translations and add or update both French and English values in `apps/web/src/i18n/resources.ts` whenever product text changes. Use small, coherent changes; update the relevant guide when behavior or tooling changes. Record material design decisions in [architecture decisions](ARCHITECTURE.md).

Run `pnpm check` before requesting integration. Add one changelog entry per coherent technical change, with its actual validation status. Documentation-only changes need content and link verification. Important merges and definitive integration require the owner's agreement.

The owner runs the same code manually: commands must work from a fresh clone without an agent runtime. Do not rely on absolute machine-specific paths in project configuration. Use Node 26 LTS and the pinned pnpm release.
