# Desktop V2 · Keyboard and window refinements

## Scope and design

This pass keeps the existing personal desktop, its wallpaper, app icons and light blue-gray window chrome. It does not add recruitment information or change the original repository/version. The work is isolated to `Desktop.tsx`, its regression tests and `desktop-accessibility.css`; `window-state.ts` and the shared `studio-v2.css` are unchanged by this pass.

The desktop remains a place to explore Haonan's collections and small interactive worlds. Its visual signature is the spatial arrangement of familiar, individually chosen app icons. This accessibility pass should not compete with those icons: the red, yellow and green window controls stay visually small while their actual targets become easier to use.

The existing palette is retained: ink `#20384a`, muted blue `#697b88`, focus blue `#5b8cc1`, window paper `#f6f8fa`, selection `#e4edf4`. The three traffic lights retain their established `#ff6058`, `#febc2e` and `#29c840` colors. Manrope/system Chinese remains the display/body pairing; utility text keeps the existing system/monospace treatment. No new font or imagery is introduced.

## Interaction contracts

- Desktop-width app windows are nonmodal. They do not trap Tab or make the desktop/Dock inert. Minimize retains the child instance and its state; close unmounts it. Closing/minimizing returns focus to that app's desktop shortcut.
- At widths up to 720 px, the active app is fullscreen. The menubar, desktop shortcuts, Dock and companion switch become native `inert` backgrounds; the app is identified as modal. Returning to the desktop removes `inert`. Resizing into fullscreen also dismisses a now-covered menubar panel and moves focus to the app.
- Search, guide, Control Center and calendar share one surface state. They cannot stack with each other. Search/guide use the existing Radix modal focus behavior. Menubar panels remain nonmodal, move focus inside on open, and dismiss on outside pointer or focus without stealing the destination.
- Escape affects the top desktop surface first. Closing Control Center/calendar does not also minimize the app. Existing app-level prevented Escape events, photo viewers and modal/alert dialogs are respected.
- The original invoker is retained through guide → search or panel → search replacement. A cancelled search returns to the exact input/control that invoked it. Selecting a search result focuses the destination window, including when it is the already-active app; Radix cleanup does not override this destination.
- IME composition (`isComposing` and key code 229) does not trigger Escape, Enter or command-search actions. Held command-search and Escape keys do not repeat toggles/dismissals. Held Enter does not launch repeatedly. Modified editing keys and normal Home/End remain available to the text input.

## Search and names

Search is an editable combobox connected to a listbox with stable option IDs, one selected option and `aria-activedescendant`. Arrow keys wrap through available apps and scroll the selected row into view. Empty results clear the active descendant, announce a useful suggestion, and cannot launch an app. Options do not add a second Tab sequence; the input remains the keyboard interaction point. The close control is visible and keyboard accessible.

The construction sandbox now displays **Little Works** on shortcuts, window titles, search results and document titles. **Little Companion** remains a search alias. The internal AppId `cats`, local settings, icon positions and existing `?app=cats` links are preserved.

Personal Atlas now validates and reflects a changed `collection` query even when the `app` query stays `atlas`. Supported collections remain `daily`, `photos`, `artists`, `films`, `games`, `food`, with unknown/absent collections falling back to `all`. Unchanged collection values do not remount the gallery. Changing only a collection does not reopen a minimized window; removing the `app` query does not implicitly close existing windows.

## CSS choices

The new stylesheet uses V2-scoped selectors strong enough to override existing desktop and mobile traffic-light dimensions, including the Music overrides. It does not alter shared global styles.

- Desktop: 28 × 28 px target containing a 12 px colored dot; three targets occupy 84 px.
- Mobile: 36 × 36 px target containing an 11 px colored dot; two targets occupy 72 px. Right-side share/home controls are also 36 px, and the title grid reserves their width without overlap.
- Long titles can truncate; the accessible window name remains complete.
- Search uses a flex column with an independently scrolling result list and a persistent footer/close action.
- Portal search/guide controls receive visible focus rings, since they render outside the desktop's inherited styling scope.
- New styles respect reduced motion; scrolling selection uses immediate nearest-edge scrolling.

## Automated verification

The suite uses the real desktop reducer, React Router and Radix Dialog. Only app internals, framer-motion, CompanionCat and drag geometry are replaced with small test doubles, so shell focus and modal behavior remain real in jsdom.

2026-09-12, initial implementation verification: the 11 audit `it.fails` all became ordinary passing tests. They cover mobile background access, panel Escape isolation/focus, IME handling, invoker restoration, combobox semantics, guide/search exclusivity, held shortcut and collection-only history changes.

Additional regressions cover desktop nonmodal/Tab-event contracts, mobile close and breakpoint changes, three search-launch focus variants, guide and panel replacement focus, calendar focus, outside-focus dismissal, Radix modal focus containment, empty-result recovery, selection scrolling, native Home/End handling, repeated Escape/Enter, the legacy search alias and old cats deep links. Existing minimize/close state, restored geometry and router lifecycle regressions remain passing.

Validation commands:

```sh
npx vitest run src/components/desktop/Desktop.test.tsx src/components/desktop/window-state.test.ts
npx vitest run src/components/cat-game src/components/desktop/HerdingCatsApp.test.tsx src/components/desktop/WorkshopApp.test.tsx src/components/desktop/Desktop.test.tsx src/components/desktop/window-state.test.ts
npx eslint src/components/desktop/Desktop.tsx src/components/desktop/Desktop.test.tsx
npm run typecheck
git diff --check
```

Final scoped run on 2026-09-12 at 23:31 (Asia/Shanghai):

- Desktop and window-state: **34/34** passed (30 shell tests, 4 state-model tests).
- Desktop + window-state + Workshop + game suites: **95/95** passed across 7 files.
- Scoped ESLint: no errors or warnings.
- Global TypeScript checks: passed for application and node configs.
- Production build: passed, including the self-contained sandbox build; no chunk-size warning.
- `git diff --check`: passed.

No expected-failure markers remain in the Desktop suite. These counts are scoped to the commands above and are not a claim about the entire repository test suite.

## Remaining real-browser checks

jsdom does not implement native Tab traversal, computed target geometry, actual scrolling or screen-reader speech. The main agent owns browser QA; this pass did not occupy the browser or claim that those checks had already passed.

1. At 320/390 px, check every app's titlebar, especially Music/Projects, for target overlap, clipping and safe-area fit. Verify dots remain visually small.
2. On desktop, Tab/Shift+Tab must be able to leave Notes for the desktop/Dock. Search must still contain a full forward/backward focus cycle. Mobile background shortcuts must be unreachable while an app is fullscreen.
3. Open search from a Notes input, select Profile or Notes itself and verify final focus. Open guide → Ctrl+K → Escape and verify the original menu trigger returns.
4. Select the last result using ArrowUp and verify visible scroll position/footer. Check empty searches and touch-scrolling without selection jumps.
5. Use VoiceOver to confirm combobox/listbox selection, modal announcements, the calendar title and removal/restoration of mobile background content. Check a real Chinese IME for confirm/cancel keys.
6. Resize with Control Center open over an app; it must disappear rather than remain focused under the mobile app.
