# React 19+

## APIs
- `use` — not a hook, works in conditionals/loops, reads promises (needs Suspense) or context
- `useActionState` — form state + pending + errors; `useFormStatus` — pending in children (inside form)
- `useOptimistic` — instant UI, auto-revert on error
- `ref` as prop (no `forwardRef`), `"use client"`/`"use server"` directives
- `useTransition`/`startTransition` — non-urgent updates; `useDeferredValue` — defer expensive values
- Default to Server Components — Client only when needed

## State
- React state first: `useState` simple, `useReducer` complex
- Context for DI (not frequent updates)
- Discriminated unions: `"idle" | "loading" | "success" | "error"`
- Server state: TanStack Query/SWR (never Redux/Zustand for API data)
- Complex client: Zustand/Jotai only when Context insufficient

## Components
- Functional only, single responsibility, never nested definitions
- Composition over inheritance, fragments, destructured props, ES6 defaults
- Custom hooks: one thing well, compose for complexity
- Prefer named exports over `export default` (easier refactoring, consistent naming)

## Performance
- React Compiler: handles memoization — remove manual `useMemo`/`useCallback`
- Without Compiler: profile first, then `React.memo`/`useMemo`/`useCallback` (all props must be memoized)
- `React.lazy` + Suspense for code splitting

## Accessibility
- Semantic HTML: `button`/`a`/`nav`/`main` over `div`/`span`
- Buttons=actions, links=navigation (never swap)
- `<label htmlFor>`, visible focus, keyboard accessible
- `aria-label` icons, `aria-live` dynamic, focus trap modals
- Test: `eslint-plugin-jsx-a11y`, `@axe-core/react`

## Error/Testing
- `react-error-boundary`, try-catch for handlers/async
- React Testing Library — test behavior; `@testing-library/user-event`
- Mock at network boundary, colocate tests

## Naming
- Hooks: `use` prefix; Handlers: `handle`/`on` prefix
