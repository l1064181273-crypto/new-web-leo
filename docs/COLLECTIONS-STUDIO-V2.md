# Collections · Studio V2

## Design plan

The collection is a personal shelf, not a career case study. Keep the original images and known journal facts. Do not invent camera data, ratings, restaurant visits, listening history or further biography.

- Palette: cloud `#F6F8FA`, mist `#DCEAF0`, ink `#20384A`, lake `#5B8CC1`, paper `#E8EDE9`, copper `#D79253`. Photography uses a darkroom background; Cinema retains its existing muted violet and brass; Daybook is paper with blue-gray ink.
- Type: Manrope/system Chinese for controls and descriptions; Georgia/Songti for a few collection titles; monospace only for actual image positions, dates, durations and chart ranks.
- Layout: photography is a light table with a contact strip; diary is a dated index beside one page; cinema is a poster beside a viewing card; food is a menu beside a plate; Atlas is a searchable index; Music is an iPod beside its queue.
- Signature: the existing iPod becomes an actual small listening desk. Keep its physical controls and add an honest, legible library rather than decorative player statistics.

```
Photography [subject / favorites] → large image → caption / filmstrip
Daybook     [month / theme index] → photograph / original memory
Cinema      [type / watchlist]    → poster / viewing notes / source
Table       [flavor / saved menu] → dish / flavor notes
Atlas       [collections]         → search / sort / grid → viewer
Music       [iPod + controls]     | chart / favorites / local background
```

The plan was revised to avoid making every collection the same card grid: each collection keeps a distinct familiar object and browsing rhythm. Numbering appears only for real sequence or chart rank.

## Boundaries and integration

- Do not modify `media.ts` or restore removed `daily-1.jpg` / `photo-12.jpg`.
- `PhotographyApp` and `GalleryApp` accept optional `favoritesSaved`; Desktop owns the shared saved state.
- Desktop should give Music a normal draggable titlebar and a 760 × 600 default window. Collections owns the `.music-studio.is-library` layout; old special 232px shell styling must be removed by the Desktop owner.
- The existing Apple/iTunes previews remain linked to their official track pages. The chart is explicitly the archived 2024 chart, not a current or personal listening chart.
- The bundled lofi audio is named as a local background clip, not as a full song or an authored recording.
- All playback starts paused. Storage and playback failures must offer visible next steps.

## Verification log

First implementation complete: themed photo filters, touch/keyboard navigation and favorites; month/theme journal navigation and local bookmarks; filterable, readable cinema watchlist; filterable tasting list with random selection; searchable/sortable Atlas with category guide; shared Radix image viewer with zoom, swipe, Escape and trigger focus restoration; full iPod library, Apple source links and separate local background clip.

Checks run on the implementation:

- App TypeScript check: passed.
- Targeted ESLint for collection/music modules and tests: passed without warnings after playback invalidation cleanup.
- 16 targeted tests cover media-to-note identity, filtered navigation, touch swipe without accidental opening, dates, list persistence, failed storage, image-dialog keyboard/focus handling, silent audio startup, source switching, favorites, playback failures, stale cancelled-playback errors and subpath deployment of local audio. With the three existing media-index tests, the related suite is 19 tests.
- Existing 45-image index remains intact. No image files or `media.ts` modified.

Browser verification belongs to the main agent. Check 390px/320px layout, iPod/window scroll area, image proportions, mobile swipe, actual preview playback, and restore/minimize behavior before final acceptance. CSS and DOM tests do not establish those visual/audio results.

## Copy and accessibility pass

- Photography notes now describe the twelve actual images, inspected individually. Removed generic instructions to “observe” or “try looking”; no EXIF, travel history or authored biography was invented.
- Daybook uses the six original journal sentences from the feature baseline. Removed the additional generic blockquotes; stable media IDs still pair each sentence with its original photograph after filtering.
- Shortened food notes and removed repeated “flavor clues” prefixes. Cinema keeps useful local-save and source information without redundant personal-rating disclaimers.
- Local lofi uses `import.meta.env.BASE_URL`, so subpath deployment does not point to the domain root.
- Strengthened captions and inactive controls on light surfaces, including selected-row backgrounds. For example, `#486573` is 5.38:1 against `#e9f0f3` and 4.72:1 against selected `#d3e3ec`; `#587480` is 4.75:1 against paper `#f8fafb`. Cinema fades only inactive poster images, not their readable titles.
- Added 44px coarse-pointer targets for compact collection controls. This still needs the main agent's mobile browser review; it is not a claim of full WCAG conformance.

## Read-only performance audit

A paired Vite build froze the same 129 source text files and removed only unused QueryClient/Tooltip/Toaster/Sonner providers in memory. With app-level lazy loading already present, initial static JS fell from 594,452 bytes (gzip 189,982) to 466,666 bytes (gzip 149,455), saving 127,786 bytes / gzip 40,527. This was reported to the main agent, who owns `App.tsx`; figures are snapshot measurements, not live-site transfer metrics.

The main agent removed the unused providers. Desktop derivatives were generated and handed to the main agent; responsive collection thumbnails are now integrated as described in `COLLECTION-IMAGES-STUDIO-V2.md`. The image-index eager glob resolves URLs; it does not mean the browser fetches all gallery images at startup. Three.js is in the separately loaded sandbox, not the React entry bundle. Source/license provenance for third-party posters, artist photos, icon artwork and bundled audio still needs an honest asset inventory.

## Thumbnail and reliability pass

- Atlas grid/list/guide, Photography filmstrip, Cinema shelf and Music covers now use generated responsive candidates. The viewer, downloads and main feature images keep the original files. A failed candidate gets one original fallback, never an endless retry.
- Music uses one audio element per source URL. Switching or closing releases the old URL and buffer; explicit source tabs remain silent. Next/previous during loading carries the user's play intent. Cancellation, failure and the 15-second timeout stop the request; retry restores the URL. Ordinary pause/resume keeps the position and source.
- Old media events and rejected play promises cannot set a new source to playing or replace its error state. Each selected loading track gets its own timeout window. Saved volume is applied to each replacement audio element.
- Failed collection saves are visible inside the full-image dialog as well as the app. Footer copy no longer claims a failed save succeeded. Escape closes the viewer without bubbling to the enclosing desktop.
- Malformed/incompatible local settings use the shared hook's backup-before-overwrite behavior, now with a visible explanation. When a backup cannot be written, the original data stays untouched and in-session controls still work. Existing unknown or duplicate bookmark/watchlist/music IDs are normalized only when the user changes the list; the current small catalog cannot overflow the 100-ID saved schema.
- Existing static Wikipedia, Apple Music/iTunes and Billboard links remain HTTPS sources. New-tab links now explicitly declare `noopener noreferrer`; the earlier `noreferrer` already implied opener protection, so this is hardening/clarity, not a claim of a discovered injection vulnerability.
- The six related test files now contain 43 passing tests (collections 13, music 15, image variants 4, preference identities 3, stories/source integrity 5, original media 3). Targeted ESLint and app/node typecheck pass; a separate production Vite build resolves all new assets.

The shared local-state hook and Desktop integration were not edited in this pass. Browser visual/audio verification remains with the main agent, especially 320px/390px layout, high-DPR gallery selection, resume position after a normal pause, silence after source switching/closing and viewer focus restoration.

## Final collection reliability pass · 2026-09-12 23:55

The main agent's browser check found that removing the last filtered Cinema/Daybook item dropped keyboard focus onto the document. New tests reproduced the same issue across Cinema, Daybook, Table, Photography, Atlas and Music. These components now use a small collection-local focus helper:

- Record only an explicitly operated control that actually has focus.
- After rendering, restore focus only if that control disappeared and focus fell back to the document body. A background favorite update or nonfocused click does not move focus elsewhere in the desktop.
- Prefer the empty-state recovery button; if items remain, use the current collection/filter control. Activating the empty-state action also returns focus to a connected collection control.
- Closing a full-image dialog still returns to its original trigger when it exists. If removing a favorite removed that trigger, the collection's empty-state/filter action receives focus.

Photography previously used a live filtered array in its viewer, allowing the last favorite's removal to display `1 / 0`. It now keeps the opening list for that viewing session, matching Atlas. The image stays visible, the user can undo the favorite change, and next/previous positions remain consistent; closing and reopening uses the current filtered list. Tests cover both one-item and two-item lists.

Additional Music tests verify rapid next/next/cancel with out-of-order promise settlement, late native events from discarded audio, and a pending request from a closed player settling after a new player opens. Existing source/generation guards passed these cases without further playback changes. A read-failed preferences mount also preserves unknown stored data despite later successful reads/writes; closing and reopening reads the original volume/repeat settings without starting playback. Collection read-failure copy now explains this temporary window-only mode and the need to reopen after restoring permissions.

Verification: 7 files / 77 tests passed (collections 35, music 20, image variants 4, preference identities 3, stories/source integrity 5, original media 3, shared local-state hook 7). Targeted ESLint and app/node typecheck passed. Root owns browser confirmation and whole-project QA; the sandbox agent was independently adding test-first failure-boundary cases, so this pass does not claim a final whole-project test result.

### Explicit cross-tab limitation

The same desktop instance shares one favorites state between Photography and Atlas; a two-window integration test verifies both views and the persisted list agree after alternating additions/removals.

Independent browser pages do not automatically synchronize their local-state hook. Before the protection follow-up below, a read-only isolated jsdom probe executed the then-current hook source and demonstrated this sequence:

1. Mount A and B for the same initially empty key.
2. A adds `first-window-favorite`; B remains empty.
3. B adds `second-window-favorite`; storage contains only B's value, overwriting A's earlier change.
4. An external storage write plus a `storage` event changes stored data but neither mounted state updates.

That snapshot was last-writer-wins, not concurrent-safe persistence. The initial scoped pass did not modify shared persistence; the main agent subsequently authorized the narrow protection below in response to this reproduction. The probe used only synthetic in-memory storage, not user/browser data.

## Cross-window overwrite protection · 2026-09-13

With the main agent's explicit authorization, `useLocalState` now records the exact raw text from the last successful read/write. Before every write it compares the current key to that baseline; a differing value, deletion, malformed replacement or unknown format locks that mounted instance into memory-only mode. A backup of initially incompatible data is preceded by the same check, and the main key is checked again after that recovery copy is saved.

Matching `storage` events can mark a conflict earlier, but never replace a collection selection, music control or Notes draft. The event handler checks live storage rather than trusting a delayed event payload. Unrelated keys and sessionStorage events are ignored; an identical raw value is not a conflict. A failed verification read also locks the mount to memory. Recovery requires a fresh mount; later edits do not silently resume writes.

Collection notices distinguish conflict/read failure from a transient write error. `CollectionStorageMessage` accepts `reloadScope: "app" | "page"` (default `"app"`). Cinema, Daybook, Table and Music can close/reopen their own app. Photography and Atlas share Desktop-owned favorites, so their optional `favoritesRecovery` metadata is passed through to the full-image viewer and uses `"page"`: first export unsaved Notes or record current selections, then reload the whole desktop. Closing only these two collection apps cannot remount Desktop's storage hook. The main agent owns Desktop's metadata propagation and control-center notices.

The API remains a tuple of value/setter/saved/metadata; metadata adds `conflict: boolean` while retaining `recoveryRaw`, `recoveryKey`, and `readFailed`. Neither automatic merging, realtime value synchronization nor a database transaction was added. There is still no atomic compare-and-set in localStorage: two tabs that truly overlap between the read check and write can race. The new guard prevents demonstrated stale sequential overwrites, not every possible concurrent write. Prefer one editing tab for important local data.

New regressions cover two mounted writers; missing events; same-value writes; external replacement/deletion; recovery-time races; failed verification reads; delayed events; cleanup/remount; and conflict notices inside viewers. Notes can continue editing and export its current temporary text/JSON without overwriting the external copy. The four directly affected suites pass 118 tests (storage 21, Notes 37, collections 39, music 21); typecheck and targeted lint pass. A 00:10 whole-project snapshot had 312/314 passing, with only the main agent's two newly added Desktop integration cases still in their test-first red phase; it is not a final acceptance result.
