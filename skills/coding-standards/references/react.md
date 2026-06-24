# React 19+

One file for all React work. Read the section the task needs — APIs/state/components for everyday code, Composition for API design, Performance for tuning, View Transitions for animation.

**Sections:** [APIs](#apis) · [State](#state) · [Components](#components) · [Composition](#composition) · [Accessibility](#accessibility) · [Error / Testing](#error--testing) · [Naming](#naming) · [Performance](#performance) · [View Transitions](#view-transitions)

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

## Composition

Compose parts, don't pile on props. Core moves: avoid boolean props · compound components · lift state to providers · DI state via a generic context interface · explicit variants · children over render props.

### Avoid boolean-prop proliferation
- No `isThread`/`isEditing`/`isDM` flags to switch behavior — each boolean doubles states and breeds conditional spaghetti.
- Compose the pieces a use-case needs; eliminates impossible states and hidden conditionals.

❌ `<Composer isThread isEditing showFormatting={false} />`
✅ `<ThreadComposer channelId="abc" />`

### Compound components
- Structure complex UI as subcomponents sharing one context — not one component with `show*` knobs.
- Subcomponents read shared state from context, not props — no drilling. Export as a namespace.

```tsx
const Composer = { Provider, Frame, Input, Footer, Submit }
<Composer.Provider state={state} actions={actions} meta={meta}>
  <Composer.Frame><Composer.Input /><Composer.Submit /></Composer.Frame>
</Composer.Provider>
```

### Explicit variants
- One named component per use-case (`ThreadComposer`, `EditMessageComposer`) — self-documenting. Each wraps its own provider + parts; shared internals, no shared monolith.

### Children over render props
- Default to `children` — readable, compose naturally. Render props ONLY when the parent must pass data back.

❌ `<Composer renderHeader={() => <H/>} />`
✅ `<List data={items} renderItem={({item}) => <Item item={item} />} />` — data flows back, fits.

### Lift state into providers
- Move state into a provider so siblings outside the main UI can read/act. Provider boundary > visual nesting. Kills prop drilling and `useEffect` up-syncing.

❌ `useEffect(() => onInputChange(state.input), [state.input])` to sync up
✅ Lift to provider; `ForwardButton` outside `Composer.Frame` calls `actions.submit` via context.

### Generic context interface (DI)
- ONE generic shape, three buckets: `state`, `actions`, `meta`. UI consumes the interface, never a concrete hook — same UI across different state backends. Swap provider, keep UI.

```tsx
interface ComposerContextValue {
  state: ComposerState; actions: ComposerActions; meta: ComposerMeta
}
```

- ❌ `function ChannelComposer() { const s = useGlobalChannelState(id) }` — hook leaks into UI.
- ✅ `ChannelProvider` owns `useGlobalChannel(id)`; `ChannelComposer` just composes `Composer.*`.

### React 19 component APIs
- `ref` is a regular prop — drop `forwardRef`. `use(Context)` replaces `useContext` (callable conditionally).

❌ `forwardRef<T,P>((props, ref) => …)` ✅ `function X({ ref, ...props }) {}`

## Accessibility
- Semantic HTML: `button`/`a`/`nav`/`main` over `div`/`span`
- Buttons=actions, links=navigation (never swap)
- `<label htmlFor>`, visible focus, keyboard accessible
- `aria-label` icons, `aria-live` dynamic, focus trap modals
- Test: `eslint-plugin-jsx-a11y`, `@axe-core/react`
- Full UI review checklist: [web-design.md](web-design.md)

## Error / Testing
- `react-error-boundary`, try-catch for handlers/async
- React Testing Library — test behavior; `@testing-library/user-event`
- Mock at network boundary, colocate tests

## Naming
- Hooks: `use` prefix; Handlers: `handle`/`on` prefix

---

## Performance

Ordered by impact. **With React Compiler on, skip manual `memo`/`useMemo`/`useCallback` — it handles those** (ignore the Re-renders memo advice below).

### Waterfalls (CRITICAL — each sequential await adds full network latency)
- Independent async ops → `Promise.all()`, never sequential awaits.
- Start independent promises early, await late — kick off `auth()` + `fetchConfig()` before awaiting either.
- Nested fetches: chain per-item inside the map so one slow item doesn't block others — `ids.map(id => getChat(id).then(c => getUser(c.author)))`, not two sequential `Promise.all`s.
- Defer `await` into the branch that uses it — early-return/guard before fetching.
- Check cheap sync conditions before awaiting a flag — `if (cond) { if (await getFlag()) ... }`.
- Stream with `<Suspense>`: render an async leaf inside a boundary instead of awaiting in the parent. Skip for above-the-fold/SEO/tiny queries.
- Share one promise across components via `use(promise)` — fetches once, both suspend together.

### Server (RSC / Next.js)
- RSCs fetch sequentially down a tree — parallelize by composing sibling async components instead of awaiting in the parent.
- Authenticate + authorize INSIDE every Server Action — they're public endpoints. Validate input (zod) → auth → authorize → mutate.
- Minimize RSC→client serialization — pass only fields the client uses (every prop is serialized into the payload).
- ❌ Don't pass both original and a derived copy across the boundary — `.toSorted()`/`.filter()`/`.map()`/`{...obj}` make new refs and double the payload. Transform in the client.
- ❌ Never store request data in module-level mutable vars — server module scope is process-wide; concurrent renders leak across users.
- `cache()` from `react` for per-request dedup of DB/auth/non-fetch work (`fetch` auto-dedups). Don't pass inline objects as args — shallow equality misses.
- LRU cache (`lru-cache`) for cross-request reuse; Redis for traditional serverless.
- Hoist static I/O (fonts, logos, config) to module level — loads once, not per request.
- `after()` for non-blocking post-response work (analytics, cleanup) — runs even on failure/redirect.

### Bundle (CRITICAL — drives TTI/LCP)
- ❌ Barrel imports cost 200-800ms/cold-start. Next.js 13.5+: named imports + `optimizePackageImports`; else import direct subpaths. Affects `lucide-react`, `@mui/*`, `react-icons`, `lodash`, `date-fns`, `@radix-ui/*`.
- `next/dynamic` (`{ ssr: false }`) for heavy components not needed first render (editors, charts, modals).
- Defer analytics/tracking to after hydration via `dynamic(..., { ssr: false })`.
- Conditionally `import()` large modules only when the feature activates.
- Preload on intent — `onMouseEnter`/`onFocus` → `void import('./heavy')`.
- Keep import/`fs` paths statically analyzable — literal-keyed maps of `() => import(...)`, not `import(variable)`.

### Re-renders
- ❌ Never define a component inside another — new type each render → remount, lost state/focus. Pass props.
- Derive values during render; don't mirror props/state into state via `useEffect`.
- Run user-action side effects in the event handler, not state+effect.
- ❌ Don't subscribe to state you only read in a callback (e.g. `useSearchParams` for a click handler) — read `window.location` on demand.
- Subscribe to derived booleans, not continuous values — `useMediaQuery('(max-width:767px)')` re-renders on transition, not every pixel.
- Functional `setState(curr => ...)` for state-derived updates — stable callbacks, no stale closures.
- Lazy `useState(() => expensive())` — initializer otherwise runs every render. Skip for primitives.
- `useRef` (not state) for transient high-frequency values (mouse pos); mutate DOM directly via ref.
- Split combined `useMemo`/`useEffect` with independent deps. Narrow effect deps to primitives — `[user.id]` not `[user]`.
- `startTransition` for frequent non-urgent updates; `useDeferredValue` + `useMemo` to keep input responsive during expensive filtering.
- `useTransition`'s `isPending` over manual `isLoading` — auto-resets on throw, handles interrupts.
- Extract expensive work into a `memo` child to allow early returns before the work runs.
- Hoist non-primitive default params to a module constant (`const NOOP = () => {}`) so `memo` equality holds.
- ❌ Don't `useMemo` a cheap primitive expression — memo + dep-compare costs more.

### Rendering
- `content-visibility: auto` + `contain-intrinsic-size` on long-list items — skips off-screen layout/paint.
- `<Activity mode={open ? 'visible' : 'hidden'}>` to preserve state/DOM of expensive toggled components.
- Ternary, not `&&`, where the left side can be `0`/`NaN` — `count > 0 ? <Badge/> : null`.
- Hoist static JSX (esp. large SVGs) to module constants.
- Resource hints from `react-dom`: `prefetchDNS`/`preconnect` for third-party origins, `preload`/`preinit` for critical fonts/CSS.
- Scripts: `defer` (ordered) or `async` (independent); in Next.js `next/script` with `strategy`.
- Animate a wrapping `<div>`, not the `<svg>` — SVG transforms often aren't GPU-accelerated. Reduce SVG precision (`npx svgo --precision=1`).
- Client-only data (theme from localStorage): synchronous inline `<script>` setting the DOM before hydration — avoids SSR crash + flicker.
- `suppressHydrationWarning` only on genuinely expected mismatches (dates, random ids).

### Client data
- SWR — auto dedup/cache/revalidate; `useImmutableSWR` static, `useSWRMutation` writes.
- Dedup global event listeners across hook instances via a module-level registry + `useSWRSubscription`.
- `{ passive: true }` on `touchstart`/`wheel`/scroll listeners that never `preventDefault()`.
- localStorage: version keys, store only needed fields (no tokens/PII), wrap get/set in try/catch.

### JS micro-opt (hot paths only)
- `new Set`/`new Map` for repeated membership/lookup — O(1) vs `.includes`/`.find`. Build an index map once for repeated joins.
- Single loop with multiple `.push`es instead of multiple passes; `.flatMap(x => cond ? [y] : [])` to map+filter in one.
- Length check before expensive array comparison. Loop for min/max, not `sort()`.
- `.toSorted()`/`.toReversed()`/`.with()` over mutating `.sort()` (mutation breaks immutability).
- Cache deep property access / function results when repeated in a loop or render. Cache `localStorage`/`cookie` reads in memory.
- Hoist `RegExp` to module scope (beware `/g` `lastIndex`). Early-return once the result is known.
- Batch DOM writes then read once — don't interleave style writes with layout reads (`offsetWidth`).
- `requestIdleCallback` (with `timeout` + `setTimeout` fallback) for non-critical work.

### Effects (advanced)
- `useEffectEvent` to read latest props/state in an effect without adding them as deps. Don't put the effect-event fn in the dep array.
- Store handlers in refs (or `useEffectEvent`) so subscriptions don't re-bind on every callback change.
- App-wide init that must run once → module-level `didInit` guard or entry-module top level, not `useEffect([])`.

---

## View Transitions

Animate UI states via the browser's `document.startViewTransition`. Declare *what* with `<ViewTransition>`, trigger *when* with `startTransition`/`useDeferredValue`/`Suspense`, control *how* with CSS classes. Unsupported browsers skip gracefully.

### When to use
Every `<ViewTransition>` must communicate spatial relationship or continuity. Can't say what it means? Don't add it. Implement **all** applicable patterns, in order: shared element (`name`) → Suspense reveal → list identity (`key`) → state change (`enter`/`exit`) → route change (layout-level).

Style: hierarchical/ordered nav → directional `nav-forward`/`nav-back` slides. Lateral nav (tab-to-tab) → fade or `default="none"` (❌ never directional — falsely implies depth). Revalidation → `default="none"` (silent).

### Availability
- **Next.js:** App Router bundles React canary. Works out of the box. ❌ Do NOT install `react@canary` (`npm ls react` showing stable is expected).
- **Without Next.js:** install `react@canary react-dom@canary`. Browsers: Chromium 111+, Firefox 144+, Safari 18.2+.

### Core
```jsx
import { ViewTransition } from 'react';
<ViewTransition><Component /></ViewTransition>
```
React auto-assigns `view-transition-name` and calls `startViewTransition`. ❌ Never call `startViewTransition` yourself; ❌ never use raw `viewTransitionName` CSS to *trigger* (it only isolates).

Triggers: `enter` / `exit` / `update` (innermost wins) / `share`. Only `startTransition`/`useDeferredValue`/`Suspense` activate VTs — plain `setState`/`flushSync` do not.

✅ Placement: VT must appear *before any DOM node* or enter/exit is suppressed.
```jsx
<ViewTransition enter="auto" exit="auto"><div>x</div></ViewTransition>  // ✅
<div><ViewTransition>...</ViewTransition></div>                          // ❌ wrapper kills enter/exit
```

### Props & CSS
Values: `"auto"` (cross-fade), `"none"`, `"class-name"`, or `{ [type]: value, default: ... }`. If `default="none"`, all triggers off unless listed.
✅ Use `default="none"` liberally — else every VT cross-fades on *every* transition. Always pair `enter` with `exit`.
Pseudo-elements: `::view-transition-old/new/group/image-pair(.class)`. ❌ Don't hand-write animation CSS — copy recipes; always add the reduced-motion query.

### Transition types
Tag context with `addTransitionType` (stackable) so VTs react differently.
```jsx
startTransition(() => { addTransitionType('nav-forward'); router.push('/detail/1'); });
```
- `enter`/`exit` need not be symmetric. TS: type-keyed objects **require** a `default` key (missing → `"auto"`).
- ❌ Types NOT available during Suspense reveals — use plain string props there.
- ❌ `router.back()` / browser back-forward skip VTs (synchronous `popstate`). Use `router.push()` with explicit URL.

### Shared elements
Same `name` on an unmounting + mounting VT morphs between them (`share="morph"`). Names globally unique (`photo-${id}`), one mounted per name.
- ❌ Named VT in a component rendered in *both* modal and page mounts twice, breaks morph — make name conditional.
- `share` beats `enter`/`exit`; add a fallback when no pair forms. ❌ Never fade-out exit a page with a shared morph — slide.
- Big text size change (`h3`→`h1`) ghosts → use a `text-morph` class.

### Patterns
- **Enter/exit:** `{show && <ViewTransition enter="fade-in" exit="fade-out"><Panel/></ViewTransition>}`
- **List reorder:** wrap each item, trigger in `startTransition`. ❌ No wrapper `<div>` between list and VT.
- **Shared-in-list:** two nested boundaries — outer `key` (list identity), inner `name`+`share` (shared element).
- **Suspense reveal:** separate VTs for fallback (`exit`) and content (`enter` + `default="none"`); plain string props. Bare VT around `<Suspense>` = zero-config cross-fade.
- **Cross-fade without remount:** omit `key` → `update`. ⚠️ keying a `<Suspense>` remounts and refetches.
- **Filter/search:** `useDeferredValue` (client) or `startTransition` + `router.replace` (server). Add `default="none"` to per-item named VTs.
- **Helpers:** `<Activity>` preserves state; `useOptimistic` resolves before snapshot (use committed state for animated content); imperative `onEnter`/`onExit`/`onUpdate`/`onShare`.
- **Isolate persistent elements** (header/nav): `style={{ viewTransitionName: 'persistent-nav' }}` + isolation CSS. ❌ Don't put manual `viewTransitionName` on the root inside a `<ViewTransition>`.

### Multiple VTs & Next.js
- All VTs matching a trigger fire together. ❌ Nested limitation: when a parent VT exits, inner VTs don't fire enter/exit — no per-item staggering on nav.
- `next.config.js`: `experimental: { viewTransition: true }` to animate `<Link>` nav — then any `default="auto"` fires on every click → use `default="none"`.
- `<Link transitionTypes={['nav-forward']}>` works in Server Components (needs flag + Next 15 canary / 16+).
- ❌ No layout-level VT wrapping `{children}` if pages have their own VTs — nested VTs never fire, animations die. Place directional VTs in **pages, not layouts**.
- `loading.tsx` is an implicit Suspense boundary: skeleton VT (`exit`) there, content VT (`enter default="none"`) in the page.
- Same-route dynamic segment (`/collection/[slug]`) stays mounted → use `key` + `name` + `share`.

### Timing & pitfalls
Toggle 100-200ms · route slide 150-250ms · Suspense reveal 200-400ms · shared morph 300-500ms.
- ❌ Bare VT w/o `default="none"` → cross-fades everything. ❌ Directional VT in layout → never fires.
- ❌ Type maps on Suspense reveals. ❌ `useOptimistic` for list order (resolves before snapshot).
- ❌ Hash fragments → scroll jumps. ❌ `border-radius` lost → apply to the captured element. Batching: A→B→C→D collapses to B→D.
