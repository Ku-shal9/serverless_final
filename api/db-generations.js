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

      const generations = await sql`
        SELECT id, user_id, prompt, image_url, source, model, seed, status, error_message, created_at
        FROM generation_logs
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
      return sendJson(res, 200, { generations });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const {
        userId,
        prompt,
        imageUrl,
        source = "unknown",
        model = "unknown",
        seed = null,
        status = "success",
        errorMessage = null,
      } = body;

      if (!userId || !prompt || !imageUrl) {
        return sendJson(res, 400, { error: "userId, prompt and imageUrl are required" });
      }

      const [generation] = await sql`
        INSERT INTO generation_logs (user_id, prompt, image_url, source, model, seed, status, error_message)
        VALUES (${userId}, ${prompt}, ${imageUrl}, ${source}, ${model}, ${seed}, ${status}, ${errorMessage})
        RETURNING id, user_id, prompt, image_url, source, model, seed, status, error_message, created_at
      `;

      await sql`
        UPDATE users
        SET generations_used = generations_used + 1, updated_at = NOW()
        WHERE id = ${userId}
      `;

      return sendJson(res, 201, { generation });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
