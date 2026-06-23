# TypeScript

## Types
- `strict` mode, never `any` (use `unknown`)
- `type` for data, `interface` for extendable contracts
- Discriminated unions for state
- Prefer `satisfies` over assertions

## Naming
- Functions: verb+noun (`getUserById`, `validateEmail`)
- Booleans: `is`/`has`/`should`/`can` prefix
- Constants: `SCREAMING_SNAKE_CASE`

## TSDoc
Document: public APIs, exported functions, complex logic. Skip self-explanatory code.
Tags: `@param`, `@returns`, `@throws`, `@example`

## Error Handling

### Framework-Managed
- **tRPC**: Throw `TRPCError` — auto HTTP codes + client handling
- **TanStack Query**: Uses `error` state from failed fetches
- **Server Actions**: Return result object; throw only for `redirect()`/`notFound()`
- **Others**: Check framework docs for recommended pattern; ask if unclear

### Custom Async (choose per operation type)
- **Internal/infra**: Throw meaningful errors
- **Expected failures** (external APIs, I/O): Return `Result<T>`

```ts
// Define once in shared types
type Result<T> = { ok: true; data: T } | { ok: false; error: string }

// Usage
if (result.ok) result.data  // ✓ type-safe access
```

### Never
- Swallow errors (`catch {}`)
- Catch without logging or re-throwing

## Validation
- Prefer Zod for runtime validation
- Infer types: `type T = z.infer<typeof schema>`

## tRPC + TanStack Query

Use `@trpc/tanstack-react-query` (NOT legacy `@trpc/react-query`). Layout: `src/lib/trpc/{init,client,server,query-client}.{ts,tsx}` + `routers/`.

```tsx
// RSC page — prefetch + hydrate
const qc = getQueryClient();
await qc.prefetchQuery(trpc.x.queryOptions(input));
return <HydrateClient>{children}</HydrateClient>;

// Client
const trpc = useTRPC();
useQuery(trpc.x.queryOptions(input));
useMutation(trpc.x.mutationOptions({ onSuccess }));
queryClient.invalidateQueries({ queryKey: trpc.x.queryKey() });
```

- Same `trpc.x.queryOptions()` object on server + client — hydration matches automatically
- `await` prefetch for above-the-fold (no flash); `void` only with `useSuspenseQuery` + Suspense
- Shared `makeQueryClient` with superjson `serializeData`/`deserializeData` on both sides — Dates survive hydration
- RSC ctx is `React.cache`-wrapped and reuses cached `getSession()` → ≤1 auth lookup/render
- Never use `trpc.x.useQuery()` / `trpc.useUtils()` (legacy proxy hooks)
