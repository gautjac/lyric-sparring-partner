// ============================================================
// REWRITE + COMPARE prompt builders.
// Bilingual (en / fr). Edit freely.
// ============================================================

export const REWRITE_ACTIONS = {
  sharper: {
    label: { en: "make sharper",        fr: "rendre plus tranchant" },
    bias:  { en: "Cut words. Trade abstraction for specificity. Sharpen the verb.",
             fr: "Coupe des mots. Échange l'abstraction contre la précision. Aiguise le verbe." },
  },
  simpler: {
    label: { en: "make simpler",        fr: "rendre plus simple" },
    bias:  { en: "Plainspoken. Shorter syllables. A child could sing it.",
             fr: "Parlé. Syllabes plus courtes. Un enfant pourrait le chanter." },
  },
  stranger: {
    label: { en: "make stranger",       fr: "rendre plus étrange" },
    bias:  { en: "Bend one image. Choose an unexpected verb or pairing. Stay true to the feeling.",
             fr: "Plie une image. Choisis un verbe ou une association inattendue. Reste fidèle au sentiment." },
  },
  emotional: {
    label: { en: "make more emotional", fr: "rendre plus émotif" },
    bias:  { en: "Move closer to the body. Name the small private thing.",
             fr: "Approche-toi du corps. Nomme la petite chose privée." },
  },
  melodic: {
    label: { en: "make more melodic",   fr: "rendre plus mélodique" },
    bias:  { en: "Smooth consonants, open vowels. Tighter syllable count. Sing it in your head as you write.",
             fr: "Consonnes douces, voyelles ouvertes. Compteur syllabique plus serré. Chante-le en l'écrivant." },
  },
};

export function getRewriteLabel(action, lang) {
  return REWRITE_ACTIONS[action]?.label?.[lang] ?? REWRITE_ACTIONS[action]?.label?.en ?? action;
}
export function getRewriteBias(action, lang) {
  return REWRITE_ACTIONS[action]?.bias?.[lang] ?? REWRITE_ACTIONS[action]?.bias?.en ?? "";
}

const REWRITE_SYSTEM_PROMPT_EN = `
You are rewriting a single line of lyric / poetry on request.
Return strict JSON:

{
  "rewrites": ["alt 1", "alt 2", "alt 3"]
}

Rules:
- Preserve the line's emotional center.
- 3 alternatives, each meaningfully different from the others.
- Respond in English.
- No explanation, no fences, JSON only.
`.trim();

const REWRITE_SYSTEM_PROMPT_FR = `
Tu réécris un seul vers de lyric / poésie sur demande.
Retourne du JSON strict :

{
  "rewrites": ["alt 1", "alt 2", "alt 3"]
}

Règles :
- Préserve le centre émotif du vers.
- 3 alternatives, chacune significativement différente des autres.
- Réponds en français.
- Pas d'explication, pas de fences, JSON uniquement.
`.trim();

export function getRewriteSystemPrompt(lang = "en") {
  return lang === "fr" ? REWRITE_SYSTEM_PROMPT_FR : REWRITE_SYSTEM_PROMPT_EN;
}

// Kept exported for back-compat with older imports.
export const REWRITE_SYSTEM_PROMPT = REWRITE_SYSTEM_PROMPT_EN;

const REWRITE_USER_TEMPLATE = {
  en: ({ label, bias, line }) => `
DIRECTION: ${label}
BIAS: ${bias}

ORIGINAL LINE:
"""
${line}
"""

Return 3 rewrites in the JSON format defined in the system prompt.
`.trim(),

  fr: ({ label, bias, line }) => `
DIRECTION : ${label}
BIAIS : ${bias}

VERS ORIGINAL :
"""
${line}
"""

Retourne 3 réécritures dans le format JSON défini par le prompt système.
`.trim(),
};

export function buildRewritePrompt({ line, action, lang = "en" }) {
  if (!REWRITE_ACTIONS[action]) throw new Error(`Unknown rewrite action: ${action}`);
  const tpl = REWRITE_USER_TEMPLATE[lang] || REWRITE_USER_TEMPLATE.en;
  return tpl({
    label: getRewriteLabel(action, lang),
    bias:  getRewriteBias(action, lang),
    line,
  });
}

// ============================================================
// COMPARE — produces a brief comparative reading of two lines.
// ============================================================

const COMPARE_SYSTEM_PROMPT_EN = `
You are a sharp lyric editor. Given two candidate lines for the same song,
write a brief comparative reading.

Return strict JSON:
{
  "verdict": "<2–3 sentences. Concrete craft language: image vs statement, rhythm,
              register, what each line risks, what each one trades away.
              Do NOT pick a winner unless one is clearly stronger; instead, name
              what each is better at.>"
}

Respond in English. JSON only. No fences.
`.trim();

const COMPARE_SYSTEM_PROMPT_FR = `
Tu es un éditeur de paroles aiguisé. Étant donné deux vers candidats pour la même
chanson, écris une brève lecture comparative.

Retourne du JSON strict :
{
  "verdict": "<2 ou 3 phrases. Langage de métier concret : image vs déclaration,
              rythme, registre, ce que chaque vers risque, ce qu'il sacrifie.
              NE choisis PAS de gagnant sauf si l'un est clairement plus fort ;
              nomme plutôt ce que chacun fait de mieux.>"
}

Réponds en français. JSON uniquement. Pas de fences.
`.trim();

export function getCompareSystemPrompt(lang = "en") {
  return lang === "fr" ? COMPARE_SYSTEM_PROMPT_FR : COMPARE_SYSTEM_PROMPT_EN;
}
export const COMPARE_SYSTEM_PROMPT = COMPARE_SYSTEM_PROMPT_EN;

const COMPARE_USER_TEMPLATE = {
  en: ({ a, b }) => `
LINE A:
"""
${a}
"""

LINE B:
"""
${b}
"""

Compare them as craft. Return JSON in the defined format.
`.trim(),
  fr: ({ a, b }) => `
VERS A :
"""
${a}
"""

VERS B :
"""
${b}
"""

Compare-les comme métier. Retourne du JSON dans le format défini.
`.trim(),
};

export function buildComparePrompt({ a, b, lang = "en" }) {
  const tpl = COMPARE_USER_TEMPLATE[lang] || COMPARE_USER_TEMPLATE.en;
  return tpl({ a, b });
}
