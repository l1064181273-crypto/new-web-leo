# Field Notes · data and mobile boundaries

Field Notes remains a browser-local notebook, not a messaging service. The existing `leo-desktop-notes-v1` storage key, the two clearly marked example notes, and existing user titles/bodies are preserved. No browser containing real user notes was used for deletion tests.

## Changes

- Mobile list: a real modal drawer scoped to the Notes surface. Its opener exposes `aria-expanded` and `aria-controls`; opening focuses the close button without forcing the phone keyboard open. Escape, the close control and outside interaction dismiss it; selecting a note returns focus to the editor. Desktop keeps the ordinary sidebar.
- Imports: a single commit helper synchronizes the latest note data immediately. Delayed file reads merge with the latest edits/new notes rather than the snapshot from the moment the file picker opened. Current selection is preserved. Cancelled, superseded and unmounted reads cannot later write their result.
- Validation: supported version-1 backups and legacy plain note arrays still work. Invalid JSON, unsupported envelopes, invalid fields/dates, duplicate IDs, title/body length limits and capacity errors have specific Chinese guidance. A BOM at the start of a JSON file is accepted without changing characters inside note text. Failed validation never partially imports.
- Capacity: the 200-note total explicitly includes recent deletions. Moving to trash remains recoverable and does not free a slot. A separate single-note or whole-trash permanent-delete action shows an alert dialog, names/counts its targets, defaults focus to Cancel, offers a backup button and requires an explicit confirmation.
- Permanent deletion uses a snapshot of confirmed IDs and removes only IDs still in trash. Active/restored notes and notes added to trash after confirmation opened survive. This is tested with synthetic arrays, not real browser data.
- Backup limits: the former 2 MB input limit could reject a legitimate export from 200 notes with 30,000-character bodies. The bounded 40 MiB limit now covers even the allowed notes' worst-case JSON escaping; record count, per-note lengths, date strings and IDs remain constrained. Large files are rejected before reading.
- Existing shared-hook recovery is retained: incompatible raw data stays available through the dedicated raw-data export, including when storage cannot preserve a recovery copy. The initial Notes pass did not modify the shared hook; the bounded follow-up below handles initial read failures.
- Local styles in `src/styles/notes-v2.css` retain the paper/leaf palette, improve secondary text and focus visibility, add coarse-pointer targets, and provide scoped drawer/confirmation layers. `studio-v2.css` was not edited by this pass.

## Automated checks

The initial related suite contained 39 tests. The earlier storage/download follow-up expanded it to 53: 33 Notes component tests, 13 note-model tests, and 7 shared-storage tests. The later cross-window protection section below updates those counts. These suites verify delayed-read editing/new-note races, cancel/supersession/unmount behavior, malformed/read/oversize errors, a legitimate >2 MB import, search/pinning, recoverable trash, confirmed cleanup at capacity, raw recovery export, whole-library backup content, shortcut export and mobile focus, as well as the additional failure boundaries below.

- Related Vitest suite: passed.
- Targeted ESLint: passed without warnings.
- Application TypeScript check: passed with the existing ES2020 configuration.

Commands:

```sh
npx vitest run src/components/desktop/StudioNotes.test.tsx src/components/desktop/notes-model.test.ts src/hooks/use-local-state.test.tsx
npx eslint src/components/desktop/StudioNotes.tsx src/components/desktop/StudioNotes.test.tsx src/components/desktop/notes-model.ts src/components/desktop/notes-model.test.ts
npx tsc --noEmit -p tsconfig.app.json
```

## Main-agent visual acceptance

Check 320px/390px drawer width, keyboard viewport height, short-window scrolling, footer actions, and focus after closing the drawer. Check that the confirmation dialog appears above the desktop and that Cancel restores focus; do not permanently delete any real user's notes during browser QA. DOM tests verify semantics and events, not final browser layout or screen-reader output.

## Initial-read, download and typography follow-up

- Shared storage: an initial `getItem` exception is not treated as an empty key. The whole mounted instance remains memory-only with `saved=false`, even if `setItem` would subsequently succeed. It never writes the fallback, later edits, or a guessed recovery copy over unreadable content. After the user exports any temporary edits and reopens the app, a successful read restores the untouched original. This is deliberately not a cross-tab synchronization redesign.
- Notes explains this initial-read boundary in its existing notice area. A regression test edits and exports a temporary draft, verifies the unread original is unchanged, then remounts and recovers it.
- Downloads create a hidden anchor, attach it to the document and synchronously click it inside the user's action. Blob creation, object-URL creation, DOM attachment/click and backup serialization errors produce a retryable message without mutating notes. The same behavior covers current-text export, complete JSON backups and raw recovery exports.
- A successful click is described as download initiation, with a request to check browser download history. The page cannot observe whether the browser allowed the download or whether the file finished writing; no filesystem-completion guarantee is claimed.
- Started object URLs remain alive for 60 seconds instead of 1200ms, including when Notes is closed. They are then safely revoked; failure before initiation releases its URL immediately. Independent exports have independent retention windows. Cleanup errors do not become unhandled timer exceptions.
- The permanent-delete confirmation displays backup failure/start feedback inside the modal so it is not hidden behind the dialog. Downloading never confirms deletion, and failure leaves every target untouched.
- Local font rules now outrank `.leo-desktop input, textarea { font: inherit }`: the title is 24px/1.6; the body is 15px/1.9 on desktop and 16px/1.9 on mobile. This is scoped to `.studio-notes .studio-note-title` / `.studio-note-body`; global desktop resets and other app layouts remain unchanged. Actual mobile typography still belongs to the main agent's browser acceptance.

Follow-up checks: 53 related tests pass, targeted ESLint is clean, app/node typecheck passes, and `git diff --check` is clean. Tests inject synthetic download/storage failures and use mocked anchors/object URLs; they do not delete real notes or create real user downloads.

## Cross-window protection follow-up · 2026-09-13

The main agent explicitly authorized protection against stale writers after an isolated two-mount probe demonstrated that a later writer could overwrite a previously saved edit. This follow-up is prevention, not automatic synchronization or merging:

- The shared hook retains the exact raw storage baseline from a successful read/write. Immediately before replacing the main key it checks for external changes, including deletion, malformed text and an unknown format. Recovery copies are also checked before creation, and the main key is rechecked after the copy.
- An external difference or a failed verification read keeps the whole current mount memory-only. `saved` becomes false; metadata reports `conflict` or `readFailed`. Further typing continues to update the current editor and its exportable data, but never resumes writes automatically. A fresh mount reads the latest stored copy.
- A matching storage event marks conflict earlier without loading its text into the editor. The handler reads live storage, so a stale queued event alone cannot create a false conflict. Identical raw writes and unrelated/sessionStorage events are ignored. The listener is removed on unmount.
- Notes displays a persistent warning instructing the user to export before closing/reopening. A successful export notice does not dismiss that warning. Current TXT export and the complete JSON backup both use the latest temporary notes, not the other window's copy.
- If another window repairs initially malformed data before recovery can write, the external repaired data is left intact. The initially read malformed text remains available through raw export; the interface does not falsely claim it is still the main stored copy.

Tests cover both event-delivered and event-missing conflicts, temporary edits and exact export payloads, original/raw recovery export during a repair race, and reopening the external saved notes. The directly relevant Notes/storage suites now have 58 passing tests (Notes 37 + storage 21); the 13 unchanged note-model tests bring the broader related set to 71. Targeted ESLint and app/node typecheck pass. Desktop conflict-message integration and actual browser acceptance remain with the main agent.

localStorage has no atomic compare-and-set operation. A truly overlapping second tab may still change the key between verification and write; this guard prevents stale sequential overwrites, not every possible concurrent race. Important notes should still be edited in one tab and exported. No real user's storage was cleared, no current draft was auto-replaced, and no data was transmitted.
