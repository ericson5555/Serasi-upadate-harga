
const COOKIE_NAME = 'serasi_session';

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );

  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';

  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;

    if (part.slice(0, i).trim() === name) {
      return part.slice(i + 1).trim();
    }
  }

  return null;
}

async function validSession(request, env) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);

  return await env.DB.prepare(`
    SELECT u.id, u.username, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND s.expires_at > ?
      AND u.active = 1
  `).bind(tokenHash, now).first();
}

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  // Login page is public.
  if (path === '/login.html') {
    const user = await validSession(request, env);

    if (user) {
      return Response.redirect(new URL('/', url), 302);
    }

    return next();
  }

  // Only POST requests may reach the login API.
  if (path === '/api/login') {
    if (method !== 'POST') {
      return Response.redirect(new URL('/login.html', url), 302);
    }

    return next();
  }

  // All other pages and APIs require a valid session.
  const user = await validSession(request, env);

  if (!user) {
    if (path.startsWith('/api/')) {
      return Response.json(
        { error: 'Silakan login terlebih dahulu.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const response = Response.redirect(
      new URL('/login.html', url),
      302
    );

    response.headers.append(
      'Set-Cookie',
      `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    );

    return response;
  }

  // Provide session details to the website when requested.
  if (path === '/api/session') {
    return Response.json(
      { authenticated: true, username: user.username, role: user.role },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const response = await next();
  const headers = new Headers(response.headers);

  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('X-Frame-Options', 'DENY');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
