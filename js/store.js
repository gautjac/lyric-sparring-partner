// Tiny localStorage wrapper. All keys live under one namespace
// so future cleanup is easy.

const NS = "lyric-sparring-v1";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(`${NS}:${key}`);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try { localStorage.setItem(`${NS}:${key}`, JSON.stringify(value)); }
  catch (e) { console.warn("localStorage write failed", e); }
}

export const store = {
  // Keepers — array of { id, text, mode, ts }
  getKeepers()        { return read("keepers", []); },
  setKeepers(list)    { write("keepers", list); },

  // UI state we want to persist between sessions
  getTheme()          { return read("theme", null); },
  setTheme(t)         { write("theme", t); },

  getControls()       { return read("controls", null); },
  setControls(c)      { write("controls", c); },

  getSeed()           { return read("seed", ""); },
  setSeed(s)          { write("seed", s); },
};
