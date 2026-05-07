// ============================================================
// GENERATION SERVICE
//
// One entry point: generate({ kind, lang, ... }) returns a structured
// JSON result. Internally it switches between:
//
//   - mockGenerate()  — default. Templated, decent-feeling output
//                       built from seed fragments + per-mode patterns.
//   - claudeGenerate() — wired to the Anthropic API. Off by default.
//
// To go live, set USE_CLAUDE = true and provide an endpoint that
// proxies to api.anthropic.com (do NOT put your API key in this file).
// The expected proxy contract is documented at the bottom.
//
// Mock output supports en + fr. Real Claude calls support any
// language — the system prompt instructs the model in the target
// language and includes a "Respond in <lang>" rule.
// ============================================================

import {
  MODES,
  getModeName,
  getModeNote,
  getSystemPrompt,
  buildModePrompt,
} from "./prompts.js";
import {
  REWRITE_ACTIONS,
  getRewriteLabel,
  getRewriteSystemPrompt,
  getCompareSystemPrompt,
  buildRewritePrompt,
  buildComparePrompt,
} from "./rewrite.js";

// ---------------------------------------------------------------
// Configuration.
//   USE_CLAUDE=true  → real Claude generations via /api/claude
//                      (Netlify Function, key in env var).
//   USE_CLAUDE=false → templated mock; useful for offline / dev.
// CLAUDE_PROXY_URL is same-origin in production. To run the
// frontend against a different proxy (e.g. local netlify dev),
// override this constant or wrap it in an env-aware check.
// ---------------------------------------------------------------
export const USE_CLAUDE = true;
export const CLAUDE_PROXY_URL = "/api/claude";
export const CLAUDE_MODEL = "claude-opus-4-7";

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------
export async function generate(req) {
  const lang = req.lang || "en";
  if (USE_CLAUDE) return claudeGenerate({ ...req, lang });
  await sleep(280 + Math.random() * 320); // fake a tiny network delay
  return mockGenerate({ ...req, lang });
}

// ============================================================
//                       MOCK GENERATOR
//   Goal: outputs that are believable enough to tune the UI on.
//   In real use, USE_CLAUDE = true gives you the real model.
// ============================================================

function mockGenerate(req) {
  switch (req.kind) {
    case "mode":    return mockMode(req);
    case "rewrite": return mockRewrite(req);
    case "compare": return mockCompare(req);
    default:        throw new Error(`Unknown request kind: ${req.kind}`);
  }
}

function mockMode({ modeId, seed, controls, lang }) {
  const tokens  = extractTokens(seed, lang);
  const palette = buildPalette(tokens, controls, lang);

  const bank = (MODE_TEMPLATES[modeId]?.[lang]) || MODE_TEMPLATES.intimate.en;
  const count = controls?.toggles?.singable ? 4 : 5;
  const lines = pickN(bank, count).map((tpl) => fillTemplate(tpl, palette));
  const finalLines = lines.map((l) => applyControls(l, controls));

  return {
    mode: getModeName(modeId, lang),
    approach_note: getModeNote(modeId, lang),
    lines: dedupe(finalLines),
  };
}

function mockRewrite({ line, action, lang }) {
  const tokens  = extractTokens(line, lang);
  const palette = buildPalette(tokens, {}, lang);
  const bank    = (REWRITE_TEMPLATES[action]?.[lang]) || REWRITE_TEMPLATES.sharper.en;

  const variants = pickN(bank, 3).map((tpl) => cap(fillTemplate(tpl, palette)));
  return { rewrites: dedupe(variants).slice(0, 3) };
}

function mockCompare({ a, b, lang }) {
  const ta = extractTokens(a, lang);
  const tb = extractTokens(b, lang);
  const aImg = ta.nouns.length;
  const bImg = tb.nouns.length;
  const aLen = a.split(/\s+/).length;
  const bLen = b.split(/\s+/).length;

  const phrases = COMPARE_PHRASES[lang] || COMPARE_PHRASES.en;
  const parts = [];

  if (aImg > bImg)      parts.push(phrases.aImage);
  else if (bImg > aImg) parts.push(phrases.bImage);
  else                  parts.push(phrases.sameImage);

  if (aLen < bLen - 2)      parts.push(phrases.aTighter);
  else if (bLen < aLen - 2) parts.push(phrases.bTighter);
  else                      parts.push(phrases.sameLength);

  parts.push(phrases.aRisk(aImg > bImg ? phrases.imgRisk : phrases.flatRisk));
  parts.push(phrases.bTrade(bImg > aImg ? phrases.tradePicture : phrases.tradeDirect));

  return { verdict: parts.join(" ") };
}

// ============================================================
//                    SEED TOKENIZATION
// ============================================================

const STOPWORDS = {
  en: new Set([
    "the","a","an","and","or","but","of","to","in","on","at","with","for","by",
    "is","are","was","were","be","been","being","i","you","he","she","it","we","they",
    "me","him","her","us","them","my","your","his","its","our","their","this","that",
    "these","those","as","from","into","over","under","than","then","so","if",
    "no","not","do","does","did","have","has","had","will","would","could","should",
    "can","may","might","up","down","out","off","just","like","still","yet","too",
    "very","really","kind","sort","because","while","when","what","why","how","which",
    "who","whom","whose","there","here","such","each","every","any","some","all",
  ]),
  fr: new Set([
    "le","la","les","l","de","d","du","des","un","une","et","ou","mais","ni",
    "à","au","aux","en","dans","sur","sous","par","pour","avec","sans","chez",
    "je","j","tu","il","elle","on","nous","vous","ils","elles","me","m","te","t",
    "se","s","lui","leur","y","mon","ton","son","ma","ta","sa","mes","tes","ses",
    "notre","votre","leurs","nos","vos","ce","c","cet","cette","ces","qui","que",
    "qu","quoi","dont","où","quand","comment","pourquoi","ne","n","pas","plus",
    "non","oui","est","sont","était","étaient","être","été","ai","as","a","avons",
    "avez","ont","avoir","eu","si","car","donc","alors","puis","aussi","encore",
    "déjà","tout","tous","toute","toutes","aucun","aucune","comme","tellement",
  ]),
};

const FALLBACK_NOUNS = {
  en: ["window","river","kitchen","name","door","weather","mouth","light","road","letter","coat","gold","rain","candle"],
  fr: ["fenêtre","rivière","cuisine","nom","porte","temps","bouche","lumière","route","lettre","manteau","or","pluie","bougie"],
};
const FALLBACK_VERBS = {
  en: ["leave","carry","forget","whisper","break","keep","sing","wait","lose","remember","fold","burn"],
  fr: ["partir","porter","oublier","murmurer","casser","garder","chanter","attendre","perdre","souvenir","plier","brûler"],
};

function extractTokens(text, lang = "en") {
  const stop = STOPWORDS[lang] || STOPWORDS.en;
  const words = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëîïôöùûüçœ'\-\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !stop.has(w));

  const verbs = [];
  const nouns = [];

  if (lang === "fr") {
    for (const w of words) {
      if (/(er|ir|re|ant|é|és|ée|ées)$/.test(w) || /(ais|ait|aient|ions|iez|ais)$/.test(w)) {
        verbs.push(w);
      } else nouns.push(w);
    }
  } else {
    const verbHints = /^(go|run|hold|leave|carry|forget|whisper|break|keep|sing|wait|lose|remember|fold|burn|fall|rise|kept|miss|pray|smile|learn|borrow|play)/;
    for (const w of words) {
      if (verbHints.test(w) || w.endsWith("ing") || w.endsWith("ed")) verbs.push(w);
      else nouns.push(w);
    }
  }

  return {
    raw: text,
    words,
    nouns: nouns.length ? unique(nouns) : pickN(FALLBACK_NOUNS[lang] || FALLBACK_NOUNS.en, 3),
    verbs: verbs.length ? unique(verbs) : pickN(FALLBACK_VERBS[lang] || FALLBACK_VERBS.en, 3),
  };
}

function buildPalette(tokens, controls, lang = "en") {
  const palettes = {
    en: {
      lights:  ["lamplight","streetlight","kitchen light","stage light","first light","blue hour"],
      places:  ["the kitchen","the back porch","the cab","the cheap motel","the upstairs hall","the parking lot"],
      weather: ["the rain","the snow","the long heat","the static","the thaw"],
      things:  ["a key","a torn coat","a paper cup","a half-finished cigarette","a folded letter","an empty glass"],
      adjDark: ["bruised","cold","unkind","late","empty"],
      adjHope: ["soft","near","warm","green","still"],
      adjMid:  ["honest","quiet","bright","slow","strange","old"],
    },
    fr: {
      lights:  ["la lampe","le lampadaire","la lumière de la cuisine","la lumière de scène","la première lumière","l'heure bleue"],
      places:  ["la cuisine","la galerie arrière","le taxi","le motel pas cher","le couloir d'en haut","le stationnement"],
      weather: ["la pluie","la neige","la longue chaleur","la statique","le dégel"],
      things:  ["une clé","un manteau déchiré","un gobelet de papier","une cigarette à demi","une lettre pliée","un verre vide"],
      adjDark: ["amer","froid","tard","vide","dur"],
      adjHope: ["doux","proche","chaud","vert","calme"],
      adjMid:  ["honnête","calme","étrange","lent","tendre","vieux"],
    },
  };
  const p = palettes[lang] || palettes.en;
  const adj = controls?.toggles?.darker  ? p.adjDark
            : controls?.toggles?.hopeful ? p.adjHope
            : p.adjMid;

  return {
    seed:    tokens.raw,
    noun:    () => pickOne(tokens.nouns),
    noun2:   () => pickOne(tokens.nouns),
    verb:    () => pickOne(tokens.verbs),
    verb2:   () => pickOne(tokens.verbs),
    light:   () => pickOne(p.lights),
    place:   () => pickOne(p.places),
    weather: () => pickOne(p.weather),
    thing:   () => pickOne(p.things),
    adj:     () => pickOne(adj),
  };
}

// ============================================================
//                      MODE TEMPLATES
//  Each mode has a deep bench so regenerate feels fresh.
//  Slots: {noun}, {verb}, {light}, {place}, {weather}, {thing}, {adj}
// ============================================================

const MODE_TEMPLATES = {
  intimate: {
    en: [
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
    fr: [
      "Je n'ai dit à personne — seulement {noun}, seulement {light}.",
      "Tu m'as touché comme une heure {adj} touche une pièce.",
      "Je garde ton {noun} dans un manteau que je ne mets plus.",
      "Il y a une version {adj} de moi qui répond encore à ton {noun}.",
      "Si je dis {noun}, tu sauras ce que je tais.",
      "Certaines nuits je répète {noun}. Certaines nuits j'oublie.",
      "Je {verb} comme quelqu'un qui craint d'être entendu.",
      "Même {light} ne demande plus de tes nouvelles.",
      "J'ai laissé {noun} allumé, au cas où tu reviendrais.",
    ],
  },

  surreal: {
    en: [
      "The {noun} is learning to {verb} without me.",
      "All night the {weather} {verb}s through a door I did not build.",
      "A {adj} animal moves the furniture while we sleep.",
      "The {noun} grew a small mouth and asked for your name.",
      "I traded the {noun} for an hour of {weather}.",
      "Your shadow is teaching {place} how to disappear.",
      "I keep finding {thing} where the {noun} used to be.",
      "Somewhere, a piano made of {noun} learns my hands.",
    ],
    fr: [
      "{noun} apprend à {verb} sans moi.",
      "Toute la nuit {weather} traverse une porte que je n'ai pas bâtie.",
      "Un animal {adj} déplace les meubles pendant qu'on dort.",
      "{noun} a poussé une petite bouche et a demandé ton nom.",
      "J'ai échangé {noun} contre une heure de {weather}.",
      "Ton ombre apprend à {place} comment disparaître.",
      "Je trouve {thing} là où il y avait {noun}.",
      "Quelque part, un piano fait de {noun} apprend mes mains.",
    ],
  },

  theatrical: {
    en: [
      "Tonight, the {noun}! Tonight, the long electric dark!",
      "Let the {weather} witness how we burn our names.",
      "I {verb} the way a city {verb}s before a war it half-wants.",
      "Bring the {noun}. Bring the lights up. Bring the rest of my life.",
      "Oh, the {adj} ruin we made of an ordinary year.",
      "If this is the last act, then love me with the curtain rising.",
      "The whole street stopped to watch the {noun} catch fire.",
      "I will {verb} and {verb} until the gods admit my name.",
    ],
    fr: [
      "Ce soir, {noun} ! Ce soir, le long noir électrique !",
      "Que {weather} témoigne comment on brûle nos noms.",
      "Je {verb} comme une ville {verb} avant une guerre qu'elle veut à demi.",
      "Apporte {noun}. Lève les lumières. Apporte le reste de ma vie.",
      "Oh, la ruine {adj} qu'on a faite d'une année ordinaire.",
      "Si c'est le dernier acte, aime-moi rideau levé.",
      "Toute la rue s'est arrêtée pour voir {noun} prendre feu.",
      "Je {verb} et je {verb} jusqu'à ce que les dieux admettent mon nom.",
    ],
  },

  brutal: {
    en: [
      "You {verb}ed me. You knew you would. We're done pretending.",
      "It wasn't love. It was practice for love.",
      "The {noun} is gone. The {noun} is not coming back.",
      "I {verb}ed you the way you wanted. It still wasn't enough.",
      "Don't dress this up. The room is empty. I'm the one who emptied it.",
      "You are not who I lost. You are who I let go.",
      "Some nights I miss you. Most nights I just don't.",
      "We were a bad idea with good lighting.",
    ],
    fr: [
      "Tu m'as {verb}. Tu savais que tu le ferais. On arrête de prétendre.",
      "Ce n'était pas l'amour. C'était l'entraînement à l'amour.",
      "{noun} est parti. {noun} ne revient pas.",
      "Je t'ai {verb} comme tu voulais. Ça ne suffisait pas.",
      "N'arrange rien. La pièce est vide. C'est moi qui l'ai vidée.",
      "Tu n'es pas celui que j'ai perdu. Tu es celui que j'ai laissé partir.",
      "Certaines nuits tu me manques. La plupart, non.",
      "On était une mauvaise idée avec un bel éclairage.",
    ],
  },

  funny: {
    en: [
      "You {verb}ed me with the confidence of a man who's never read a map.",
      "I'm not crying — I'm just allergic to your {noun}.",
      "Therapy is going great. I only {verb} you on weekends now.",
      "If heartbreak burned calories, I'd be in the {place} doing victory laps.",
      "I bought a plant. I named it after you. It died, of course.",
      "Love is a group chat I keep getting added to by accident.",
      "You left like someone who forgot they had a coat. I am the coat.",
      "I'd take you back, but only as a houseplant.",
    ],
    fr: [
      "Tu m'as {verb} avec l'assurance d'un homme qui n'a jamais lu une carte.",
      "Je ne pleure pas — je suis allergique à ton {noun}.",
      "La thérapie va bien. Je ne te {verb} plus que la fin de semaine.",
      "Si la peine d'amour brûlait des calories, je serais à {place} en train de gagner.",
      "J'ai acheté une plante. Je l'ai nommée d'après toi. Elle est morte, bien sûr.",
      "L'amour est un groupe de discussion où on m'ajoute par accident.",
      "Tu es parti comme quelqu'un qui a oublié son manteau. Le manteau, c'est moi.",
      "Je te reprendrais — mais comme plante d'intérieur.",
    ],
  },

  cinematic: {
    en: [
      "Wide shot: the {place}, the {weather}, no one moving.",
      "Cut to your hands. Cut to the {noun}. Cut to me, watching.",
      "The {light} comes in from the left and finds my face.",
      "Slow zoom on a {thing} no one will pick up.",
      "Hold on the door. Hold on the door. Hold on the door.",
    ],
    fr: [
      "Plan large : {place}, {weather}, personne ne bouge.",
      "Coupe sur tes mains. Coupe sur {noun}. Coupe sur moi, qui regarde.",
      "{light} entre par la gauche et trouve mon visage.",
      "Zoom lent sur {thing} que personne ne ramassera.",
      "Tiens sur la porte. Tiens sur la porte. Tiens sur la porte.",
    ],
  },

  minimalist: {
    en: [
      "Just the {noun}.",
      "Then nothing.",
      "Your name. Twice.",
      "A {adj} room.",
      "I {verb}. I wait.",
      "Light. Then less.",
    ],
    fr: [
      "Juste {noun}.",
      "Puis rien.",
      "Ton nom. Deux fois.",
      "Une chambre {adj}.",
      "Je {verb}. J'attends.",
      "Lumière. Puis moins.",
    ],
  },

  mythic: {
    en: [
      "The {noun} is older than the road that brought it.",
      "I made an offering of {thing} and the river took it without thanks.",
      "There is an old word for what you {verb}ed in me.",
      "The {weather} comes the way the gods come — without explaining.",
      "I will be the small saint of {place} when this is finished.",
    ],
    fr: [
      "{noun} est plus vieux que la route qui l'a porté.",
      "J'ai offert {thing} et la rivière l'a pris sans merci.",
      "Il existe un vieux mot pour ce que tu m'as {verb}.",
      "{weather} vient comme viennent les dieux — sans s'expliquer.",
      "Je serai le petit saint de {place} quand ce sera fini.",
    ],
  },
};

// ============================================================
//                  REWRITE TEMPLATES (mock)
// ============================================================

const REWRITE_TEMPLATES = {
  sharper: {
    en: [
      "{noun} — and that was the whole sentence.",
      "I {verb}. That was the warning.",
      "No {noun}. No goodbye. Just gone.",
    ],
    fr: [
      "{noun} — et c'était toute la phrase.",
      "Je {verb}. C'était l'avertissement.",
      "Pas de {noun}. Pas d'au revoir. Juste parti.",
    ],
  },
  simpler: {
    en: [
      "I {verb} the {noun}. That's all.",
      "Just {noun}. Just that.",
      "I came home. The {noun} was gone.",
    ],
    fr: [
      "Je {verb} {noun}. C'est tout.",
      "Juste {noun}. Juste ça.",
      "Je suis rentré. {noun} était parti.",
    ],
  },
  stranger: {
    en: [
      "The {noun} {verb}s in a language I almost remember.",
      "A {noun} learned to {verb} from watching me.",
      "I keep {verb}ing the {noun} like it owes me weather.",
    ],
    fr: [
      "{noun} {verb} dans une langue que je reconnais presque.",
      "Un {noun} a appris à {verb} en me regardant.",
      "Je continue à {verb} {noun} comme s'il me devait du temps.",
    ],
  },
  emotional: {
    en: [
      "And I am the one who still {verb}s the {noun}.",
      "It isn't the {noun}. It's that I {verb} it alone.",
      "You don't know how often I {verb} the {noun} for you.",
    ],
    fr: [
      "Et c'est moi qui {verb} encore {noun}.",
      "Ce n'est pas {noun}. C'est que je le {verb} seul.",
      "Tu ne sais pas combien de fois je {verb} {noun} pour toi.",
    ],
  },
  melodic: {
    en: [
      "Oh, the {noun} and the long way home.",
      "{verb} me slow, {noun} me down.",
      "A {noun}, a {noun}, and the room goes gold.",
    ],
    fr: [
      "Oh, {noun} et le long chemin du retour.",
      "{verb}-moi lentement, {noun}-moi doucement.",
      "Un {noun}, un {noun}, et la pièce devient or.",
    ],
  },
};

// ============================================================
//                COMPARE phrasing (mock verdict)
// ============================================================

const COMPARE_PHRASES = {
  en: {
    aImage:    "Line A leans on image; Line B leans on statement.",
    bImage:    "Line B leans on image; Line A leans on statement.",
    sameImage: "Both work in roughly the same register, image-wise.",
    aTighter:  "A is tighter — it lands quicker, costs less breath.",
    bTighter:  "B is tighter — it lands quicker, costs less breath.",
    sameLength:"They sit at a similar length, so the difference is texture, not pace.",
    imgRisk:   "obscurity from image-load.",
    flatRisk:  "flatness from plainness.",
    tradePicture: "directness for picture.",
    tradeDirect:  "picture for directness.",
    aRisk:     (r) => "A risks: " + r,
    bTrade:    (t) => "B trades: " + t,
  },
  fr: {
    aImage:    "Le vers A penche vers l'image ; le vers B vers la déclaration.",
    bImage:    "Le vers B penche vers l'image ; le vers A vers la déclaration.",
    sameImage: "Les deux travaillent dans à peu près le même registre, côté image.",
    aTighter:  "A est plus serré — ça atterrit plus vite, ça coûte moins de souffle.",
    bTighter:  "B est plus serré — ça atterrit plus vite, ça coûte moins de souffle.",
    sameLength:"Ils sont d'une longueur similaire, donc la différence est de texture, pas de rythme.",
    imgRisk:   "l'obscurité par excès d'image.",
    flatRisk:  "la platitude par excès de simplicité.",
    tradePicture: "la franchise contre l'image.",
    tradeDirect:  "l'image contre la franchise.",
    aRisk:     (r) => "A risque : " + r,
    bTrade:    (t) => "B échange : " + t,
  },
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
  if (controls.complexity <= 25) {
    out = out.replace(/—/g, ",").replace(/^Oh,?\s*/i, "");
  }
  if (controls.complexity >= 75 && /^I\s/.test(out) && Math.random() < 0.3) {
    out = out.replace(/^I\s+(\w+)/, "$1 I");
  }
  if (controls.tone <= 25) out = out.replace(/!/g, ".");
  return out;
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
  const lang = req.lang || "en";

  if (req.kind === "mode") {
    system = getSystemPrompt(lang);
    user   = buildModePrompt({ modeId: req.modeId, seed: req.seed, controls: req.controls, lang });
  } else if (req.kind === "rewrite") {
    system = getRewriteSystemPrompt(lang);
    user   = buildRewritePrompt({ line: req.line, action: req.action, lang });
  } else if (req.kind === "compare") {
    system = getCompareSystemPrompt(lang);
    user   = buildComparePrompt({ a: req.a, b: req.b, lang });
  } else {
    throw new Error(`Unknown request kind: ${req.kind}`);
  }

  try {
    const res = await fetch(CLAUDE_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, user, model: CLAUDE_MODEL }),
    });
    if (!res.ok) {
      console.warn(`Claude proxy ${res.status} — falling back to mock`);
      return fallback(req);
    }
    const { content } = await res.json();
    return safeParseJSON(content, req);
  } catch (e) {
    console.warn("Claude proxy unreachable — falling back to mock", e);
    return fallback(req);
  }
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
