// ═════════════ 📲 خادم «تطبيق التواصل» للمعلمات والإداريات (1.5.0) والطالبات (1.6.0) ═════════════
// قاعدة بيانات Cloudflare D1 (مجانية). كل مدرسة = قناة المزامنة المشفّرة نفسها (معرّفها id).
// - المستخدمة تسجّل من رابط المدرسة، ويبقى حسابها «بانتظار القبول» حتى تقبله الأستاذة من البرنامج الرئيسي.
// - كلمة المرور لا تصل الخادم: يُرسل الجهاز ناتج PBKDF2 (100 ألف دورة)، ويحفظ الخادم تجزئته فقط.
// - المنسوبات: محادثة داخلية جماعية لا تراها إلا من مُنحت الصلاحية (chat=1).
// - الطالبات: «المطلوب» (طلبات بموعد ومتابعة التسليم)، والتذكيرات المجدولة، ومحادثة خاصة مع الإدارة فقط بالصلاحية.
// - الإشعارات: Web Push دون محتوى، ثم يجلب الجوال نصه من /st/notes ويُحذف فوراً.

const MAX_USERS = 1500, MAX_BODY = 4000, MAX_TITLE = 150, PUSH_BATCH = 35;
let schemaReady = false;
async function schema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, school TEXT NOT NULL, username TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, phone TEXT, pass TEXT NOT NULL, status TEXT NOT NULL, chat INTEGER NOT NULL DEFAULT 0, teacher_id TEXT, created INTEGER NOT NULL, seen INTEGER, cls TEXT, UNIQUE(school, username))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (tok TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, school TEXT NOT NULL, kind TEXT NOT NULL, sender TEXT NOT NULL, sender_name TEXT NOT NULL, title TEXT, body TEXT NOT NULL, audience TEXT, created INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, grp TEXT, thread TEXT, due TEXT, remind_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS msg_school ON messages (school, kind, id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS recipients (msg_id INTEGER NOT NULL, user_id TEXT NOT NULL, read_at INTEGER, done_at INTEGER, ok_at INTEGER, PRIMARY KEY (msg_id, user_id))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS rcp_user ON recipients (user_id, msg_id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS subs (endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS pushq (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT, state INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, at INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS pq_state ON pushq (state, at, id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS surveys (id TEXT PRIMARY KEY, school TEXT NOT NULL, title TEXT NOT NULL, intro TEXT, fields TEXT NOT NULL, target TEXT, pkey TEXT, public INTEGER NOT NULL DEFAULT 0, open INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS responses (id INTEGER PRIMARY KEY AUTOINCREMENT, survey_id TEXT NOT NULL, school TEXT NOT NULL, user_id TEXT, data TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER, imported INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS resp_sv ON responses (survey_id, id)`),
  ]);
  // ترقية قاعدة أُنشئت بإصدار أقدم (يُتجاهل الخطأ إن كان العمود موجوداً)
  for (const sql of ['ALTER TABLE users ADD COLUMN cls TEXT', 'ALTER TABLE messages ADD COLUMN grp TEXT', 'ALTER TABLE messages ADD COLUMN thread TEXT', 'ALTER TABLE messages ADD COLUMN due TEXT', 'ALTER TABLE messages ADD COLUMN remind_at INTEGER',
    'ALTER TABLE recipients ADD COLUMN done_at INTEGER', 'ALTER TABLE recipients ADD COLUMN ok_at INTEGER', 'ALTER TABLE pushq ADD COLUMN at INTEGER NOT NULL DEFAULT 0']) { try { await db.prepare(sql).run(); } catch { } }
  schemaReady = true;
}
const te = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', te.encode(s)));
const rnd = (n = 16) => hex(crypto.getRandomValues(new Uint8Array(n)));
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const ROLES = ['teacher', 'admin', 'student'];
const isStu = (u) => u?.role === 'student';
const pubUser = (u) => u && { id: u.id, username: u.username, name: u.name, role: u.role, phone: u.phone || '', cls: u.cls || '', status: u.status, chat: !!u.chat, teacherId: u.teacher_id || '', created: u.created, seen: u.seen || 0 };
const preview = (s, n = 110) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const okDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null);

// إضافة إشعارات للمستخدمات (فوراً أو في وقت لاحق at) ثم إرسال دفعة
async function queuePush(env, ctx, userIds, title, body, url, send, at = 0) {
  if (!userIds.length) return;
  const now = Date.now(), st = env.DB.prepare('INSERT INTO pushq (user_id, title, body, url, created, at) VALUES (?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < userIds.length; i += 50) await env.DB.batch(userIds.slice(i, i + 50).map((u) => st.bind(u, clip(title, 80), preview(body), url || './', now, at || 0)));
  if (at > now) return;
  const p = flushPush(env, send);
  if (ctx?.waitUntil) ctx.waitUntil(p); else await p;
}
export async function flushPush(env, send) {
  if (!env.DB) return;
  await schema(env.DB);
  const now = Date.now();
  const { results } = await env.DB.prepare(`SELECT pushq.id, pushq.user_id, subs.endpoint FROM pushq LEFT JOIN subs ON subs.user_id = pushq.user_id WHERE pushq.state = 0 AND pushq.at <= ? ORDER BY pushq.id LIMIT ${PUSH_BATCH}`).bind(now).all();
  if (results.length) {
    await env.DB.batch([...new Set(results.map((r) => r.id))].map((id) => env.DB.prepare('UPDATE pushq SET state = 1, created = ? WHERE id = ?').bind(now, id)));
    const done = new Set();
    for (const r of results) {
      if (!r.endpoint || done.has(r.endpoint)) continue; // إشعار واحد لكل جهاز في الدفعة
      done.add(r.endpoint);
      const st = await send(r.endpoint);
      if (st === 404 || st === 410) await env.DB.prepare('DELETE FROM subs WHERE endpoint = ?').bind(r.endpoint).run();
    }
  }
  // تنظيف: ما أُرسل قبل أكثر من يومين
  await env.DB.prepare('DELETE FROM pushq WHERE state = 1 AND created < ?').bind(now - 2 * 86400e3).run();
}

async function staffUser(env, req) {
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!/^[0-9a-f]{64}$/.test(tok)) return null;
  const u = await env.DB.prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.tok = ?').bind(await sha('st:' + tok)).first();
  return u && u.status === 'active' ? u : null;
}
// المستلمات: all = كل المنسوبات (دون الطالبات)، teacher/admin، students = كل الطالبات، {cls:[…]} = فصول، أو قائمة معرّفات
const audienceIds = async (env, school, to) => {
  const all = (await env.DB.prepare("SELECT id, role, cls FROM users WHERE school = ? AND status = 'active'").bind(school).all()).results;
  if (to === 'all') return all.filter((u) => u.role !== 'student').map((u) => u.id);
  if (to === 'teacher' || to === 'admin') return all.filter((u) => u.role === to).map((u) => u.id);
  if (to === 'students') return all.filter((u) => u.role === 'student').map((u) => u.id);
  if (to && Array.isArray(to.cls)) { const c = new Set(to.cls.map(String)); return all.filter((u) => u.role === 'student' && c.has(u.cls || '')).map((u) => u.id); }
  const set = new Set(Array.isArray(to) ? to : []); return all.filter((u) => set.has(u.id)).map((u) => u.id);
};

// ───── واجهة المستخدمات: /st/... ─────
export async function staffApi(req, env, ctx, url, json, channelExists, send, notifyAdmin) {
  if (!env.DB) return json({ error: 'no_db' }, 503);
  await schema(env.DB);
  const p = url.pathname, M = req.method, now = Date.now();
  let body = {};
  if (M === 'POST' || M === 'PUT') { const t = await req.text(); if (t.length > 20000) return json({ error: 'too_large' }, 413); try { body = t ? JSON.parse(t) : {}; } catch { return json({ error: 'bad_json' }, 400); } }
  const admin = (school, title, text) => { if (notifyAdmin) { const p2 = notifyAdmin(school, title, text).catch(() => { }); if (ctx?.waitUntil) ctx.waitUntil(p2); } };

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
      const name = clip(body.name, 80), role = ROLES.includes(body.role) ? body.role : '', phone = clip(body.phone, 20).replace(/[^\d+]/g, ''), cls = role === 'student' ? clip(body.cls, 30) : '';
      if (name.length < 3 || !role) return json({ error: 'bad_input' }, 400);
      const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE school = ?').bind(school).first();
      if (n.n >= MAX_USERS) return json({ error: 'full' }, 403);
      const pend = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE school = ? AND status = 'pending'").bind(school).first();
      if (pend.n >= 150) return json({ error: 'too_many_pending' }, 429);
      try { await env.DB.prepare('INSERT INTO users (id, school, username, name, role, phone, pass, status, chat, created, cls) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)').bind(rnd(), school, username, name, role, phone, ph, 'pending', now, cls).run(); }
      catch { return json({ error: 'taken' }, 409); }
      admin(school, '📥 طلب عضوية جديد', `${name} (${role === 'student' ? 'طالبة' + (cls ? ' — ' + cls : '') : role === 'admin' ? 'إدارية' : 'معلمة'}) تنتظر قبولكِ في تطبيق التواصل`);
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
    const { results } = await env.DB.prepare('SELECT m.id, m.kind, m.title, m.body, m.sender_name, m.created, m.due, m.remind_at, m.thread, r.read_at, r.done_at, r.ok_at FROM recipients r JOIN messages m ON m.id = r.msg_id WHERE r.user_id = ? AND m.deleted = 0 ORDER BY m.id DESC LIMIT 300').bind(u.id).all();
    return json({ items: results, user: pubUser(u) });
  }
  if (p === '/st/read' && M === 'POST') {
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isFinite).slice(0, 200);
    if (ids.length) await env.DB.batch(ids.map((id) => env.DB.prepare('UPDATE recipients SET read_at = ? WHERE msg_id = ? AND user_id = ? AND read_at IS NULL').bind(now, id, u.id)));
    return json({ ok: true });
  }
  if (p === '/st/done' && M === 'POST') { // الطالبة: «أنجزته / سلّمته» أو التراجع
    const id = Number(body.id); if (!Number.isFinite(id)) return json({ error: 'bad_input' }, 400);
    await env.DB.prepare('UPDATE recipients SET done_at = ?, read_at = COALESCE(read_at, ?) WHERE msg_id = ? AND user_id = ?').bind(body.done ? now : null, now, id, u.id).run();
    return json({ ok: true });
  }
  if (p === '/st/chat') {
    if (!u.chat) return json({ error: 'no_chat' }, 403);
    if (isStu(u)) { // الطالبة: محادثة خاصة مع الإدارة فقط
      if (M === 'GET') {
        const { results } = await env.DB.prepare("SELECT id, sender, sender_name, body, created FROM messages WHERE school = ? AND kind = 'dm' AND thread = ? AND deleted = 0 ORDER BY id DESC LIMIT 200").bind(u.school, u.id).all();
        return json({ items: results.reverse().map((m) => ({ ...m, mine: m.sender === u.id })) });
      }
      if (M === 'POST') {
        const text = clip(body.body, MAX_BODY); if (!text) return json({ error: 'empty' }, 400);
        const r = await env.DB.prepare("INSERT INTO messages (school, kind, sender, sender_name, body, created, thread, grp) VALUES (?, 'dm', ?, ?, ?, ?, ?, 'student')").bind(u.school, u.id, u.name, text, now, u.id).run();
        admin(u.school, '💬 ' + u.name + (u.cls ? ' — ' + u.cls : ''), text);
        return json({ ok: true, id: r.meta?.last_row_id });
      }
    }
    if (M === 'GET') {
      const after = Number(url.searchParams.get('after') || 0);
      const { results } = await env.DB.prepare("SELECT id, sender, sender_name, body, created FROM messages WHERE school = ? AND kind = 'chat' AND deleted = 0 AND id > ? ORDER BY id DESC LIMIT 200").bind(u.school, after).all();
      return json({ items: results.reverse().map((m) => ({ ...m, mine: m.sender === u.id })) });
    }
    if (M === 'POST') {
      const text = clip(body.body, MAX_BODY); if (!text) return json({ error: 'empty' }, 400);
      const r = await env.DB.prepare("INSERT INTO messages (school, kind, sender, sender_name, body, created, grp) VALUES (?, 'chat', ?, ?, ?, ?, 'staff')").bind(u.school, u.id, u.name, text, now).run();
      const members = (await env.DB.prepare("SELECT id FROM users WHERE school = ? AND status = 'active' AND chat = 1 AND role != 'student' AND id != ?").bind(u.school, u.id).all()).results.map((x) => x.id);
      await queuePush(env, ctx, members, '💬 ' + u.name, text, './#chat', send);
      return json({ ok: true, id: r.meta?.last_row_id });
    }
  }
  const sv = p.match(/^\/st\/survey\/([0-9a-f]{16})$/);
  if (sv) { // تعبئة استبيان من داخل التطبيق (مرة واحدة لكل مستخدمة، وتُعدَّل)
    const S = await env.DB.prepare('SELECT * FROM surveys WHERE id = ? AND school = ?').bind(sv[1], u.school).first();
    const msg = S && await env.DB.prepare("SELECT r.msg_id FROM recipients r JOIN messages m ON m.id = r.msg_id WHERE m.kind = 'survey' AND m.thread = ? AND r.user_id = ? AND m.deleted = 0").bind(S.id, u.id).first();
    if (!S || (!msg && !S.public)) return json({ error: 'not_found' }, 404);
    const mine = await env.DB.prepare('SELECT id, data FROM responses WHERE survey_id = ? AND user_id = ?').bind(S.id, u.id).first();
    if (M === 'GET') return json({ survey: svPub(S), answer: mine ? JSON.parse(mine.data) : null });
    if (M === 'POST') {
      if (!S.open) return json({ error: 'closed' }, 403);
      const data = svClean(S, body.data); if (data.error) return json(data, 400);
      if (mine) await env.DB.prepare('UPDATE responses SET data = ?, updated = ?, imported = 0 WHERE id = ?').bind(JSON.stringify(data), now, mine.id).run();
      else await env.DB.prepare('INSERT INTO responses (survey_id, school, user_id, data, created) VALUES (?, ?, ?, ?, ?)').bind(S.id, u.school, u.id, JSON.stringify(data), now).run();
      if (msg) await env.DB.prepare('UPDATE recipients SET done_at = ?, read_at = COALESCE(read_at, ?) WHERE msg_id = ? AND user_id = ?').bind(now, now, msg.msg_id, u.id).run();
      return json({ ok: true });
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
    const pend = (await env.DB.prepare("SELECT role = 'student' AS s, COUNT(*) AS n FROM users WHERE school = ? AND status = 'pending' GROUP BY role = 'student'").bind(school).all()).results;
    const last = await env.DB.prepare("SELECT MAX(id) AS id FROM messages WHERE school = ? AND kind = 'chat' AND deleted = 0 AND sender != 'admin'").bind(school).first();
    const dm = await env.DB.prepare("SELECT MAX(id) AS id FROM messages WHERE school = ? AND kind = 'dm' AND deleted = 0 AND sender != 'admin'").bind(school).first();
    const ps = pend.find((x) => x.s)?.n || 0, pf = pend.find((x) => !x.s)?.n || 0;
    return json({ pending: pf + ps, pendingStaff: pf, pendingStudents: ps, chatLast: last.id || 0, dmLast: dm.id || 0 });
  }
  if (rest === 'users' && M === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM users WHERE school = ? ORDER BY created DESC').bind(school).all();
    return json({ users: results.map(pubUser) });
  }
  const um = rest.match(/^users\/([0-9a-f]{32})$/);
  if (um) {
    const x = await own(um[1]); if (!x) return json({ error: 'not_found' }, 404);
    if (M === 'DELETE') { await env.DB.batch([env.DB.prepare('DELETE FROM users WHERE id = ?').bind(x.id), env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(x.id), env.DB.prepare('DELETE FROM subs WHERE user_id = ?').bind(x.id), env.DB.prepare('DELETE FROM recipients WHERE user_id = ?').bind(x.id), env.DB.prepare('DELETE FROM pushq WHERE user_id = ?').bind(x.id), env.DB.prepare("DELETE FROM messages WHERE kind = 'dm' AND thread = ?").bind(x.id)]); return json({ ok: true }); }
    if (M === 'POST') {
      const status = ['active', 'disabled', 'pending'].includes(body.status) ? body.status : x.status;
      const chat = body.chat === undefined ? x.chat : body.chat ? 1 : 0;
      const role = ROLES.includes(body.role) ? body.role : x.role, name = body.name ? clip(body.name, 80) : x.name;
      const cls = body.cls === undefined ? x.cls : clip(body.cls, 30);
      const teacher = body.teacherId === undefined ? x.teacher_id : clip(body.teacherId, 40) || null;
      const pass = /^[A-Za-z0-9_-]{43}$/.test(body.pass || '') ? await sha('pw:' + body.pass) : x.pass;
      await env.DB.prepare('UPDATE users SET status = ?, chat = ?, role = ?, name = ?, teacher_id = ?, pass = ?, cls = ? WHERE id = ?').bind(status, chat, role, name, teacher, pass, cls, x.id).run();
      if (status !== 'active' || pass !== x.pass) await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(x.id).run(); // الإيقاف أو تغيير كلمة المرور يُخرجها من أجهزتها
      if (status === 'active' && x.status === 'pending') await queuePush(env, ctx, [x.id], '✅ تم قبول عضويتكِ', 'مرحباً بكِ في تطبيق التواصل. ستصلكِ الرسائل هنا.', './', send);
      if (chat && !x.chat && status === 'active') await queuePush(env, ctx, [x.id], '💬 المحادثة', isStu(x) ? 'أصبح بإمكانكِ مراسلة إدارة المدرسة.' : 'أصبح بإمكانكِ المشاركة في المحادثة الداخلية.', './#chat', send);
      return json({ ok: true, user: pubUser(await own(x.id)) });
    }
  }
  if (rest === 'send' && M === 'POST') { // رسالة أو تذكير (note) أو طلب (req)
    const title = clip(body.title, MAX_TITLE), text = clip(body.body, MAX_BODY), kind = body.kind === 'req' ? 'req' : 'note';
    if (!text && !(kind === 'req' && title)) return json({ error: 'empty' }, 400);
    const ids = await audienceIds(env, school, body.to);
    if (!ids.length) return json({ error: 'no_recipients' }, 400);
    const due = kind === 'req' ? okDate(body.due) : null, remind = Number.isFinite(body.remind) && body.remind > now ? Math.min(body.remind, now + 400 * 86400e3) : null;
    const grp = body.to === 'students' || body.to?.cls || body.grp === 'student' ? 'student' : 'staff';
    const r = await env.DB.prepare('INSERT INTO messages (school, kind, sender, sender_name, title, body, audience, created, grp, due, remind_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(school, kind, 'admin', clip(body.from || 'الإدارة', 80), title, text || title, JSON.stringify(body.to ?? 'all').slice(0, 20000), now, grp, due, remind).run();
    const mid = r.meta?.last_row_id;
    const st = env.DB.prepare('INSERT INTO recipients (msg_id, user_id) VALUES (?, ?)');
    for (let i = 0; i < ids.length; i += 50) await env.DB.batch(ids.slice(i, i + 50).map((u) => st.bind(mid, u)));
    const head = kind === 'req' ? '📋 مطلوب: ' + (title || 'طلب جديد') : '📬 ' + (title || 'رسالة جديدة');
    if (!remind || body.now !== false) await queuePush(env, ctx, ids, head, text || title, './#m' + mid, send);
    if (remind) await queuePush(env, ctx, ids, '🔔 تذكير: ' + (title || preview(text, 40)), text || title, './#m' + mid, send, remind);
    return json({ ok: true, id: mid, n: ids.length });
  }
  if (rest === 'sent' && M === 'GET') {
    const grp = url.searchParams.get('grp') === 'student' ? 'student' : 'staff';
    const { results } = await env.DB.prepare(`SELECT m.id, m.kind, m.title, m.body, m.audience, m.created, m.due, m.remind_at, COUNT(r.user_id) AS n, COUNT(r.read_at) AS rd, COUNT(r.done_at) AS dn, COUNT(r.ok_at) AS ok FROM messages m LEFT JOIN recipients r ON r.msg_id = m.id WHERE m.school = ? AND m.kind IN ('note','req') AND m.deleted = 0 AND COALESCE(m.grp, 'staff') = ? GROUP BY m.id ORDER BY m.id DESC LIMIT 150`).bind(school, grp).all();
    return json({ items: results });
  }
  const rm = rest.match(/^sent\/(\d+)(\/ok)?$/);
  if (rm) {
    const m = await env.DB.prepare("SELECT id FROM messages WHERE id = ? AND school = ? AND kind IN ('note','req')").bind(Number(rm[1]), school).first();
    if (!m) return json({ error: 'not_found' }, 404);
    if (rm[2] && M === 'POST') { // تأكيد الاستلام من الطالبة (أو إلغاؤه)
      const ids = (Array.isArray(body.users) ? body.users : [body.user]).filter((x) => /^[0-9a-f]{32}$/.test(x || '')).slice(0, 500);
      if (ids.length) await env.DB.batch(ids.map((uid) => env.DB.prepare('UPDATE recipients SET ok_at = ? WHERE msg_id = ? AND user_id = ?').bind(body.ok === false ? null : now, m.id, uid)));
      return json({ ok: true });
    }
    if (M === 'DELETE') { await env.DB.prepare('UPDATE messages SET deleted = 1 WHERE id = ?').bind(m.id).run(); await env.DB.prepare("DELETE FROM pushq WHERE state = 0 AND url = ?").bind('./#m' + m.id).run(); return json({ ok: true }); }
    const { results } = await env.DB.prepare('SELECT u.id, u.name, u.role, u.cls, r.read_at, r.done_at, r.ok_at FROM recipients r JOIN users u ON u.id = r.user_id WHERE r.msg_id = ? ORDER BY u.cls, u.name').bind(m.id).all();
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
      const r = await env.DB.prepare("INSERT INTO messages (school, kind, sender, sender_name, body, created, grp) VALUES (?, 'chat', 'admin', ?, ?, ?, 'staff')").bind(school, name, text, now).run();
      const members = (await env.DB.prepare("SELECT id FROM users WHERE school = ? AND status = 'active' AND chat = 1 AND role != 'student'").bind(school).all()).results.map((x) => x.id);
      await queuePush(env, ctx, members, '💬 ' + name, text, './#chat', send);
      return json({ ok: true, id: r.meta?.last_row_id });
    }
  }
  const cm = rest.match(/^chat\/(\d+)$/);
  if (cm && M === 'DELETE') { await env.DB.prepare("UPDATE messages SET deleted = 1 WHERE id = ? AND school = ? AND kind IN ('chat','dm')").bind(Number(cm[1]), school).run(); return json({ ok: true }); }
  // ───── الاستبيانات (1.9.0) ─────
  if (rest === 'surveys' && M === 'GET') {
    const { results } = await env.DB.prepare('SELECT s.*, (SELECT COUNT(*) FROM responses r WHERE r.survey_id = s.id) AS n, (SELECT COUNT(*) FROM responses r WHERE r.survey_id = s.id AND r.imported = 0) AS fresh FROM surveys s WHERE s.school = ? ORDER BY s.created DESC LIMIT 200').bind(school).all();
    return json({ items: results.map((x) => ({ ...svPub(x), pkey: x.pkey, n: x.n, fresh: x.fresh, created: x.created })) });
  }
  if (rest === 'surveys' && M === 'POST') {
    const fields = svFields(body.fields); if (!fields.length) return json({ error: 'no_fields' }, 400);
    const title = clip(body.title, MAX_TITLE); if (!title) return json({ error: 'empty' }, 400);
    const id = rnd(8), pkey = rnd(8), target = ['teacher', 'student'].includes(body.target) ? body.target : '';
    await env.DB.prepare('INSERT INTO surveys (id, school, title, intro, fields, target, pkey, public, open, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)').bind(id, school, title, clip(body.intro, 2000), JSON.stringify(fields), target, pkey, body.public ? 1 : 0, now).run();
    let n = 0;
    if (body.to) { // إرساله إلى مستخدمات تطبيق التواصل
      const ids = await audienceIds(env, school, body.to);
      if (ids.length) {
        const grp = body.to === 'students' || body.to?.cls ? 'student' : 'staff';
        const r = await env.DB.prepare("INSERT INTO messages (school, kind, sender, sender_name, title, body, audience, created, grp, thread) VALUES (?, 'survey', 'admin', ?, ?, ?, ?, ?, ?, ?)").bind(school, clip(body.from || 'الإدارة', 80), title, clip(body.intro, 2000) || title, JSON.stringify(body.to).slice(0, 20000), now, grp, id).run();
        const mid = r.meta?.last_row_id, st = env.DB.prepare('INSERT INTO recipients (msg_id, user_id) VALUES (?, ?)');
        for (let i = 0; i < ids.length; i += 50) await env.DB.batch(ids.slice(i, i + 50).map((u) => st.bind(mid, u)));
        await queuePush(env, ctx, ids, '📝 استبيان: ' + title, clip(body.intro, 200) || 'نرجو تعبئته', './#m' + mid, send);
        n = ids.length;
      }
    }
    return json({ ok: true, id, pkey, n });
  }
  const sm2 = rest.match(/^surveys\/([0-9a-f]{16})(\/imported)?$/);
  if (sm2) {
    const S = await env.DB.prepare('SELECT * FROM surveys WHERE id = ? AND school = ?').bind(sm2[1], school).first();
    if (!S) return json({ error: 'not_found' }, 404);
    if (sm2[2] && M === 'POST') { const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isFinite).slice(0, 2000); for (let i = 0; i < ids.length; i += 50) await env.DB.batch(ids.slice(i, i + 50).map((x) => env.DB.prepare('UPDATE responses SET imported = 1 WHERE id = ? AND survey_id = ?').bind(x, S.id))); return json({ ok: true }); }
    if (M === 'GET') {
      const { results } = await env.DB.prepare('SELECT r.id, r.user_id, r.data, r.created, r.updated, r.imported, u.name AS uname, u.role AS urole, u.cls AS ucls FROM responses r LEFT JOIN users u ON u.id = r.user_id WHERE r.survey_id = ? ORDER BY r.id DESC LIMIT 2000').bind(S.id).all();
      return json({ survey: { ...svPub(S), pkey: S.pkey }, items: results.map((r) => ({ ...r, data: JSON.parse(r.data) })) });
    }
    if (M === 'POST') { const open = body.open === undefined ? S.open : body.open ? 1 : 0, pub = body.public === undefined ? S.public : body.public ? 1 : 0; await env.DB.prepare('UPDATE surveys SET open = ?, public = ? WHERE id = ?').bind(open, pub, S.id).run(); return json({ ok: true }); }
    if (M === 'DELETE') { await env.DB.batch([env.DB.prepare('DELETE FROM responses WHERE survey_id = ?').bind(S.id), env.DB.prepare('DELETE FROM surveys WHERE id = ?').bind(S.id), env.DB.prepare("UPDATE messages SET deleted = 1 WHERE kind = 'survey' AND thread = ?").bind(S.id)]); return json({ ok: true }); }
  }
  // المحادثات الخاصة مع الطالبات
  if (rest === 'dm' && M === 'GET') {
    const { results } = await env.DB.prepare("SELECT m.thread AS uid, MAX(m.id) AS last, MAX(CASE WHEN m.sender != 'admin' THEN m.id ELSE 0 END) AS lastIn, COUNT(*) AS n FROM messages m WHERE m.school = ? AND m.kind = 'dm' AND m.deleted = 0 GROUP BY m.thread ORDER BY last DESC LIMIT 300").bind(school).all();
    return json({ threads: results });
  }
  const dm = rest.match(/^dm\/([0-9a-f]{32})$/);
  if (dm) {
    const x = await own(dm[1]); if (!x || !isStu(x)) return json({ error: 'not_found' }, 404);
    if (M === 'GET') {
      const { results } = await env.DB.prepare("SELECT id, sender, sender_name, body, created FROM messages WHERE school = ? AND kind = 'dm' AND thread = ? AND deleted = 0 ORDER BY id DESC LIMIT 300").bind(school, x.id).all();
      return json({ items: results.reverse().map((m) => ({ ...m, mine: m.sender === 'admin' })) });
    }
    if (M === 'POST') {
      const text = clip(body.body, MAX_BODY); if (!text) return json({ error: 'empty' }, 400);
      const name = clip(body.from || 'الإدارة', 80);
      const r = await env.DB.prepare("INSERT INTO messages (school, kind, sender, sender_name, body, created, thread, grp) VALUES (?, 'dm', 'admin', ?, ?, ?, ?, 'student')").bind(school, name, text, now, x.id).run();
      if (x.chat && x.status === 'active') await queuePush(env, ctx, [x.id], '💬 ' + name, text, './#chat', send);
      return json({ ok: true, id: r.meta?.last_row_id });
    }
  }
  return json({ error: 'not_found' }, 404);
}

// ═════════════ 📝 الاستبيانات (1.9.0) ═════════════
const SV_TYPES = ['text', 'textarea', 'email', 'tel', 'number', 'date', 'select'];
function svFields(f) {
  return (Array.isArray(f) ? f : []).slice(0, 40).map((x, i) => ({
    id: /^[a-z0-9_]{1,20}$/i.test(x?.id || '') ? x.id : 'f' + i, label: clip(x?.label, 120), type: SV_TYPES.includes(x?.type) ? x.type : 'text',
    required: !!x?.required, options: x?.type === 'select' ? (Array.isArray(x.options) ? x.options : []).map((o) => clip(o, 80)).filter(Boolean).slice(0, 30) : undefined, map: clip(x?.map, 30),
  })).filter((x) => x.label);
}
const svPub = (S) => ({ id: S.id, title: S.title, intro: S.intro || '', fields: JSON.parse(S.fields || '[]'), target: S.target || '', public: !!S.public, open: !!S.open });
function svClean(S, data) {
  const out = {}, F = JSON.parse(S.fields || '[]');
  if (!data || typeof data !== 'object') return { error: 'bad_input' };
  for (const f of F) {
    let v = clip(data[f.id], f.type === 'textarea' ? 2000 : 300);
    if (f.type === 'select' && v && !(f.options || []).includes(v)) v = '';
    if (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { error: 'bad_email', field: f.id };
    if (f.required && !v) return { error: 'required', field: f.id };
    if (v) out[f.id] = v;
  }
  if (!Object.keys(out).length) return { error: 'empty' };
  return out;
}
// الرابط العام: /sv/<school>/<survey>?k=<مفتاح الرابط>
export async function surveyPublic(req, env, ctx, url, json) {
  if (!env.DB) return json({ error: 'no_db' }, 503);
  await schema(env.DB);
  const m = url.pathname.match(/^\/sv\/([0-9a-f]{32})\/([0-9a-f]{16})$/); if (!m) return json({ error: 'not_found' }, 404);
  const S = await env.DB.prepare('SELECT * FROM surveys WHERE id = ? AND school = ?').bind(m[2], m[1]).first();
  if (!S || !S.public) return json({ error: 'not_found' }, 404);
  if (req.method === 'GET') { if (url.searchParams.get('k') !== S.pkey) return json({ error: 'not_found' }, 404); return json({ survey: svPub(S) }); }
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body = {}; try { const t = await req.text(); if (t.length > 20000) return json({ error: 'too_large' }, 413); body = JSON.parse(t); } catch { return json({ error: 'bad_json' }, 400); }
  if (body.k !== S.pkey) return json({ error: 'not_found' }, 404);
  if (!S.open) return json({ error: 'closed' }, 403);
  const ip = req.headers.get('CF-Connecting-IP') || 'x', lk = `sl:${S.id}:${ip}`, n = Number((await env.DATA?.get(lk)) || 0);
  if (n >= 30) return json({ error: 'too_many' }, 429); // حد معقول لكل جهاز في الساعة
  const cnt = await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE survey_id = ?').bind(S.id).first();
  if (cnt.n >= 3000) return json({ error: 'full' }, 403);
  const data = svClean(S, body.data); if (data.error) return json(data, 400);
  await env.DB.prepare('INSERT INTO responses (survey_id, school, user_id, data, created) VALUES (?, ?, NULL, ?, ?)').bind(S.id, S.school, JSON.stringify(data), Date.now()).run();
  await env.DATA?.put(lk, String(n + 1), { expirationTtl: 3600 });
  return json({ ok: true });
}
