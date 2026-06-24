# pkvillanueva

Patrick's personal Claude Code plugin. Home for all reusable Claude Code setup —
starting with a default **coding-standards skill**, with room to grow into more
skills, agents, hooks, and slash commands.

## What it ships today

| Component      | What                                                                |
| -------------- | ------------------------------------------------------------------- |
| `skills/`      | `coding-standards`, `work-log` (write), `work-history` (query) skills |
| `hooks/`       | `worklog-reminder` Stop hook — nudges the agent to run `work-log`    |
| `scripts/`     | `query.js` — reads the work log back for the `work-history` skill    |
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

## Work log

Two model-invoked skills, no hook: `work-log` writes the log, `work-history`
reads it back.

- **Write:** automated and agent-decided — after finishing a substantive unit of
  work, Claude self-invokes the `work-log` skill, judges whether it's worth
  recording, and (if so) appends one timestamped past-tense line to
  `~/.claude/work-log/<YYYY-MM-DD>.md`, tagged with the project. Not a user
  command; trivial lookups and questions are skipped. The summary line is
  generated on **Haiku 4.5** (`claude-haiku-4-5`, the cheapest model) via a
  headless call, not on the session model — so logging costs almost nothing.
- **Nudge:** because a self-invoked skill gets dropped once context fills, a thin
  `Stop` hook (`hooks/worklog-reminder.js`) reminds the agent to consider
  `work-log` when a turn ends after real edits and nothing was logged. It carries
  no logging logic — just the reminder — and fires at most once per session, only
  when `Edit`/`Write`/`NotebookEdit` ran and `work-log` hasn't.
- **Query:** ask *"what did I do today / this week / this past month"* (optionally
  on a project) and the `work-history` skill runs `scripts/query.js` and narrates
  the result — also on **Haiku 4.5** via a headless call, keeping reads cheap too.

```md
# Work Log — 2026-06-24

- **16:42** — Split the work log into write + query skills _(project: claude)_
```

Logs live in `~/.claude/work-log/` (global, across all projects) and are not
committed. Query needs Node on `PATH`.

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
