// ═════════════ 📲 خادم «تطبيق التواصل» للمعلمات والإداريات (1.5.0) ═════════════
// قاعدة بيانات Cloudflare D1 (مجانية). كل مدرسة = قناة المزامنة المشفّرة نفسها (معرّفها id).
// - المنسوبة تسجّل من رابط المدرسة، ويبقى حسابها «بانتظار القبول» حتى تقبله الأستاذة من البرنامج الرئيسي.
// - كلمة المرور لا تصل الخادم: يُرسل الجهاز ناتج PBKDF2 (100 ألف دورة)، ويحفظ الخادم تجزئته فقط.
// - المحادثة الداخلية لا تراها إلا من مُنحت الصلاحية (chat=1)، والأستاذة تمنحها وتسحبها.
// - الإشعارات: Web Push دون محتوى، ثم يجلب الجوال نصه من /st/notes ويُحذف فوراً.

const MAX_USERS = 300, MAX_BODY = 4000, MAX_TITLE = 150, PUSH_BATCH = 35;
let schemaReady = false;
async function schema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, school TEXT NOT NULL, username TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, phone TEXT, pass TEXT NOT NULL, status TEXT NOT NULL, chat INTEGER NOT NULL DEFAULT 0, teacher_id TEXT, created INTEGER NOT NULL, seen INTEGER, UNIQUE(school, username))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (tok TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, school TEXT NOT NULL, kind TEXT NOT NULL, sender TEXT NOT NULL, sender_name TEXT NOT NULL, title TEXT, body TEXT NOT NULL, audience TEXT, created INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS msg_school ON messages (school, kind, id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS recipients (msg_id INTEGER NOT NULL, user_id TEXT NOT NULL, read_at INTEGER, PRIMARY KEY (msg_id, user_id))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS rcp_user ON recipients (user_id, msg_id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS subs (endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS pushq (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT, state INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS pq_state ON pushq (state, id)`),
  ]);
  schemaReady = true;
}
const te = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', te.encode(s)));
const rnd = (n = 16) => hex(crypto.getRandomValues(new Uint8Array(n)));
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const ROLES = ['teacher', 'admin'];
const pubUser = (u) => u && { id: u.id, username: u.username, name: u.name, role: u.role, phone: u.phone || '', status: u.status, chat: !!u.chat, teacherId: u.teacher_id || '', created: u.created, seen: u.seen || 0 };
const preview = (s, n = 110) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// إضافة إشعارات للمستخدمات ثم إرسال دفعة فوراً (والباقي عبر المؤقت)
async function queuePush(env, ctx, userIds, title, body, url, send) {
  if (!userIds.length) return;
  const now = Date.now(), st = env.DB.prepare('INSERT INTO pushq (user_id, title, body, url, created) VALUES (?, ?, ?, ?, ?)');
  for (let i = 0; i < userIds.length; i += 50) await env.DB.batch(userIds.slice(i, i + 50).map((u) => st.bind(u, clip(title, 80), preview(body), url || './', now)));
  const p = flushPush(env, send);
  if (ctx?.waitUntil) ctx.waitUntil(p); else await p;
}
export async function flushPush(env, send) {
  if (!env.DB) return;
  await schema(env.DB);
  const { results } = await env.DB.prepare(`SELECT pushq.id, pushq.user_id, subs.endpoint FROM pushq LEFT JOIN subs ON subs.user_id = pushq.user_id WHERE pushq.state = 0 ORDER BY pushq.id LIMIT ${PUSH_BATCH}`).all();
  if (!results.length) return;
  await env.DB.batch(results.map((r) => env.DB.prepare('UPDATE pushq SET state = 1 WHERE id = ?').bind(r.id)));
  const done = new Set();
  for (const r of results) {
    if (!r.endpoint || done.has(r.endpoint)) continue; // إشعار واحد لكل جهاز في الدفعة
    done.add(r.endpoint);
    const st = await send(r.endpoint);
    if (st === 404 || st === 410) await env.DB.prepare('DELETE FROM subs WHERE endpoint = ?').bind(r.endpoint).run();
  }
  // تنظيف: إشعارات أقدم من يومين
  await env.DB.prepare('DELETE FROM pushq WHERE created < ?').bind(Date.now() - 2 * 86400e3).run();
}

async function staffUser(env, req) {
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!/^[0-9a-f]{64}$/.test(tok)) return null;
  const u = await env.DB.prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.tok = ?').bind(await sha('st:' + tok)).first();
  return u && u.status === 'active' ? u : null;
}
const audienceIds = async (env, school, to) => {
  const all = (await env.DB.prepare("SELECT id, role FROM users WHERE school = ? AND status = 'active'").bind(school).all()).results;
  if (to === 'all') return all.map((u) => u.id);
  if (to === 'teacher' || to === 'admin') return all.filter((u) => u.role === to).map((u) => u.id);
  const set = new Set(Array.isArray(to) ? to : []); return all.filter((u) => set.has(u.id)).map((u) => u.id);
};

// ───── واجهة المنسوبات: /st/... ─────
export async function staffApi(req, env, ctx, url, json, channelExists, send) {
  if (!env.DB) return json({ error: 'no_db' }, 503);
  await schema(env.DB);
  const p = url.pathname, M = req.method, now = Date.now();
  let body = {};
  if (M === 'POST' || M === 'PUT') { const t = await req.text(); if (t.length > 20000) return json({ error: 'too_large' }, 413); try { body = t ? JSON.parse(t) : {}; } catch { return json({ error: 'bad_json' }, 400); } }

  // التسجيل والدخول: /st/<school>/register و /st/<school>/login
  const sm = p.match(/^\/st\/([0-9a-f]{32})\/(register|login|info)$/);
  if (sm) {
    const school = sm[1];
    if (!(await channelExists(school))) return json({ error: 'no_school' }, 404);
    if (sm[2] === 'info') return json({ ok: true });
    const username = clip(body.username, 40).toLowerCase(), pass = String(body.pass || '');
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || !/^[A-Za-z0-9_-]{43}$/.test(pass)) return json({ error: 'bad_input' }, 400);
    const ph = await sha('pw:' + pass);
    if (sm[2] === 'register' && M === 'POST') {
      const name = clip(body.name, 80), role = ROLES.includes(body.role) ? body.role : '', phone = clip(body.phone, 20).replace(/[^\d+]/g, '');
      if (name.length < 3 || !role) return json({ error: 'bad_input' }, 400);
      const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE school = ?').bind(school).first();
      if (n.n >= MAX_USERS) return json({ error: 'full' }, 403);
      const pend = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE school = ? AND status = 'pending'").bind(school).first();
      if (pend.n >= 60) return json({ error: 'too_many_pending' }, 429);
      try { await env.DB.prepare('INSERT INTO users (id, school, username, name, role, phone, pass, status, chat, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)').bind(rnd(), school, username, name, role, phone, ph, 'pending', now).run(); }
      catch { return json({ error: 'taken' }, 409); }
      return json({ ok: true, status: 'pending' });
    }
    if (sm[2] === 'login' && M === 'POST') {
      const lk = `lf:${school}:${username}`, fails = Number((await env.DATA?.get(lk)) || 0);
      if (fails >= 8) return json({ error: 'locked' }, 429); // حماية من التخمين: 8 محاولات خاطئة ← انتظار 15 دقيقة
      const u = await env.DB.prepare('SELECT * FROM users WHERE school = ? AND username = ?').bind(school, username).first();
      if (!u || u.pass !== ph) { await env.DATA?.put(lk, String(fails + 1), { expirationTtl: 900 }); return json({ error: 'wrong' }, 401); }
      if (u.status !== 'active') return json({ ok: true, status: u.status });
      const tok = rnd(32);
      await env.DB.prepare('INSERT INTO sessions (tok, user_id, created) VALUES (?, ?, ?)').bind(await sha('st:' + tok), u.id, now).run();
      return json({ ok: true, status: 'active', token: tok, user: pubUser(u) });
    }
    return json({ error: 'method' }, 405);
  }

  // جلب نص الإشعار من عامل الخدمة (بالرمز)، ثم حذفه
  const u = await staffUser(env, req);
  if (p === '/st/notes' && M === 'GET') {
    if (!u) return json({ items: [] });
    const { results } = await env.DB.prepare('SELECT id, title, body, url FROM pushq WHERE user_id = ? AND state = 1 ORDER BY id DESC LIMIT 5').bind(u.id).all();
    if (results.length) await env.DB.prepare('DELETE FROM pushq WHERE user_id = ? AND state = 1').bind(u.id).run();
    return json({ items: results.reverse() });
  }
  if (!u) return json({ error: 'auth' }, 401);
  await env.DB.prepare('UPDATE users SET seen = ? WHERE id = ?').bind(now, u.id).run();
  if (p === '/st/me' && M === 'GET') return json({ user: pubUser(u) });
  if (p === '/st/logout' && M === 'POST') { await env.DB.prepare('DELETE FROM sessions WHERE tok = ?').bind(await sha('st:' + (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''))).run(); return json({ ok: true }); }
  if (p === '/st/pass' && M === 'POST') {
    const np = String(body.pass || ''); if (!/^[A-Za-z0-9_-]{43}$/.test(np)) return json({ error: 'bad_input' }, 400);
    await env.DB.prepare('UPDATE users SET pass = ? WHERE id = ?').bind(await sha('pw:' + np), u.id).run(); return json({ ok: true });
  }
  if (p === '/st/inbox' && M === 'GET') {
    const { results } = await env.DB.prepare('SELECT m.id, m.title, m.body, m.sender_name, m.created, r.read_at FROM recipients r JOIN messages m ON m.id = r.msg_id WHERE r.user_id = ? AND m.deleted = 0 ORDER BY m.id DESC LIMIT 200').bind(u.id).all();
    return json({ items: results, user: pubUser(u) });
  }
  if (p === '/st/read' && M === 'POST') {
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isFinite).slice(0, 200);
    if (ids.length) await env.DB.batch(ids.map((id) => env.DB.prepare('UPDATE recipients SET read_at = ? WHERE msg_id = ? AND user_id = ? AND read_at IS NULL').bind(now, id, u.id)));
    return json({ ok: true });
  }
  if (p === '/st/chat') {
    if (!u.chat) return json({ error: 'no_chat' }, 403);
    if (M === 'GET') {
      const after = Number(url.searchParams.get('after') || 0);
      const { results } = await env.DB.prepare("SELECT id, sender, sender_name, body, created FROM messages WHERE school = ? AND kind = 'chat' AND deleted = 0 AND id > ? ORDER BY id DESC LIMIT 200").bind(u.school, after).all();
      return json({ items: results.reverse().map((m) => ({ ...m, mine: m.sender === u.id })) });
    }
    if (M === 'POST') {
      const text = clip(body.body, MAX_BODY); if (!text) return json({ error: 'empty' }, 400);
      const r = await env.DB.prepare("INSERT INTO messages (school, kind, sender, sender_name, body, created) VALUES (?, 'chat', ?, ?, ?, ?)").bind(u.school, u.id, u.name, text, now).run();
      const members = (await env.DB.prepare("SELECT id FROM users WHERE school = ? AND status = 'active' AND chat = 1 AND id != ?").bind(u.school, u.id).all()).results.map((x) => x.id);
      await queuePush(env, ctx, members, '💬 ' + u.name, text, './#chat', send);
      return json({ ok: true, id: r.meta?.last_row_id });
    }
  }
  if (p === '/st/sub') {
    const ep = String(body.endpoint || '');
    if (M === 'PUT') { if (!/^https:\/\//.test(ep) && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(ep)) return json({ error: 'bad_sub' }, 400); await env.DB.prepare('INSERT OR REPLACE INTO subs (endpoint, user_id, created) VALUES (?, ?, ?)').bind(ep.slice(0, 1000), u.id, now).run(); return json({ ok: true }); }
    if (M === 'DELETE') { await env.DB.prepare('DELETE FROM subs WHERE user_id = ? AND endpoint = ?').bind(u.id, ep).run(); return json({ ok: true }); }
  }
  return json({ error: 'not_found' }, 404);
}

// ───── واجهة الأستاذة (البرنامج الرئيسي، بكلمة عبور القناة): /v1/<id>/staff/... ─────
export async function staffAdmin(req, env, ctx, school, rest, json, send) {
  if (!env.DB) return json({ error: 'no_db' }, 503);
  await schema(env.DB);
  const M = req.method, now = Date.now(), url = new URL(req.url);
  let body = {};
  if (M === 'POST' || M === 'PUT') { const t = await req.text(); if (t.length > 30000) return json({ error: 'too_large' }, 413); try { body = t ? JSON.parse(t) : {}; } catch { return json({ error: 'bad_json' }, 400); } }
  const own = (id) => env.DB.prepare('SELECT * FROM users WHERE id = ? AND school = ?').bind(id, school).first();

  if (rest === 'summary' && M === 'GET') {
    const pend = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE school = ? AND status = 'pending'").bind(school).first();
    const last = await env.DB.prepare("SELECT MAX(id) AS id FROM messages WHERE school = ? AND kind = 'chat' AND deleted = 0 AND sender != 'admin'").bind(school).first();
    return json({ pending: pend.n, chatLast: last.id || 0 });
  }
  if (rest === 'users' && M === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM users WHERE school = ? ORDER BY created DESC').bind(school).all();
    return json({ users: results.map(pubUser) });
  }
  const um = rest.match(/^users\/([0-9a-f]{32})$/);
  if (um) {
    const x = await own(um[1]); if (!x) return json({ error: 'not_found' }, 404);
    if (M === 'DELETE') { await env.DB.batch([env.DB.prepare('DELETE FROM users WHERE id = ?').bind(x.id), env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(x.id), env.DB.prepare('DELETE FROM subs WHERE user_id = ?').bind(x.id), env.DB.prepare('DELETE FROM recipients WHERE user_id = ?').bind(x.id), env.DB.prepare('DELETE FROM pushq WHERE user_id = ?').bind(x.id)]); return json({ ok: true }); }
    if (M === 'POST') {
      const status = ['active', 'disabled', 'pending'].includes(body.status) ? body.status : x.status;
      const chat = body.chat === undefined ? x.chat : body.chat ? 1 : 0;
      const role = ROLES.includes(body.role) ? body.role : x.role, name = body.name ? clip(body.name, 80) : x.name;
      const teacher = body.teacherId === undefined ? x.teacher_id : clip(body.teacherId, 40) || null;
      const pass = /^[A-Za-z0-9_-]{43}$/.test(body.pass || '') ? await sha('pw:' + body.pass) : x.pass;
      await env.DB.prepare('UPDATE users SET status = ?, chat = ?, role = ?, name = ?, teacher_id = ?, pass = ? WHERE id = ?').bind(status, chat, role, name, teacher, pass, x.id).run();
      if (status !== 'active' || pass !== x.pass) await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(x.id).run(); // الإيقاف أو تغيير كلمة المرور يُخرجها من أجهزتها
      if (status === 'active' && x.status === 'pending') await queuePush(env, ctx, [x.id], '✅ تم قبول عضويتكِ', 'مرحباً بكِ في تطبيق التواصل. ستصلكِ الرسائل هنا.', './', send);
      if (chat && !x.chat && status === 'active') await queuePush(env, ctx, [x.id], '💬 المحادثة الداخلية', 'أصبح بإمكانكِ المشاركة في المحادثة الداخلية.', './#chat', send);
      return json({ ok: true, user: pubUser(await own(x.id)) });
    }
  }
  if (rest === 'send' && M === 'POST') {
    const title = clip(body.title, MAX_TITLE), text = clip(body.body, MAX_BODY);
    if (!text) return json({ error: 'empty' }, 400);
    const ids = await audienceIds(env, school, body.to);
    if (!ids.length) return json({ error: 'no_recipients' }, 400);
    const r = await env.DB.prepare("INSERT INTO messages (school, kind, sender, sender_name, title, body, audience, created) VALUES (?, 'note', 'admin', ?, ?, ?, ?, ?)").bind(school, clip(body.from || 'الإدارة', 80), title, text, JSON.stringify(body.to ?? 'all').slice(0, 20000), now).run();
    const mid = r.meta?.last_row_id;
    const st = env.DB.prepare('INSERT INTO recipients (msg_id, user_id) VALUES (?, ?)');
    for (let i = 0; i < ids.length; i += 50) await env.DB.batch(ids.slice(i, i + 50).map((u) => st.bind(mid, u)));
    await queuePush(env, ctx, ids, '📬 ' + (title || 'رسالة جديدة'), text, './#m' + mid, send);
    return json({ ok: true, id: mid, n: ids.length });
  }
  if (rest === 'sent' && M === 'GET') {
    const { results } = await env.DB.prepare("SELECT m.id, m.title, m.body, m.audience, m.created, COUNT(r.user_id) AS n, COUNT(r.read_at) AS rd FROM messages m LEFT JOIN recipients r ON r.msg_id = m.id WHERE m.school = ? AND m.kind = 'note' AND m.deleted = 0 GROUP BY m.id ORDER BY m.id DESC LIMIT 100").bind(school).all();
    return json({ items: results });
  }
  const rm = rest.match(/^sent\/(\d+)$/);
  if (rm) {
    const m = await env.DB.prepare("SELECT id FROM messages WHERE id = ? AND school = ? AND kind = 'note'").bind(Number(rm[1]), school).first();
    if (!m) return json({ error: 'not_found' }, 404);
    if (M === 'DELETE') { await env.DB.prepare('UPDATE messages SET deleted = 1 WHERE id = ?').bind(m.id).run(); return json({ ok: true }); }
    const { results } = await env.DB.prepare('SELECT u.id, u.name, u.role, r.read_at FROM recipients r JOIN users u ON u.id = r.user_id WHERE r.msg_id = ? ORDER BY r.read_at IS NULL, u.name').bind(m.id).all();
    return json({ items: results });
  }
  if (rest === 'chat') {
    if (M === 'GET') {
      const after = Number(url.searchParams.get('after') || 0);
      const { results } = await env.DB.prepare("SELECT id, sender, sender_name, body, created FROM messages WHERE school = ? AND kind = 'chat' AND deleted = 0 AND id > ? ORDER BY id DESC LIMIT 300").bind(school, after).all();
      return json({ items: results.reverse().map((m) => ({ ...m, mine: m.sender === 'admin' })) });
    }
    if (M === 'POST') {
      const text = clip(body.body, MAX_BODY); if (!text) return json({ error: 'empty' }, 400);
      const name = clip(body.from || 'الإدارة', 80);
      const r = await env.DB.prepare("INSERT INTO messages (school, kind, sender, sender_name, body, created) VALUES (?, 'chat', 'admin', ?, ?, ?)").bind(school, name, text, now).run();
      const members = (await env.DB.prepare("SELECT id FROM users WHERE school = ? AND status = 'active' AND chat = 1").bind(school).all()).results.map((x) => x.id);
      await queuePush(env, ctx, members, '💬 ' + name, text, './#chat', send);
      return json({ ok: true, id: r.meta?.last_row_id });
    }
  }
  const cm = rest.match(/^chat\/(\d+)$/);
  if (cm && M === 'DELETE') { await env.DB.prepare("UPDATE messages SET deleted = 1 WHERE id = ? AND school = ? AND kind = 'chat'").bind(Number(cm[1]), school).run(); return json({ ok: true }); }
  return json({ error: 'not_found' }, 404);
}
