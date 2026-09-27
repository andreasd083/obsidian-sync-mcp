<!-- DRAFT reply to es617 on es617/obsidian-sync-mcp#25. Not posted. Not part of the PR content; drop this file before any push to the PR branch. -->

Thanks for the careful review. All four points are addressed, and the branch is rebased on current `main`.

**Rebase.** Rebased onto `main` at 953f4e9 (#26). No conflicts: #26 only touches `delete_note` in `src/tools.ts`, and `search_notes` sits in a different part of the file.

**1. Unbounded `terms`.** `terms` now has `.max(20)` in the zod schema (`SEARCH_MAX_TERMS`, mentioned in the parameter description). Behind it, the new `cleanSearchTerms()` trims the terms, drops empty ones and clamps to 20, so a caller that skips schema validation still can't make the scan unbounded. Tests: the schema accepts 20 terms and rejects 21, and the clamp keeps exactly 20, with empty terms dropped before clamping.

**2. Two writers, no ordering.** `SearchIndex.update()` now skips a write when its mtime isn't newer than the mtime recorded for text the index already holds. That way a stale catch-up batch can't overwrite a newer watcher update, and the other way round. The guard only applies when text is already present, because mtimes loaded from the persisted metadata come without text and the startup rebuild has to fill them in. Writes without an mtime, and a note that was removed and then recreated, go through as before. Tests: a newer write followed by an older one keeps the newer text, tags and mtime, and the older text can't be found. An equal mtime is skipped and a newer one wins. A second test checks that mtimes loaded from disk don't block the rebuild. With the guard removed, the race test fails.
One caveat: mtime is a wall-clock value. If a device's clock runs far behind the server's, an edit made there right after a server-side write (which records `Date.now()`) could be treated as stale until the next edit. A CouchDB seq would avoid that, but the catch-up callback doesn't carry seq today. I kept mtime to keep the diff small. Happy to switch to seq if you'd prefer.

**3. Invalid `DISPLAY_TIMEZONE`.** The new `resolveDisplayZone()` builds an `Intl.DateTimeFormat` with the configured zone once, when the module loads at startup. An invalid zone logs a warning and falls back to `UTC`, so `search_notes` keeps working. The README row notes the fallback. Test: a valid zone is kept, `Not/AZone` returns `UTC` with exactly one warning, and the status-line formatter works with the fallback.

**4. SECURITY.md.** The old "not cached" wording is gone. It now says plainly that for `search_notes` the server keeps the full decrypted text of every note in process memory for its whole lifetime, so with E2E encryption on, the whole vault's plaintext is in memory and readable to anyone who can read that process (core dump, swap, debugger, compromised host). It also says note text is never written to disk. I also corrected the stale "50 matches" search cap line: it is 20 hits with one context line each, plus the 20-term cap.

**Tested:** `npm run lint` clean; `TZ=UTC npm test` 196/196; `TZ=Europe/Stockholm npm test` 196/196; `npm run test:e2e` 40/40; `npm run build` OK.
