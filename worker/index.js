const SESSION_COOKIE = "nihongo_session";
const SESSION_DAYS = 30;
const MAX_LOGIN_FAILURES = 5;
const LOCK_MINUTES = 15;
const PASSWORD_ITERATIONS = 120000;
const SETTING_KEYS = new Set([
  "toeic.current-rank",
  "toeic.selected-dataset",
  "toeic-auto-play-settings",
  "toeic-keep-screen-awake",
  "toeic-delay-vietnamese-meaning",
]);
const PROGRESS_STATUSES = new Set(["new", "learning", "known", "review"]);

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  new Uint8Array(bytes).forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function derivePassword(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(salt), iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return bytesToBase64(bits);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.get("Cookie") || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, ...value]) => [key, decodeURIComponent(value.join("="))]),
  );
}

function allowedOrigin(request, env) {
  return env.ALLOWED_ORIGIN || new URL(request.url).origin;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigin(request, env);
  return origin === allowed
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, X-Turnstile-Token",
        "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
        Vary: "Origin",
      }
    : {};
}

function json(request, env, payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request, env),
      ...extraHeaders,
    },
  });
}

function errorResponse(request, env, message, status = 400, code = "request_error") {
  return json(request, env, { error: { code, message } }, status);
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 20000) throw new Error("Payload quá lớn.");
  return request.json();
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

function verifyOrigin(request, env) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("Origin");
  return !origin || origin === allowedOrigin(request, env);
}

async function verifyTurnstile(request, env, token) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET);
  form.set("response", token);
  form.set("remoteip", clientIp(request));
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const result = await response.json();
  return result.success === true;
}

async function currentUser(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256(token);
  return env.DB.prepare(
    `SELECT users.id, users.username, users.display_name
     FROM user_sessions
     JOIN users ON users.id = user_sessions.user_id
     WHERE user_sessions.token_hash = ?1
       AND user_sessions.expires_at > CURRENT_TIMESTAMP
       AND users.is_active = 1`,
  ).bind(tokenHash).first();
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}`;
}

function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

async function handleLogin(request, env) {
  const body = await readJson(request);
  const username = String(body.username || "").trim().slice(0, 64);
  const password = String(body.password || "");
  if (!username || password.length < 8 || password.length > 256) {
    return errorResponse(request, env, "Tên đăng nhập hoặc mật khẩu không hợp lệ.", 400, "invalid_credentials");
  }

  const attemptKey = await sha256(`${username.toLowerCase()}:${clientIp(request)}`);
  const attempt = await env.DB.prepare(
    "SELECT failed_count, locked_until FROM login_attempts WHERE attempt_key = ?1",
  ).bind(attemptKey).first();
  if (attempt?.locked_until && new Date(attempt.locked_until).getTime() > Date.now()) {
    return errorResponse(request, env, "Đăng nhập tạm khóa. Vui lòng thử lại sau 15 phút.", 429, "login_locked");
  }

  const turnstileToken = request.headers.get("X-Turnstile-Token") || body.turnstileToken;
  if (!await verifyTurnstile(request, env, turnstileToken)) {
    return errorResponse(request, env, "Không thể xác minh yêu cầu đăng nhập.", 403, "turnstile_failed");
  }

  const user = await env.DB.prepare(
    "SELECT id, username, display_name, password_hash, password_salt FROM users WHERE username = ?1 COLLATE NOCASE AND is_active = 1",
  ).bind(username).first();
  const fallbackSalt = "AAAAAAAAAAAAAAAAAAAAAA==";
  const fallbackHash = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  const passwordHash = await derivePassword(password, user?.password_salt || fallbackSalt);
  const valid = Boolean(
    user && constantTimeEqual(passwordHash, user.password_hash || fallbackHash),
  );

  if (!valid) {
    const failedCount = Number(attempt?.failed_count || 0) + 1;
    const lockedUntil = failedCount >= MAX_LOGIN_FAILURES
      ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString()
      : null;
    await env.DB.prepare(
      `INSERT INTO login_attempts (attempt_key, failed_count, locked_until, updated_at)
       VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
       ON CONFLICT(attempt_key) DO UPDATE SET
         failed_count = excluded.failed_count,
         locked_until = excluded.locked_until,
         updated_at = CURRENT_TIMESTAMP`,
    ).bind(attemptKey, failedCount, lockedUntil).run();
    return errorResponse(request, env, "Tên đăng nhập hoặc mật khẩu không đúng.", 401, "invalid_credentials");
  }

  await env.DB.prepare("DELETE FROM login_attempts WHERE attempt_key = ?1").bind(attemptKey).run();
  await env.DB.prepare("DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP").run();
  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare(
    "INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)",
  ).bind(tokenHash, user.id, expiresAt).run();

  return json(
    request,
    env,
    { user: { id: user.id, username: user.username, displayName: user.display_name || user.username } },
    200,
    { "Set-Cookie": sessionCookie(token) },
  );
}

async function handleLogout(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (token) {
    await env.DB.prepare("DELETE FROM user_sessions WHERE token_hash = ?1").bind(await sha256(token)).run();
  }
  return json(request, env, { success: true }, 200, { "Set-Cookie": expiredSessionCookie() });
}

async function requireUser(request, env) {
  const user = await currentUser(request, env);
  return user || errorResponse(request, env, "Vui lòng đăng nhập.", 401, "authentication_required");
}

async function getSettings(request, env, user) {
  const result = await env.DB.prepare(
    "SELECT setting_key, setting_value, updated_at FROM user_settings WHERE user_id = ?1",
  ).bind(user.id).all();
  const settings = {};
  let updatedAt = null;
  for (const row of result.results || []) {
    try { settings[row.setting_key] = JSON.parse(row.setting_value); } catch { /* Ignore corrupt rows. */ }
    if (!updatedAt || row.updated_at > updatedAt) updatedAt = row.updated_at;
  }
  return json(request, env, { settings, updatedAt });
}

async function putSettings(request, env, user) {
  const body = await readJson(request);
  if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) {
    return errorResponse(request, env, "Thiết lập không hợp lệ.");
  }
  const entries = Object.entries(body.settings);
  if (!entries.length || entries.length > SETTING_KEYS.size) {
    return errorResponse(request, env, "Số lượng thiết lập không hợp lệ.");
  }
  const statements = [];
  for (const [key, value] of entries) {
    if (!SETTING_KEYS.has(key)) return errorResponse(request, env, `Không hỗ trợ thiết lập: ${key}`);
    const serialized = JSON.stringify(value);
    if (serialized.length > 4096) return errorResponse(request, env, `Thiết lập ${key} quá lớn.`);
    statements.push(
      env.DB.prepare(
        `INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at)
         VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_at = CURRENT_TIMESTAMP`,
      ).bind(user.id, key, serialized),
    );
  }
  await env.DB.batch(statements);
  return json(request, env, { success: true });
}

async function getProgress(request, env, user, datasetId) {
  const result = await env.DB.prepare(
    `SELECT word_rank, status, correct_count, wrong_count, next_review_at, updated_at
     FROM vocabulary_progress WHERE user_id = ?1 AND dataset_id = ?2 ORDER BY word_rank`,
  ).bind(user.id, datasetId).all();
  return json(request, env, { datasetId, progress: result.results || [] });
}

async function putProgress(request, env, user, datasetId, rank) {
  const body = await readJson(request);
  const status = String(body.status || "");
  if (!PROGRESS_STATUSES.has(status) || !Number.isInteger(rank) || rank < 1 || rank > 100000) {
    return errorResponse(request, env, "Tiến độ không hợp lệ.");
  }
  const correctCount = Math.max(0, Math.min(100000, Number(body.correctCount) || 0));
  const wrongCount = Math.max(0, Math.min(100000, Number(body.wrongCount) || 0));
  await env.DB.prepare(
    `INSERT INTO vocabulary_progress
       (user_id, dataset_id, word_rank, status, correct_count, wrong_count, next_review_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, dataset_id, word_rank) DO UPDATE SET
       status = excluded.status,
       correct_count = excluded.correct_count,
       wrong_count = excluded.wrong_count,
       next_review_at = excluded.next_review_at,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(user.id, datasetId, rank, status, correctCount, wrongCount, body.nextReviewAt || null).run();
  return json(request, env, { success: true });
}

async function handleApi(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  if (!verifyOrigin(request, env)) return errorResponse(request, env, "Origin không được phép.", 403, "origin_denied");
  if (!env.DB) return errorResponse(request, env, "D1 chưa được cấu hình.", 503, "database_not_configured");

  const url = new URL(request.url);
  if (url.pathname === "/api/health" && request.method === "GET") return json(request, env, { ok: true, database: true });
  if (url.pathname === "/api/login" && request.method === "POST") return handleLogin(request, env);
  if (url.pathname === "/api/logout" && request.method === "POST") return handleLogout(request, env);

  const userOrResponse = await requireUser(request, env);
  if (userOrResponse instanceof Response) return userOrResponse;
  const user = userOrResponse;
  if (url.pathname === "/api/session" && request.method === "GET") {
    return json(request, env, { user: { id: user.id, username: user.username, displayName: user.display_name || user.username } });
  }
  if (url.pathname === "/api/settings" && request.method === "GET") return getSettings(request, env, user);
  if (url.pathname === "/api/settings" && ["PUT", "POST"].includes(request.method)) return putSettings(request, env, user);

  const progressMatch = url.pathname.match(/^\/api\/progress\/([a-zA-Z0-9._-]{1,100})(?:\/(\d+))?$/);
  if (progressMatch && request.method === "GET" && !progressMatch[2]) {
    return getProgress(request, env, user, progressMatch[1]);
  }
  if (progressMatch && request.method === "PUT" && progressMatch[2]) {
    return putProgress(request, env, user, progressMatch[1], Number(progressMatch[2]));
  }
  return errorResponse(request, env, "Không tìm thấy API.", 404, "not_found");
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Worker error:", error);
      return errorResponse(request, env, "Máy chủ gặp lỗi.", 500, "internal_error");
    }
  },
};
