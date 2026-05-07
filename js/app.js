// ============================================================
// Lyric Sparring Partner — main app
// Wires the UI to the generator and the local store.
// Bilingual (EN / FR). All UI strings flow through i18n.js.
// ============================================================

import { ACTIVE_MODES, MODES, getModeName, getModeNote } from "./prompts.js";
import { REWRITE_ACTIONS, getRewriteLabel } from "./rewrite.js";
import { generate } from "./generator.js";
import { store } from "./store.js";
import { getExamples } from "./examples.js";
import { t, tRaw, getLang, setLang, onLangChange } from "./i18n.js";

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const seedEl       = $("seed");
const cardsEl      = $("cards");
const keepersEl    = $("keepers");
const generateBtn  = $("generateBtn");
const exampleBtn   = $("exampleBtn");
const themeToggle  = $("themeToggle");
const langToggle   = $("langToggle");
const compareBar   = $("compareBar");
const compareStatus = $("compareStatus");
const compareBtn   = $("compareBtn");
const clearCompareBtn = $("clearCompareBtn");
const compareResult = $("compareResult");
const toastEl      = $("toast");
const toggleGroup  = $("toggleGroup");

const slider = {
  tone: $("tone"),
  abstraction: $("abstraction"),
  complexity: $("complexity"),
};
const sliderLabel = {
  tone: $("toneLabel"),
  abstraction: $("absLabel"),
  complexity: $("cxLabel"),
};

// ---------- App state ----------
const state = {
  cards: {},          // modeId -> { mode, approach_note, lines: [] }
  keepers: store.getKeepers(),
  toggles: {},        // toggle id -> bool
  compareIds: [],     // up to 2 line ids
  rewriteOpen: null,  // dom of currently open rewrite menu
  lastSeedAtGen: "",  // seed used for the most recent generation (for re-render in new lang)
};

// ---------- Boot ----------
init();

function init() {
  applyTheme(store.getTheme() || (prefersDark() ? "dark" : "light"));
  themeToggle.addEventListener("click", () => {
    const next = document.body.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    store.setTheme(next);
  });

  // Language toggle
  document.documentElement.lang = getLang();
  applyI18n();
  langToggle.addEventListener("click", () => {
    setLang(getLang() === "fr" ? "en" : "fr");
  });
  onLangChange(() => {
    applyI18n();
    rerenderDynamic();
  });

  // Restore last session
  const savedSeed = store.getSeed();
  if (savedSeed) seedEl.value = savedSeed;

  const savedControls = store.getControls();
  if (savedControls) {
    slider.tone.value        = savedControls.tone        ?? 50;
    slider.abstraction.value = savedControls.abstraction ?? 50;
    slider.complexity.value  = savedControls.complexity  ?? 50;
    state.toggles = savedControls.toggles || {};
  }

  // Slider labels
  for (const k of Object.keys(slider)) {
    slider[k].addEventListener("input", () => {
      sliderLabel[k].textContent = describeSlider(k, +slider[k].value);
      persistControls();
    });
    sliderLabel[k].textContent = describeSlider(k, +slider[k].value);
  }

  // Toggles
  toggleGroup.querySelectorAll(".chip").forEach((btn) => {
    const key = btn.dataset.toggle;
    if (state.toggles[key]) btn.classList.add("active");
    btn.addEventListener("click", () => {
      state.toggles[key] = !state.toggles[key];
      btn.classList.toggle("active", state.toggles[key]);
      persistControls();
    });
  });

  // Buttons
  generateBtn.addEventListener("click", runAllModes);
  exampleBtn.addEventListener("click", () => {
    const next = pickExample(seedEl.value);
    seedEl.value = next;
    store.setSeed(next);
    seedEl.focus();
  });
  seedEl.addEventListener("input", () => store.setSeed(seedEl.value));

  // Cmd/Ctrl+Enter to generate
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runAllModes();
    }
    if (e.key === "Escape") closeRewriteMenu();
  });
  document.addEventListener("click", (e) => {
    if (state.rewriteOpen && !state.rewriteOpen.contains(e.target)) closeRewriteMenu();
  });

  // Compare bar buttons
  compareBtn.addEventListener("click", runCompare);
  clearCompareBtn.addEventListener("click", clearCompare);

  // Export buttons
  $("copyPlain").addEventListener("click", () => copyKeepers("plain"));
  $("copyVerse").addEventListener("click", () => copyKeepers("verse"));
  $("exportMd").addEventListener("click", exportMarkdown);
  $("clearKeepers").addEventListener("click", () => {
    if (state.keepers.length === 0) return;
    if (confirm(t("toasts.confirm_clear_keepers"))) {
      state.keepers = [];
      saveKeepers();
      renderKeepers();
    }
  });

  renderKeepers();
  updateCompareBar();
}

// ============================================================
// I18N — apply translations to the static DOM
// ============================================================
function applyI18n() {
  // Text content
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  // Attributes (placeholder, title, aria-label)
  document.querySelectorAll("*").forEach((el) => {
    for (const attr of el.attributes || []) {
      const m = /^data-i18n-attr-(.+)$/.exec(attr.name);
      if (m) el.setAttribute(m[1], t(attr.value));
    }
  });
  // Page title
  document.title = t("brand.name");
  // Slider value labels
  Object.keys(slider).forEach((k) => {
    sliderLabel[k].textContent = describeSlider(k, +slider[k].value);
  });
}

function rerenderDynamic() {
  // If we have generated cards, refresh their mode names + notes in the new language.
  for (const modeId of ACTIVE_MODES) {
    const card = cardsEl.querySelector(`.card[data-mode="${modeId}"]`);
    if (!card) continue;
    const nameEl = card.querySelector(".mode-name");
    const noteEl = card.querySelector(".approach-note");
    if (nameEl && state.cards[modeId]?.mode) {
      // We stored the localized name at gen-time; re-derive from MODES so the
      // displayed language matches the current UI.
      nameEl.textContent = getModeName(modeId, getLang());
    }
    if (noteEl && state.cards[modeId]) {
      // Only override if the note appears to be the default mode note (mock case).
      // Real Claude responses might have a model-written note in the original language.
      const original = state.cards[modeId].approach_note;
      const fallbackEN = getModeNote(modeId, "en");
      const fallbackFR = getModeNote(modeId, "fr");
      if (original === fallbackEN || original === fallbackFR) {
        noteEl.textContent = getModeNote(modeId, getLang());
      }
    }
  }
  // Empty state, keepers (if empty), compare bar text — picked up by data-i18n already
  renderKeepers();
  updateCompareBar();
  // If a compare result is visible, refresh its label rows
  if (!compareResult.classList.contains("hidden")) {
    const aLine = compareResult.querySelector(".compare-pair .compare-line:nth-child(1)");
    const bLine = compareResult.querySelector(".compare-pair .compare-line:nth-child(2)");
    const heading = compareResult.querySelector("h4");
    if (heading) heading.textContent = t("compare.title");
    if (aLine && aLine.dataset.text) aLine.textContent = `${t("compare.a_label")} · ${aLine.dataset.text}`;
    if (bLine && bLine.dataset.text) bLine.textContent = `${t("compare.b_label")} · ${bLine.dataset.text}`;
  }
}

// ============================================================
// CONTROL DESCRIPTIONS  (the little italic words next to sliders)
// ============================================================
function describeSlider(key, v) {
  const map = { tone: "tone", abstraction: "imagery", complexity: "diction" };
  const arr = tRaw(`slider_buckets.${map[key]}`) || ["", "", "", "", ""];
  const i = Math.min(arr.length - 1, Math.floor((v / 100) * arr.length));
  return arr[i];
}

function readControls() {
  return {
    tone:        +slider.tone.value,
    abstraction: +slider.abstraction.value,
    complexity:  +slider.complexity.value,
    toggles:     { ...state.toggles },
  };
}
function persistControls() { store.setControls(readControls()); }

// ============================================================
// THEME
// ============================================================
function applyTheme(t) {
  document.body.dataset.theme = t;
  themeToggle.textContent = t === "dark" ? "☀" : "◐";
}
function prefersDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// ============================================================
// EXAMPLES
// ============================================================
function pickExample(current) {
  const pool = getExamples(getLang()).filter((s) => s !== current);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================
// GENERATE — all modes, in parallel
// ============================================================
async function runAllModes() {
  const seed = seedEl.value.trim();
  if (!seed) { toast(t("toasts.drop_first")); seedEl.focus(); return; }

  generateBtn.disabled = true;
  generateBtn.textContent = t("actions.generating");
  compareResult.classList.add("hidden");
  state.compareIds = [];
  updateCompareBar();
  state.lastSeedAtGen = seed;

  // Render skeletons immediately so the room fills.
  state.cards = {};
  cardsEl.innerHTML = "";
  ACTIVE_MODES.forEach((modeId) => {
    state.cards[modeId] = { loading: true };
    cardsEl.appendChild(skeletonCard(modeId));
  });

  const controls = readControls();
  const lang = getLang();

  const results = await Promise.all(
    ACTIVE_MODES.map(async (modeId) => {
      try {
        const result = await generate({ kind: "mode", modeId, seed, controls, lang });
        return { modeId, result };
      } catch (err) {
        console.error(err);
        return { modeId, result: { mode: getModeName(modeId, lang), approach_note: "", lines: [] } };
      }
    })
  );

  results.forEach(({ modeId, result }) => {
    state.cards[modeId] = result;
    const old = cardsEl.querySelector(`.card[data-mode="${modeId}"]`);
    const fresh = renderCard(modeId, result);
    if (old) old.replaceWith(fresh); else cardsEl.appendChild(fresh);
  });

  generateBtn.disabled = false;
  generateBtn.textContent = t("actions.generate");

  showCompareBar();
}

async function regenMode(modeId, regenButton) {
  const seed = seedEl.value.trim();
  if (!seed) return;

  regenButton?.classList.add("spinning");
  const card = cardsEl.querySelector(`.card[data-mode="${modeId}"]`);
  if (card) card.classList.add("loading");

  try {
    const result = await generate({ kind: "mode", modeId, seed, controls: readControls(), lang: getLang() });
    state.cards[modeId] = result;
    const fresh = renderCard(modeId, result);
    card?.replaceWith(fresh);
  } catch (e) {
    console.error(e);
    toast(t("toasts.regen_failed"));
    card?.classList.remove("loading");
  } finally {
    regenButton?.classList.remove("spinning");
  }
}

// ============================================================
// CARD RENDERING
// ============================================================
function skeletonCard(modeId) {
  const lang = getLang();
  const el = document.createElement("article");
  el.className = "card loading";
  el.dataset.mode = modeId;
  el.innerHTML = `
    <header class="card-head">
      <span class="mode-name">${escapeHtml(getModeName(modeId, lang))}</span>
      <button class="mode-regen" title="${escapeHtml(t("actions.regen_mode"))}">↻</button>
    </header>
    <p class="approach-note">${escapeHtml(getModeNote(modeId, lang))}</p>
    <ul class="lines">
      ${[1,2,3,4].map(() => `<li class="line"><span class="line-text" style="opacity:0.35;font-style:italic;">${escapeHtml(t("panels.output.listening"))}</span></li>`).join("")}
    </ul>`;
  return el;
}

function renderCard(modeId, result) {
  const lang = getLang();
  const el = document.createElement("article");
  el.className = "card";
  el.dataset.mode = modeId;

  el.innerHTML = `
    <header class="card-head">
      <span class="mode-name">${escapeHtml(result.mode || getModeName(modeId, lang))}</span>
      <button class="mode-regen" title="${escapeHtml(t("actions.regen_mode"))}">↻</button>
    </header>
    <p class="approach-note">${escapeHtml(result.approach_note || getModeNote(modeId, lang))}</p>
    <ul class="lines"></ul>
  `;

  const linesEl = el.querySelector(".lines");
  (result.lines || []).forEach((text, idx) => {
    const lineId = `${modeId}:${idx}:${cheapHash(text)}`;
    linesEl.appendChild(renderLine(lineId, text, modeId));
  });

  el.querySelector(".mode-regen").addEventListener("click", (e) => {
    regenMode(modeId, e.currentTarget);
  });

  return el;
}

function renderLine(id, text, modeId) {
  const li = document.createElement("li");
  li.className = "line";
  li.dataset.lineId = id;
  if (state.keepers.some((k) => k.id === id)) li.classList.add("kept");
  if (state.compareIds.includes(id)) li.classList.add("compare-selected");

  li.innerHTML = `
    <span class="line-text">${escapeHtml(text)}</span>
    <span class="line-actions">
      <button class="line-action" data-act="rewrite" title="${escapeHtml(t("actions.rewrite"))}">${escapeHtml(t("actions.rewrite"))}</button>
      <button class="line-action" data-act="compare" title="${escapeHtml(t("actions.compare"))}">${escapeHtml(t("actions.compare"))}</button>
    </span>
  `;

  li.querySelector(".line-text").addEventListener("click", () => toggleKeeper(id, text, modeId, li));

  li.querySelector('[data-act="rewrite"]').addEventListener("click", (e) => {
    e.stopPropagation();
    openRewriteMenu(li, text, modeId);
  });

  li.querySelector('[data-act="compare"]').addEventListener("click", (e) => {
    e.stopPropagation();
    toggleCompareLine(id, text, li);
  });

  return li;
}

// ============================================================
// REWRITE MENU
// ============================================================
function openRewriteMenu(lineEl, text, modeId) {
  closeRewriteMenu();
  const lang = getLang();

  const menu = document.createElement("div");
  menu.className = "rewrite-menu";
  Object.keys(REWRITE_ACTIONS).forEach((key) => {
    const b = document.createElement("button");
    b.textContent = getRewriteLabel(key, lang);
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeRewriteMenu();
      await runRewrite(text, key, lineEl, modeId);
    });
    menu.appendChild(b);
  });
  const div = document.createElement("div"); div.className = "menu-divider"; menu.appendChild(div);
  const close = document.createElement("button"); close.textContent = t("actions.cancel");
  close.style.color = "var(--ink-faint)";
  close.addEventListener("click", (e) => { e.stopPropagation(); closeRewriteMenu(); });
  menu.appendChild(close);

  lineEl.style.position = "relative";
  lineEl.appendChild(menu);
  const rect = lineEl.getBoundingClientRect();
  if (rect.right + 200 < window.innerWidth) {
    menu.style.left = "auto";
    menu.style.right = "0";
    menu.style.top   = "100%";
  } else {
    menu.style.left = "0";
    menu.style.top  = "100%";
  }
  state.rewriteOpen = menu;
}

function closeRewriteMenu() {
  if (state.rewriteOpen) {
    state.rewriteOpen.remove();
    state.rewriteOpen = null;
  }
}

async function runRewrite(text, action, lineEl, modeId) {
  const lang = getLang();
  toast(t("toasts.rewriting", { action: getRewriteLabel(action, lang) }));
  try {
    const out = await generate({ kind: "rewrite", line: text, action, lang });
    const rewrites = (out.rewrites || []).filter(Boolean);
    if (!rewrites.length) { toast(t("toasts.no_rewrites")); return; }

    const ul = lineEl.parentElement;
    rewrites.forEach((rw, i) => {
      const id = `${modeId}:rw:${cheapHash(rw + i + Date.now())}`;
      const newLine = renderLine(id, rw, modeId);
      newLine.querySelector(".line-text").style.color = "var(--ink-soft)";
      newLine.querySelector(".line-text").style.fontStyle = "italic";
      ul.insertBefore(newLine, lineEl.nextSibling);
    });
    toast(t("toasts.variants", { n: rewrites.length }));
  } catch (e) {
    console.error(e);
    toast(t("toasts.rewrite_failed"));
  }
}

// ============================================================
// KEEPERS
// ============================================================
function toggleKeeper(id, text, modeId, lineEl) {
  const i = state.keepers.findIndex((k) => k.id === id);
  if (i >= 0) {
    state.keepers.splice(i, 1);
    lineEl.classList.remove("kept");
  } else {
    state.keepers.push({ id, text, modeId, ts: Date.now() });
    lineEl.classList.add("kept");
    flashKept(lineEl);
  }
  saveKeepers();
  renderKeepers();
}

function flashKept(lineEl) {
  lineEl.animate(
    [ { background: "var(--accent)", color: "var(--paper)" }, { background: "var(--highlight)", color: "var(--ink)" } ],
    { duration: 380, easing: "ease-out" }
  );
}

function saveKeepers() { store.setKeepers(state.keepers); }

function renderKeepers() {
  const lang = getLang();
  keepersEl.innerHTML = "";
  if (state.keepers.length === 0) {
    keepersEl.innerHTML = `<div class="keepers-empty">${escapeHtml(t("panels.keepers.empty"))}</div>`;
    return;
  }
  state.keepers.forEach((k, idx) => {
    const div = document.createElement("div");
    div.className = "keeper-line";
    div.draggable = true;
    div.dataset.idx = idx;
    const modeName = k.modeId ? getModeName(k.modeId, lang) : (k.mode || "");
    div.innerHTML = `
      <div style="flex:1; min-width:0;">
        <div class="keeper-text">${escapeHtml(k.text)}</div>
        <div class="keeper-meta">${escapeHtml(modeName)}</div>
      </div>
      <button class="keeper-remove" title="remove">×</button>
    `;
    div.querySelector(".keeper-remove").addEventListener("click", () => {
      state.keepers.splice(idx, 1);
      saveKeepers();
      renderKeepers();
      const liveLine = cardsEl.querySelector(`.line[data-line-id="${cssEscape(k.id)}"]`);
      liveLine?.classList.remove("kept");
    });

    div.addEventListener("dragstart", (e) => {
      div.classList.add("dragging");
      e.dataTransfer.setData("text/plain", String(idx));
      e.dataTransfer.effectAllowed = "move";
    });
    div.addEventListener("dragend", () => div.classList.remove("dragging"));
    div.addEventListener("dragover", (e) => { e.preventDefault(); div.classList.add("drag-over"); });
    div.addEventListener("dragleave", () => div.classList.remove("drag-over"));
    div.addEventListener("drop", (e) => {
      e.preventDefault();
      div.classList.remove("drag-over");
      const from = +e.dataTransfer.getData("text/plain");
      const to = idx;
      if (from === to) return;
      const [moved] = state.keepers.splice(from, 1);
      state.keepers.splice(to, 0, moved);
      saveKeepers();
      renderKeepers();
    });

    keepersEl.appendChild(div);
  });
}

// ============================================================
// COMPARE
// ============================================================
function showCompareBar() { compareBar.classList.remove("hidden"); updateCompareBar(); }

function toggleCompareLine(id, text, lineEl) {
  const existing = state.compareIds.indexOf(id);
  if (existing >= 0) {
    state.compareIds.splice(existing, 1);
    lineEl.classList.remove("compare-selected");
  } else {
    if (state.compareIds.length >= 2) {
      const droppedId = state.compareIds.shift();
      cardsEl.querySelector(`.line[data-line-id="${cssEscape(droppedId)}"]`)?.classList.remove("compare-selected");
    }
    state.compareIds.push(id);
    lineEl.classList.add("compare-selected");
  }
  updateCompareBar();
}

function updateCompareBar() {
  compareStatus.textContent = t("compare.status", { n: state.compareIds.length });
  compareBtn.disabled = state.compareIds.length !== 2;
}

function clearCompare() {
  state.compareIds.forEach((id) => {
    cardsEl.querySelector(`.line[data-line-id="${cssEscape(id)}"]`)?.classList.remove("compare-selected");
  });
  state.compareIds = [];
  compareResult.classList.add("hidden");
  updateCompareBar();
}

async function runCompare() {
  if (state.compareIds.length !== 2) return;
  const [a, b] = state.compareIds.map((id) => {
    const el = cardsEl.querySelector(`.line[data-line-id="${cssEscape(id)}"] .line-text`);
    return el ? el.textContent : "";
  });
  if (!a || !b) { toast(t("toasts.cant_read_lines")); return; }

  compareBtn.disabled = true;
  compareBtn.textContent = t("compare.comparing");
  try {
    const out = await generate({ kind: "compare", a, b, lang: getLang() });
    compareResult.classList.remove("hidden");
    compareResult.innerHTML = `
      <h4>${escapeHtml(t("compare.title"))}</h4>
      <div class="compare-pair">
        <div class="compare-line" data-text="${escapeHtml(a)}">${escapeHtml(t("compare.a_label"))} · ${escapeHtml(a)}</div>
        <div class="compare-line" data-text="${escapeHtml(b)}">${escapeHtml(t("compare.b_label"))} · ${escapeHtml(b)}</div>
      </div>
      <div class="compare-verdict">${escapeHtml(out.verdict || "")}</div>
    `;
    compareResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (e) {
    console.error(e);
    toast(t("toasts.compare_failed"));
  } finally {
    compareBtn.disabled = false;
    compareBtn.textContent = t("compare.compare_btn");
  }
}

// ============================================================
// EXPORT
// ============================================================
async function copyKeepers(format) {
  if (!state.keepers.length) { toast(t("toasts.no_keepers")); return; }
  const text = format === "verse"
    ? state.keepers.map((k) => k.text).join("\n")
    : state.keepers.map((k) => k.text).join("  /  ");
  try {
    await navigator.clipboard.writeText(text);
    toast(format === "verse" ? t("toasts.verse_copied") : t("toasts.plain_copied"));
  } catch {
    toast(t("toasts.clipboard_blocked"));
  }
}

function exportMarkdown() {
  if (!state.keepers.length) { toast(t("toasts.no_keepers")); return; }
  const lang = getLang();
  const seed = seedEl.value.trim();
  const date = new Date().toISOString().slice(0, 10);

  const groups = {};
  state.keepers.forEach((k) => {
    const m = k.modeId ? getModeName(k.modeId, lang) : (k.mode || "Untitled");
    (groups[m] ||= []).push(k.text);
  });

  let md = `# ${t("export.draft_title", { date })}\n\n`;
  if (seed) md += `> ${t("export.seed_label")}: *${seed}*\n\n`;
  Object.entries(groups).forEach(([mode, lines]) => {
    md += `## ${mode}\n\n`;
    md += lines.map((l) => l).join("\n") + "\n\n";
  });
  md += `---\n\n_${t("export.footer")}_\n`;

  const blob = new Blob([md], { type: "text/markdown" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = t("export.filename", { date });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(t("toasts.draft_exported"));
}

// ============================================================
// UTILITIES
// ============================================================
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function cheapHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h).toString(36);
}

function cssEscape(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
}
