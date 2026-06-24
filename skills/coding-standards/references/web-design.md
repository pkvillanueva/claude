# Web Design Guidelines

Reviewer checklist for UI code. Group findings by file, use terse `file:line` format.

## Accessibility
- Icon-only buttons need `aria-label`; decorative icons get `aria-hidden="true"`.
- Form controls need a `<label>` (via `htmlFor`/wrapping) or `aria-label`.
- Images need `alt` (`alt=""` if decorative).
- Async updates (toasts, validation) need `aria-live="polite"`.
- Semantic HTML first (`<button>`, `<a>`, `<label>`, `<table>`) before reaching for ARIA.
- Headings hierarchical `<h1>`–`<h6>`; include a skip link to main content.
- `scroll-margin-top` on heading anchors.
- ✅ `<button>` for actions, `<a>`/`<Link>` for navigation. ❌ `<div onClick>`.

## Focus States
- Interactive elements need a visible focus ring (`focus-visible:ring-*`).
- Prefer `:focus-visible` over `:focus` (no ring on click).
- Use `:focus-within` for compound controls.
- ❌ `outline-none`/`outline: none` without a focus replacement.

## Interaction & Touch
- `touch-action: manipulation` to kill double-tap zoom delay.
- Set `-webkit-tap-highlight-color` intentionally.
- `overscroll-behavior: contain` in modals/drawers/sheets.
- Buttons/links need `hover:` feedback; hover/active/focus must out-contrast rest state.
- During drag: disable text selection, `inert` on dragged elements.
- Destructive actions need a confirmation modal or undo window — never immediate.
- `autoFocus` sparingly: desktop only, single primary input, avoid on mobile.

## Forms
- Inputs need `autocomplete` and a meaningful `name`.
- Correct `type` (`email`, `tel`, `url`, `number`) and `inputmode`.
- Labels clickable; checkboxes/radios share one hit target with their label (no dead zones).
- Submit stays enabled until request starts; show spinner during request.
- Errors inline beside fields; focus the first error on submit, with fix/next step.
- Placeholders end with `…` and show an example pattern.
- Disable spellcheck on emails/codes/usernames (`spellCheck={false}`).
- `autocomplete="off"` on non-auth fields to avoid password-manager triggers.
- Warn before navigating away with unsaved changes (`beforeunload`/router guard).
- ❌ Never block paste (`onPaste` + `preventDefault`).

## Layout & Content
- Text containers handle long content: `truncate`, `line-clamp-*`, or `break-words`.
- Flex children need `min-w-0` to allow truncation.
- Handle empty states — don't render broken UI for empty strings/arrays.
- Anticipate short, average, and very long user-generated input.
- Prefer flex/grid over JS measurement for layout.
- Avoid stray scrollbars: `overflow-x-hidden` on containers, fix root overflow.
- Full-bleed layouts need `env(safe-area-inset-*)` for notches.

## Typography
- `…` not `...`; curly quotes `"` `"` not straight `"`.
- Non-breaking spaces: `10&nbsp;MB`, `⌘&nbsp;K`, brand names.
- Loading states end with `…`: `"Loading…"`, `"Saving…"`.
- `font-variant-numeric: tabular-nums` for number columns/comparisons.
- `text-wrap: balance`/`text-pretty` on headings to prevent widows.

## Animation
- Honor `prefers-reduced-motion` (reduced variant or disable).
- Animate `transform`/`opacity` only (compositor-friendly).
- List properties explicitly; set correct `transform-origin`.
- SVG: transform the `<g>` wrapper with `transform-box: fill-box; transform-origin: center`.
- Animations must be interruptible by user input mid-flight.
- ❌ `transition: all`.

## Images & Performance
- `<img>` needs explicit `width`/`height` (prevents CLS).
- Below-fold: `loading="lazy"`. Above-fold critical: `priority`/`fetchpriority="high"`.
- Large lists (>50): virtualize (`virtua`, `content-visibility: auto`).
- No layout reads in render (`getBoundingClientRect`, `offsetHeight`, `scrollTop`); batch reads/writes.
- Prefer uncontrolled inputs; controlled inputs must be cheap per keystroke.
- `<link rel="preconnect">` for CDN/asset domains.
- Critical fonts: `<link rel="preload" as="font">` with `font-display: swap`.

## Navigation & State
- URL reflects state — filters, tabs, pagination, expanded panels in query params.
- Deep-link stateful UI; if it uses `useState`, consider URL sync (nuqs or similar).
- Links use `<a>`/`<Link>` to support Cmd/Ctrl+click and middle-click.

## Theming & Hydration
- `color-scheme: dark` on `<html>` for dark themes (fixes scrollbars, inputs).
- `<meta name="theme-color">` matches page background.
- Native `<select>`: explicit `background-color`/`color` (Windows dark mode).
- Inputs with `value` need `onChange` (or `defaultValue` for uncontrolled).
- Guard date/time rendering against hydration mismatch; `suppressHydrationWarning` only where truly needed.

## Locale & i18n
- Dates/times via `Intl.DateTimeFormat`; numbers/currency via `Intl.NumberFormat` — never hardcode.
- Detect language via `Accept-Language`/`navigator.languages`, not IP.
- Wrap brand names, code tokens, identifiers with `translate="no"`.

## Content & Copy
- Active voice, second person: "Install the CLI" not "The CLI will be installed".
- Title Case (Chicago) for headings/buttons; numerals for counts ("8 deployments").
- Specific button labels: "Save API Key" not "Continue".
- Error messages include the fix/next step, not just the problem.
- `&` over "and" where space-constrained.

## Anti-patterns (flag on sight)
- `user-scalable=no`/`maximum-scale=1` disabling zoom.
- `onPaste` + `preventDefault`; `transition: all`; `outline-none` without focus-visible.
- `<div>`/`<span>` with click handlers (use `<button>`); inline `onClick` nav without `<a>`.
- Images without dimensions; large arrays `.map()` without virtualization.
- Inputs without labels; icon buttons without `aria-label`.
- Hardcoded date/number formats; `autoFocus` without justification.
