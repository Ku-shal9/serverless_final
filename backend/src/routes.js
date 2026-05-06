const express = require("express");
const crypto = require("crypto");

const { getSql } = require("./db");
const { runSchemaMigrations } = require("./migrations");
const { hashPassword, verifyPassword } = require("./password");

const router = express.Router();

function asyncHandler(fn) {
  return (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(500).json({ error: e.message }));
}

// --- DB migrate (keep protected in production) ---
router.post(
  "/db-migrate",
  asyncHandler(async (req, res) => {
    const sql = getSql();
    await runSchemaMigrations(sql);
    res.json({ success: true, message: "Schema migrated successfully" });
  }),
);

// --- HF image generation proxy ---
const HF_MODELS = [
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-xl-base-1.0",
  "runwayml/stable-diffusion-v1-5",
];

async function queryModel(model, prompt, seed, token) {
  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: prompt, parameters: { seed } }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HF ${model} failed (${response.status}): ${text}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

router.post(
  "/generate-image",
  asyncHandler(async (req, res) => {
    const token = process.env.HF_TOKEN;
    if (!token) return res.status(500).json({ error: "HF_TOKEN is not configured on server." });

    const { prompt, seed = Math.floor(Math.random() * 1000000) } = req.body || {};
    if (!prompt || String(prompt).trim().length < 3) {
      return res.status(400).json({ error: "Prompt must be at least 3 characters." });
    }

    const errors = [];
    for (const model of HF_MODELS) {
      try {
        const imageBase64 = await queryModel(model, String(prompt).trim(), seed, token);
        return res.json({ imageBase64, model });
      } catch (e) {
        errors.push(e.message);
      }
    }
    return res.status(502).json({ error: "All Hugging Face models failed.", details: errors });
  }),
);

// --- Auth (token-based; stored client-side) ---
router.post(
  "/auth-signup",
  asyncHandler(async (req, res) => {
    const sql = getSql();
    const username = String(req.body?.username || "").trim();
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
    const password = String(req.body?.password || "");

    if (username.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters." });
    if (password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email address." });
    }

    const passwordHash = hashPassword(password);

    try {
      const [user] = await sql`
        INSERT INTO users (username, email, password_hash, role, plan, rate_limit)
        VALUES (${username}, ${email}, ${passwordHash}, ${"user"}, ${"free"}, 6)
        RETURNING id, username, email, role, plan, generations_used, rate_limit
      `;

      await sql`
        INSERT INTO auth_credentials (user_id, username, password_hash)
        VALUES (${user.id}, ${username}, ${passwordHash})
      `;

      const token = crypto.randomBytes(32).toString("hex");
      await sql`
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (${user.id}, ${token}, NOW() + INTERVAL '7 days')
      `;

      return res.status(201).json({ token, user });
    } catch (e) {
      if (String(e.code) === "23505") return res.status(409).json({ error: "Username or email already exists." });
      throw e;
    }
  }),
);

router.post(
  "/auth-login",
  asyncHandler(async (req, res) => {
    const sql = getSql();
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const role = req.body?.role ? String(req.body.role) : null;

    if (!username || !password) return res.status(400).json({ error: "Username and password are required." });

    const [cred] = await sql`
      SELECT ac.user_id, ac.password_hash, u.username, u.email, u.role, u.plan, u.generations_used, u.rate_limit
      FROM auth_credentials ac
      JOIN users u ON u.id = ac.user_id
      WHERE ac.username = ${username}
      LIMIT 1
    `;
    if (!cred) return res.status(401).json({ error: "Invalid username or password." });
    if (role && cred.role !== role) return res.status(403).json({ error: `This account is not a ${role} account.` });

    const ok = verifyPassword(password, cred.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid username or password." });

    const token = crypto.randomBytes(32).toString("hex");
    await sql`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (${cred.user_id}, ${token}, NOW() + INTERVAL '7 days')
    `;

    return res.json({
      token,
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
  }),
);

router.get(
  "/auth-me",
  asyncHandler(async (req, res) => {
    const sql = getSql();
    const auth = String(req.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
    if (!token) return res.json({ user: null });

    const [row] = await sql`
      SELECT u.id, u.username, u.email, u.role, u.plan, u.generations_used, u.rate_limit
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ${token} AND s.expires_at > NOW()
      LIMIT 1
    `;
    if (!row) return res.json({ user: null });
    return res.json({
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
  }),
);

router.post(
  "/auth-logout",
  asyncHandler(async (req, res) => {
    const sql = getSql();
    const auth = String(req.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
    if (token) await sql`DELETE FROM sessions WHERE token = ${token}`;
    return res.json({ success: true });
  }),
);

// --- Persistence endpoints used by frontend ---
router.post(
  "/db-bootstrap-user",
  asyncHandler(async (req, res) => {
    const sql = getSql();
    const username = String(req.body?.username || "").trim();
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
    if (!username) return res.status(400).json({ error: "username is required" });

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

    return res.json({ user });
  }),
);

router.post(
  "/db-generations",
  asyncHandler(async (req, res) => {
    const sql = getSql();
    const { userId, prompt, imageUrl, source = "unknown", model = "unknown", seed = null, status = "success", errorMessage = null } =
      req.body || {};
    if (!userId || !prompt || !imageUrl) return res.status(400).json({ error: "userId, prompt and imageUrl are required" });

    const [generation] = await sql`
      INSERT INTO generation_logs (user_id, prompt, image_url, source, model, seed, status, error_message)
      VALUES (${userId}, ${prompt}, ${imageUrl}, ${source}, ${model}, ${seed}, ${status}, ${errorMessage})
      RETURNING id, created_at
    `;

    await sql`UPDATE users SET generations_used = generations_used + 1, updated_at = NOW() WHERE id = ${userId}`;
    return res.status(201).json({ generation });
  }),
);

router.post(
  "/db-prompts",
  asyncHandler(async (req, res) => {
    const sql = getSql();
    const { userId, prompt } = req.body || {};
    if (!userId || !prompt) return res.status(400).json({ error: "userId and prompt are required" });
    const [item] = await sql`
      INSERT INTO prompt_history (user_id, prompt)
      VALUES (${userId}, ${prompt})
      RETURNING id, created_at
    `;
    return res.status(201).json({ prompt: item });
  }),
);

router.post(
  "/db-gallery",
  asyncHandler(async (req, res) => {
    const sql = getSql();
    const { userId, generationId = null, prompt, imageUrl, source = null, model = null } = req.body || {};
    if (!userId || !prompt || !imageUrl) return res.status(400).json({ error: "userId, prompt and imageUrl are required" });
    const [image] = await sql`
      INSERT INTO gallery_images (user_id, generation_id, prompt, image_url, source, model)
      VALUES (${userId}, ${generationId}, ${prompt}, ${imageUrl}, ${source}, ${model})
      RETURNING id, created_at
    `;
    return res.status(201).json({ image });
  }),
);

module.exports = router;

