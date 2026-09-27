# DRAFT — reply to review on es617/obsidian-sync-mcp#24 (not posted)

Thanks for the careful review — all three points addressed in 16e9f7c, and the branch is rebased onto current main (on top of #26, no conflicts).

1. **Code spans crossing paragraphs.** Inline masking now runs per blank-line-delimited chunk, so a code span can never cross a blank line (CommonMark/Obsidian). Added your cross-paragraph case as a test: `The user`s request … #important`, 20 `## Section i` sections with `#tag{i}`, and `… thats it`s done. #wrapup` joined by `\n\n` — all 22 tags survive (the test fails on the previous commit).

2. **Quadratic masking.** `maskInlineSpans` now collects all backtick runs in one pass and links each run to the next run of the same length (right-to-left scan with a `Map`), then masks left to right — O(n) overall. Behaviour for matched/unmatched runs is unchanged. Timing on one paragraph of unmatched runs of distinct lengths (`maskCode` only, same machine):

   | Input | Before | After |
   |---|---|---|
   | 1.25 MB | ~3.0 s | ~6 ms |
   | 8 MB | ~50 s | ~20 ms |

   Added a test that a ~2 MB pathological paragraph parses in under 2 s (generous bound; it takes a few ms).

3. **`\p{N}` → `\p{Nd}`.** Only decimal-digit tags are dropped now; `#Ⅳ` and `#²` are kept (new test). One note: `#١٢٣` (Arabic-Indic digits) is `\p{Nd}`, so it is still treated as numeric with this change. If you'd rather restrict the rule to ASCII `[0-9]` I'm happy to switch — I don't know which Obsidian does.

**Tested:** `npm run lint` clean; `npm test` 169/169 under both `TZ=UTC` and `TZ=Europe/Stockholm`; `npm run build` OK; `npm run test:e2e` 35/35.
