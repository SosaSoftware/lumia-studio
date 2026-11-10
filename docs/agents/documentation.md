# Documentation standards

How to write and maintain documentation in Lumia Studio. It applies to every assistant and every role, and in particular to [roles/documentation-writer.md](roles/documentation-writer.md).

## Layers

| Layer | Location | Language | Reader |
|---|---|---|---|
| In-code documentation | TSDoc and comments in the source | English | Developers and assistants reading the code |
| Human documentation | Every `README.md` and `docs/`, except `docs/agents/` | Spanish | People new to the repository |
| Assistant kit | `docs/agents/` | English | AI coding assistants |

## In-code documentation

- Document exported classes, interfaces and public members with TSDoc: a one-line summary, plus parameters, return value and errors when they apply.
- Inline comments explain why something non-obvious is done. They do not restate the code.
- No commented-out code and no `TODO` comments.

## Human documentation

Style:
- Formal, descriptive and direct. Short sentences, present tense, impersonal. No first person plural, no narrative, no emoji, no filler.
- Explain what something does and why it exists, never how the solution was reached or what changed over time.
- Name things exactly as in the code.
- Tables for references (parameters, variables, endpoints, commands). Commands in code blocks, ready to copy.

Structure:
- `docs/README.md` is an index by need: understand, run, change, deploy, operate.
- Each folder has a `README.md` that summarizes each page in two or three lines and says when to read it.
- Each page covers one topic, starts with its title and a two- or three-line summary, and ends with a `Siguiente:` link to the page usually read next.
- Pages stay under about 150 lines; split a longer page.
- General content goes first, details after; long reference tables go at the end.

`README.md` files:
- Root: purpose (two or three lines), requirements, installation, usage, configuration (environment variables without real values), structure, available scripts, and a map of the documentation.
- Packages: purpose, how to run or test it, a short structure and a link to the matching `docs/` page. Details live in `docs/`.

## Assistant kit

- Optimized for machine reading: short sections, tables, explicit paths and imperative steps.
- Every claim cites the file that backs it.
- Vendor-neutral: no names, file formats or locations of any specific assistant or tool. Each assistant maps the kit to its own mechanisms.

## Diagrams

Diagrams live in `docs/diagrams/` as SVG files, listed in `docs/diagrams/README.md`. GitHub and Bitbucket render them as images.

- Plain SVG only: no scripts, no external files and no `<foreignObject>`.
- Architecture diagrams use the official AWS Architecture Icons, embedded once per file as `<symbol>` elements and used with `<use>`. Entity-relationship diagrams (`er-*.svg`) draw each table as a node instead: a header with its name, one line per main column, and an edge with the cardinality at each end.
- Each file starts with a comment that explains its structure: nodes are `<g id="node-*" transform="translate(x, y)">`, edges are `<g id="edge-*">` with absolute coordinates.
- Pages embed diagrams with relative paths and no leading slash, for example `![Arquitectura en AWS](../diagrams/aws-architecture.svg)`. Numbered steps in a diagram are listed below it, with the same numbers; entity-relationship diagrams have none.
- Steps for editing a diagram are in [workflows/update-docs-and-diagrams.md](workflows/update-docs-and-diagrams.md).

## Content that never goes into documentation

- People, conversations, decisions, plans, pending work or history of the repository.
- Account ids, ARNs, resource ids, real bucket names, real email addresses, tokens or secrets. The repository is public; use placeholders.

## When documentation must change

When a change alters behavior, structure, commands, configuration or architecture, update in the same change:

1. The human documentation page that covers the area. Find it from `docs/README.md`.
2. The matching file in this kit, usually in [knowledge/](knowledge/) or [workflows/](workflows/).
3. The diagrams that show the changed part.
