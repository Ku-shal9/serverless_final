/**
 * db-client.js - minimal Neon persistence client for browser.
 * Stores the current user's DB id in localStorage and writes generations/prompts/gallery.
 */

const DB_KEYS = {
  USER_ID: "pg_db_user_id",
};

async function ensureDbUserId() {
  try {
    const cached = localStorage.getItem(DB_KEYS.USER_ID);
    if (cached) return cached;
  } catch (_) {}

  const user = typeof getCurrentUser === "function" ? getCurrentUser() : null;
  if (!user || !user.username) return null;

  const res = await fetch("/api/db-bootstrap-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user.username, email: user.email || null }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const id = data && data.user && data.user.id ? data.user.id : null;
  if (!id) return null;

  try {
    localStorage.setItem(DB_KEYS.USER_ID, id);
  } catch (_) {}

  return id;
}

async function dbLogGeneration(payload) {
  const userId = await ensureDbUserId();
  if (!userId) return;

  await fetch("/api/db-generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload }),
  });
}

async function dbAddPrompt(prompt) {
  const userId = await ensureDbUserId();
  if (!userId) return;

  await fetch("/api/db-prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, prompt }),
  });
}

async function dbSaveGallery(imageData) {
  const userId = await ensureDbUserId();
  if (!userId) return;

  await fetch("/api/db-gallery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      prompt: imageData.prompt,
      imageUrl: imageData.url,
      source: imageData.source || null,
      model: imageData.model || null,
    }),
  });
}

