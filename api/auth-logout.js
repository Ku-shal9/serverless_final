const { neon } = require("@neondatabase/serverless");
const { applyCors, sendJson } = require("../lib/cors-json");
const { parseCookies, setCookie } = require("../lib/cookies");

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  return neon(databaseUrl);
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const sql = getSql();
    const cookies = parseCookies(req);
    const token = cookies.pg_session;
    if (token) {
      await sql`DELETE FROM sessions WHERE token = ${token}`;
    }

    const isHttps = (req.headers["x-forwarded-proto"] || "").includes("https");
    setCookie(res, "pg_session", "", {
      httpOnly: true,
      sameSite: "Lax",
      secure: isHttps,
      path: "/",
      maxAge: 0,
    });
    return sendJson(res, 200, { success: true });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};

