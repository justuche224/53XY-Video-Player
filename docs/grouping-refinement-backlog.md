# Grouping Refinement Backlog

Captured from the first real on-device scan (Plan 2A debug list, SM-S901N, 373 groups).
The grouping engine (`src/library/normalize-title.ts` + `parse-episode.ts` + `group-videos.ts`)
works for `SxxExx`-style names but under-groups several real-world formats below.

**Guiding principle:** refine by recognizing more *episode patterns*, NOT by fuzzy
string-merging — fuzzy merge would wrongly fuse distinct shows. Each rule below should
land as new fixtures in `normalize-title.test.ts` / `parse-episode.test.ts` first (TDD).

## Confirmed-good (regression fixtures to keep)
- `La casa de papel A K A Money Heist` → 8 grouped ✅
- `Saved by the Bell` → 10 grouped ✅
- `Boston Legal` SxxExx-format → 16 grouped ✅

## Under-grouping patterns to fix (with real examples)
1. **Numeric season+episode codes (no S/E):** `201 Boston Legal`, `215 Boston Legal`,
   `Boston Legal 301 Can't We All` — `2NN`/`3NN` is season+episode. Rule: detect a 3-digit
   code (1–3 digit season + 2-digit ep) as an episode marker and cut the title there.
   Risk: don't strip 3-digit numbers that are part of a real title — require it to be
   adjacent to other episode signals or positionally a prefix/standalone token.
2. **`Show - NNN - Episode Title`:** `Boston Legal - 216 - Live Big`,
   `Boston Legal - 302 - New Kids on the Block` — cut at the ` - NNN - ` infix.
3. **Trailing separator artifact:** `Boston Legal -` (group title kept a dangling dash).
   Rule: trim trailing/leading `-`, `–`, `·`, spaces after normalization.
4. **Appended episode titles:** after the episode marker, everything (incl. the human
   episode title) must be dropped — already true for `SxxExx`, extend to the numeric forms.
5. **Screen recordings:** `Screen Recording 20250421 153822 Delta Force` — consider grouping
   by trailing app name (`Delta Force`) or a single "Screen recordings" bucket; low priority.

## Correctly ungrouped (leave as singletons — NOT bugs)
- Camera/timestamp names: `20231119 163112`, `20260613 092747`, `IMG 8499`.
- Hash/CDN names: `0792400c7aab44abb8a1e603b1483330`, `A001 03061102 C001`.
- One-off downloads / promo-titled clips: `Night Teeth NF 800MB -GalaxyRG`,
  `Ju81Zt1D7aZugDS ... Live Wallpaper`, gymtok/fyp clips.

## Notes
- The pure engine means this can be tuned independently any time; 2B (UI) renders whatever
  groups exist and is unblocked.
- Also pending from 2A final review: drop overly-aggressive `english`/`hq` from QUALITY_TAGS.

## Resolved (grouping refinement pass)
- ✅ Dropped over-eager `english`/`hq` from QUALITY_TAGS.
- ✅ Trailing/leading separator trim ("Boston Legal -" → "Boston Legal").
- ✅ Dash-delimited episode numbers cut ("Boston Legal - 216 - Live Big" → "Boston Legal").
- ✅ Conservative corroborated merge: numbered titles ("201 Boston Legal", "Boston Legal 301 …") fold into a clean anchor group when one exists; movies like "127 Hours"/"Apollo 13" are never mangled (guard tests added).
- Still by-design-split (no anchor): number-prefixed siblings with no clean anchor (e.g. "201 Mystery"/"202 Mystery"). Screen-recording bucketing still low-priority/open.
