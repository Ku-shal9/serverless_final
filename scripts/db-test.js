const dotenv = require("dotenv");
const { neon } = require("@neondatabase/serverless");

dotenv.config();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing in .env");
  }

  const sql = neon(databaseUrl);
  const testPrefix = `dbtest_${Date.now()}`;
  const username = `${testPrefix}_user`;
  const sessionToken = `${testPrefix}_session_token`;

  const [user] = await sql`
    INSERT INTO users (username, email, password_hash, role, plan, generations_used, rate_limit)
    VALUES (${username}, ${`${username}@example.com`}, ${"hash_demo"}, ${"user"}, ${"free"}, 0, 6)
    RETURNING id, username, role, plan
  `;
  assert(user && user.id, "Failed to create user");

  const [session] = await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${user.id}, ${sessionToken}, NOW() + INTERVAL '1 day')
    RETURNING id, token
  `;
  assert(session && session.id, "Failed to create session");

  const [authCredential] = await sql`
    INSERT INTO auth_credentials (user_id, username, password_hash)
    VALUES (${user.id}, ${username}, ${"hash_demo"})
    RETURNING id
  `;
  assert(authCredential && authCredential.id, "Failed to create auth credential");

  const [generation] = await sql`
    INSERT INTO generation_logs (user_id, prompt, image_url, source, model, seed, status)
    VALUES (
      ${user.id},
      ${"A retro cyberpunk city at dusk"},
      ${"https://example.com/image.png"},
      ${"huggingface"},
      ${"black-forest-labs/FLUX.1-schnell"},
      42,
      ${"success"}
    )
    RETURNING id, prompt
  `;
  assert(generation && generation.id, "Failed to create generation log");

  const [prompt] = await sql`
    INSERT INTO prompt_history (user_id, prompt)
    VALUES (${user.id}, ${"A retro cyberpunk city at dusk"})
    RETURNING id
  `;
  assert(prompt && prompt.id, "Failed to create prompt history");

  const [gallery] = await sql`
    INSERT INTO gallery_images (user_id, generation_id, prompt, image_url, source, model)
    VALUES (
      ${user.id},
      ${generation.id},
      ${"A retro cyberpunk city at dusk"},
      ${"https://example.com/image.png"},
      ${"huggingface"},
      ${"black-forest-labs/FLUX.1-schnell"}
    )
    RETURNING id
  `;
  assert(gallery && gallery.id, "Failed to create gallery image");

  const [otp] = await sql`
    INSERT INTO otp_codes (user_id, otp_code, purpose, expires_at)
    VALUES (${user.id}, ${"123456"}, ${"password_reset"}, NOW() + INTERVAL '10 minutes')
    RETURNING id
  `;
  assert(otp && otp.id, "Failed to create OTP record");

  const [counts] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE id = ${user.id}) AS users_count,
      (SELECT COUNT(*)::int FROM sessions WHERE user_id = ${user.id}) AS sessions_count,
      (SELECT COUNT(*)::int FROM auth_credentials WHERE user_id = ${user.id}) AS auth_count,
      (SELECT COUNT(*)::int FROM generation_logs WHERE user_id = ${user.id}) AS generations_count,
      (SELECT COUNT(*)::int FROM prompt_history WHERE user_id = ${user.id}) AS prompts_count,
      (SELECT COUNT(*)::int FROM gallery_images WHERE user_id = ${user.id}) AS gallery_count,
      (SELECT COUNT(*)::int FROM otp_codes WHERE user_id = ${user.id}) AS otp_count
  `;

  assert(counts.users_count === 1, "Users table verification failed");
  assert(counts.sessions_count === 1, "Sessions table verification failed");
  assert(counts.auth_count === 1, "Auth credentials verification failed");
  assert(counts.generations_count === 1, "Generation logs verification failed");
  assert(counts.prompts_count === 1, "Prompt history verification failed");
  assert(counts.gallery_count === 1, "Gallery images verification failed");
  assert(counts.otp_count === 1, "OTP table verification failed");

  await sql`DELETE FROM users WHERE id = ${user.id}`;
  console.log("Database test passed: all tables inserted and verified successfully.");
}

run().catch((error) => {
  console.error("Database test failed:", error);
  process.exit(1);
});
