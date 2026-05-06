const { neon } = require("@neondatabase/serverless");
const { runSchemaMigrations } = require("../lib/run-schema-migrations");
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
  if (req.method !== "POST") {
    applyCors(res);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const sql = getSql();
    await runSchemaMigrations(sql);
    return sendJson(res, 200, { success: true, message: "Schema migrated successfully" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
