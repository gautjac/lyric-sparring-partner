# Lyric Sparring Partner

A small, local-first writing room for songwriters, poets, and lyricists.
You drop in one line. Five voices answer back, each pushing in a different direction.
Keep what's useful. Throw away the rest.

> Not a song generator. A sparring partner.

---

## Run it

No build step. No server. No npm.

```bash
# from this folder, any of:
open index.html              # macOS, opens in default browser
python3 -m http.server 8000  # then visit http://localhost:8000
npx serve .                  # if you have node around
```

A static server is preferred over `file://` only because ES modules are stricter
under `file://` in some browsers. Modern Safari/Chrome/Firefox all handle it
either way.

---

## What it does

- Five **modes** spar with your seed in parallel: **Intimate**, **Surreal**,
  **Theatrical**, **Brutal/Direct**, **Funny/Sly**. Three more (Cinematic,
  Minimalist, Mythic) are defined and one swap away.
- Three **sliders** — Tone, Imagery, Diction — and seven **craft toggles** to
  bias the output without touching prompts.
- Click any line to **keep** it. Keepers persist across sessions (localStorage).
- Hover any line for **rewrite** (sharper / simpler / stranger / more emotional /
  more melodic) and **compare** (pick two lines, get a brief craft reading).
- Drag-reorder keepers. Export as plain text, verse block, or a rough markdown
  lyric draft.
- Dark mode. Keyboard-friendly (`⌘/Ctrl ⏎` to generate, `Esc` to dismiss).

---

## File map

```
index.html         # markup + structure
styles.css         # warm-neutral notebook theme + dark mode
js/app.js          # UI wiring, state, render
js/prompts.js      # *** mode definitions + system prompt — tune here ***
js/rewrite.js      # rewrite + compare prompt builders
js/generator.js    # mock generator + Claude API integration point
js/store.js        # localStorage wrapper
js/examples.js     # sample seed lines for the "Try a seed" button
```

The mock generator in `generator.js` produces template-driven output that's
good enough to evaluate the UI and tune the prompt language. Real model output
will obviously be much better.

---

## Wire it to Claude

Out of the box the app uses a templated mock so you can play with the
interface immediately. To switch to real Claude generations:

1. **Stand up a tiny proxy.** The browser can't call `api.anthropic.com`
   directly (CORS + your key would leak). The proxy contract is:

   ```
   POST /api/claude
   Body: { "system": "...", "user": "...", "model": "claude-opus-4-7" }
   200:  { "content": "<the model's text>" }
   ```

   Any Node / Bun / Deno / Cloudflare Worker / Vercel function will do.
   Forward `system` and `user` to the Messages API with your key in the
   `x-api-key` header.

2. **Flip the switch** in `js/generator.js`:

   ```js
   export const USE_CLAUDE = true;
   export const CLAUDE_PROXY_URL = "/api/claude";
   ```

3. The model is asked to return strict JSON. `safeParseJSON()` is forgiving
   (strips fences, finds the first `{...}`) and falls back to the mock if
   parsing fails, so a malformed response never breaks the UI.

---

## Tuning the writing

Almost all of the creative behavior lives in two files:

- **`js/prompts.js`** — the system prompt, each mode's bias paragraph, and the
  per-mode user-prompt builder. Edit the `MODES` object to change voice,
  reorder `ACTIVE_MODES` to change which five appear, swap in `cinematic`,
  `minimalist`, or `mythic` whenever you want.
- **`js/rewrite.js`** — the five rewrite actions and the compare prompt.

The mock generator in `js/generator.js` has its own per-mode template bench
under `MODE_TEMPLATES`. You can edit those templates the same way, but they
only matter while `USE_CLAUDE = false`.

---

## Notes on writing rules

The system prompt encodes the rules from the brief: no inspirational mush,
no clichés, prefer image and implication, vary syntax, allow fragments, allow
risk, preserve the seed's emotional center. Tune the rules in `SYSTEM_PROMPT`
in `js/prompts.js`.

---

## What's intentionally not here

- No accounts, no backend, no analytics.
- No "save to cloud." Keepers live in your browser only. Export when you want
  durability.
- No chat transcript layout. This is a writing room, not a conversation.
