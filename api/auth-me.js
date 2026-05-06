const { neon } = require("@neondatabase/serverless");
const { applyCors, sendJson } = require("../lib/cors-json");
const { parseCookies } = require("../lib/cookies");

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  return neon(databaseUrl);
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const sql = getSql();
    const cookies = parseCookies(req);
    const token = cookies.pg_session;
    if (!token) return sendJson(res, 200, { user: null });

    const [row] = await sql`
      SELECT u.id, u.username, u.email, u.role, u.plan, u.generations_used, u.rate_limit
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ${token} AND s.expires_at > NOW()
      LIMIT 1
    `;

    if (!row) return sendJson(res, 200, { user: null });

    return sendJson(res, 200, {
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
        plan: row.plan,
        generationsUsed: row.generations_used,
        rateLimit: row.rate_limit,
      },
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};

