// ═════════════ خادم المزامنة المشفّرة — المساعد الإداري ═════════════
// يعمل على Cloudflare Workers (الخطة المجانية) ويحفظ في Workers KV.
// لا يرى هذا الخادم أي بيانات مقروءة: كل ما يصله مشفّر في الجهاز (AES-256-GCM) بمفتاح لا يغادر الأجهزة المرتبطة.
// كل مجموعة أجهزة مرتبطة = «قناة» معرّفها مشتق من المفتاح، وتحميها كلمة عبور مشتقة منه أيضاً (يُحفظ هنا تجزئتها فقط).
// الخادم خاص: يقبل عدداً محدوداً من القنوات (MAX_CHANNELS) حتى لا يستغله غير أصحابه.

import { staffApi, staffAdmin, flushPush } from './staff.js';

const MAX_VALUE = 24 * 1024 * 1024; // حد Workers KV للقيمة الواحدة 25 ميجابايت
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const te = new TextEncoder();
const b64u = (u8) => { let s = ''; u8.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

// ───── إشعارات «هدهد» على الجوال (1.4.0) ─────
// الجهاز يرفع «خطة» إشعارات قصيرة بالأرقام فقط (مثل: عندك 3 مهام اليوم) دون أي تفاصيل،
// والمؤقت (كل 5 دقائق) يرسل ما حان وقته إلى الجوالات المشتركة عبر Web Push (VAPID) دون محتوى،
// ثم يجلب عامل الخدمة في الجوال نص الإشعار من صندوقه هنا (/push/inbox/<sid>) ويعرضه.
const SUB_PUB = 'https://khaleljo55.github.io/madrasa-assistant/';
async function vapid(env) {
  let k = await env.DATA.get('vapid', { type: 'json' });
  if (!k) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    k = { priv: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))) };
    await env.DATA.put('vapid', JSON.stringify(k));
  }
  return k;
}
async function vapidHeader(endpoint, k) {
  const h = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const p = b64u(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUB_PUB })));
  const key = await crypto.subtle.importKey('jwk', k.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(h + '.' + p)));
  return `vapid t=${h}.${p}.${b64u(sig)}, k=${k.pub}`;
}
const okEndpoint = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || (x.protocol === 'http:' && /^(127\.0\.0\.1|localhost)$/.test(x.hostname)); } catch { return false; } };
// إرسال رسائل إلى كل جوالات القناة: تُضاف إلى صندوق كل جوال ثم يُرسل له تنبيه واحد
async function pushSend(env, id, msgs) {
  const k = await vapid(env), subs = await env.DATA.list({ prefix: `ps:${id}:` });
  let sent = 0;
  for (const key of subs.keys) {
    const sid = key.name.slice(`ps:${id}:`.length), sub = await env.DATA.get(key.name, { type: 'json' });
    if (!sub?.endpoint || !okEndpoint(sub.endpoint)) { await env.DATA.delete(key.name); continue; }
    const box = (await env.DATA.get('pi:' + sid, { type: 'json' })) || [];
    await env.DATA.put('pi:' + sid, JSON.stringify([...box, ...msgs].slice(-6)), { expirationTtl: 2 * 86400 });
    try {
      const r = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: await vapidHeader(sub.endpoint, k), TTL: '43200', Urgency: 'high', 'Content-Length': '0' } });
      if (r.status === 404 || r.status === 410) { await env.DATA.delete(key.name); await env.DATA.delete('pi:' + sid); } else if (r.ok) sent++;
    } catch { }
  }
  return sent;
}
// مُرسِل إشعار بلا محتوى، مع توقيع واحد لكل خدمة إشعارات في الطلب
function pushSender(env) {
  const cache = new Map();
  return async (endpoint) => {
    if (!okEndpoint(endpoint)) return 410;
    try {
      const aud = new URL(endpoint).origin;
      if (!cache.has(aud)) cache.set(aud, await vapidHeader(endpoint, await vapid(env)));
      const r = await fetch(endpoint, { method: 'POST', headers: { Authorization: cache.get(aud), TTL: '43200', Urgency: 'high', 'Content-Length': '0' } });
      return r.status;
    } catch { return 0; }
  };
}
const cleanMsg = (m) => ({ title: String(m.title || 'هدهد 👧').slice(0, 80), body: String(m.body || '').slice(0, 300), url: /^\.\/(#go=[a-z]+)?$/.test(m.url || '') ? m.url : './', tag: String(m.tag || 'hud').slice(0, 60) });
async function pushCron(env) {
  const plans = await env.DATA.list({ prefix: 'pp:' }), now = Date.now();
  for (const key of plans.keys) {
    const plan = await env.DATA.get(key.name, { type: 'json' });
    if (!plan?.items?.length) continue;
    const due = plan.items.filter((m) => m.at <= now), rest = plan.items.filter((m) => m.at > now);
    if (!due.length) continue;
    const fresh = due.filter((m) => now - m.at < 40 * 60000).map(cleanMsg); // ما فات بأكثر من 40 دقيقة لا يُرسل
    await env.DATA.put(key.name, JSON.stringify({ ...plan, items: rest }));
    if (fresh.length) await pushSend(env, key.name.slice(3), fresh);
  }
}

function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (url.pathname.startsWith('/st/')) {
      try { return await staffApi(req, env, ctx, url, json, async (id) => !!(await env.DATA.get('ch:' + id)), pushSender(env)); }
      catch (e) { return json({ error: 'server', detail: String(e.message || e).slice(0, 200) }, 500); }
    }
    if (url.pathname === '/' || url.pathname === '/v1') return json({ ok: true, app: 'madrasa-sync', v: 3, push: true, staff: !!env.DB });
    if (url.pathname === '/push/key' && req.method === 'GET') return json({ key: (await vapid(env)).pub });
    const ib = url.pathname.match(/^\/push\/inbox\/([0-9a-f]{32})$/);
    if (ib && req.method === 'GET') { // رقم الجوال السري (128 بت) هو مفتاح صندوقه
      const box = (await env.DATA.get('pi:' + ib[1], { type: 'json' })) || [];
      if (box.length) await env.DATA.delete('pi:' + ib[1]);
      return json({ items: box });
    }
    const pm = url.pathname.match(/^\/v1\/([0-9a-f]{32})\/push\/(plan|sub|test)(?:\/([0-9a-f]{32}))?$/);
    const sa = url.pathname.match(/^\/v1\/([0-9a-f]{32})\/staff\/([a-z0-9/]{2,60})$/);
    const m = pm ? [null, pm[1], null, null] : sa ? [null, sa[1], null, null] : url.pathname.match(/^\/v1\/([0-9a-f]{32})\/(?:o\/(.+)|(list))$/);
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

    if (sa) {
      if (!reg) return json({ error: 'not_found' }, 404);
      try { return await staffAdmin(req, env, ctx, id, sa[2], json, pushSender(env)); }
      catch (e) { return json({ error: 'server', detail: String(e.message || e).slice(0, 200) }, 500); }
    }
    if (pm) {
      if (!reg) return json({ error: 'not_found' }, 404);
      const [, , kind, sid] = pm;
      if (kind === 'plan' && req.method === 'PUT') {
        const body = await req.text(); if (body.length > 64 * 1024) return json({ error: 'too_large' }, 413);
        let p; try { p = JSON.parse(body); } catch { return json({ error: 'bad_json' }, 400); }
        const items = (Array.isArray(p.items) ? p.items : []).filter((x) => Number.isFinite(x.at)).slice(0, 120).map((x) => ({ at: x.at, ...cleanMsg(x) }));
        await env.DATA.put('pp:' + id, JSON.stringify({ items, at: Date.now() }));
        return json({ ok: true, n: items.length });
      }
      if (kind === 'sub' && sid && req.method === 'PUT') {
        let sub; try { sub = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
        if (!okEndpoint(sub?.endpoint) || JSON.stringify(sub).length > 4000) return json({ error: 'bad_sub' }, 400);
        const n = await env.DATA.list({ prefix: `ps:${id}:`, limit: 11 });
        if (n.keys.length >= 10 && !n.keys.some((x) => x.name.endsWith(sid))) return json({ error: 'too_many' }, 403);
        await env.DATA.put(`ps:${id}:${sid}`, JSON.stringify({ endpoint: sub.endpoint, at: Date.now() }));
        return json({ ok: true });
      }
      if (kind === 'sub' && sid && req.method === 'DELETE') { await env.DATA.delete(`ps:${id}:${sid}`); await env.DATA.delete('pi:' + sid); return json({ ok: true }); }
      if (kind === 'test' && req.method === 'POST') {
        let m = {}; try { m = await req.json(); } catch { }
        return json({ ok: true, sent: await pushSend(env, id, [cleanMsg({ title: 'هدهد 👧', body: m.body || 'هلا أستاذتي! هكذا تصلك إشعاراتي 💜', url: './', tag: 'test' })]) });
      }
      return json({ error: 'method' }, 405);
    }

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
  async scheduled(event, env, ctx) { ctx.waitUntil(Promise.all([pushCron(env), flushPush(env, pushSender(env)).catch(() => { })])); },
};
