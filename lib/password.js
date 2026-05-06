const crypto = require("crypto");

function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function scryptParams() {
  // Reasonable baseline for serverless; tune later if needed.
  return { N: 16384, r: 8, p: 1, keylen: 64 };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const { N, r, p, keylen } = scryptParams();
  const derived = crypto.scryptSync(String(password), salt, keylen, { N, r, p });
  return `scrypt$N=${N}$r=${r}$p=${p}$salt=${salt}$hash=${derived.toString("hex")}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;
  if (!stored.startsWith("scrypt$")) return false;

  const parts = stored.split("$").slice(1);
  const kv = {};
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k && v) kv[k] = v;
  }

  const salt = kv.salt;
  const hashHex = kv.hash;
  const N = parseInt(kv.N, 10);
  const r = parseInt(kv.r, 10);
  const p = parseInt(kv.p, 10);

  if (!salt || !hashHex || !Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  const keylen = Buffer.from(hashHex, "hex").length;
  const derived = crypto.scryptSync(String(password), salt, keylen, { N, r, p });
  return timingSafeEqual(derived.toString("hex"), hashHex);
}

module.exports = { hashPassword, verifyPassword };

