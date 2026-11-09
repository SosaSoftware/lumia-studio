# Self-configuration

The procedure an AI coding assistant follows when a developer asks it to configure itself for this repository. It produces the minimum configuration needed to work here, in the assistant's own native format, and ends with a report.

## Scope

| Included: minimum configuration | Not included: the developer decides |
|---|---|
| Project rules loaded as persistent instructions | Permission rules, allow lists and blocks |
| The roles in [roles/](roles/) installed | Hooks and automations |
| Pointers to the knowledge files and workflows | Model, response language and style |
| Local files ignored by Git | Global or user-level configuration of the tool |

Offer [permissions.md](permissions.md) as guidance and apply only what the developer accepts.

## Mandatory rule: nothing you generate is versioned

Every file or folder you create during setup is local configuration for one developer and one tool. This repository versions no vendor-specific assistant configuration.

- Before finishing, every path you created must be ignored by Git.
- If a path is not ignored, add a pattern for it to the block `# Local AI assistant configuration` in `.gitignore`. That block is the only versioned change setup may make. Add patterns only; never remove existing ones.
- Never commit, push or stage assistant configuration.

## Procedure

### 1. Identify your mechanisms

Determine how your tool supports each category below, following your tool's own documentation.

| Category | Typical mechanism |
|---|---|
| Project instructions | A file or setting your tool loads at the start of each session |
| Roles | Subagents, custom agents or modes. If unsupported, saved prompts |
| Workflows | Custom commands or skills. If unsupported, nothing to install |
| Permissions | Permission or approval rules. Only on the developer's request |

### 2. Read the kit

Read [README.md](README.md), [rules.md](rules.md), every file in [knowledge/](knowledge/), [verification.md](verification.md) and [documentation.md](documentation.md).

### 3. Install the project rules

Create local project instructions in your native mechanism. They must:

1. Load or reference [rules.md](rules.md). Prefer an import or a reference over copying, so the instructions stay current when the kit changes.
2. Point to [README.md](README.md) as the index of the kit.
3. State that [documentation.md](documentation.md) applies to any documentation change.

Keep these instructions short. The kit is the source; your instructions are pointers to it.

### 4. Install the roles

For each file in [roles/](roles/), create one role in your native mechanism:

- Use the role's file name as its name, for example `documentation-writer`.
- Use its `Purpose` and `When to use` sections as the description your tool uses to choose it.
- Make the role read its source file at the start of each run instead of copying the text, when your tool allows it.
- Grant the capabilities listed in the role's `Capabilities` section.

If your tool has no subagents or modes, save each role as a reusable prompt that says: "Act as the role defined in `docs/agents/roles/<name>.md`".

### 5. Expose the workflows (optional)

If your tool supports custom commands or skills, you may create one per file in [workflows/](workflows/), each pointing to its source file. Otherwise skip this step: the workflows are read on demand.

### 6. Offer the permission guidance

Tell the developer that [permissions.md](permissions.md) contains a recommended policy. Apply it, fully or partially, only if they ask. Never change global or user-level configuration as part of setup.

### 7. Verify that nothing is versioned

```bash
git check-ignore -v <each path you created>
git status --short
```

- Every path you created must appear in the output of `git check-ignore`.
- `git status --short` must show no new files. The only allowed change is `.gitignore`, and only if a path needed a new pattern.

### 8. Report

Return this report to the developer:

```text
Configuration report
Tool: <tool name and version, if known>
Read: <kit files read>
Created:
  - <path> -> <purpose>
Ignored by Git: <yes for every path, or the paths that are not>
.gitignore changed: <no | yes, patterns added: ...>
Not configured: <category and reason, or "none">
Permission guidance: <offered | applied as requested | declined>
```

## Done when

- [ ] The project rules load at the start of every session.
- [ ] Both roles are installed, or saved as prompts.
- [ ] Every created path is ignored by Git, and `git status --short` shows no new files other than an allowed `.gitignore` change.
- [ ] The report was returned.

## Running it again

Setup is idempotent. When the kit changes, for example after pulling new commits, run it again: update the files you created before instead of creating duplicates.
