# General Engineering

Applies to any code edit, language-agnostic.

## Principles
- **SOLID** — single responsibility, open/closed, Liskov, interface segregation, dependency inversion
- **DRY** — extract after 3+ *identical* usages (not similar-looking)
- **KISS** — simplest solution that works
- **YAGNI** — don't build for hypotheticals
- **TDD** — tests first when practical; cover business logic, edge cases, regressions; skip trivial code

## Search Before Creating
- Always search the codebase first for existing functions, components, hooks, utils before creating new ones
- Reuse > recreate

## Avoid Over-Engineering
- Skip abstraction when: one implementation, 1-2 usages, no current requirement
- Justify when: multiple implementations exist, real extension points, team boundaries
- Rule: 3 usages before abstracting, real pain before optimizing

## Comments
- Explain "why" not "what"
- Delete commented-out code
- Keep updated or remove

## Security
- Never log sensitive data — passwords, tokens, API keys, PII
