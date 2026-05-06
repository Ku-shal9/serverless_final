/**
 * api-client.js - centralizes backend base URL for ECS-hosted API.
 *
 * Set `window.PG_API_BASE` in HTML (recommended), e.g.:
 * <script>window.PG_API_BASE = "https://api.yourdomain.com";</script>
 */

function pgApiUrl(path) {
  const base = (typeof window !== "undefined" && window.PG_API_BASE) ? String(window.PG_API_BASE) : "";
  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = String(path || "").startsWith("/") ? String(path) : `/${path}`;
  return cleanBase ? `${cleanBase}${cleanPath}` : cleanPath;
}

async function pgFetch(path, options) {
  return fetch(pgApiUrl(path), options);
}

