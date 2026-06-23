---
name: coding-standards
description: Use when writing or editing any code, or TypeScript, React, Next.js, or Markdown files — Patrick's default coding conventions for engineering principles, type safety, component design, App Router patterns, and table formatting.
---

# Coding Standards

## Overview

Patrick's default coding conventions. Load the reference for whatever you're touching — types, components, routes, or docs — and follow it. Conventions are opinionated defaults, not suggestions.

## When to Use

Invoke when editing or creating files of these kinds:

| Touching | Read |
| ----------------------------- | --------------------------------- |
| Any code file | [references/general.md](references/general.md) |
| `.ts` / `.tsx` types & logic | [references/typescript.md](references/typescript.md) |
| `.tsx` React components | [references/react.md](references/react.md) |
| Next.js App Router (`apps/web/**`) | [references/nextjs.md](references/nextjs.md) |
| `.md` files | [references/markdown.md](references/markdown.md) |

Editing a `.tsx` React component in a Next.js app touches all four — read each that applies.

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
