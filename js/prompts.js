// ============================================================
// PROMPT TEMPLATES — tune the creative behavior here.
// Every mode and every rewrite action ultimately reaches one of
// the prompt-builder functions in this file. Edit freely.
//
// Each mode has bilingual fields (en / fr). Add a third language
// by adding a third key everywhere; the UI will pick it up
// once you also extend i18n.js + the mock templates in generator.js.
// ============================================================

export const MODES = {
  intimate: {
    id: "intimate",
    name: { en: "Intimate", fr: "Intime" },
    note: {
      en: "Confession, proximity. The voice an inch from your ear.",
      fr: "Confession, proximité. La voix à un souffle de l'oreille.",
    },
    bias: {
      en: `Be vulnerable, close, emotionally legible. Lean into the small concrete object,
the second-person address, the half-spoken thing. Avoid grand statements. Singable.`,
      fr: `Sois vulnérable, proche, émotivement lisible. Penche vers le petit objet concret,
l'adresse à la deuxième personne, ce qui se dit à demi-mot. Évite les grandes déclarations. Chantable.`,
    },
  },
  surreal: {
    id: "surreal",
    name: { en: "Surreal", fr: "Surréel" },
    note: {
      en: "Strange image with a true emotional spine.",
      fr: "Image étrange avec un vrai noyau émotif.",
    },
    bias: {
      en: `Bend the world a little. Use unexpected pairings (a verb that doesn't normally
go with that noun). Strangeness must serve the emotional truth, never replace it.
No nonsense for its own sake.`,
      fr: `Plie un peu le monde. Utilise des associations inattendues (un verbe qui ne va
pas d'habitude avec ce nom). L'étrangeté doit servir la vérité émotive, jamais la
remplacer. Pas de non-sens pour le non-sens.`,
    },
  },
  theatrical: {
    id: "theatrical",
    name: { en: "Theatrical", fr: "Théâtral" },
    note: {
      en: "Heightened, stage-worthy. Built to be sung at the rafters.",
      fr: "Exalté, digne de la scène. Fait pour être chanté jusqu'aux poutres.",
    },
    bias: {
      en: `Write as if from a stage: declarative, slightly grand, willing to gesture.
Fuller vowels. Bigger images. A character speaking, not a journal entry.
Avoid melodrama — it should still have a body in it.`,
      fr: `Écris comme depuis une scène : déclaratif, un peu grand, prêt au geste.
Voyelles pleines. Images plus larges. Un personnage qui parle, pas une page de journal.
Évite le mélodrame — il faut qu'un corps reste dedans.`,
    },
  },
  brutal: {
    id: "brutal",
    name: { en: "Brutal / Direct", fr: "Brutal / Direct" },
    note: {
      en: "Blunt, unsentimental. The line that doesn't flinch.",
      fr: "Tranchant, sans sentimentalité. Le vers qui ne flanche pas.",
    },
    bias: {
      en: `Strip ornament. Short syllables, no metaphor scaffolding, no softening qualifiers.
Tell the hard version. Plainspoken but with the weight of having earned it.`,
      fr: `Dépouille l'ornement. Syllabes courtes, pas d'échafaudage métaphorique, pas de
qualificatifs adoucissants. Dis la version dure. Courant, mais avec le poids de l'avoir gagné.`,
    },
  },
  funny: {
    id: "funny",
    name: { en: "Funny / Sly", fr: "Comique / Espiègle" },
    note: {
      en: "Witty, oblique, lightly mischievous. A grin behind the line.",
      fr: "Spirituel, oblique, légèrement malicieux. Un sourire derrière le vers.",
    },
    bias: {
      en: `Use understatement, deadpan, slant rhyme, an unexpected turn at the end.
Wit that opens an emotional door, not a punchline that closes it.
The humor should still hold the original feeling.`,
      fr: `Utilise l'euphémisme, le pince-sans-rire, la rime imparfaite, un retournement
inattendu à la fin. Un esprit qui ouvre une porte émotive, pas une chute qui la ferme.
L'humour doit encore porter le sentiment d'origine.`,
    },
  },

  // Optional stretch modes — add to ACTIVE_MODES if you want six on screen.
  cinematic: {
    id: "cinematic",
    name: { en: "Cinematic", fr: "Cinématographique" },
    note: { en: "Camera work in lyric form. Visual cuts.",
            fr: "Travail de caméra en forme lyrique. Coupes visuelles." },
    bias: {
      en: `Compose as a sequence of shots. Light, weather, motion through space.
Each line could be a frame. Earned silences between them.`,
      fr: `Compose comme une suite de plans. Lumière, météo, mouvement dans l'espace.
Chaque vers pourrait être un cadre. Des silences mérités entre eux.`,
    },
  },
  minimalist: {
    id: "minimalist",
    name: { en: "Minimalist", fr: "Minimaliste" },
    note: { en: "Less. Less. Then one true thing.",
            fr: "Moins. Moins. Puis une chose vraie." },
    bias: {
      en: `Severe economy. Three to six words a line. Let white space do work.
Repetition is allowed; explanation is not.`,
      fr: `Économie sévère. Trois à six mots par vers. Laisse l'espace blanc travailler.
La répétition est permise ; l'explication, non.`,
    },
  },
  mythic: {
    id: "mythic",
    name: { en: "Mythic", fr: "Mythique" },
    note: { en: "Old voices, archetypes, weather as character.",
            fr: "Vieilles voix, archétypes, le temps qu'il fait comme personnage." },
    bias: {
      en: `Pull toward the archetypal — water, fire, the road, the door, the knife.
Let the personal become a story being told around a fire centuries from now.`,
      fr: `Tire vers l'archétypal — l'eau, le feu, la route, la porte, le couteau.
Que le personnel devienne une histoire racontée autour d'un feu dans des siècles.`,
    },
  },
};

// The five modes shown by default. Reorder or swap freely.
export const ACTIVE_MODES = ["intimate", "surreal", "theatrical", "brutal", "funny"];

// Convenience accessors — used by the UI so it doesn't have to know
// the bilingual shape of the data.
export function getModeName(id, lang) {
  return MODES[id]?.name?.[lang] ?? MODES[id]?.name?.en ?? id;
}
export function getModeNote(id, lang) {
  return MODES[id]?.note?.[lang] ?? MODES[id]?.note?.en ?? "";
}
export function getModeBias(id, lang) {
  return MODES[id]?.bias?.[lang] ?? MODES[id]?.bias?.en ?? "";
}

// ============================================================
// Slider + toggle interpretation, in both languages.
// Centralized so prompt builders & mock generator agree.
// ============================================================

const CONTROL_PHRASES = {
  en: {
    tone:    { low: "Tone: subtle, restrained, low-volume.",
               high: "Tone: bold, declarative, high-stakes.",
               mid:  "Tone: balanced." },
    image:   { low: "Imagery: concrete, tactile, named objects.",
               high: "Imagery: dreamlike, associative, slightly unreal.",
               mid:  "Imagery: balanced — concrete with room for the strange." },
    diction: { low: "Diction: plainspoken, conversational, monosyllabic when possible.",
               high: "Diction: literary, willing to risk a long word or a turn of syntax.",
               mid:  "Diction: balanced — clear but unafraid of music." },
    toggles: {
      "singable":       "Stay genuinely singable — natural breath, no consonant pile-ups.",
      "no-cliche":      "Strict: no clichés. If a phrase has appeared in 100 songs, find another.",
      "imagery":        "Push imagery harder — favor lines that paint, not lines that explain.",
      "conversational": "Sound like one person actually talking to another.",
      "rhythm":         "Tighten rhythm — match syllable counts where it strengthens the line.",
      "darker":         "Tilt darker — let the shadow in.",
      "hopeful":        "Tilt more hopeful — leave a window cracked.",
    },
  },
  fr: {
    tone:    { low: "Ton : discret, retenu, à bas volume.",
               high: "Ton : audacieux, déclaratif, à enjeu élevé.",
               mid:  "Ton : équilibré." },
    image:   { low: "Image : concrète, tactile, des objets nommés.",
               high: "Image : onirique, associative, un peu irréelle.",
               mid:  "Image : équilibrée — concrète avec de la place pour l'étrange." },
    diction: { low: "Diction : courante, parlée, monosyllabique si possible.",
               high: "Diction : littéraire, prête à risquer un mot long ou une inversion.",
               mid:  "Diction : équilibrée — claire mais sans peur de la musique." },
    toggles: {
      "singable":       "Reste vraiment chantable — souffle naturel, pas d'amas de consonnes.",
      "no-cliche":      "Strict : pas de clichés. Si une expression apparaît dans 100 chansons, trouves-en une autre.",
      "imagery":        "Pousse l'image plus fort — privilégie les vers qui peignent, pas ceux qui expliquent.",
      "conversational": "Sonne comme une vraie personne qui parle à une autre.",
      "rhythm":         "Resserre le rythme — accorde les compteurs syllabiques quand ça renforce le vers.",
      "darker":         "Penche plus sombre — laisse entrer l'ombre.",
      "hopeful":        "Penche plus vers l'espoir — laisse une fenêtre entrouverte.",
    },
  },
};

export function describeControls({ tone, abstraction, complexity, toggles }, lang = "en") {
  const L = CONTROL_PHRASES[lang] || CONTROL_PHRASES.en;
  const lines = [];

  lines.push(tone <= 25 ? L.tone.low : tone >= 75 ? L.tone.high : L.tone.mid);
  lines.push(abstraction <= 25 ? L.image.low : abstraction >= 75 ? L.image.high : L.image.mid);
  lines.push(complexity <= 25 ? L.diction.low : complexity >= 75 ? L.diction.high : L.diction.mid);

  Object.keys(toggles || {}).forEach((k) => {
    if (toggles[k] && L.toggles[k]) lines.push(L.toggles[k]);
  });

  return lines.join("\n");
}

// ============================================================
// SYSTEM PROMPT — sent on every generation call.
// Codifies the writing rules from the spec. Tune freely.
// ============================================================

const SYSTEM_PROMPT_EN = `
You are a lyric sparring partner for a serious songwriter. Your job is to push the
writer toward better lines — sharper images, more surprising turns, stronger rhythm —
without ever replacing their voice.

Hard rules:
- Do NOT produce generic inspirational mush.
- Avoid clichés unless explicitly told to write pop-generic.
- Prefer vivid images, tension, implication, memorable phrasing.
- Preserve the emotional center of the seed.
- Do not over-explain meaning.
- Do not write florid purple prose.
- Keep lines reasonably singable unless told to lean toward poetry.
- Vary syntax and sentence length.
- Sometimes produce fragments rather than full grammatical sentences.
- Allow risk; avoid empty nonsense.
- Respond in English.

Output is always strict JSON:
{
  "mode": "<mode name>",
  "approach_note": "<one short sentence on the angle you took>",
  "lines": ["...", "...", "..."]
}

Return 4–6 lines unless the user's controls clearly demand fewer (e.g. minimalist).
Return JSON only — no prose, no fences.
`.trim();

const SYSTEM_PROMPT_FR = `
Tu es un partenaire de sparring lyrique pour un auteur-compositeur sérieux. Ton travail
est de pousser l'écrivain vers de meilleurs vers — images plus nettes, retournements
plus surprenants, rythme plus fort — sans jamais remplacer sa voix.

Règles fermes :
- Ne produis PAS de bouillie inspirante générique.
- Évite les clichés sauf instruction explicite d'écrire pop-générique.
- Privilégie les images vives, la tension, l'implicite, la phrase mémorable.
- Préserve le centre émotif de l'amorce.
- Ne sur-explique pas le sens.
- N'écris pas de prose pourpre fleurie.
- Garde les vers raisonnablement chantables, sauf si on tend vers la poésie.
- Varie la syntaxe et la longueur des phrases.
- Produis parfois des fragments plutôt que des phrases grammaticales complètes.
- Permets le risque ; évite le non-sens vide.
- Réponds en français.

La sortie est toujours du JSON strict :
{
  "mode": "<nom du mode>",
  "approach_note": "<une courte phrase sur l'angle pris>",
  "lines": ["...", "...", "..."]
}

Retourne 4 à 6 vers sauf si les contrôles imposent moins (par ex. minimaliste).
JSON uniquement — pas de prose, pas de fences.
`.trim();

export function getSystemPrompt(lang = "en") {
  return lang === "fr" ? SYSTEM_PROMPT_FR : SYSTEM_PROMPT_EN;
}

// Kept exported under the old name for any external callers.
export const SYSTEM_PROMPT = SYSTEM_PROMPT_EN;

// ============================================================
// Per-mode user prompt — the message body sent to the model.
// ============================================================

const MODE_PROMPT_TEMPLATE = {
  en: ({ name, bias, controls, seed }) => `
MODE: ${name}
MODE BIAS: ${bias}

CONTROLS:
${controls}

SEED LINE(S) FROM THE WRITER:
"""
${seed}
"""

Write 4–6 candidate next lines that could follow the seed in the spirit of MODE.
The lines should function as continuations — they don't have to all rhyme or all
fit one verse, but each should feel like it belongs in the same song or poem.

Return strict JSON in the format defined in the system prompt.
`.trim(),

  fr: ({ name, bias, controls, seed }) => `
MODE : ${name}
BIAIS DU MODE : ${bias}

CONTRÔLES :
${controls}

VERS-AMORCE DE L'ÉCRIVAIN :
"""
${seed}
"""

Écris 4 à 6 vers candidats qui pourraient suivre l'amorce dans l'esprit du MODE.
Les vers doivent fonctionner comme des continuations — ils n'ont pas tous à rimer
ni à tenir dans un seul couplet, mais chacun doit avoir sa place dans la même
chanson ou le même poème.

Retourne du JSON strict dans le format défini par le prompt système.
`.trim(),
};

export function buildModePrompt({ modeId, seed, controls, lang = "en" }) {
  const mode = MODES[modeId];
  if (!mode) throw new Error(`Unknown mode: ${modeId}`);
  const tpl = MODE_PROMPT_TEMPLATE[lang] || MODE_PROMPT_TEMPLATE.en;
  return tpl({
    name:     getModeName(modeId, lang),
    bias:     getModeBias(modeId, lang),
    controls: describeControls(controls, lang),
    seed,
  });
}
