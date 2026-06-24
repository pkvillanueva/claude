# Next.js App Router

One file for all Next.js work. Basics first; deeper non-obvious rules below the divider.

**Sections:** [Special Files](#special-files) · [Routing](#route-organization) · [Data](#data-fetching) · [Rendering](#rendering) · [Metadata](#metadata) · then [RSC boundaries](#rsc-boundaries) · [Async APIs](#async-apis) · [Route handlers](#route-handlers) · [OG images](#og-images-nextog) · [Error/hydration](#error--hydration) · [Images/fonts](#images--fonts) · [Bundling](#bundling) · [Scripts](#scripts) · [Runtime](#runtime) · [Parallel routes](#parallel--intercepting-routes) · [Self-hosting](#self-hosting) · [Debug](#debug)

## Special Files
- `page.tsx` — route · `layout.tsx` — persistent wrapper · `loading.tsx` — auto-Suspense
- `not-found.tsx` — 404 · `route.ts` — API · `proxy.ts` — middleware (renamed from `middleware.ts` in 16+)

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
Default: no caching — opt-in explicitly. Non-fetch: `unstable_cache` with tags.
After mutations: always `revalidateTag('x')` or `revalidatePath('/x')`.

## Rendering
| Content        | Strategy | Config                 |
| -------------- | -------- | ---------------------- |
| Marketing/docs | SSG      | default/`force-static` |
| Dashboards     | SSR      | `force-dynamic`        |
| Blog           | ISR      | `revalidate: 3600`     |
| Mixed          | PPR      | `experimental_ppr`     |

## Metadata
Every page needs `title` + `description`. Layout for defaults, page for overrides.
```tsx
// layout
export const metadata = { title: { default: 'App', template: '%s | App' } }
// page
export const metadata = { title: 'About' }  // → "About | App"
```

## Always Use
- `next/image` with `priority` for above-fold · `next/font` (prevents layout shift)
- `await params` / `await searchParams` (they're async)

## Common Mistakes
❌ Proxy-only auth (verify in Server Components too) · ❌ Not revalidating after mutations · ❌ Route handlers for internal mutations · ❌ Missing `priority` on hero images · ❌ Forgetting `await` on params

---

Deeper rules below. This file's defaults above win on conflict; prefer current Next.js docs for anything version-specific.

## RSC boundaries
- Client components cannot be `async` — fetch in a server parent, pass data down (arrow-fn components too).
- Props server→client must be JSON-serializable. Non-serializable: functions, `Date`, `Map`/`Set`, class instances, `Symbol`, circular refs.
- ❌ `Date` to a client component — silently stringifies, then `.getFullYear()` crashes at runtime. ✅ pass `.toISOString()`, reconstruct client-side.
- Class instances lose methods; `Map`/`Set` get stripped — pass plain object/array.
- ✅ Exception: a `'use server'` function CAN be passed as a prop (`<ClientForm onSubmit={action} />`).

## Data (deep)
- Decision: server read → fetch directly; client mutation → Server Action; client read → pass from server parent, else Route Handler; external/webhook → Route Handler.
- Server Actions are POST-only — no HTTP caching. Prefer Route Handlers for cacheable reads.
- Preload pattern: wrap fetch in React `cache()`, expose `preloadX = () => { void getX(id) }`, fire early then await later.
- Same data in `generateMetadata` and the page → wrap fetch in `cache()` to dedupe.

## Async APIs
- `params`/`searchParams` are `Promise<...>` — type them so. In a non-async component use `React.use(promise)` instead of `await`.
- `cookies()` and `headers()` are async too — `await` them.
- Codemod: `npx @next/codemod@latest next-async-request-api .`

## Route handlers
- ❌ `route.ts` and `page.tsx` cannot coexist in the same folder — put the API under a separate path (`app/api/...`).
- Server-component-like env: async/await, `cookies()`/`headers()`, Node APIs — but NO React hooks, NO React DOM, NO browser APIs.
- Methods: `GET POST PUT PATCH DELETE HEAD OPTIONS`. Read search params via `new URL(request.url).searchParams`.

## Metadata (deep)
- `metadata`/`generateMetadata` work ONLY in server components. If the page is `'use client'`: move client logic to a child, or put metadata in a parent server layout.
- `viewport`/`generateViewport` are separate from metadata; `themeColor` lives there, not in metadata.
- Static metadata files often suffice: `icon`/`apple-icon`, `opengraph-image`/`twitter-image` (Twitter falls back to OG), `sitemap.ts`, `robots.ts`, `manifest.ts` — drop in `app/` or any segment.
- `generateSitemaps` → many sitemaps; `generateImageMetadata` → multiple OG images per route.

### OG images (`next/og`)
- Import from `next/og`, NOT `@vercel/og`. Avoid Edge runtime — use default Node.
- ❌ no access to `searchParams` — use route `params`. Flexbox only (`display:'flex'`), no Grid, inline-object styles only.
- Convention exports: `alt`, `size = {width:1200,height:630}`, `contentType`. Custom fonts: read TTF with `fs`, pass via `fonts:[{name,data,style}]`.

## Error / hydration
- `error.tsx` and `global-error.tsx` MUST be `'use client'`. `global-error.tsx` renders its own `<html>`/`<body>`.
- ❌ Never wrap navigation APIs in try-catch — `redirect`/`permanentRedirect`/`notFound`/`forbidden`/`unauthorized` work by throwing. Call OUTSIDE try-catch, or `unstable_rethrow(error)` first in the catch.
- `redirect` = 307, `permanentRedirect` = 308 (browser-cached — only for real URL migrations). `unauthorized()`/`forbidden()` render `unauthorized.tsx`/`forbidden.tsx`.
- Errors bubble to the nearest `error.tsx`; root-layout errors escape to `global-error.tsx`.
- Hydration mismatch causes: browser APIs in render, `new Date()`/`toLocaleString` (timezone), `Math.random()` ids, invalid HTML nesting, DOM-mutating scripts.
  - Browser/date values → render in `useEffect` after a mounted flag, or a `<ClientOnly>`. Generated ids → `useId()`.
- `useSearchParams()` without a `<Suspense>` boundary bails the WHOLE page to CSR — wrap the consumer. `usePathname()` needs Suspense in dynamic routes (unless `generateStaticParams`); `useParams`/`useRouter` never do.

## Images / fonts
- `fill` without `sizes` downloads the largest variant — always set `sizes` (`"100vw"`, `"(max-width:768px) 100vw, 33vw"`).
- ❌ Don't use `width`/`height` as an aspect-ratio hint — use real display dims, or `fill` + `sizes` + `objectFit`.
- Local imported images auto-infer dims + free `placeholder="blur"`; remote images need explicit dims + manual `blurDataURL`.
- Static export (`output:'export'`) breaks optimization → `images.unoptimized` or custom `loader`.
- ❌ Instantiating a `next/font` inside a component creates a new instance every render — define ONCE (layout or `lib/fonts.ts`), share via `variable`/`.className`.
- Prefer variable fonts; else list only weights you use. Always set `subsets`. `display:'swap'` is the sane default. ❌ No `@import`/`<link>` for Google Fonts.

## Bundling
- `window`/`document`/`localStorage is not defined` in a server component → `dynamic(() => import('x'), { ssr: false })` or a `'use client'` wrapper.
- `serverExternalPackages: [...]` — server-side packages that won't bundle (native bindings: `sharp`, `bcrypt`, `canvas`; some ORMs).
- `transpilePackages: [...]` — ESM/CJS interop errors (`Cannot use import statement outside a module`).
- Browser-only libs needing `ssr:false`: `recharts`, `react-quill`, `mapbox-gl`, `monaco-editor`, `lottie-web`.
- Next bundles 50+ polyfills — ❌ don't load polyfill.io. Import CSS, never `<link rel="stylesheet">`.
- Turbopack default in 15+ — migrate `webpack:` config to `serverExternalPackages`/`transpilePackages`. Analysis (16.1+): `next experimental-analyze`.

## Scripts
- Use `next/script`, not raw `<script>`. Inline scripts REQUIRE an `id`. ❌ Don't put `<Script>` inside `next/head`.
- Strategies: `afterInteractive` (default), `lazyOnload` (idle), `beforeInteractive` (root layout only), `worker` (experimental).
- GA/GTM/YouTube/Maps → `@next/third-parties/google`.

## Runtime
- Default to Node runtime. Only `runtime = 'edge'` if the project already uses it OR there's a real latency need AND all deps are edge-compatible (no `fs`, limited `crypto`).

## Parallel / intercepting routes
- Every `@slot` MUST have `default.tsx` (return `null`) or hard nav / refresh 404s — including each slot nested in route groups.
- Matchers are by route SEGMENT, not folder: `(.)` same level, `(..)` one up, `(...)` from root. ❌ `(..)` ≠ "parent folder".
- Close modals with `router.back()` — NOT `router.push('/')`/`<Link>` (adds history, leaves the intercepted route mounted, flashes the modal).
- Hard-navigating to the intercepted URL renders the full page (expected). To show a modal there too, render `<Modal>` in the full page as well.

## Self-hosting
- `output: 'standalone'` for Docker → minimal `server.js`. Does NOT include `public/` or `.next/static/` — copy both manually. Set `HOSTNAME="0.0.0.0"` + `PORT`.
- ❌ ISR breaks across multiple instances — filesystem cache is per-instance. Fix with a shared `cacheHandler` (Redis/S3) + `cacheMaxMemorySize: 0`. Same for `revalidatePath`/`revalidateTag`. Re-test on every Next upgrade.
- `NEXT_PUBLIC_*` is baked in at build time — expose runtime values via a Route Handler reading `process.env`. Add `/api/health` for load balancers.

## Debug
- Dev server exposes `/_next/mcp` (JSON-RPC over POST) — default-on in 16+, else `experimental.mcpServer: true`. Find the real port. Tools: `get_errors`, `get_routes`, `get_logs`, `get_server_action_by_id`.
- `next build --debug-build-paths "/dashboard"` (16+) rebuilds only matching routes for fast build-error iteration.
