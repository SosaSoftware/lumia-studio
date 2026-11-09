# Repository rules

Rules every AI assistant follows when working in Lumia Studio. They come from the repository's configuration, code and documentation, and they apply to every developer and every tool.

## Language

| What | Language | Source |
|---|---|---|
| Code, identifiers, comments and TSDoc | English | [`docs/development/conventions.md`](../development/conventions.md) |
| Messages a person sees: API errors, web texts | Spanish | `apps/api/src`, `apps/web/src` |
| Human documentation: every `README.md` and `docs/` | Spanish | [documentation.md](documentation.md) |
| This kit: `docs/agents/` | English | [documentation.md](documentation.md) |
| File and folder names | English, no accents or spaces | [`docs/development/conventions.md`](../development/conventions.md) |

## Code

- Follow the existing pattern of the area you change before adding a new one. [workflows/](workflows/) describes the patterns for frequent tasks.
- TypeScript is strict: see `tsconfig.base.json` and `tsconfig.json`. ESLint rules are in `eslint.config.mjs`.
- Workspaces are ES modules and import with the `.ts` extension. The CDK app in `bin/`, `lib/` and `test/` imports without extension.
- Unit tests live next to the code as `*.test.ts`. Details are in [verification.md](verification.md).
- Do not add, remove or upgrade dependencies unless the developer asks.

## Before finishing a change

1. Check [knowledge/invariants.md](knowledge/invariants.md) for the areas you touched.
2. Run the checks listed in [verification.md](verification.md) for the kind of change.
3. Update documentation and diagrams if the change alters what they describe. See [workflows/update-docs-and-diagrams.md](workflows/update-docs-and-diagrams.md).

## Commits

Format: `type(scope): summary`, in English. The history uses the types `feat` and `fix`, and scopes such as `agent`, `api`, `docs`, `mcp`, `sandbox` and `web`. Source: `git log`.

## Safety

- The repository is public. Never write account ids, ARNs, resource ids, real bucket names, real email addresses, tokens or secrets into code, tests or documentation. Use placeholders such as `<runtime-arn>`.
- Never read or print the values in `.env` or `.env.*`. Only `.env.example` is versioned.
- Actions with effects outside the working tree follow the developer's explicit instruction: deploying or destroying stacks, writing to AWS or to the database, pushing or rewriting Git history, and installing tools or plugins. [permissions.md](permissions.md) holds a recommended policy.
- Never version assistant configuration. See [setup.md](setup.md).

## Scope of knowledge

This kit and the human documentation describe the repository as it is. When they disagree with the code, the code wins: tell the developer, and update the documentation if asked.
