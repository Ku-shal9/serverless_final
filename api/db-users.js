const { neon } = require("@neondatabase/serverless");
const { applyCors, sendJson } = require("../lib/cors-json");

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return neon(databaseUrl);
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const sql = getSql();

    if (req.method === "GET") {
      const users = await sql`
        SELECT id, username, email, role, plan, generations_used, rate_limit, is_active, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
      `;
      return sendJson(res, 200, { users });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const { username, email, passwordHash, role = "user", plan = "free" } = body;

      if (!username || !passwordHash) {
        return sendJson(res, 400, { error: "username and passwordHash are required" });
      }

      const [user] = await sql`
        INSERT INTO users (username, email, password_hash, role, plan, rate_limit)
        VALUES (${username}, ${email || null}, ${passwordHash}, ${role}, ${plan}, ${role === "admin" ? 999 : 6})
        RETURNING id, username, email, role, plan, generations_used, rate_limit, is_active, created_at, updated_at
      `;

      await sql`
        INSERT INTO auth_credentials (user_id, username, password_hash)
        VALUES (${user.id}, ${username}, ${passwordHash})
      `;
      return sendJson(res, 201, { user });
    }

    if (req.method === "PUT") {
      const body = req.body || {};
      const { userId, role, plan, rateLimit, generationsUsed, isActive } = body;
      if (!userId) return sendJson(res, 400, { error: "userId is required" });

      const [user] = await sql`
        UPDATE users
        SET
          role = COALESCE(${role}, role),
          plan = COALESCE(${plan}, plan),
          rate_limit = COALESCE(${rateLimit}, rate_limit),
          generations_used = COALESCE(${generationsUsed}, generations_used),
          is_active = COALESCE(${isActive}, is_active),
          updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id, username, email, role, plan, generations_used, rate_limit, is_active, created_at, updated_at
      `;

      if (!user) return sendJson(res, 404, { error: "User not found" });
      return sendJson(res, 200, { user });
    }

    if (req.method === "DELETE") {
      const body = req.body || {};
      const { userId } = body;
      if (!userId) return sendJson(res, 400, { error: "userId is required" });
      await sql`DELETE FROM users WHERE id = ${userId}`;
      return sendJson(res, 200, { success: true });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
