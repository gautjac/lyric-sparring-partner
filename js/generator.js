// ============================================================
// GENERATION SERVICE
//
// One entry point: generate({ kind, ... }) returns a structured
// JSON result. Internally it switches between:
//
//   - mockGenerate()  — default. Templated, decent-feeling output
//                       built from seed fragments + per-mode patterns.
//   - claudeGenerate() — wired to the Anthropic API. Off by default.
//
// To go live, set USE_CLAUDE = true and provide an endpoint that
// proxies to api.anthropic.com (do NOT put your API key in this file).
// The expected proxy contract is documented at the bottom.
// ============================================================

import {
  MODES,
  SYSTEM_PROMPT,
  buildModePrompt,
} from "./prompts.js";
import {
  REWRITE_SYSTEM_PROMPT,
  COMPARE_SYSTEM_PROMPT,
  buildRewritePrompt,
  buildComparePrompt,
} from "./rewrite.js";

// ---------------------------------------------------------------
// Configuration. Flip USE_CLAUDE to true once you have a proxy up.
// ---------------------------------------------------------------
export const USE_CLAUDE = false;
export const CLAUDE_PROXY_URL = "/api/claude"; // your endpoint
export const CLAUDE_MODEL = "claude-opus-4-7";

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------
export async function generate(req) {
  if (USE_CLAUDE) return claudeGenerate(req);
  // Fake a tiny network delay for realism.
  await sleep(280 + Math.random() * 320);
  return mockGenerate(req);
}

// ============================================================
//                       MOCK GENERATOR
//   Goal: outputs that are believable enough to tune the UI on.
//   Strategy: extract content words from the seed, then weave
//   them into per-mode templated lines that respect controls.
// ============================================================

function mockGenerate(req) {
  switch (req.kind) {
    case "mode":    return mockMode(req);
    case "rewrite": return mockRewrite(req);
    case "compare": return mockCompare(req);
    default:        throw new Error(`Unknown request kind: ${req.kind}`);
  }
}

function mockMode({ modeId, seed, controls }) {
  const mode = MODES[modeId];
  const tokens = extractTokens(seed);
  const palette = buildPalette(tokens, controls);

  const templateBank = MODE_TEMPLATES[modeId] || MODE_TEMPLATES.intimate;
  const count = controls?.toggles?.singable ? 4 : 5;
  const lines = pickN(templateBank, count).map((tpl) => fillTemplate(tpl, palette));

  // Apply a few control-driven nudges.
  let finalLines = lines.map((l) => applyControls(l, controls));

  return {
    mode: mode.name,
    approach_note: mode.note,
    lines: dedupe(finalLines),
  };
}

function mockRewrite({ line, action }) {
  // Lightweight rule-based rewrites for the mock.
  const variants = [];
  const tokens = extractTokens(line);
  const palette = buildPalette(tokens, {});

  const recipes = {
    sharper: [
      (l) => l.replace(/\b(very|really|quite|just|so|kind of|sort of)\s+/gi, ""),
      (l) => sharpenVerb(l),
      (l) => fillTemplate("{noun} — and that was the whole sentence.", palette),
    ],
    simpler: [
      (l) => l.toLowerCase().replace(/[—;:]/g, ",").replace(/,\s*,/g, ","),
      (l) => fillTemplate("i {verb} the {noun}. that's all.", palette),
      (l) => fillTemplate("just {noun}. just that.", palette),
    ],
    stranger: [
      (l) => fillTemplate("the {noun} {verb}s in a language I almost remember", palette),
      (l) => fillTemplate("a {noun} learned to {verb} from watching me", palette),
      (l) => fillTemplate("I keep {verb}ing the {noun} like it owes me weather", palette),
    ],
    emotional: [
      (l) => fillTemplate("and I am the one who still {verb}s the {noun}", palette),
      (l) => fillTemplate("it isn't the {noun}. it's that I {verb} it alone.", palette),
      (l) => fillTemplate("you don't know how often I {verb} the {noun} for you", palette),
    ],
    melodic: [
      (l) => fillTemplate("oh, the {noun} and the long way home", palette),
      (l) => fillTemplate("{verb} me slow, {noun} me down", palette),
      (l) => fillTemplate("a {noun}, a {noun}, and the room goes gold", palette),
    ],
  };

  const pool = recipes[action] || recipes.sharper;
  pool.forEach((fn) => variants.push(cap(fn(line))));

  return { rewrites: dedupe(variants).slice(0, 3) };
}

function mockCompare({ a, b }) {
  const ta = extractTokens(a);
  const tb = extractTokens(b);
  const aImg = ta.nouns.length;
  const bImg = tb.nouns.length;

  const aLen = a.split(/\s+/).length;
  const bLen = b.split(/\s+/).length;

  const parts = [];
  if (aImg > bImg) parts.push("Line A leans on image; Line B leans on statement.");
  else if (bImg > aImg) parts.push("Line B leans on image; Line A leans on statement.");
  else parts.push("Both work in roughly the same register, image-wise.");

  if (aLen < bLen - 2) parts.push("A is tighter — it lands quicker, costs less breath.");
  else if (bLen < aLen - 2) parts.push("B is tighter — it lands quicker, costs less breath.");
  else parts.push("They sit at a similar length, so the difference is texture, not pace.");

  parts.push("A risks: " + (aImg > bImg ? "obscurity from image-load." : "flatness from plainness."));
  parts.push("B trades: " + (bImg > aImg ? "directness for picture." : "picture for directness."));

  return { verdict: parts.join(" ") };
}

// ============================================================
//                    SEED TOKENIZATION
// ============================================================

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","at","with","for","by",
  "is","are","was","were","be","been","being","i","you","he","she","it","we","they",
  "me","him","her","us","them","my","your","his","its","our","their","this","that",
  "these","those","as","from","into","over","under","than","then","so","if",
  "no","not","do","does","did","have","has","had","will","would","could","should",
  "can","may","might","up","down","out","off","just","like","still","yet","too",
  "very","really","kind","sort","because","while","when","what","why","how","which",
  "who","whom","whose","there","here","such","each","every","any","some","all",
]);

const FALLBACK_NOUNS = ["window","river","kitchen","name","door","weather","mouth","light","road","letter","coat","gold","rain","candle"];
const FALLBACK_VERBS = ["leave","carry","forget","whisper","break","keep","sing","wait","lose","remember","fold","burn"];

function extractTokens(text) {
  const words = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9'\-\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOPWORDS.has(w));

  // Crude POS-ish split: -ing / -ed / common verbs go to verbs; rest are nouns.
  const verbs = [];
  const nouns = [];
  const verbHints = /^(ing|ed)$|^(go|run|hold|leave|carry|forget|whisper|break|keep|sing|wait|lose|remember|fold|burn|fall|rise|kept|kept|miss|pray|smile|learn|borrow|play)/;

  for (const w of words) {
    if (verbHints.test(w) || w.endsWith("ing") || w.endsWith("ed")) verbs.push(w);
    else nouns.push(w);
  }

  return {
    raw: text,
    words,
    nouns: nouns.length ? unique(nouns) : pickN(FALLBACK_NOUNS, 3),
    verbs: verbs.length ? unique(verbs) : pickN(FALLBACK_VERBS, 3),
    firstNoun: (nouns[0] || pickOne(FALLBACK_NOUNS)),
    firstVerb: (verbs[0] || pickOne(FALLBACK_VERBS)),
  };
}

function buildPalette(tokens, controls) {
  // Decorative pools the templates can pull from.
  const lights = ["lamplight","streetlight","kitchen light","stage light","first light","blue hour"];
  const places = ["the kitchen","the back porch","the cab","the cheap motel","the upstairs hall","the parking lot"];
  const weather = ["the rain","the snow","the long heat","the static","the thaw"];
  const things  = ["a key","a torn coat","a paper cup","a half-finished cigarette","a folded letter","an empty glass"];
  const ints    = controls?.toggles?.darker  ? ["bruised","cold","unkind","late","empty"]
                : controls?.toggles?.hopeful ? ["soft","near","warm","green","still"]
                : ["honest","quiet","bright","slow","strange","old"];

  return {
    seed:     tokens.raw,
    noun:     () => pickOne(tokens.nouns),
    noun2:    () => pickOne(tokens.nouns),
    verb:     () => pickOne(tokens.verbs),
    verb2:    () => pickOne(tokens.verbs),
    light:    () => pickOne(lights),
    place:    () => pickOne(places),
    weather:  () => pickOne(weather),
    thing:    () => pickOne(things),
    adj:      () => pickOne(ints),
  };
}

// ============================================================
//                      MODE TEMPLATES
//  Each mode has a deep bench so regenerate feels fresh.
//  {noun}, {verb}, {light}, {place}, {weather}, {thing}, {adj}
// ============================================================

const MODE_TEMPLATES = {
  intimate: [
    "I told no one — only the {noun}, only the {light}.",
    "You {verb}ed me the way a {adj} hour {verb}s a room.",
    "I keep your {noun} in a coat I no longer wear.",
    "There is a {adj} version of me that still answers to your {noun}.",
    "If I say {noun}, you'll know what I'm not saying.",
    "Some nights I rehearse the {noun}. Some nights I forget the words.",
    "I {verb} like someone afraid of being heard.",
    "Even the {light} has stopped asking after you.",
    "I left the {noun} on, in case you came back.",
  ],

  surreal: [
    "The {noun} is learning to {verb} without me.",
    "All night the {weather} {verb}s through a door I did not build.",
    "A {adj} animal moves the furniture while we sleep.",
    "The {noun} grew a small mouth and asked for your name.",
    "I traded the {noun} for an hour of {weather}.",
    "Your shadow is teaching {place} how to disappear.",
    "I keep finding {thing} where the {noun} used to be.",
    "Somewhere, a piano made of {noun} learns my hands.",
  ],

  theatrical: [
    "Tonight, the {noun}! Tonight, the long electric dark!",
    "Let the {weather} witness how we burn our names.",
    "I {verb} the way a city {verb}s before a war it half-wants.",
    "Bring the {noun}. Bring the lights up. Bring the rest of my life.",
    "Oh, the {adj} ruin we made of an ordinary year.",
    "If this is the last act, then love me with the curtain rising.",
    "The whole street stopped to watch the {noun} catch fire.",
    "I will {verb} and {verb} until the gods admit my name.",
  ],

  brutal: [
    "You {verb}ed me. You knew you would. We're done pretending.",
    "It wasn't love. It was practice for love.",
    "The {noun} is gone. The {noun} is not coming back.",
    "I {verb}ed you the way you wanted. It still wasn't enough.",
    "Don't dress this up. The room is empty. I'm the one who emptied it.",
    "You are not who I lost. You are who I let go.",
    "Some nights I miss you. Most nights I just don't.",
    "We were a bad idea with good lighting.",
  ],

  funny: [
    "You {verb}ed me with the confidence of a man who's never read a map.",
    "I'm not crying — I'm just allergic to your {noun}.",
    "Therapy is going great. I only {verb} you on weekends now.",
    "If heartbreak burned calories, I'd be in the {place} doing victory laps.",
    "I bought a plant. I named it after you. It died, of course.",
    "Love is a group chat I keep getting added to by accident.",
    "You left like someone who forgot they had a coat. I am the coat.",
    "I'd take you back, but only as a houseplant.",
  ],

  cinematic: [
    "Wide shot: the {place}, the {weather}, no one moving.",
    "Cut to your hands. Cut to the {noun}. Cut to me, watching.",
    "The {light} comes in from the left and finds my face.",
    "Slow zoom on a {thing} no one will pick up.",
    "Hold on the door. Hold on the door. Hold on the door.",
  ],

  minimalist: [
    "Just the {noun}.",
    "Then nothing.",
    "Your name. Twice.",
    "A {adj} room.",
    "I {verb}. I wait.",
    "Light. Then less.",
  ],

  mythic: [
    "The {noun} is older than the road that brought it.",
    "I made an offering of {thing} and the river took it without thanks.",
    "There is an old word for what you {verb}ed in me.",
    "The {weather} comes the way the gods come — without explaining.",
    "I will be the small saint of {place} when this is finished.",
  ],
};

// ============================================================
//                      TEMPLATE FILLER
// ============================================================

function fillTemplate(tpl, palette) {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => {
    const fn = palette[key];
    return typeof fn === "function" ? fn() : key;
  });
}

function applyControls(line, controls) {
  if (!controls) return line;
  let out = line;

  // Plainspoken nudge: drop em-dashes, lower the temperature on "Oh,"
  if (controls.complexity <= 25) {
    out = out.replace(/—/g, ",").replace(/^Oh,?\s*/i, "");
  }
  // Literary nudge: occasionally invert. Keep it light.
  if (controls.complexity >= 75 && /^I\s/.test(out) && Math.random() < 0.3) {
    out = out.replace(/^I\s+(\w+)/, "$1 I");
  }
  // Subtle tone: trim exclamation points.
  if (controls.tone <= 25) out = out.replace(/!/g, ".");
  // Bold tone: occasionally upgrade a period.
  if (controls.tone >= 75 && Math.random() < 0.25) out = out.replace(/\.$/, ".");

  return out;
}

function sharpenVerb(line) {
  return line
    .replace(/\bwalked\b/i, "stepped")
    .replace(/\bwent\b/i, "left")
    .replace(/\blooked\b/i, "watched")
    .replace(/\bsaid\b/i, "told it");
}

// ============================================================
//                     SMALL UTILITIES
// ============================================================

function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const copy = arr.slice();
  const out = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}
function unique(arr)  { return Array.from(new Set(arr)); }
function dedupe(arr)  { return Array.from(new Set(arr.map((s) => s.trim()))).filter(Boolean); }
function cap(s)       { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function sleep(ms)    { return new Promise((r) => setTimeout(r, ms)); }


// ============================================================
//                   CLAUDE PROXY INTEGRATION
// ============================================================
//
// The browser cannot call api.anthropic.com directly with a key
// (CORS + secret leakage). When you're ready, stand up a tiny
// server that accepts:
//
//   POST /api/claude
//   { system: "...", user: "...", model: "claude-opus-4-7" }
//
// and forwards it to the Messages API. Then return:
//
//   { content: "<the model's text>" }
//
// This function will parse JSON out of that text and return it.
//
// ============================================================

async function claudeGenerate(req) {
  let system, user;
  if (req.kind === "mode") {
    system = SYSTEM_PROMPT;
    user   = buildModePrompt({ modeId: req.modeId, seed: req.seed, controls: req.controls });
  } else if (req.kind === "rewrite") {
    system = REWRITE_SYSTEM_PROMPT;
    user   = buildRewritePrompt({ line: req.line, action: req.action });
  } else if (req.kind === "compare") {
    system = COMPARE_SYSTEM_PROMPT;
    user   = buildComparePrompt({ a: req.a, b: req.b });
  } else {
    throw new Error(`Unknown request kind: ${req.kind}`);
  }

  const res = await fetch(CLAUDE_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, user, model: CLAUDE_MODEL }),
  });

  if (!res.ok) throw new Error(`Claude proxy ${res.status}`);
  const { content } = await res.json();

  return safeParseJSON(content, req);
}

// Lenient JSON parser — strips fences, finds first { ... }, falls back gracefully.
function safeParseJSON(text, req) {
  if (!text) return fallback(req);
  let cleaned = text.trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return fallback(req);
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (e) {
    console.warn("Malformed JSON from model. Falling back.", e);
    return fallback(req);
  }
}

function fallback(req) {
  if (req.kind === "mode")    return mockMode(req);
  if (req.kind === "rewrite") return mockRewrite(req);
  if (req.kind === "compare") return mockCompare(req);
  return { error: "no fallback for kind: " + req.kind };
}
