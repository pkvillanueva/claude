# pkvillanueva-setup

Patrick's personal Claude Code plugin. Home for all reusable Claude Code setup —
starting with default coding **rules**, with room to grow into skills, agents,
hooks, and slash commands.

## What it ships today

| Component      | What                                                            |
| -------------- | --------------------------------------------------------------- |
| `rules/`       | Default coding rules (markdown, TypeScript, React 19+, Next.js) |
| `hooks/`       | `SessionStart` hook that syncs rules into each project          |
| `dependencies` | Auto-installs caveman + superpowers when this plugin installs   |

## Bundled plugins (one install, everything)

The whole point: add **one** marketplace on a new device, install **one**
plugin, get the entire setup. Installing `pkvillanueva-setup` auto-installs its
dependencies via Claude Code's native plugin dependency resolution
([docs](https://code.claude.com/docs/en/plugin-dependencies)):

| Bundled plugin    | Source                                              |
| ----------------- | --------------------------------------------------- |
| `caveman`         | `JuliusBrussee/caveman`                             |
| `superpowers`     | `obra/superpowers`                                  |
| `context7`        | `anthropics/claude-plugins-official` (subdir)       |
| `frontend-design` | `anthropics/claude-plugins-official` (subdir)       |
| `stripe`          | `stripe/ai` (subdir)                                |
| `neon`            | `neondatabase/agent-skills` (subdir)                |
| `supabase`        | `supabase-community/supabase-plugin`                |

All are listed in this repo's `marketplace.json`, so the bare-name
`dependencies` in `plugin.json` resolve within the same marketplace — no
cross-marketplace config needed.

To add another plugin to the bundle later: list its real source in
`marketplace.json`, then add its name to `dependencies` in `plugin.json`.

## How rules work

Claude Code natively loads `.claude/rules/*.md` and scopes them by the `paths:`
glob in each file's frontmatter — rules only enter context when Claude touches a
matching file. **Plugins cannot register rules natively yet**
([anthropics/claude-code#21163](https://github.com/anthropics/claude-code/issues/21163)),
so this plugin bridges the gap:

- On every session start, `hooks/sync-rules.sh` copies `rules/*.md` into the
  project at `.claude/rules/pkvillanueva-setup/`.
- The native rules engine then loads them with full path-glob scoping.

The copy is namespaced under `pkvillanueva-setup/` so it never collides with a
project's own hand-written rules. Files are overwritten each session so plugin
updates propagate automatically.

> **Note:** On first install the synced rules take effect from the **next**
> session (the copy runs at session start, after rules are already loaded).

### Frontmatter format

Use the documented **list form** — quoted single-line `paths:` is buggy
([#13905](https://github.com/anthropics/claude-code/issues/13905),
[#17204](https://github.com/anthropics/claude-code/issues/17204)):

```markdown
---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
```

Rules with no `paths:` load unconditionally. Path-scoped user-level rules in
`~/.claude/rules/` are silently ignored
([#21858](https://github.com/anthropics/claude-code/issues/21858)) — that's
exactly why this plugin syncs into the **project** instead.

## Install

**From GitHub (recommended):**

```bash
/plugin marketplace add pkvillanueva/claude
/plugin install pkvillanueva-setup@claude
```

Pin a version/branch/tag: `pkvillanueva/claude#v1.0`.

Non-interactive terminal form:

```bash
claude plugin marketplace add pkvillanueva/claude
claude plugin install pkvillanueva-setup@claude --scope user
```

**Auto-install for a project** — commit this to a repo's `.claude/settings.json`
and teammates get prompted to install on trust:

```json
{
  "extraKnownMarketplaces": {
    "claude": { "source": { "source": "github", "repo": "pkvillanueva/claude" } }
  },
  "enabledPlugins": ["pkvillanueva-setup@claude"]
}
```

**From a local path (dev/testing):**

```bash
/plugin marketplace add /Users/patrickvillanueva/Documents/Personal/claude
/plugin install pkvillanueva-setup@claude
```

## Ignore synced rules in your projects (optional)

The synced files are plugin-managed. To keep them out of a project's git:

```gitignore
.claude/rules/pkvillanueva-setup/
```

## Adding more setup later

Drop new components into the plugin root — Claude Code auto-discovers them:

- `skills/<name>/SKILL.md` — model-invoked skills
- `commands/<name>.md` — slash commands
- `agents/<name>.md` — custom subagents
- `hooks/hooks.json` — more lifecycle hooks
- `.mcp.json` — MCP servers

To add a new default rule: drop a `rules/<topic>.md` with `paths:` frontmatter.
It syncs into every project automatically.
