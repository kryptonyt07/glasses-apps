# glasses-apps — personal HUD apps for Meta Ray-Ban Display

Vanilla HTML/CSS/JS, zero dependencies. Each app is a sibling folder; `/index.html` is the launcher.
Display: fixed 600×600, additive (pure black = transparent), no scrolling, no touch.
Input: Neural Band gestures arrive as `ArrowUp/Down/Left/Right`, `Enter`, `Escape` key events.

## Sideload (5 lines)
1. Meta AI app → Settings → App Info → tap **App version** 5× → enable Developer Mode.
2. Settings → App connections → **Developer mode apps** → add app by URL.
3. URL: `https://kryptonyt07.github.io/glasses-apps/` (launcher) or `.../glasses-apps/line-runner/` direct.
4. Open the app from the glasses' app list. Test on a Mac first: open the URL in Chrome, arrow keys = gestures.
5. To load new sides: open `line-runner/editor.html` on phone/Mac → paste → generate link → update the app URL in step 2 with the generated link.

## Line Runner (v1)
Teleprompter/line-runner for self-tapes and rehearsal. Editor packs the script into the URL
(`#s=` base64) — sides never touch the repo or any server log (a `?s=` variant exists as fallback;
that one does appear in server logs, use it only if the `#s=` form won't load). Last script is
cached in `localStorage` on the device; position survives app restarts. Read mode shows everything;
Rehearse mode hides YOUR lines until you pinch ✓; Prompter mode auto-scrolls the whole script
(✓ pause · ▲▼ speed · ◀▶ jump). Text size S/M/L on the home menu (persisted) — tune it on-face.
Long lines are auto-paginated at ~230 chars in Read/Rehearse.

## Platform facts (updated 2026-10-28 from Meta's Oct 2026 toolkit: github.com/facebook/meta-wearables-webapp)
- **Text input: YES.** A plain `<input>`/`<textarea>` opens the glasses' handwriting / dictation / keyboard
  composer after wearer focus + pinch (programmatic focus alone does not open it). Used by scratch/ and Jarvis "Ask anything".
- **Voice control via Meta AI (WebMCP, developer preview): YES, additive.** Register tools on `document.modelContext`;
  "Hey Meta, ..." calls them. Off by default, enabled per device by Developer Mode or rollout, decided at app launch
  (relaunch after enabling). Scalar params only; enum/min/max not enforced (validate in `execute`); 10 s deadline;
  57-char effective name budget; reserved names (`openUrl`, `goBack`, `reload`, `getPageText`...) fail silently.
  **The app must stay fully usable by D-pad.** Used by drill-timer/ (`dt_status`, `dt_start`, `dt_control`).
  Privacy: tool results go to Meta AI (cloud). Never expose Jarvis brief/mail/calendar, Line Runner sides, or anything personal.
- **Offline: YES.** Offline cold start loads the page so a service worker can answer from cache (root `sw.js`, network-first).
- Still no raw microphone or camera for Web Apps (native Device Access Toolkit only). Geolocation, motion and
  Neural Band wrist motion are available with permission. localStorage 5 MB.
- Budgets: first load < 300 KB and < 15 requests (slow link, ~16 ms per KB), 30 Hz panel (33 ms frames).
- Back = thumb + middle-finger gesture / `Escape`: push a history entry when leaving a home screen or back exits the app.
- Testing: Meta Ray-Ban Display Simulator Chrome extension (600x600, additive blending, D-pad, QA checklist).
  Live docs MCP: `https://mcp.developer.meta.com/wearables` (`search_webapps_docs`).
