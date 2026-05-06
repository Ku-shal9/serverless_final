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
      const userId = req.query.userId;
      if (!userId) return sendJson(res, 400, { error: "userId is required" });

      const prompts = await sql`
        SELECT id, user_id, prompt, created_at
        FROM prompt_history
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 50
      `;
      return sendJson(res, 200, { prompts });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const { userId, prompt } = body;
      if (!userId || !prompt) return sendJson(res, 400, { error: "userId and prompt are required" });

      const [item] = await sql`
        INSERT INTO prompt_history (user_id, prompt)
        VALUES (${userId}, ${prompt})
        RETURNING id, user_id, prompt, created_at
      `;
      return sendJson(res, 201, { prompt: item });
    }

    if (req.method === "DELETE") {
      const body = req.body || {};
      const { userId } = body;
      if (!userId) return sendJson(res, 400, { error: "userId is required" });
      await sql`DELETE FROM prompt_history WHERE user_id = ${userId}`;
      return sendJson(res, 200, { success: true });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
