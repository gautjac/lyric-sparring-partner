// ============================================================
// i18n — UI strings only.
// Mode definitions, prompts, and mock templates live in prompts.js
// and generator.js (those files own their own EN/FR fields).
//
// Usage:
//   import { t, getLang, setLang, onLangChange } from "./i18n.js";
//   t("panels.seed.title")
//   t("compare.status", { n: 1 })
// ============================================================

import { store } from "./store.js";

const SUPPORTED = ["en", "fr"];

let currentLang =
  store.getLang() ||
  (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en");

if (!SUPPORTED.includes(currentLang)) currentLang = "en";

const listeners = new Set();

export function getLang() { return currentLang; }
export function setLang(lang) {
  if (!SUPPORTED.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  store.setLang(lang);
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn(lang));
}
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(path, vars) {
  const value = lookup(TRANSLATIONS[currentLang], path)
            ?? lookup(TRANSLATIONS.en, path)
            ?? path;
  if (typeof value !== "string") return value;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

// Returns array, object, or string — for buckets, etc.
export function tRaw(path) {
  return lookup(TRANSLATIONS[currentLang], path)
      ?? lookup(TRANSLATIONS.en, path);
}

function lookup(root, path) {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), root);
}

// ============================================================
// Translations
// ============================================================

export const TRANSLATIONS = {
  en: {
    brand: {
      name: "Lyric Sparring Partner",
      sub:  "a writing room, not a chatbot",
    },
    topbar: {
      try_seed: "Try a seed",
      theme:    "Toggle theme",
      lang:     "français",
    },
    panels: {
      seed: {
        title: "The seed",
        hint:  "A line, a couplet, a fragment. Whatever is alive.",
        placeholder: "I kept your name in the mouth of winter…",
      },
      output: {
        title: "Sparring partners",
        hint:  "Five pressure angles. Take what's useful. Tap a line to keep it.",
        empty_quiet: "The room is quiet.",
        empty_drop:  "Drop a line above and we'll start trading verses.",
        listening:   "listening…",
      },
      keepers: {
        title: "Keepers",
        hint:  "Saved here, saved on this device.",
        empty: "Lines you save here become a draft.",
      },
    },
    sliders: {
      tone: "Tone",
      imagery: "Imagery",
      diction: "Diction",
    },
    slider_ends: {
      tone_low: "subtle", tone_high: "bold",
      imagery_low: "concrete", imagery_high: "dreamlike",
      diction_low: "plainspoken", diction_high: "literary",
    },
    slider_buckets: {
      tone:        ["whispered", "subtle", "balanced", "bold", "thunderous"],
      imagery:     ["literal", "concrete", "balanced", "imagistic", "dreamlike"],
      diction:     ["plainspoken", "easy", "balanced", "literary", "ornate"],
    },
    toggles: {
      "singable":       "keep it singable",
      "no-cliche":      "avoid clichés",
      "imagery":        "stronger imagery",
      "conversational": "conversational",
      "rhythm":         "tighter rhythm",
      "darker":         "darker",
      "hopeful":        "more hopeful",
    },
    actions: {
      generate:    "Spar with me ⏎",
      generating:  "Sparring…",
      regen_mode:  "regenerate this mode",
      rewrite:     "↻ rewrite",
      compare:     "⇌ compare",
      cancel:      "cancel",
    },
    rewrite: {
      sharper:   "make sharper",
      simpler:   "make simpler",
      stranger:  "make stranger",
      emotional: "make more emotional",
      melodic:   "make more melodic",
    },
    compare: {
      status:      "{n} / 2 selected for compare",
      compare_btn: "Compare these two",
      comparing:   "Comparing…",
      clear:       "clear",
      title:       "Compare",
      a_label:     "A",
      b_label:     "B",
    },
    export: {
      copy_plain:    "copy plain",
      copy_verse:    "copy verse",
      export_md:     "export draft .md",
      clear_keepers: "clear",
      draft_title:   "Lyric draft — {date}",
      seed_label:    "Seed",
      footer:        "Generated with Lyric Sparring Partner.",
      filename:      "lyric-draft-{date}.md",
    },
    toasts: {
      drop_first:           "Drop a line first.",
      no_keepers:           "No keepers yet.",
      verse_copied:         "Verse block copied.",
      plain_copied:         "Plain text copied.",
      clipboard_blocked:    "Clipboard blocked. Select & copy manually.",
      draft_exported:       "Draft exported.",
      rewrite_failed:       "Rewrite failed.",
      compare_failed:       "Compare failed.",
      no_rewrites:          "No rewrites came back.",
      regen_failed:         "Couldn't regenerate that one.",
      cant_read_lines:      "Couldn't read those lines.",
      rewriting:            "Rewriting — {action}…",
      variants:             "+{n} variants — click to keep",
      confirm_clear_keepers:"Clear all keepers?",
    },
    footer: "Built for the writing desk. Mock generator on by default — wire generator.js to Claude when you're ready.",
    hotkey: "⌘/Ctrl ⏎",
  },

  fr: {
    brand: {
      name: "Le Sparring Lyrique",
      sub:  "une chambre d'écriture, pas un chatbot",
    },
    topbar: {
      try_seed: "Une amorce",
      theme:    "Bascule du thème",
      lang:     "english",
    },
    panels: {
      seed: {
        title: "L'amorce",
        hint:  "Un vers, un distique, un fragment. Ce qui est vivant.",
        placeholder: "J'ai gardé ton nom dans la bouche de l'hiver…",
      },
      output: {
        title: "Partenaires de sparring",
        hint:  "Cinq angles de pression. Prends ce qui sert. Touche un vers pour le garder.",
        empty_quiet: "La chambre est silencieuse.",
        empty_drop:  "Pose une ligne là-haut et on commence à échanger des vers.",
        listening:   "à l'écoute…",
      },
      keepers: {
        title: "À garder",
        hint:  "Gardés ici, gardés sur cet appareil.",
        empty: "Les vers gardés ici deviennent un brouillon.",
      },
    },
    sliders: {
      tone:    "Ton",
      imagery: "Image",
      diction: "Diction",
    },
    slider_ends: {
      tone_low: "discret", tone_high: "audacieux",
      imagery_low: "concret", imagery_high: "onirique",
      diction_low: "courant", diction_high: "littéraire",
    },
    slider_buckets: {
      tone:    ["murmuré", "discret", "équilibré", "audacieux", "fracassant"],
      imagery: ["littéral", "concret", "équilibré", "imagé", "onirique"],
      diction: ["courant", "simple", "équilibré", "littéraire", "ornementé"],
    },
    toggles: {
      "singable":       "qu'on puisse le chanter",
      "no-cliche":      "éviter les clichés",
      "imagery":        "images plus fortes",
      "conversational": "ton parlé",
      "rhythm":         "rythme plus serré",
      "darker":         "plus sombre",
      "hopeful":        "plus d'espoir",
    },
    actions: {
      generate:    "Sparre avec moi ⏎",
      generating:  "On sparre…",
      regen_mode:  "régénérer ce mode",
      rewrite:     "↻ réécrire",
      compare:     "⇌ comparer",
      cancel:      "annuler",
    },
    rewrite: {
      sharper:   "rendre plus tranchant",
      simpler:   "rendre plus simple",
      stranger:  "rendre plus étrange",
      emotional: "rendre plus émotif",
      melodic:   "rendre plus mélodique",
    },
    compare: {
      status:      "{n} / 2 sélectionnés pour comparer",
      compare_btn: "Comparer ces deux-là",
      comparing:   "Comparaison…",
      clear:       "effacer",
      title:       "Comparaison",
      a_label:     "A",
      b_label:     "B",
    },
    export: {
      copy_plain:    "copier brut",
      copy_verse:    "copier en vers",
      export_md:     "exporter brouillon .md",
      clear_keepers: "effacer",
      draft_title:   "Brouillon de paroles — {date}",
      seed_label:    "Amorce",
      footer:        "Généré avec Le Sparring Lyrique.",
      filename:      "brouillon-paroles-{date}.md",
    },
    toasts: {
      drop_first:           "Pose d'abord un vers.",
      no_keepers:           "Rien encore gardé.",
      verse_copied:         "Bloc en vers copié.",
      plain_copied:         "Texte brut copié.",
      clipboard_blocked:    "Presse-papiers bloqué. Sélectionne et copie à la main.",
      draft_exported:       "Brouillon exporté.",
      rewrite_failed:       "Échec de la réécriture.",
      compare_failed:       "Échec de la comparaison.",
      no_rewrites:          "Aucune réécriture reçue.",
      regen_failed:         "Régénération impossible.",
      cant_read_lines:      "Impossible de lire ces vers.",
      rewriting:            "Réécriture — {action}…",
      variants:             "+{n} variantes — touche pour garder",
      confirm_clear_keepers:"Effacer tout ce qui est gardé ?",
    },
    footer: "Conçu pour le bureau d'écriture. Générateur factice par défaut — branche generator.js à Claude quand tu seras prêt.",
    hotkey: "⌘/Ctrl ⏎",
  },
};
