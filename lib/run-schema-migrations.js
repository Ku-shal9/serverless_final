const fs = require("fs");
const path = require("path");

/**
 * Neon HTTP SQL cannot run multiple statements in one query. Split schema into
 * single statements and execute in order.
 */
function splitStatements(sqlText) {
  return sqlText
    .replace(/\r\n/g, "\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function runSchemaMigrations(sql) {
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  for (const statement of splitStatements(schemaSql)) {
    await sql(statement);
  }
}

module.exports = { splitStatements, runSchemaMigrations };
