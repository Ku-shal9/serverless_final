function parseCookies(req) {
  const header = req.headers && (req.headers.cookie || req.headers.Cookie);
  const cookies = {};
  if (!header) return cookies;
  const items = header.split(";").map((s) => s.trim());
  for (const item of items) {
    const idx = item.indexOf("=");
    if (idx === -1) continue;
    const key = item.slice(0, idx).trim();
    const value = item.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function setCookie(res, name, value, opts = {}) {
  const parts = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);
  parts.push(`Path=${opts.path || "/"}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push("Secure");
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

module.exports = { parseCookies, setCookie };

