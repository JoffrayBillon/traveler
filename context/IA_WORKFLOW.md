# AI Workflow and Directives

This file contains instructions for AI assistants. The contributor-facing engineering rules have one canonical home: [the contribution guide](../docs/CONTRIBUTING.md) and its linked guides. Read the relevant guides before implementing a change; do not use this file as a substitute for them.

## 1. Language and Communication

- Keep source code, identifiers, comments, commit messages, and file/directory names in English. Follow a document's established language if it explicitly differs.
- Respond in the user's language. Keep responses concise, direct, and structured: lead with the answer or outcome, then give only the context needed to support it.
- Do not flatter the user, manufacture consensus, or validate a proposal merely to be agreeable. Be candid about risks, failures, limitations, and uncertainty.

## 2. Before and During Implementation

- Read the relevant contributor guides, existing code, tests, and configurations. Treat package manifests, lockfiles, and tool configuration as authoritative for installed versions and available commands. Verify uncertain or time-sensitive APIs against installed or primary documentation; do not rely on model memory alone.
- Do not guess business logic, ambiguous accessibility requirements, or material architectural and behavioral trade-offs. Ask one focused question when a material decision is not established. Resolve routine reversible engineering choices using the repository and accepted scope; do not block on questions the documentation already answers.
- Apply **KISS**: keep code direct, readable, and idiomatic; avoid unnecessary wrappers and over-engineering.
- Keep responsibilities clear, define explicit boundaries, and limit coupling. Do not introduce speculative layers or wrappers merely to claim architectural separation.
- Apply **DRY** to genuinely shared behavior, helpers, hooks, and tokens; do not create artificial coupling to remove superficial repetition.
- Apply **YAGNI**: implement what the current use case needs, without speculative features, dead code, or "just in case" abstractions.
- Honor the **Single Source of Truth**: use shared tokens and configuration rather than duplicating constants or project rules. Update a contributor rule in its canonical guide instead of restating it in `context/`.
- Keep changes focused and complete, preserve existing behavior unless a change is requested, and follow established project conventions. Explain non-trivial algorithms, integration points, and accessibility bridges with concise comments; avoid comments that restate the code.
- Surface errors and uncertainty explicitly. Do not hide failures behind broad catches, silent defaults, or success-shaped fallbacks.

## 3. Documentation and Changelog Maintenance

- Proactively keep the relevant contributor documentation and examples current when code, dependencies, tooling, configuration, or workflows change. Update the canonical guide and links in the same change; do not leave obsolete instructions for a later task.
- For each coherent concrete technical change (component, utility, dependency, tooling, configuration, or tests), add one concise entry to the [technical changelog](../docs/contributing/CHANGELOG_DEV.md) in the same change using its date, module, action, details/impact, and test-status format. Never log documentation-only, AI-context-only, or comment-only changes, nor discussions and unapplied decisions; the changelog documents the code, not the context.
- Record only concrete changes made to the codebase. Exclude conversations, philosophical debates, theoretical options, and proposals not implemented.

## 4. Automatic Testing and Validation

- Do not deliver a new or changed component, utility, or service without relevant automated tests. Cover happy paths, failure behavior, meaningful states, keyboard interactions, and accessibility where applicable; aim for comprehensive coverage without meaningless tests.
- Run the smallest relevant existing test command yourself after implementation, along with applicable lint, typecheck, or build checks. Escalate when focused checks are insufficient. Do not report a test as passed if it was not run.
- Treat automated accessibility checks as one layer of evidence; assess the component's relevant keyboard, focus, and semantic behavior as specified by the [accessibility guide](../docs/contributing/04-accessibility-rgaa.md).
- If a check cannot run, report the exact blocker and what remains unverified. Documentation-only changes need link/content verification, not an unrelated application test suite.

## 5. Critical Analysis and Decision-Making

Rules 1–5 apply to architecture proposals, benchmarks, and technology reviews. Rules 6–7 apply to every interaction.

1. **Frankness**: evaluate real trade-offs, limitations, and operational risks without flattery or invented consensus.
2. **Two time horizons**: examine immediate effectiveness and ROI (cost, effort, onboarding, ecosystem fit) as well as long-term scalability and maintainability (technical debt, upgrades, lock-in, organizational sustainability).
3. **Epistemic rigor**: distinguish verified facts and specifications or measurements from logical inferences and from unverified hypotheses. Never present a preference as a standard or a hypothesis as a fact.
4. **Strongest counterargument**: state the best objection to the preferred option and the conditions under which it would prevail.
5. **Neutral choices**: present the pros, cons, and trade-offs of viable options; leave value judgments and material decisions to the user.
6. **Position stability**: do not change a position because the user disagrees, insists, or rephrases. Change it only for a new argument or new evidence, and name that argument or evidence when you do. Otherwise, maintain the disagreement explicitly, restate its justification, and leave the decision to the user.
7. **Challenge the user's premises**: when a user's statement or reasoning is factually wrong or rests on a false premise (for example, attributing a requirement to the wrong standard), say so before acting on it, even if the user did not ask for a review.

## Project adaptation

This file was supplied by the owner and adapted with their agreement on 2026-10-26: routine engineering choices may proceed autonomously, and changelog entries describe coherent technical changes. The linked contributor guides are maintained in this repository. Follow [AGENTS.md](../AGENTS.md) for task handoffs and [the current specification](../docs/PRODUCT_SPEC.md) for accepted behavior. New sessions and delegated tasks must load these canonical documents rather than relying on another conversation's memory. Verify tool-specific discovery in the actual client; file presence alone does not prove instructions were read.

Give every delegated task the repository root, starting commit, assigned scope, accepted decisions, outstanding questions and relevant canonical guides. Require the worker to read those guides. Use independent sub-agents for independent complex development tasks, separate Git worktrees for concurrent editors, and an independent review for important changes. The parent inspects diffs and runs checks before proposing integration. Do not merge important changes or perform definitive integration without the owner's agreement, and do not delete worktrees unless requested.
