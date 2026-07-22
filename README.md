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

## Platform constraints (verified from DAT docs, Jul 2026)
- No microphone, no Web Speech, no camera, no text input, no service workers on Web Apps.
- "Offline" is best-effort only: single-file apps + localStorage survive restarts, but a fresh
  page load needs network. Do not rely on it mid-audition — open the app before you're on.
- localStorage/sessionStorage 5 MB. Geolocation + motion sensors available with permission.

## Phase 2 (queued, not built): AI HUD
POSTs OpenAI-format chat completions to the LiteLLM gateway (port 8000) reached over Tailscale
from the phone; model param switches Claude ↔ local Ollama. Mic is unavailable (verified above),
so input = gesture-selected prompt templates. **Never embed API keys client-side** — the glasses
app is public JS; keys live only in LiteLLM env or a Vercel proxy with a bearer token.
