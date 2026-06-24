# pkvillanueva

Patrick's personal Claude Code plugin. Home for all reusable Claude Code setup —
starting with a default **coding-standards skill**, with room to grow into more
skills, agents, hooks, and slash commands.

## What it ships today

| Component      | What                                                              |
| -------------- | ---------------------------------------------------------------- |
| `skills/`      | `coding-standards` skill — core conventions + deep-dive references |
| `dependencies` | Auto-installs caveman + superpowers + more when this plugin installs |

### coding-standards references

One reference file per domain (progressive disclosure: the `SKILL.md` index loads
only the file a task touches; each domain file has a section index up top). The
React, React Native, Next.js, and web-design files fold in material distilled from
Vercel's open-source agent skills, then **owned** here — rewritten lean, maintained
in-repo, no upstream sync.

| Reference         | Covers                                                              |
| ----------------- | ------------------------------------------------------------------ |
| `general.md`      | engineering principles, naming, comments, security                 |
| `typescript.md`   | strict types, error handling, tRPC + TanStack Query                |
| `react.md`        | APIs/state/components + performance, composition, view transitions |
| `react-native.md` | RN/Expo                                                             |
| `nextjs.md`       | App Router basics + RSC boundaries, OG images, runtime, self-host  |
| `web-design.md`   | UX / a11y review checklist                                          |
| `markdown.md`     | aligned table formatting                                            |

Attribution + sources: [skills/coding-standards/references/CREDITS.md](skills/coding-standards/references/CREDITS.md).

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
  SKILL.md             # overview + progressive-disclosure routing (one file per domain)
  references/
    general.md         # SOLID/DRY/KISS/YAGNI/TDD, naming, comments, security
    typescript.md      # strict types, error handling, tRPC + TanStack Query
    react.md           # APIs/state/components + performance, composition, view transitions
    react-native.md    # RN/Expo
    nextjs.md          # App Router basics + RSC boundaries, OG images, runtime, self-host
    web-design.md      # UX / a11y review checklist
    markdown.md        # aligned table formatting
    CREDITS.md         # attribution for distilled material
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
