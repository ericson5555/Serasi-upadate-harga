const COOKIE_NAME = 'serasi_session';
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function onRequestPost({ request, env }) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const part = cookieHeader.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE_NAME + '='));
  const token = part ? part.slice(COOKIE_NAME.length + 1) : '';
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256Hex(token)).run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    }
  });
}
