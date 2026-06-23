# Next.js App Router

## Special Files
- `page.tsx` — route
- `layout.tsx` — persistent wrapper
- `loading.tsx` — auto-Suspense
- `not-found.tsx` — 404
- `route.ts` — API
- `proxy.ts` — middleware (renamed from `middleware.ts` in 16+)

## Route Organization
- `(group)/` — no URL segment, separate layouts/auth
- `_folder/` — private, colocated non-routes
- `@slot` — parallel routes; `(.)folder` — intercepting routes

## Data Fetching
```tsx
fetch(url, { cache: 'force-cache' })           // static
fetch(url, { cache: 'no-store' })              // dynamic
fetch(url, { next: { revalidate: 3600 } })     // ISR
fetch(url, { next: { tags: ['posts'] } })      // tag-based
```
Default: no caching — opt-in explicitly
Non-fetch: `unstable_cache` with tags

## After Mutations
Always `revalidateTag('x')` or `revalidatePath('/x')`

## Rendering
| Content       | Strategy | Config              |
| ------------- | -------- | ------------------- |
| Marketing/docs | SSG     | default/`force-static` |
| Dashboards    | SSR      | `force-dynamic`     |
| Blog          | ISR      | `revalidate: 3600`  |
| Mixed         | PPR      | `experimental_ppr`  |

## Route Handlers vs Server Actions
- Route handlers: webhooks, public API, non-POST methods
- Server Actions: internal UI mutations

## Metadata
Every page needs `title` + `description`. Layout for defaults, page for overrides.
```tsx
// layout
export const metadata = { title: { default: 'App', template: '%s | App' } }
// page
export const metadata = { title: 'About' }  // → "About | App"
```

## Always Use
- `next/image` with `priority` for above-fold
- `next/font` (prevents layout shift)
- `await params` / `await searchParams` (they're async)

## Common Mistakes
❌ Proxy-only auth (verify in Server Components too)
❌ Not revalidating after mutations
❌ Route handlers for internal mutations
❌ Missing `priority` on hero images
❌ Forgetting `await` on params
