# Update documentation and diagrams

Keeps the documentation in line with the code. The rules are in [documentation.md](../documentation.md).

## When

When a change alters behavior, structure, commands, configuration or architecture.

## Steps

1. Find the human page that covers the area from `docs/README.md`, and update it in Spanish.
2. Update the matching file of this kit in English, usually in `knowledge/` or `workflows/`.
3. Update the package `README.md` if its commands or structure changed.
4. Update the diagrams in `docs/diagrams/` that show the changed part. `docs/diagrams/README.md` lists them and where each one is used.

## Editing a diagram

- Read the comment at the top of the SVG file: it explains its structure.
- A node is `<g id="node-*" transform="translate(x, y)">`. To move it, change the translation and update the edges that connect to it. In an entity-relationship diagram a node is a table and grows 17 units per column, so move the tables below it as well.
- An edge is `<g id="edge-*">`, with a path in absolute coordinates and an optional label.
- Icons are `<symbol>` elements copied unchanged from the official AWS Architecture Icons. Reuse the symbols already in the file.
- Keep plain SVG: no scripts, external files or `<foreignObject>`.
- If a numbered step changes, update the list below the diagram in its page.

## Done when

Every link and relative path resolves, and every command, file and variable mentioned exists in the repository.
