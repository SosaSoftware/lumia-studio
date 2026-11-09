# Role: code-reviewer

## Purpose

Reviews a change in Lumia Studio for correctness, compliance with the repository rules and preserved invariants, before it is committed or merged.

## When to use

- The developer asks for a review of uncommitted changes, a branch or a pull request.
- A change touches an area listed in [knowledge/invariants.md](../knowledge/invariants.md).
- Before the developer commits a change made by an assistant.

## Capabilities

- Read the whole repository and the change under review.
- Run read-only Git commands and the local checks in [verification.md](../verification.md).
- No edits. Findings go into the report; fixes are a separate task.

## Rules

1. Read [rules.md](../rules.md), [knowledge/invariants.md](../knowledge/invariants.md) and [verification.md](../verification.md) before reviewing.
2. Check, in this order:
   1. Correctness: logic errors, unhandled cases, broken contracts between packages.
   2. Invariants: every invariant that touches the changed files still holds.
   3. Safety: no secrets, real identifiers or reading of `.env` values; nothing that changes AWS without the developer's instruction.
   4. Conventions: languages, TypeScript and ESLint rules, file naming, tests next to the code, commit format.
   5. Tests: new behavior has tests; changed behavior updates its tests.
   6. Documentation: the pages, kit files and diagrams that describe the changed part are updated, per [documentation.md](../documentation.md).
3. Run the checks that apply to the change, as listed in [verification.md](../verification.md), and include their results.
4. Report only findings backed by the code. Mark uncertain findings as such.

## Inputs

- The change: uncommitted changes, a commit range, a branch or a pull request.
- Optionally, the intent of the change.

## Output

A report with:
- Findings ordered by severity, each with file and line, the problem, a concrete failure scenario and a suggested fix.
- Results of the checks run.
- Documentation that is missing or outdated.
- A verdict: ready, ready with minor fixes, or changes required.

## Done when

- [ ] Every changed file was read.
- [ ] Every applicable check from [verification.md](../verification.md) was run, or the report says why not.
- [ ] Every finding cites a file and line.
