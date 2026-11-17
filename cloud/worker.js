// ═════════════ خادم المزامنة المشفّرة — المساعد الإداري ═════════════
// يعمل على Cloudflare Workers (الخطة المجانية) ويحفظ في Workers KV.
// لا يرى هذا الخادم أي بيانات مقروءة: كل ما يصله مشفّر في الجهاز (AES-256-GCM) بمفتاح لا يغادر الأجهزة المرتبطة.
// كل مجموعة أجهزة مرتبطة = «قناة» معرّفها مشتق من المفتاح، وتحميها كلمة عبور مشتقة منه أيضاً (يُحفظ هنا تجزئتها فقط).
// الخادم خاص: يقبل عدداً محدوداً من القنوات (MAX_CHANNELS) حتى لا يستغله غير أصحابه.

const MAX_VALUE = 24 * 1024 * 1024; // حد Workers KV للقيمة الواحدة 25 ميجابايت
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/v1') return json({ ok: true, app: 'madrasa-sync', v: 1 });
    const m = url.pathname.match(/^\/v1\/([0-9a-f]{32})\/(?:o\/(.+)|(list))$/);
    if (!m) return json({ error: 'not_found' }, 404);
    const id = m[1];
    let name = null;
    if (m[2]) {
      try { name = decodeURIComponent(m[2]); } catch { return json({ error: 'bad_name' }, 400); }
      if (name.length > 300 || name.includes('..') || name.startsWith('/') || /[\x00-\x1f]/.test(name)) return json({ error: 'bad_name' }, 400);
    }
    const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(tok)) return json({ error: 'auth' }, 401);
    const th = await sha256hex('madrasa-sync:' + tok);
    const reg = await env.DATA.get('ch:' + id, { cacheTtl: 300 });
    if (reg && !safeEq(reg, th)) return json({ error: 'forbidden' }, 403);

    if (req.method === 'GET') {
      if (!reg) return m[3] ? json({ names: [] }) : json({ error: 'not_found' }, 404);
      if (m[3]) {
        const prefix = `o:${id}:${url.searchParams.get('prefix') || ''}`, names = [];
        let cursor;
        do { const r = await env.DATA.list({ prefix, cursor }); r.keys.forEach((k) => names.push(k.name.slice(`o:${id}:`.length))); cursor = r.list_complete ? null : r.cursor; } while (cursor);
        return json({ names });
      }
      const v = await env.DATA.get(`o:${id}:${name}`, { type: 'arrayBuffer' });
      if (!v) return json({ error: 'not_found' }, 404);
      return new Response(v, { headers: { ...CORS, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
    }

    if (req.method === 'PUT' && name) {
      const len = Number(req.headers.get('Content-Length') || 0);
      if (len > MAX_VALUE) return json({ error: 'too_large' }, 413);
      const body = await req.arrayBuffer();
      if (body.byteLength > MAX_VALUE) return json({ error: 'too_large' }, 413);
      if (!reg) {
        // قناة جديدة: يُسمح بعدد محدود فقط
        const max = Number(env.MAX_CHANNELS || 5);
        const existing = await env.DATA.list({ prefix: 'ch:', limit: max + 1 });
        if (existing.keys.length >= max) return json({ error: 'channels_full' }, 403);
        await env.DATA.put('ch:' + id, th);
      }
      await env.DATA.put(`o:${id}:${name}`, body);
      return json({ ok: true });
    }
    return json({ error: 'method' }, 405);
  },
};
