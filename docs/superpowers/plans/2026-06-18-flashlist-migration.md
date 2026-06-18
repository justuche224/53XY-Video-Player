# FlashList Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home library and group-detail `FlatList`s with Shopify FlashList v2 for smoother thumbnail fling scrolling via cell recycling.

**Architecture:** Pure list-engine swap. Add `@shopify/flash-list`, then replace each `FlatList` with `FlashList`, keeping the same data/render/keying and dropping the now-redundant FlatList perf props. No behaviour change.

**Tech Stack:** Expo SDK 56, React Native 0.85 (new architecture), `@shopify/flash-list` v2, TypeScript, Jest (jest-expo).

## Global Constraints

- **Expo SDK 56 / RN 0.85 (new architecture only).** Per `AGENTS.md`, read https://docs.expo.dev/versions/v56.0.0/ before SDK code; verify thin docs against `node_modules/<pkg>/build/types/*.d.ts`.
- **Commits MUST NOT include any `Co-Authored-By:` or "Generated with / Claude Code" trailer.** Plain conventional commits.
- **Package manager is `bun`.** Add Expo-managed deps with `npx expo install`. Tests: `npm test`. Typecheck: `npx tsc --noEmit`.
- **`@shopify/flash-list` ships native code → a `npx expo run:android` rebuild is required to see it on-device** (the user runs this). Agent gate is `tsc` + tests only.
- **FlashList v2** auto-measures — do **not** set `estimatedItemSize` (the prop is removed in v2).
- **Android-only.**
- This is a UI/glue migration — no new Jest surface. Agent gate: `npx tsc --noEmit` + `npm test` green. The user device-verifies after rebuild.

---

### Task 1: Add the `@shopify/flash-list` dependency

**Files:**
- Modify: `package.json` (+ `bun.lock`)

**Interfaces:**
- Produces: `@shopify/flash-list` resolvable, exporting `FlashList` with TypeScript types — consumed by Tasks 2 and 3.

**Note:** This task gates the others — `tsc` of the screens (which import `FlashList`) needs the package installed. If the sandbox has no network and the install fails, report **BLOCKED** so the controller can have the user run the install; do not hand-edit `package.json` with a guessed version.

- [ ] **Step 1: Install via expo**

Run: `npx expo install @shopify/flash-list`
Expected: it resolves an SDK-56-compatible version and adds it to `package.json` `dependencies` + updates `bun.lock`.

- [ ] **Step 2: Verify it installed and types resolve**

Run: `grep '"@shopify/flash-list"' package.json` (expect a version line) and `ls node_modules/@shopify/flash-list/dist/index.d.ts` (or `node_modules/@shopify/flash-list/package.json` — confirm the package is present).
Then `npx tsc --noEmit` — expect clean (no source imports it yet, so this just confirms nothing broke).

- [ ] **Step 3: Confirm tests still pass**

Run: `npm test`
Expected: full suite green (adding a dep changes no behaviour).

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "build: add @shopify/flash-list for recycling lists"
```

---

### Task 2: Migrate the home library list (`index.tsx`)

**Files:**
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: `FlashList` from `@shopify/flash-list` (Task 1).
- Produces: no API change — the library list now uses FlashList.

**Note:** UI/glue. Verified by `tsc`/tests + user on-device.

- [ ] **Step 1: Update the `react-native` import (drop `FlatList`)**

Change line 5 from:

```ts
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
```

to:

```ts
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
```

- [ ] **Step 2: Add the FlashList import**

Immediately below the `react-native` import (before the `@/components/...` imports), add:

```ts
import { FlashList } from '@shopify/flash-list';
```

- [ ] **Step 3: Delete the `LIST_ROW_HEIGHT` constant and its comment**

Remove these three lines (currently around lines 23–25):

```ts
// List rows are fixed height (60px thumb + 8px vertical padding each side),
// so getItemLayout can skip measurement — the biggest list-scroll win.
const LIST_ROW_HEIGHT = 76;
```

- [ ] **Step 4: Replace the `<FlatList>` with `<FlashList>`**

Replace the entire `<FlatList … />` element (currently the `key={layout}` … `contentContainerStyle={…}` block) with:

```tsx
        <FlashList
          key={layout}
          data={visible}
          keyExtractor={(g) => g.key}
          numColumns={layout === 'grid' ? 2 : 1}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface }}>
              {refreshing ? 'Scanning…' : status === 'ready' ? 'No videos found.' : 'Loading…'}
            </Text>
          }
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
```

This drops the FlatList-only props (`initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `updateCellsBatchingPeriod`, `removeClippedSubviews`, `getItemLayout`) — FlashList's recycler replaces them.

- [ ] **Step 5: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass.

> If `tsc` complains only about the `index` route / `.expo/types/router.d.ts` typed-route entry, that's the known regen quirk (regenerated by `expo start`) — note it and proceed. Any other error is real.

- [ ] **Step 6: Commit**

```bash
git add src/app/index.tsx
git commit -m "perf(library): use FlashList for the home library list"
```

---

### Task 3: Migrate the group-detail list (`group.tsx`)

**Files:**
- Modify: `src/app/group.tsx`

**Interfaces:**
- Consumes: `FlashList` from `@shopify/flash-list` (Task 1).
- Produces: no API change — the episode list now uses FlashList.

**Note:** UI/glue. Verified by `tsc`/tests + user on-device.

- [ ] **Step 1: Update the `react-native` import (drop `FlatList`)**

Change line 5 from:

```ts
import { FlatList, Text } from 'react-native';
```

to:

```ts
import { Text } from 'react-native';
```

- [ ] **Step 2: Add the FlashList import**

Immediately below the `react-native` import (before the `@/components/...` imports), add:

```ts
import { FlashList } from '@shopify/flash-list';
```

- [ ] **Step 3: Replace `<FlatList>` with `<FlashList>`**

Replace the `<FlatList … >` opening tag (keeping the children and props identical) and its closing `</FlatList>` so the element reads:

```tsx
      <FlashList
        data={group?.items ?? []}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <EpisodeRow
            video={item}
            percent={progress.get(item.id)?.percent ?? 0}
            onPress={() => router.push({ pathname: '/player', params: { videoId: item.id, uri: item.uri, title: item.filename, groupKey: key, mode } })}
          />
        )}
        ListEmptyComponent={<Text style={{ color: colors.onSurface }}>Loading…</Text>}
      />
```

- [ ] **Step 4: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/group.tsx
git commit -m "perf(library): use FlashList for the group-detail list"
```

---

## Device verification checklist (for the user)

Requires a full rebuild: `npx expo run:android` (FlashList is native).

- [ ] Library **grid** scrolls/flings smoothly with thumbnails; two columns aligned, no clipped cards.
- [ ] Library **list** scrolls smoothly; rows look identical to before.
- [ ] Toggling grid↔list still re-lays-out correctly.
- [ ] **Group detail** episode list scrolls smoothly.
- [ ] Empty/loading states still appear ("Scanning…", "No videos found.", "Loading…").
- [ ] Sort, filters, search, tabs, and progress bars all still behave as before.

---

## Self-Review

**Spec coverage:**
- Add `@shopify/flash-list` via `expo install`; native-rebuild caveat → Task 1. ✓
- Home library swap, keep data/key/numColumns/`key={layout}`/empty/padding, drop FlatList perf props + `LIST_ROW_HEIGHT` → Task 2. ✓
- Group-detail swap (props unchanged) → Task 3. ✓
- No `estimatedItemSize` (v2) → not added anywhere. ✓
- No new Jest surface; gate = tsc + tests; user device-verifies → reflected in each task + checklist. ✓
- Out of scope (masonry, other lists, metrics) → absent. ✓

**Placeholder scan:** No TBD/TODO; full code in every code step. ✓

**Type consistency:** `FlashList` imported identically in Tasks 2 & 3 from `@shopify/flash-list` (added in Task 1); props used (`data`, `keyExtractor`, `numColumns`, `renderItem`, `ListEmptyComponent`, `contentContainerStyle`) are all valid FlashList v2 props; `renderItem`/`visible`/`layout`/`spacing` references match the existing `index.tsx` symbols. ✓
