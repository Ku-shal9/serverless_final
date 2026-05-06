const { neon } = require("@neondatabase/serverless");
const { applyCors, sendJson } = require("../lib/cors-json");
const { hashPassword } = require("../lib/password");
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
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const password = String(body.password || "");

    if (username.length < 3) return sendJson(res, 400, { error: "Username must be at least 3 characters." });
    if (password.length < 4) return sendJson(res, 400, { error: "Password must be at least 4 characters." });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJson(res, 400, { error: "Invalid email address." });
    }

    const passwordHash = hashPassword(password);

    const [user] = await sql`
      INSERT INTO users (username, email, password_hash, role, plan, rate_limit)
      VALUES (${username}, ${email}, ${passwordHash}, ${"user"}, ${"free"}, 6)
      RETURNING id, username, email, role, plan, generations_used, rate_limit, created_at
    `;

    await sql`
      INSERT INTO auth_credentials (user_id, username, password_hash)
      VALUES (${user.id}, ${username}, ${passwordHash})
    `;

    const token = crypto.randomBytes(32).toString("hex");
    const [session] = await sql`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, NOW() + INTERVAL '7 days')
      RETURNING token, expires_at
    `;

    setCookie(res, "pg_session", session.token, sessionCookieOptions(req));
    return sendJson(res, 201, { user });
  } catch (error) {
    // Unique violation
    if (String(error.code) === "23505") {
      return sendJson(res, 409, { error: "Username or email already exists." });
    }
    return sendJson(res, 500, { error: error.message });
  }
};

