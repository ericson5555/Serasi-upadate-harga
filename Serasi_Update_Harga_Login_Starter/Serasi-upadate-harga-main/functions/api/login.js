const COOKIE_NAME = 'serasi_session';
const SESSION_SECONDS = 12 * 60 * 60;
const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function b64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function verifyPassword(password, stored) {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
  const salt = b64ToBytes(parts[2]);
  const expected = b64ToBytes(parts[3]);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, expected.length * 8);
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders } });
}
export async function onRequestPost({ request, env }) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) return json({ error: 'Format permintaan tidak valid.' }, 415);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Permintaan tidak valid.' }, 400); }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password || username.length > 80 || password.length > 1024) return json({ error: 'Username atau password tidak benar.' }, 400);

  const now = Math.floor(Date.now() / 1000);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256Hex(ip);
  await env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(now - WINDOW_SECONDS).run();
  const attempts = await env.DB.prepare('SELECT COUNT(*) AS count FROM login_attempts WHERE ip_hash=? AND attempted_at>?').bind(ipHash, now - WINDOW_SECONDS).first();
  if ((attempts?.count || 0) >= MAX_ATTEMPTS) return json({ error: 'Terlalu banyak percobaan. Coba lagi 15 menit kemudian.' }, 429);
  await env.DB.prepare('INSERT INTO login_attempts (ip_hash, attempted_at) VALUES (?, ?)').bind(ipHash, now).run();

  const user = await env.DB.prepare('SELECT id, username, password_hash, role, active FROM users WHERE username=? COLLATE NOCASE').bind(username).first();
  const valid = user && user.active === 1 && await verifyPassword(password, user.password_hash);
  if (!valid) return json({ error: 'Username atau password tidak benar.' }, 401);

  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const token = [...random].map(b => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256Hex(token);
  const expiresAt = now + SESSION_SECONDS;
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(tokenHash, user.id, expiresAt, now).run();
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash=?').bind(ipHash).run();
  const cookie = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
  return json({ ok: true, redirect: '/' }, 200, { 'Set-Cookie': cookie });
}
