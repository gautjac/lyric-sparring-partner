// ============================================================
// Lyric Sparring Partner — main app
// Wires the UI to the generator and the local store.
// Most behavior is intentionally inline so it's easy to read.
// ============================================================

import { ACTIVE_MODES, MODES } from "./prompts.js";
import { REWRITE_ACTIONS } from "./rewrite.js";
import { generate } from "./generator.js";
import { store } from "./store.js";
import { EXAMPLE_SEEDS } from "./examples.js";

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const seedEl       = $("seed");
const cardsEl      = $("cards");
const keepersEl    = $("keepers");
const generateBtn  = $("generateBtn");
const exampleBtn   = $("exampleBtn");
const themeToggle  = $("themeToggle");
const compareBar   = $("compareBar");
const compareCount = $("compareCount");
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
  // Click anywhere to close rewrite menu
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
    if (confirm("Clear all keepers?")) {
      state.keepers = [];
      saveKeepers();
      renderKeepers();
    }
  });

  renderKeepers();
}

// ============================================================
// CONTROL DESCRIPTIONS  (the little italic words next to sliders)
// ============================================================
function describeSlider(key, v) {
  const buckets = {
    tone:        ["whispered", "subtle", "balanced", "bold", "thunderous"],
    abstraction: ["literal", "concrete", "balanced", "imagistic", "dreamlike"],
    complexity:  ["plainspoken", "easy", "balanced", "literary", "ornate"],
  };
  const arr = buckets[key];
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
  const pool = EXAMPLE_SEEDS.filter((s) => s !== current);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================
// GENERATE — all modes, in parallel
// ============================================================
async function runAllModes() {
  const seed = seedEl.value.trim();
  if (!seed) { toast("Drop a line first."); seedEl.focus(); return; }

  generateBtn.disabled = true;
  generateBtn.textContent = "Sparring…";
  compareResult.classList.add("hidden");
  state.compareIds = [];
  updateCompareBar();

  // Render skeletons immediately so the room fills.
  state.cards = {};
  cardsEl.innerHTML = "";
  ACTIVE_MODES.forEach((modeId) => {
    state.cards[modeId] = { loading: true };
    cardsEl.appendChild(skeletonCard(modeId));
  });

  const controls = readControls();

  // Fire all five at once.
  const results = await Promise.all(
    ACTIVE_MODES.map(async (modeId) => {
      try {
        const result = await generate({ kind: "mode", modeId, seed, controls });
        return { modeId, result };
      } catch (err) {
        console.error(err);
        return { modeId, result: { mode: MODES[modeId].name, approach_note: "Could not generate.", lines: [] } };
      }
    })
  );

  // Replace skeletons with real cards as they arrive.
  results.forEach(({ modeId, result }) => {
    state.cards[modeId] = result;
    const old = cardsEl.querySelector(`.card[data-mode="${modeId}"]`);
    const fresh = renderCard(modeId, result);
    if (old) old.replaceWith(fresh); else cardsEl.appendChild(fresh);
  });

  generateBtn.disabled = false;
  generateBtn.textContent = "Spar with me ⏎";

  showCompareBar();
}

// Regenerate one mode in place.
async function regenMode(modeId, regenButton) {
  const seed = seedEl.value.trim();
  if (!seed) return;

  regenButton?.classList.add("spinning");
  const card = cardsEl.querySelector(`.card[data-mode="${modeId}"]`);
  if (card) card.classList.add("loading");

  try {
    const result = await generate({ kind: "mode", modeId, seed, controls: readControls() });
    state.cards[modeId] = result;
    const fresh = renderCard(modeId, result);
    card?.replaceWith(fresh);
  } catch (e) {
    console.error(e);
    toast("Couldn't regenerate that one.");
    card?.classList.remove("loading");
  } finally {
    regenButton?.classList.remove("spinning");
  }
}

// ============================================================
// CARD RENDERING
// ============================================================
function skeletonCard(modeId) {
  const mode = MODES[modeId];
  const el = document.createElement("article");
  el.className = "card loading";
  el.dataset.mode = modeId;
  el.innerHTML = `
    <header class="card-head">
      <span class="mode-name">${escapeHtml(mode.name)}</span>
      <button class="mode-regen" title="regenerate">↻</button>
    </header>
    <p class="approach-note">${escapeHtml(mode.note)}</p>
    <ul class="lines">
      ${[1,2,3,4].map(() => `<li class="line"><span class="line-text" style="opacity:0.35;font-style:italic;">listening…</span></li>`).join("")}
    </ul>`;
  return el;
}

function renderCard(modeId, result) {
  const mode = MODES[modeId];
  const el = document.createElement("article");
  el.className = "card";
  el.dataset.mode = modeId;

  el.innerHTML = `
    <header class="card-head">
      <span class="mode-name">${escapeHtml(result.mode || mode.name)}</span>
      <button class="mode-regen" title="regenerate this mode">↻</button>
    </header>
    <p class="approach-note">${escapeHtml(result.approach_note || mode.note)}</p>
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
      <button class="line-action" data-act="rewrite" title="rewrite">↻ rewrite</button>
      <button class="line-action" data-act="compare" title="flag for compare">⇌ compare</button>
    </span>
  `;

  // Click line text → toggle keeper
  li.querySelector(".line-text").addEventListener("click", () => toggleKeeper(id, text, modeId, li));

  // Rewrite menu
  li.querySelector('[data-act="rewrite"]').addEventListener("click", (e) => {
    e.stopPropagation();
    openRewriteMenu(li, text, modeId);
  });

  // Compare flag
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

  const menu = document.createElement("div");
  menu.className = "rewrite-menu";
  Object.entries(REWRITE_ACTIONS).forEach(([key, def]) => {
    const b = document.createElement("button");
    b.textContent = def.label;
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeRewriteMenu();
      await runRewrite(text, key, lineEl, modeId);
    });
    menu.appendChild(b);
  });
  // Divider + dismiss
  const div = document.createElement("div"); div.className = "menu-divider"; menu.appendChild(div);
  const close = document.createElement("button"); close.textContent = "cancel";
  close.style.color = "var(--ink-faint)";
  close.addEventListener("click", (e) => { e.stopPropagation(); closeRewriteMenu(); });
  menu.appendChild(close);

  // Position relative to the line
  lineEl.style.position = "relative";
  lineEl.appendChild(menu);
  // Place to the right of the line text if there's room, else below
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
  toast(`Rewriting — ${REWRITE_ACTIONS[action].label}…`);
  try {
    const out = await generate({ kind: "rewrite", line: text, action });
    const rewrites = (out.rewrites || []).filter(Boolean);
    if (!rewrites.length) { toast("No rewrites came back."); return; }

    // Append rewrites under the original line, marked as variants.
    const ul = lineEl.parentElement;
    rewrites.forEach((rw, i) => {
      const id = `${modeId}:rw:${cheapHash(rw + i + Date.now())}`;
      const newLine = renderLine(id, rw, modeId);
      newLine.querySelector(".line-text").style.color = "var(--ink-soft)";
      newLine.querySelector(".line-text").style.fontStyle = "italic";
      ul.insertBefore(newLine, lineEl.nextSibling);
    });
    toast(`+${rewrites.length} variants — click to keep`);
  } catch (e) {
    console.error(e);
    toast("Rewrite failed.");
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
    state.keepers.push({ id, text, mode: MODES[modeId]?.name || modeId, ts: Date.now() });
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
  keepersEl.innerHTML = "";
  state.keepers.forEach((k, idx) => {
    const div = document.createElement("div");
    div.className = "keeper-line";
    div.draggable = true;
    div.dataset.idx = idx;
    div.innerHTML = `
      <div style="flex:1; min-width:0;">
        <div class="keeper-text">${escapeHtml(k.text)}</div>
        <div class="keeper-meta">${escapeHtml(k.mode || "")}</div>
      </div>
      <button class="keeper-remove" title="remove">×</button>
    `;
    div.querySelector(".keeper-remove").addEventListener("click", () => {
      state.keepers.splice(idx, 1);
      saveKeepers();
      renderKeepers();
      // Also un-highlight in the cards if visible
      const liveLine = cardsEl.querySelector(`.line[data-line-id="${cssEscape(k.id)}"]`);
      liveLine?.classList.remove("kept");
    });

    // Drag-and-drop reorder
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
      // Bump the oldest selection out
      const droppedId = state.compareIds.shift();
      cardsEl.querySelector(`.line[data-line-id="${cssEscape(droppedId)}"]`)?.classList.remove("compare-selected");
    }
    state.compareIds.push(id);
    lineEl.classList.add("compare-selected");
  }
  updateCompareBar();
}

function updateCompareBar() {
  compareCount.textContent = state.compareIds.length;
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
  if (!a || !b) { toast("Couldn't read those lines."); return; }

  compareBtn.disabled = true;
  compareBtn.textContent = "Comparing…";
  try {
    const out = await generate({ kind: "compare", a, b });
    compareResult.classList.remove("hidden");
    compareResult.innerHTML = `
      <h4>Compare</h4>
      <div class="compare-pair">
        <div class="compare-line">A · ${escapeHtml(a)}</div>
        <div class="compare-line">B · ${escapeHtml(b)}</div>
      </div>
      <div class="compare-verdict">${escapeHtml(out.verdict || "")}</div>
    `;
    compareResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (e) {
    console.error(e);
    toast("Compare failed.");
  } finally {
    compareBtn.disabled = false;
    compareBtn.textContent = "Compare these two";
  }
}

// ============================================================
// EXPORT
// ============================================================
async function copyKeepers(format) {
  if (!state.keepers.length) { toast("No keepers yet."); return; }
  const text = format === "verse"
    ? state.keepers.map((k) => k.text).join("\n")
    : state.keepers.map((k) => k.text).join("  /  ");
  try {
    await navigator.clipboard.writeText(text);
    toast(format === "verse" ? "Verse block copied." : "Plain text copied.");
  } catch {
    toast("Clipboard blocked. Select & copy manually.");
  }
}

function exportMarkdown() {
  if (!state.keepers.length) { toast("No keepers yet."); return; }
  const seed = seedEl.value.trim();
  const date = new Date().toISOString().slice(0, 10);

  // Group by mode for the rough draft.
  const groups = {};
  state.keepers.forEach((k) => {
    const m = k.mode || "Untitled";
    (groups[m] ||= []).push(k.text);
  });

  let md = `# Lyric draft — ${date}\n\n`;
  if (seed) md += `> Seed: *${seed}*\n\n`;
  Object.entries(groups).forEach(([mode, lines]) => {
    md += `## ${mode}\n\n`;
    md += lines.map((l) => l).join("\n") + "\n\n";
  });
  md += `---\n\n_Generated with Lyric Sparring Partner._\n`;

  const blob = new Blob([md], { type: "text/markdown" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `lyric-draft-${date}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Draft exported.");
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

// Tiny string hash (stable enough for line ids in a session)
function cheapHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h).toString(36);
}

// CSS.escape polyfill-lite for selector queries on line ids
function cssEscape(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
}
