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

      const images = await sql`
        SELECT id, user_id, generation_id, prompt, image_url, source, model, created_at
        FROM gallery_images
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
      return sendJson(res, 200, { images });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const { userId, generationId = null, prompt, imageUrl, source = null, model = null } = body;

      if (!userId || !prompt || !imageUrl) {
        return sendJson(res, 400, { error: "userId, prompt and imageUrl are required" });
      }

      const [image] = await sql`
        INSERT INTO gallery_images (user_id, generation_id, prompt, image_url, source, model)
        VALUES (${userId}, ${generationId}, ${prompt}, ${imageUrl}, ${source}, ${model})
        RETURNING id, user_id, generation_id, prompt, image_url, source, model, created_at
      `;
      return sendJson(res, 201, { image });
    }

    if (req.method === "DELETE") {
      const body = req.body || {};
      const { imageId, userId } = body;
      if (!imageId || !userId) return sendJson(res, 400, { error: "imageId and userId are required" });

      const [deleted] = await sql`
        DELETE FROM gallery_images
        WHERE id = ${imageId} AND user_id = ${userId}
        RETURNING id
      `;

      if (!deleted) return sendJson(res, 404, { error: "Image not found" });
      return sendJson(res, 200, { success: true });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
