# 53XY — Visual Cohesion & Design System (spec)

**Date:** 2026-06-25
**Status:** Approved design — ready for plan.
**Topic:** A design-system-first visual overhaul. Functionality is v2-complete; this pass addresses *looks and cohesion*, not features.

---

## 1. Why

53XY is functionally solid but visually incoherent. The Material You color extraction is the only consistently good thing. Concrete pain points (user-reported + audited):

- **Typography is 100% ad-hoc.** No shared text styles — list-row titles are 14px in one component, 15px in another, 16px in a third; weights wander 500/600/700 with no rule. This is the single biggest cause of "nothing feels related."
- **Spacing/radius tokens exist (`SPACING`, `RADIUS`) but ~40% of values are hardcoded** — FAB radius, tab pill, modal padding, input padding all bypass the scale.
- **Every list row is a one-off.** Thumbnails are 96×60 in some rows, 110×64 in others; trailing actions are improvised per screen.
- **Home feels wrong, especially list mode.** The floating Resume FAB sits "way too high" and reads as detached.
- **Playlist detail trailing controls** (up/down arrows + trash crammed together) feel off.
- **Settings is a cluttered mega-scroll** — wants splitting into sub-screens.
- **No elevation scale, no icon-size scale** — icons range 11→64px arbitrarily; only the FAB has elevation.

### Direction (locked in brainstorming)

- **Approach:** Design-system-first — establish shared tokens + component anatomy, *then* apply screen by screen. Fixes the root cause before touching layouts.
- **Ambition:** "M3 + a signature" — correct Material 3 foundation, plus deliberate signature touches so 53XY is recognizably itself.
- **Signatures:** All three approved, built in sequence (not all at once): a **continue-watching hero**, a **typographic voice**, and a **signature media card**.

## 2. Goals / Non-goals

**Goals**
- One shared typography ramp; zero ad-hoc `fontSize`/`fontWeight` in screens.
- Proper M3 **tonal elevation** (surfaces lighten/tint with elevation) — no drop shadows.
- One canonical list row + card + list-item, replacing the per-screen variants.
- A continue-watching hero that replaces the floating Resume FAB.
- Settings decomposed into a landing list + focused sub-screens.
- Restrained, intentional motion; reduce-motion respected.

**Non-goals**
- No new product features. No data-model, scanning, grouping, or player-logic changes.
- Not abandoning Material You — we double down on doing M3 *correctly*.
- No maximalist/expressive redesign; personality is concentrated in the signatures, everything else stays quiet and disciplined.

## 3. Foundation tokens

Extend `src/theme/resolve-theme.ts` and add shared primitives. The theme provider (`@pchmn/expo-material3-theme`) exposes the **full M3 tonal ramp**: `surfaceContainerLowest/Low/Container/High/Highest`, `surfaceDim`, `surfaceBright`, `surfaceTint` — confirmed present.

### 3.1 Typography ramp

A `typography` token map + an `<AppText variant=…>` wrapper component (`src/components/app-text.tsx`). Screens stop setting type by hand.

| variant | size / weight | family | used for |
|---|---|---|---|
| `display` | 28 / 700 | **display** | screen titles, `53XY` wordmark |
| `headline` | 22 / 600 | display | hero title, dialog titles |
| `title` | 16 / 600 | body | list-row titles (replaces 14/15/16 variance) |
| `titleSmall` | 14 / 600 | body | dense row titles |
| `body` | 14 / 400 | body | supporting text |
| `label` | 13 / 600 | body | chips, buttons, tabs |
| `meta` | 12 / 500 | body | counts, folder paths, durations |
| `episode` | 12 / 700 | body | `S01E04` labels (color = `primary`) |

- `AppText` accepts `variant`, `color` (defaults to `onSurface`), and standard `Text` props (`numberOfLines`, etc.). Line-height baked into each variant.
- Variants are the only sanctioned way to render text in screens/components going forward.

### 3.2 Typographic voice (signature #2)

- **Display font: Space Grotesk** (distinctive, geometric, free; great for the `53XY` wordmark). Loaded via `expo-font`. Body stays **Roboto / system**.
- The font family is a **single token** (`FONTS.display`) — swapping to Sora/Outfit/etc. later is a one-line change.
- Only `display`/`headline` variants use the display face; everything else stays system for legibility.

### 3.3 Elevation

`elevation(level: 0|1|2|3)` → background color from the tonal ramp:

| level | surface token | used for |
|---|---|---|
| 0 | `background` / `surface` | screen background |
| 1 | `surfaceContainerLow` | search bar, resting cards |
| 2 | `surfaceContainer` | hero card, raised rows |
| 3 | `surfaceContainerHigh` | dialogs, sheets, menus |

No `shadowColor`/`elevation` (Android shadow) usage except where a floating element genuinely needs separation; default is tonal.

### 3.4 Icon, radius, spacing

- `ICON = { sm: 18, md: 24, lg: 28, hero: 64 }` — replaces scattered 11→64 values.
- `RADIUS` gains `xl: 28` (hero/large cards). FAB and tab pill routed through `RADIUS` tokens.
- `SPACING` scale unchanged; hardcoded values eliminated as each component is rebuilt.

## 4. Shared component anatomy

Coherence comes from collapsing per-screen variants into a small set of canonical components.

- **`MediaRow`** — one list row replacing `group-row`, `episode-row`, `history-row`, `playlist-item-row`, `playlist-row`. Fixed anatomy:
  - Leading 16:9 thumbnail at **one** size (target ~100×56, `RADIUS.sm`), with the standard duration badge.
  - Middle: `title` (or `titleSmall` in dense lists) + a `meta` line + optional `episode` label + optional progress sliver.
  - **Trailing slot** (prop): chevron, overflow `⋮`, drag handle `≡`, or count — chosen per usage.
  - Full-width ripple, ~72px min touch target, consistent vertical padding.
- **`MediaCard`** — grid card. Progress woven into the poster's **bottom edge** as a `primary`-tinted bar (signature #3). Pill duration badge using a `surface`/scrim tint, not harsh `rgba(0,0,0,.75)` black.
- **`ListItem` + `SectionHeader`** — M3 list rows for Settings/nav: leading icon, headline + supporting text, trailing switch/chevron. Used to build the split Settings screens.
- **`AppBar`** — unifies headers (supersedes / wraps `screen-header`). Home variant = large **`53XY` wordmark** in the display face + actions; detail variant = back affordance + title.
- **Unified destructive / reorder affordance:**
  - **Swipe-to-delete** everywhere (History already has it; Playlist detail adopts it) — one delete gesture across the app.
  - **Drag handle `≡`** in the trailing slot for reorder — replacing the cramped up/down-arrows + trash cluster on Playlist detail.

## 5. The three signatures (layered, in order)

1. **Continue-watching hero** — a real card at the top of Home: poster (thumbnail/collage), ▶ overlay, title, episode label, "18m left" + progress bar; tap resumes. **Removes the floating Resume FAB entirely** (the source of "FAB too high / home feels wrong"). Hidden when nothing resolves to resume (`resolveLastPlayed` already gates this). Reuses existing resume resolution + group/next-prev wiring.
2. **Typographic voice** — display font for wordmark + `display`/`headline` variants (see §3.2).
3. **Signature media card** — progress-into-poster + branded duration/episode treatment, applied consistently across hero, grid cards, and rows.

## 6. Screen applications

- **Home (`(tabs)/index.tsx`)** — `AppBar` wordmark → continue-watching hero → search + segmented tabs → `MediaRow`/`MediaCard` list. `resume-fab` removed.
- **Group detail (`group.tsx`)** — `AppBar` + `MediaRow` (episode trailing/label).
- **History (`(tabs)/history.tsx`)** — `MediaRow` + existing swipe-delete (now the shared pattern) + `SectionHeader` day buckets.
- **Playlists list (`(tabs)/playlists.tsx`)** — `MediaRow`.
- **Playlist detail (`playlist.tsx`)** — `MediaRow` with drag-handle reorder + swipe-delete; app bar holds play / edit / delete cleanly (replaces the off-feeling inline controls).
- **Settings — split into sub-screens.** Landing (`(tabs)/settings.tsx`) becomes a tidy `ListItem` list:
  - **Player** → background play, PiP (new route).
  - **Library filters** → min/max duration, name patterns (new route).
  - **Hidden folders** → folder ignore list (new route).
  - **About** → version/info (new route).

  Each sub-screen uses `ListItem`/`SectionHeader` + `AppBar` back. The current single-scroll content moves into these routes; the existing filter/setting logic (`filter-settings`, `setting-switch`, repos) is reused unchanged.

## 7. Motion (restrained)

Keep what works (tab-pill spring, `pressable-scale`). Add: hero entrance, list-item ripples, sub-screen push transitions. Respect `prefers-reduced-motion` / RN reduce-motion. No ambient/decorative motion — over-animation is what makes UIs read as AI-generated.

## 8. Phasing → implementation plans

Each phase is independently shippable and device-verifiable, matching the plan-by-plan workflow (brainstorm → writing-plans → subagent-driven-development → user device-verify → merge).

1. **Foundation** — `typography` + `AppText`, `elevation`, `ICON`, `RADIUS.xl`, load Space Grotesk. Migrate existing `Text` usages to `AppText` opportunistically.
2. **Shared components** — `MediaRow`, `MediaCard`, `ListItem`, `SectionHeader`, `AppBar`, duration badge.
3. **Home + hero** — wordmark AppBar, continue-watching hero (remove `resume-fab`), roll `MediaRow`/`MediaCard` across library/group/history/playlists.
4. **Settings split** — landing list + Player / Library filters / Hidden folders / About routes.
5. **Motion polish.**

> Phases 1–3 deliver the bulk of the perceived improvement. Phases 4–5 are completion. The spec covers all five; plans may be written per-phase.

## 9. Testing & verification notes

- Pure/tokenized logic stays unit-testable: `typography`/`elevation`/`ICON` resolvers get a small Jest test (correct family/size per variant, correct surface token per level). No snapshot/visual tests.
- No native modules touched → JS-only; `npx expo start` reload suffices. **Exception:** loading a new font may need an asset bundle reload — note in the plan.
- Per task: `npx tsc --noEmit` clean + `npm test` green + commit-clean.
- Device verification (visual) deferred to the user's build, per project convention.

## 10. Risks / open notes

- **Font loading flash:** gate first render on `expo-font` ready (already a splash/font pattern in Expo Router) to avoid FOUT.
- **`@pchmn` tonal tokens** are typed as `Record<string, string>` (flat) in `resolve-theme.ts` — `elevation()` reads keys defensively with a `surfaceVariant` fallback if a tone is ever absent.
- **FlashList rows:** `MediaRow` height must stay stable for recycling — fixed thumbnail size + capped `numberOfLines` keep row height predictable.
- Font family choice (Space Grotesk) is intentionally a token; revisit cheaply if disliked on-device.
