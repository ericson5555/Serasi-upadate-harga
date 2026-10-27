
const COOKIE_NAME = 'serasi_session';
const SESSION_SECONDS = 12 * 60 * 60;

// Akun tes. Simpan repository sebagai Private.
const LOGIN_USERNAME = 'Mantap';
const LOGIN_PASSWORD = 'Serasi!Masuk2026#';

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );

  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const username =
      typeof body.username === 'string' ? body.username.trim() : '';
    const password =
      typeof body.password === 'string' ? body.password : '';

    if (
      username !== LOGIN_USERNAME ||
      password !== LOGIN_PASSWORD
    ) {
      return json(
        { error: 'Username atau password salah.' },
        401
      );
    }

    const user = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ? COLLATE NOCASE AND active = 1'
    ).bind(LOGIN_USERNAME).first();

    if (!user) {
      return json(
        { error: 'Akun Mantap belum aktif di database D1.' },
        500
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const random = new Uint8Array(32);
    crypto.getRandomValues(random);

    const token = [...random]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const tokenHash = await sha256Hex(token);

    await env.DB.prepare(
      'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
    ).bind(
      tokenHash,
      user.id,
      now + SESSION_SECONDS,
      now
    ).run();

    return json(
      { ok: true, redirect: '/' },
      200,
      {
        'Set-Cookie':
          `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
      }
    );
  } catch (error) {
    return json(
      { error: 'Kesalahan server saat login. Periksa log Cloudflare.' },
      500
    );
  }
}
