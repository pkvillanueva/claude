# Vendor Vercel React skills into pkvillanueva

**Date:** 2026-06-24

> **Superseded (same day):** the vendored standalone skills were later distilled
> into lean, *owned* deep-dive references under `coding-standards/references/`
> (`react-performance.md`, `react-composition.md`, `react-view-transitions.md`,
> `react-native.md`, `web-design.md`, `nextjs-deep.md`) and the `skills/vercel-*`
> dirs removed. Attribution: `coding-standards/references/CREDITS.md`. This doc is
> kept as a record of the intermediate vendoring step.

## Problem

`vercel-labs/agent-skills` ships Agent Skills (`SKILL.md` format), not Claude
Code plugins — no `plugin.json`/`marketplace.json`. So they cannot be added to
`pkvillanueva`'s `dependencies` like the other bundled plugins; a manifest-less
marketplace source is rejected on install.

## Decision

Vendor the React-related skills directly into this plugin's `skills/`
(same mechanism as `coding-standards`). Standalone skills, cross-linked from
`coding-standards`. No merging of content.

### Scope — 4 skills (React, incl. native)

| vendored dir | upstream `skills/<name>` | content |
| --- | --- | --- |
| `vercel-react-best-practices` | `react-best-practices` | SKILL.md + `rules/` (~70) |
| `vercel-composition-patterns` | `composition-patterns` | SKILL.md + `rules/` (~9) |
| `vercel-react-view-transitions` | `react-view-transitions` | SKILL.md + `references/` |
| `vercel-react-native-skills` | `react-native-skills` | SKILL.md + `rules/` (~35) |

Excluded: `web-design-guidelines`, `writing-guidelines`, `vercel-optimize`,
`deploy-to-vercel`, `vercel-cli-with-tokens`.

### Approach

- **Copy whole folders** (incl. `README.md`/`AGENTS.md`/`metadata.json`).
  Preserves MIT attribution, keeps SKILL.md internal links intact, makes re-sync
  a plain recopy. Claude reads only `SKILL.md` + what it links; extra files inert.
- Skill names are already `vercel-`prefixed upstream → no collision with
  `coding-standards`.
- **Provenance:** `skills/VENDORED.md` records source repo, commit, update steps.

### Cross-link

- `coding-standards/SKILL.md` routing table → pointer rows to the 4 skills.
- `coding-standards/references/react.md` → pointer + **precedence note**: the
  React-Compiler default (no manual `useMemo`/`useCallback`) overrides Vercel's
  manual-memo rules where they conflict.

### Housekeeping

- README "What it ships today" lists the 4 skills.
- Bump `plugin.json` version `0.1.3` → `0.1.4`.
- No `marketplace.json` / `dependencies` changes.

## Source

`vercel-labs/agent-skills` @ `f8a72b9`, MIT.
