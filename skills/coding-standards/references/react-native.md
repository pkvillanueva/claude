# React Native (Expo)

Terse, opinionated defaults for performant Expo apps. Priority: rendering crashes > lists > animation > navigation/UI > state > config.

## Rendering (CRITICAL — crashes)
- Wrap every string in `<Text>` — a bare string under `<View>` is a hard crash.
- ❌ `{count && <X/>}` when `count` could be `0`/`""` — renders the falsy value → production crash.
- ✅ `{count ? <X/> : null}`, `{!!count && <X/>}`, or early `return null`. Enable `react/jsx-no-leaked-render`.

## Lists (CRITICAL — perf)
- Virtualize everything — `LegendList`/`FlashList`, never `ScrollView` + `.map()`, even for short lists. ScrollView mounts all children upfront.
- ❌ Don't `map`/`filter` data before passing to a list — new refs reparent the whole list on every change. Pass stable `data`; transform inside items.
- New array instance is fine if inner object refs are stable (e.g. `tlds.toSorted(...)`).
- Pass primitives (not objects) to items so `memo()` shallow-compare works — `<Row id={item.id} name={item.name} />`, not `<Row user={item} />`.
- ❌ No inline objects/styles in `renderItem` — breaks memoization. Hoist static styles to module scope or derive inside the memoized child.
- Hoist callbacks to one instance at the list root; items call it with their id. ❌ no `onPress={() => handle(item.id)}` inline.
- Memoize item components with `memo()`; derive styles inside them.
- Keep items lightweight — no queries, no `useContext` chains, no expensive `useMemo`. Fetch in parent, pass pre-computed props down.
- Prefer Zustand selectors over Context inside items (re-render only when *that* value changes); read parent-derived state inside the item, not as a prop.
- Heterogeneous lists: add a `type` field + `getItemType={(i) => i.type}` so each layout gets its own recycling pool. Pair with `getEstimatedItemSize` per type. Use `recycleItems`.
- Always load compressed/thumbnail images sized for display (2x for retina): `${url}?w=200&h=200&fit=cover`.
- React Compiler on → `memo`/`useCallback` unneeded, but stable-reference rules still apply.

## Animation (HIGH)
- Animate only `transform` (translate/scale/rotate) and `opacity` — GPU, no layout. ❌ Never animate `width/height/top/left/margin/padding` (layout recalc every frame). Collapse via `scaleY` + fixed height + `transformOrigin`.
- State = ground truth, not visuals. Store `pressed` (0/1) / `progress` / `isOpen`; derive `scale`/`opacity`/`translateY` via `interpolate`. Same for React state: `const height = isExpanded ? 200 : 0`, don't store it.
- `useDerivedValue` to derive one shared value from another (declarative, auto-deps). `useAnimatedReaction` only for side effects (haptics, logging, `runOnJS`).
- Animated press states → `GestureDetector` + `Gesture.Tap()` with shared values, NOT `Pressable` `onPressIn/Out` (worklets run on UI thread, no JS round-trip). `runOnJS(onPress)()` in `.onEnd`.

## Scroll (HIGH)
- ❌ Never track scroll position in `useState` — render thrash, dropped frames.
- ✅ `useAnimatedScrollHandler` + shared value (for animation) or `useRef` (non-reactive). `scrollEventThrottle={16}`.

## Navigation (HIGH)
- Native navigators only. Stack → `@react-navigation/native-stack` or expo-router's default `Stack`. ❌ avoid `@react-navigation/stack`.
- Tabs → `react-native-bottom-tabs` / expo-router `NativeTabs`. ❌ avoid `@react-navigation/bottom-tabs` when native feel matters.
- Use native header options (`title`, `headerLargeTitleEnabled`, `headerSearchBarOptions`) over custom `header:` components — get large titles, blur, search, safe areas free.
- iOS native tabs auto-enable content inset on the root ScrollView of each tab (`disableAutomaticContentInsets` to opt out).

## Native UI (HIGH)
- Images → `expo-image` (caching, blurhash, progressive). Key props: `placeholder` (blurhash), `contentFit`, `transition`, `priority`, `cachePolicy`, `recyclingKey`. Cross-platform → `SolitoImage`.
- Lightbox/gallery → `@nandorojo/galeria` (native shared-element transitions, pinch/double-tap zoom, pan-to-close). ❌ don't hand-roll a Modal. Works with any image component + FlashList.
- Menus/dropdowns/context menus → native via `zeego` (`zeego/dropdown-menu`, `zeego/context-menu`) — accessibility + platform UX free. ❌ no custom JS dropdowns.
- Modals/sheets → native `<Modal presentationStyle="formSheet">` or React Navigation v7 `presentation: 'formSheet'` (`sheetAllowedDetents: 'fitToContents'`). ❌ avoid JS bottom-sheet libs.
- `Pressable` over `TouchableOpacity`/`TouchableHighlight`. Inside lists use `Pressable` from `react-native-gesture-handler` (with its `ScrollView`).
- Safe areas → `contentInsetAdjustmentBehavior="automatic"` on root ScrollView. ❌ no `SafeAreaView` wrapper or manual `paddingTop: insets.top`.
- Dynamic top/bottom spacing → `contentInset` (+ `scrollIndicatorInsets`), not padding (no layout recalc). Static spacing → padding is fine.
- Measure views → `useLayoutEffect` (sync, `getBoundingClientRect()` on RN 0.82+) for initial + `onLayout` for updates. ❌ avoid imperative `measure()`. Compare in a dispatch updater to skip re-renders.

## Styling (MEDIUM)
- `StyleSheet.create` or Nativewind.
- Always `borderCurve: 'continuous'` with `borderRadius` (smooth iOS corners).
- `gap` on parent for spacing between, `padding` for space within. ❌ no per-child margins.
- Gradients → `experimental_backgroundImage: 'linear-gradient(...)'`, not a gradient lib.
- Shadows → CSS `boxShadow: '0 2px 8px rgba(0,0,0,0.1)'`, not `shadow*` objects or `elevation`.
- Hierarchy via `fontWeight` + grayscale color, not many font sizes.

## State (MEDIUM)
- Minimize state; derive everything possible during render. ❌ no `useEffect` to sync derived values (`total`, `fullName`, `itemCount`).
- State = user intent / ground truth. Init `undefined`, fall back with `??` to prop/server value → reactive fallback that updates when source changes; user choice persists once set. ❌ don't seed `useState(prop)`.
- Use dispatch updaters when next state depends on current: `setCount(p => p + 1)`. For non-primitive state, compare in the updater and `return prev` to skip re-render. Primitives can set directly.

## React Compiler (MEDIUM)
- Destructure functions from hooks at top of render: `const { push } = useRouter()`. ❌ don't dot into objects in callbacks (`router.push`) — compiler keys cache on the unstable object.
- Reanimated shared values: use `.get()`/`.set()`, never `.value` — compiler can't track property access (`count.set(count.get() + 1)`).

## Design System (MEDIUM)
- Compound components over polymorphic children. A component taking a `string` child must be a dedicated `*Text`. Buttons → `<Button><ButtonIcon/><ButtonText/></Button>`. ❌ no `children: string | ReactNode`.
- Re-export deps from a design-system folder; app imports from `@/components/*`, not packages directly. Start by re-exporting; customize later without touching app code.

## Monorepo / Config (LOW)
- Native deps must be installed in the app package's `package.json` (autolinking only scans the app's `node_modules`) — even if a shared package also lists it.
- One exact version per dep across the repo (no `^`/`~`). Enforce with syncpack or root `pnpm.overrides`/resolutions.
- Fonts → `expo-font` config plugin (embedded at build), not `useFonts`/`Font.loadAsync` — no async loading state. Run `npx expo prebuild` + rebuild after adding.
- Hoist `Intl.DateTimeFormat`/`NumberFormat`/`RelativeTimeFormat` to module scope (expensive to instantiate); `useMemo` keyed on locale for dynamic locales.
