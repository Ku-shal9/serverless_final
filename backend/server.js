const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// Configure allowed origins via env (comma-separated). Example:
// CORS_ORIGINS="https://your-frontend.vercel.app,http://localhost:3000"
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: false,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

// Routes (migrated from Vercel `api/*`)
app.use(require("./src/routes.js"));

const port = Number(process.env.PORT || 3001);
// Bind to all interfaces so the container port is reachable by ECS networking.
app.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`[photo-galli-backend] listening on :${port}`);
});

