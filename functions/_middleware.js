const COOKIE_NAME = 'serasi_session';

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Public routes required to log in or sign out.
  if (path === '/login.html' || path === '/api/login' || path === '/api/logout') {
    if (path === '/login.html' && getCookie(request, COOKIE_NAME)) {
      const token = getCookie(request, COOKIE_NAME);
      const tokenHash = await sha256Hex(token);
      const row = await env.DB.prepare(
        'SELECT s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1'
      ).bind(tokenHash, Math.floor(Date.now() / 1000)).first();
      if (row) return Response.redirect(new URL('/', request.url), 302);
    }
    return next();
  }

  const token = getCookie(request, COOKIE_NAME);
  if (!token) return Response.redirect(new URL('/login.html', request.url), 302);

  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  const user = await env.DB.prepare(
    'SELECT u.id, u.username, u.role, s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1'
  ).bind(tokenHash, now).first();

  if (!user) {
    const response = Response.redirect(new URL('/login.html', request.url), 302);
    response.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return response;
  }

  if (path === '/api/session') {
    return Response.json({ authenticated: true, username: user.username, role: user.role });
  }
  if (path === '/api/login') return new Response('Method not allowed', { status: 405 });

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('X-Frame-Options', 'DENY');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
