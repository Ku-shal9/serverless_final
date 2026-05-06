const { neon } = require("@neondatabase/serverless");
const { applyCors, sendJson } = require("../lib/cors-json");
const { verifyPassword } = require("../lib/password");
const { setCookie } = require("../lib/cookies");
const crypto = require("crypto");

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  return neon(databaseUrl);
}

function sessionCookieOptions(req) {
  const isHttps = (req.headers["x-forwarded-proto"] || "").includes("https");
  return { httpOnly: true, sameSite: "Lax", secure: isHttps, path: "/", maxAge: 60 * 60 * 24 * 7 };
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const sql = getSql();
    const body = req.body || {};
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const role = body.role ? String(body.role) : null;

    if (!username || !password) return sendJson(res, 400, { error: "Username and password are required." });

    const [cred] = await sql`
      SELECT ac.user_id, ac.password_hash, u.username, u.email, u.role, u.plan, u.generations_used, u.rate_limit
      FROM auth_credentials ac
      JOIN users u ON u.id = ac.user_id
      WHERE ac.username = ${username}
      LIMIT 1
    `;

    if (!cred) return sendJson(res, 401, { error: "Invalid username or password." });
    if (role && cred.role !== role) {
      return sendJson(res, 403, { error: `This account is not a ${role} account.` });
    }

    const ok = verifyPassword(password, cred.password_hash);
    if (!ok) return sendJson(res, 401, { error: "Invalid username or password." });

    const token = crypto.randomBytes(32).toString("hex");
    await sql`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (${cred.user_id}, ${token}, NOW() + INTERVAL '7 days')
    `;

    setCookie(res, "pg_session", token, sessionCookieOptions(req));
    return sendJson(res, 200, {
      user: {
        id: cred.user_id,
        username: cred.username,
        email: cred.email,
        role: cred.role,
        plan: cred.plan,
        generationsUsed: cred.generations_used,
        rateLimit: cred.rate_limit,
      },
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};

