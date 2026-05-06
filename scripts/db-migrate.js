const dotenv = require("dotenv");
const { neon } = require("@neondatabase/serverless");
const { runSchemaMigrations } = require("../lib/run-schema-migrations");

dotenv.config();

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing in .env");
  }

  const sql = neon(databaseUrl);
  await runSchemaMigrations(sql);
  console.log("Database migration completed successfully.");
}

run().catch((error) => {
  console.error("Database migration failed:", error);
  process.exit(1);
});
