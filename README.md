# pkvillanueva

Patrick's personal Claude Code plugin. Home for all reusable Claude Code setup —
starting with a default **coding-standards skill**, with room to grow into more
skills, agents, hooks, and slash commands.

## What it ships today

| Component      | What                                                              |
| -------------- | ---------------------------------------------------------------- |
| `skills/`      | `coding-standards` skill (Markdown, TypeScript, React 19+, Next.js) |
| `dependencies` | Auto-installs caveman + superpowers + more when this plugin installs |

## Bundled plugins (one install, everything)

The whole point: add **one** marketplace on a new device, install **one**
plugin, get the entire setup. Installing `pkvillanueva` auto-installs its
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

## How the coding-standards skill works

`skills/coding-standards/` is a model-invoked skill. Claude reads its
description and invokes it when you write or edit TypeScript, React, Next.js, or
Markdown files, then loads only the relevant reference:

```
skills/coding-standards/
  SKILL.md                # overview + when-to-use routing table
  references/
    general.md            # SOLID/DRY/KISS/YAGNI/TDD, naming, comments, security
    typescript.md         # strict types, error handling, tRPC + TanStack Query
    react.md              # React 19+ APIs, state, components, a11y
    nextjs.md             # App Router special files, caching, rendering
    markdown.md           # aligned table formatting
```

Unlike the native `.claude/rules/` engine (which path-scopes by `paths:`
frontmatter), a skill is invoked by description match — no per-project file sync
needed. The plugin ships the skill once and Claude pulls it in on demand.

## Install

**From GitHub (recommended):**

```bash
/plugin marketplace add pkvillanueva/claude
/plugin install pkvillanueva@claude
```

Pin a version/branch/tag: `pkvillanueva/claude#v1.0`.

Non-interactive terminal form:

```bash
claude plugin marketplace add pkvillanueva/claude
claude plugin install pkvillanueva@claude --scope user
```

**Auto-install for a project** — commit this to a repo's `.claude/settings.json`
and teammates get prompted to install on trust:

```json
{
  "extraKnownMarketplaces": {
    "claude": { "source": { "source": "github", "repo": "pkvillanueva/claude" } }
  },
  "enabledPlugins": ["pkvillanueva@claude"]
}
```

**From a local path (dev/testing):**

```bash
/plugin marketplace add /Users/patrickvillanueva/Documents/Personal/claude
/plugin install pkvillanueva@claude
```

## Adding more setup later

Drop new components into the plugin root — Claude Code auto-discovers them:

- `skills/<name>/SKILL.md` — model-invoked skills
- `commands/<name>.md` — slash commands
- `agents/<name>.md` — custom subagents
- `hooks/hooks.json` — lifecycle hooks
- `.mcp.json` — MCP servers

To extend coding standards: add a section to the relevant
`skills/coding-standards/references/<topic>.md`, or add a new reference file and
link it from `SKILL.md`'s routing table.
