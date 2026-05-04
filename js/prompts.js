// ============================================================
// PROMPT TEMPLATES — tune the creative behavior here.
// Every mode and every rewrite action ultimately reaches one of
// the prompt-builder functions in this file. Edit freely.
// ============================================================

export const MODES = {
  intimate: {
    id: "intimate",
    name: "Intimate",
    note: "Confession, proximity. The voice an inch from your ear.",
    bias: `Be vulnerable, close, emotionally legible. Lean into the small concrete object,
the second-person address, the half-spoken thing. Avoid grand statements. Singable.`,
  },
  surreal: {
    id: "surreal",
    name: "Surreal",
    note: "Strange image with a true emotional spine.",
    bias: `Bend the world a little. Use unexpected pairings (a verb that doesn't normally
go with that noun). Strangeness must serve the emotional truth, never replace it.
No nonsense for its own sake.`,
  },
  theatrical: {
    id: "theatrical",
    name: "Theatrical",
    note: "Heightened, stage-worthy. Built to be sung at the rafters.",
    bias: `Write as if from a stage: declarative, slightly grand, willing to gesture.
Fuller vowels. Bigger images. A character speaking, not a journal entry.
Avoid melodrama — it should still have a body in it.`,
  },
  brutal: {
    id: "brutal",
    name: "Brutal / Direct",
    note: "Blunt, unsentimental. The line that doesn't flinch.",
    bias: `Strip ornament. Short syllables, no metaphor scaffolding, no softening qualifiers.
Tell the hard version. Plainspoken but with the weight of having earned it.`,
  },
  funny: {
    id: "funny",
    name: "Funny / Sly",
    note: "Witty, oblique, lightly mischievous. A grin behind the line.",
    bias: `Use understatement, deadpan, slant rhyme, an unexpected turn at the end.
Wit that opens an emotional door, not a punchline that closes it.
The humor should still hold the original feeling.`,
  },

  // Optional stretch modes — add to ACTIVE_MODES if you want six on screen.
  cinematic: {
    id: "cinematic",
    name: "Cinematic",
    note: "Camera work in lyric form. Visual cuts.",
    bias: `Compose as a sequence of shots. Light, weather, motion through space.
Each line could be a frame. Earned silences between them.`,
  },
  minimalist: {
    id: "minimalist",
    name: "Minimalist",
    note: "Less. Less. Then one true thing.",
    bias: `Severe economy. Three to six words a line. Let white space do work.
Repetition is allowed; explanation is not.`,
  },
  mythic: {
    id: "mythic",
    name: "Mythic",
    note: "Old voices, archetypes, weather as character.",
    bias: `Pull toward the archetypal — water, fire, the road, the door, the knife.
Let the personal become a story being told around a fire centuries from now.`,
  },
};

// The five modes shown by default. Reorder or swap freely.
export const ACTIVE_MODES = ["intimate", "surreal", "theatrical", "brutal", "funny"];

// ============================================================
// Slider + toggle interpretation
// Centralized so prompt builders & mock generator agree.
// ============================================================

export function describeControls({ tone, abstraction, complexity, toggles }) {
  const lines = [];

  if (tone <= 25)        lines.push("Tone: subtle, restrained, low-volume.");
  else if (tone >= 75)   lines.push("Tone: bold, declarative, high-stakes.");
  else                   lines.push("Tone: balanced.");

  if (abstraction <= 25) lines.push("Imagery: concrete, tactile, named objects.");
  else if (abstraction >= 75) lines.push("Imagery: dreamlike, associative, slightly unreal.");
  else                   lines.push("Imagery: balanced — concrete with room for the strange.");

  if (complexity <= 25)  lines.push("Diction: plainspoken, conversational, monosyllabic when possible.");
  else if (complexity >= 75) lines.push("Diction: literary, willing to risk a long word or a turn of syntax.");
  else                   lines.push("Diction: balanced — clear but unafraid of music.");

  const toggleNotes = {
    "singable":       "Stay genuinely singable — natural breath, no consonant pile-ups.",
    "no-cliche":      "Strict: no clichés. If a phrase has appeared in 100 songs, find another.",
    "imagery":        "Push imagery harder — favor lines that paint, not lines that explain.",
    "conversational": "Sound like one person actually talking to another.",
    "rhythm":         "Tighten rhythm — match syllable counts where it strengthens the line.",
    "darker":         "Tilt darker — let the shadow in.",
    "hopeful":        "Tilt more hopeful — leave a window cracked.",
  };

  Object.keys(toggles || {}).forEach((k) => {
    if (toggles[k] && toggleNotes[k]) lines.push(toggleNotes[k]);
  });

  return lines.join("\n");
}

// ============================================================
// SYSTEM PROMPT — sent on every generation call.
// Codifies the writing rules from the spec. Tune freely.
// ============================================================

export const SYSTEM_PROMPT = `
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

Output is always strict JSON:
{
  "mode": "<mode name>",
  "approach_note": "<one short sentence on the angle you took>",
  "lines": ["...", "...", "..."]
}

Return 4–6 lines unless the user's controls clearly demand fewer (e.g. minimalist).
Return JSON only — no prose, no fences.
`.trim();

// ============================================================
// Per-mode user prompt — the message body sent to the model.
// ============================================================

export function buildModePrompt({ modeId, seed, controls }) {
  const mode = MODES[modeId];
  if (!mode) throw new Error(`Unknown mode: ${modeId}`);

  return `
MODE: ${mode.name}
MODE BIAS: ${mode.bias}

CONTROLS:
${describeControls(controls)}

SEED LINE(S) FROM THE WRITER:
"""
${seed}
"""

Write 4–6 candidate next lines that could follow the seed in the spirit of MODE.
The lines should function as continuations — they don't have to all rhyme or all
fit one verse, but each should feel like it belongs in the same song or poem.

Return strict JSON in the format defined in the system prompt.
`.trim();
}
