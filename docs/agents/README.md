# AI assistant kit

This folder is for AI coding assistants from any vendor. It holds what an assistant needs to understand Lumia Studio, configure itself for this repository and work on it correctly. Human documentation lives in [`docs/`](../README.md) and is written in Spanish.

## If you were asked to configure yourself

An instruction such as "configure yourself to work in this repo" means: follow [setup.md](setup.md) from start to end and return its report. Do not improvise a different setup.

## If you were asked to analyze or understand the repo

Read in this order:

| Order | File | Gives you |
|---|---|---|
| 1 | [rules.md](rules.md) | Rules every assistant follows in this repository |
| 2 | [knowledge/repository-map.md](knowledge/repository-map.md) | Packages, entry points and key files |
| 3 | [knowledge/architecture.md](knowledge/architecture.md) | Components, flows and contracts between packages |
| 4 | [knowledge/data-model.md](knowledge/data-model.md) | Tables, relations, enums and data rules of the `studio` schema |
| 5 | [knowledge/glossary.md](knowledge/glossary.md) | Domain terms and their names in code |
| 6 | [knowledge/invariants.md](knowledge/invariants.md) | What a change must not break |
| 7 | [verification.md](verification.md) | What to run for each kind of change |

## Reference

| File | Use it when |
|---|---|
| [setup.md](setup.md) | Configuring yourself, or re-configuring after the kit changes |
| [documentation.md](documentation.md) | Writing or updating any documentation, in code or in `docs/` |
| [permissions.md](permissions.md) | The developer asks for a recommended permission policy. It is guidance, not a requirement |
| [roles/](roles/) | Installing or acting as a role: `documentation-writer`, `code-reviewer` |
| [workflows/](workflows/) | Doing a frequent task: a GraphQL field, a catalog component, an MCP tool, a Lumi skill, a migration, an infrastructure change, a docs or diagram update |

## Principles of this kit

- Everything here is vendor-neutral. No vendor-specific configuration is versioned in this repository.
- The configuration each assistant generates for itself is local to the developer's machine and ignored by Git. This is mandatory; see [setup.md](setup.md).
- Every claim cites the file that backs it. When a claim and the code disagree, the code wins, and the kit must be updated.
- This kit describes the repository only. It contains no personal preferences, decisions, plans or pending work of any person.
