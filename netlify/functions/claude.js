// ============================================================
// /api/claude — server-side proxy to the Anthropic Messages API.
//
// The API key is read from the ANTHROPIC_API_KEY env var, which is
// set in Netlify (Site → Configuration → Environment variables).
// The key MUST NOT appear in this file or anywhere in the repo.
//
// Frontend contract (matches js/generator.js → claudeGenerate):
//   POST /api/claude
//   { system, user, model?, max_tokens? }
//   →  { content: "<assistant text>" }
// ============================================================

const ALLOWED_ORIGINS = new Set([
  "https://lyric-sparring-partner.netlify.app",
  "http://localhost:5610",
  "http://localhost:8888",
  "http://localhost:5588",
]);

const MAX_USER_LEN   = 8000;   // chars in the user prompt
const MAX_TOKENS_CAP = 2048;   // hard upper bound on max_tokens

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Origin allowlist — stops casual cross-origin abuse of your API credits.
  const origin = req.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Forbidden" }, 403);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: "Server not configured" }, 500);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { system, user, model = "claude-opus-4-7", max_tokens = 1024 } = body || {};
  if (typeof system !== "string" || typeof user !== "string") {
    return json({ error: "Missing system or user" }, 400);
  }
  if (user.length > MAX_USER_LEN) return json({ error: "User prompt too long" }, 413);

  const tokens = Math.min(Math.max(Number(max_tokens) || 1024, 64), MAX_TOKENS_CAP);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: tokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error("anthropic api error", r.status, text.slice(0, 500));
      return json({ error: "Upstream error", status: r.status }, 502);
    }

    const data    = await r.json();
    const content = data?.content?.[0]?.text ?? "";
    return json({ content });
  } catch (e) {
    console.error("function error", e);
    return json({ error: "Network error" }, 502);
  }
};

// Bind this function to /api/claude — no netlify.toml redirect needed.
export const config = { path: "/api/claude" };

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
