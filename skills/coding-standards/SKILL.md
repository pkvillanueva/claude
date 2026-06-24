---
name: coding-standards
description: Patrick's default coding conventions — engineering principles, type safety, component and API design, React performance, composition, view transitions, Next.js App Router, React Native/Expo, UI/UX and accessibility review, and Markdown formatting. Use whenever writing, editing, creating, refactoring, scaffolding, or reviewing code — especially TypeScript, JavaScript, React, React Native, or Next.js (.ts, .tsx, .jsx files, components, hooks, server actions, App Router routes) and Markdown (.md). ALWAYS consult this before producing or changing any code or .md file, even tiny edits, so output follows the house style.
---

# Coding Standards

## Overview

Patrick's default coding conventions. Load the reference for whatever you're touching — types, components, routes, or docs — and follow it. Conventions are opinionated defaults, not suggestions.

## When to Use

Invoke when editing or creating files of these kinds. One reference per domain — load the one(s) the task touches, then jump to the section you need (each domain file has a section index up top). Progressive disclosure: don't load files the task doesn't touch.

| Touching / doing                   | Read                                                |
| ---------------------------------- | --------------------------------------------------- |
| Any code file                      | [references/general.md](references/general.md)       |
| `.ts` / `.tsx` types & logic       | [references/typescript.md](references/typescript.md) |
| React (`.tsx`) — incl. perf, composition, view transitions | [references/react.md](references/react.md) |
| React Native / Expo                | [references/react-native.md](references/react-native.md) |
| Next.js App Router (`apps/web/**`) | [references/nextjs.md](references/nextjs.md)         |
| Reviewing UI for UX / a11y         | [references/web-design.md](references/web-design.md) |
| `.md` files                        | [references/markdown.md](references/markdown.md)     |

A `.tsx` React component in a Next.js app touches general + typescript + react + nextjs — read each that applies.

`react.md`, `react-native.md`, `nextjs.md`, and `web-design.md` are owned, distilled from Vercel's agent-skills (see [references/CREDITS.md](references/CREDITS.md)). With React Compiler on, ignore the manual-memo advice in `react.md`'s Performance section.

## Quick Reference

- **General** — SOLID/DRY/KISS/YAGNI/TDD, search before creating, 3 usages before abstracting, kebab-case files, comments explain "why", never log secrets.
- **TypeScript** — `strict`, never `any` (use `unknown`), `type` for data / `interface` for contracts, `satisfies` over assertions, Zod for runtime validation. tRPC via `@trpc/tanstack-react-query`.
- **React 19+** — Server Components by default, `"use client"` only when needed, named exports, React Compiler handles memoization, semantic HTML + a11y.
- **Next.js** — App Router special files, explicit `cache` opt-in, always revalidate after mutations, `await params`/`searchParams`, every page has `title` + `description`.
- **Markdown** — vertically aligned tables.

## Common Mistakes

- Skipping the reference because "I know the conventions" — read it; the details (caching defaults, async params, Result types) are easy to get wrong from memory.
- Manual `useMemo`/`useCallback` when React Compiler is on — remove them.
- Forgetting `revalidateTag`/`revalidatePath` after a mutation.
