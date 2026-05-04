// ============================================================
// REWRITE + COMPARE prompt builders.
// Same architecture as prompts.js — edit freely.
// ============================================================

export const REWRITE_ACTIONS = {
  sharper:    { label: "make sharper",      bias: "Cut words. Trade abstraction for specificity. Sharpen the verb." },
  simpler:    { label: "make simpler",      bias: "Plainspoken. Shorter syllables. A child could sing it." },
  stranger:   { label: "make stranger",     bias: "Bend one image. Choose an unexpected verb or pairing. Stay true to the feeling." },
  emotional:  { label: "make more emotional", bias: "Move closer to the body. Name the small private thing." },
  melodic:    { label: "make more melodic", bias: "Smooth consonants, open vowels. Tighter syllable count. Sing it in your head as you write." },
};

export const REWRITE_SYSTEM_PROMPT = `
You are rewriting a single line of lyric / poetry on request.
Return strict JSON:

{
  "rewrites": ["alt 1", "alt 2", "alt 3"]
}

Rules:
- Preserve the line's emotional center.
- 3 alternatives, each meaningfully different from the others.
- No explanation, no fences, JSON only.
`.trim();

export function buildRewritePrompt({ line, action }) {
  const a = REWRITE_ACTIONS[action];
  if (!a) throw new Error(`Unknown rewrite action: ${action}`);

  return `
DIRECTION: ${a.label}
BIAS: ${a.bias}

ORIGINAL LINE:
"""
${line}
"""

Return 3 rewrites in the JSON format defined in the system prompt.
`.trim();
}

// ============================================================
// COMPARE — produces a brief comparative reading of two lines.
// ============================================================

export const COMPARE_SYSTEM_PROMPT = `
You are a sharp lyric editor. Given two candidate lines for the same song,
write a brief comparative reading.

Return strict JSON:
{
  "verdict": "<2–3 sentences. Concrete craft language: image vs statement, rhythm,
              register, what each line risks, what each one trades away.
              Do NOT pick a winner unless one is clearly stronger; instead, name
              what each is better at.>"
}

JSON only. No fences.
`.trim();

export function buildComparePrompt({ a, b }) {
  return `
LINE A:
"""
${a}
"""

LINE B:
"""
${b}
"""

Compare them as craft. Return JSON in the defined format.
`.trim();
}
