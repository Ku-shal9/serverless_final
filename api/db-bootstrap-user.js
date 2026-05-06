const { neon } = require("@neondatabase/serverless");
const { applyCors, sendJson } = require("../lib/cors-json");

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return neon(databaseUrl);
}

/**
 * Minimal helper endpoint: ensures a `users` + `auth_credentials` row exists.
 * This is NOT full auth; it just links the current local user to a DB user id
 * so generation/gallery data can be stored.
 */
module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const sql = getSql();
    const body = req.body || {};
    const { username, email = null } = body;

    if (!username) return sendJson(res, 400, { error: "username is required" });

    const [user] = await sql`
      INSERT INTO users (username, email, password_hash, role, plan, rate_limit)
      VALUES (${username}, ${email}, ${"bootstrap_only"}, ${"user"}, ${"free"}, 6)
      ON CONFLICT (username)
      DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email), updated_at = NOW()
      RETURNING id, username, email, role, plan
    `;

    await sql`
      INSERT INTO auth_credentials (user_id, username, password_hash)
      VALUES (${user.id}, ${username}, ${"bootstrap_only"})
      ON CONFLICT (username)
      DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW()
    `;

    return sendJson(res, 200, { user });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};

