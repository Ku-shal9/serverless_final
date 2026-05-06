/**
 * auth-db.js - Bridge DB auth to existing localStorage session format.
 * This lets the rest of the app keep using `getCurrentUser()` without a full refactor.
 */

async function dbSignUp(username, email, password) {
  const res = await pgFetch("/auth-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  const data = await res.json().catch(function () {
    return {};
  });
  if (!res.ok) return { success: false, message: data.error || "Sign up failed." };
  return { success: true, user: data.user };
}

async function dbLogin(username, password, role) {
  const res = await pgFetch("/auth-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role }),
  });
  const data = await res.json().catch(function () {
    return {};
  });
  if (!res.ok) return { success: false, message: data.error || "Login failed." };
  return { success: true, user: data.user };
}

function upsertLocalUserFromDb(dbUser) {
  const users = getAllUsers();
  const existingIdx = users.findIndex(function (u) {
    return u.username && u.username.toLowerCase() === String(dbUser.username).toLowerCase();
  });

  const localUser = {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email || null,
    password: "", // do not store passwords locally
    role: dbUser.role,
    plan: dbUser.plan || "free",
    createdAt: Date.now(),
    generationsUsed: dbUser.generationsUsed || 0,
    rateLimit: dbUser.rateLimit !== undefined ? dbUser.rateLimit : DEFAULT_RATE_LIMIT,
    promptHistory: [],
    galleryImages: [],
  };

  if (existingIdx >= 0) {
    users[existingIdx] = { ...users[existingIdx], ...localUser };
  } else {
    users.push(localUser);
  }
  saveAllUsers(users);
  return localUser;
}

async function dbSyncSessionIntoLocalStorage() {
  const res = await pgFetch("/auth-me");
  const data = await res.json().catch(function () {
    return {};
  });

  if (!res.ok || !data.user) return false;

  const localUser = upsertLocalUserFromDb(data.user);
  saveSession(localUser);
  return true;
}

