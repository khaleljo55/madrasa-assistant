// ═════════════ 📲 تطبيق «تواصل المدرسة» للمعلمات والإداريات (1.5.0) ═════════════
// يُفتح من رابط ترسله الأستاذة: …/staff/#s=<معرّف المدرسة>&r=<رابط الخادم>&n=<اسم المدرسة>
// كلمة المرور لا تغادر الجهاز: يُرسل ناتج PBKDF2 فقط.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = { get(k) { try { return JSON.parse(localStorage.getItem('staff:' + k)); } catch { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem('staff:' + k) : localStorage.setItem('staff:' + k, JSON.stringify(v)); } catch { } } };
const S = { cfg: LS.get('cfg'), tok: LS.get('tok'), user: LS.get('user'), pend: LS.get('pend'), tab: 'inbox', inbox: [], chat: [], open: null, authTab: 'login', busy: false, err: '' };
const RELAY_RE = /^(https:\/\/[a-z0-9.-]+\.workers\.dev|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)$/i;
const ROLE = { teacher: 'معلمة', admin: 'إدارية' };

// قراءة رابط المدرسة
(function readLink() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  const s = h.get('s'), r = (h.get('r') || '').replace(/\/+$/, '');
  if (/^[0-9a-f]{32}$/.test(s || '') && RELAY_RE.test(r)) {
    if (S.cfg && S.cfg.s !== s) { S.tok = null; S.user = null; LS.set('tok', null); LS.set('user', null); }
    S.cfg = { s, r, n: (h.get('n') || '').slice(0, 80) }; LS.set('cfg', S.cfg);
    history.replaceState(null, '', location.pathname);
  }
})();

const b64u = (u8) => { let s = ''; u8.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function passHash(username, pass) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 100000, salt: new TextEncoder().encode(`madrasa-staff:${S.cfg.s}:${username}`) }, key, 256);
  return b64u(new Uint8Array(bits));
}
async function api(path, opt = {}, auth = true) {
  let r;
  try { r = await fetch(S.cfg.r + path, { ...opt, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(auth && S.tok ? { Authorization: 'Bearer ' + S.tok } : {}) } }); }
  catch { throw new Error(navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : 'تعذّر الاتصال بالخادم'); }
  let j = {}; try { j = await r.json(); } catch { }
  if (r.status === 401 && auth && S.tok && path !== '/st/notes') { logout(true); throw new Error('انتهت الجلسة، سجّلي الدخول من جديد'); }
  if (!r.ok) { const e = new Error({ wrong: 'اسم المستخدم أو كلمة المرور غير صحيحة', taken: 'اسم المستخدم مستخدم من قبل، اختاري اسماً آخر', locked: 'محاولات كثيرة، انتظري ربع ساعة', no_school: 'رابط المدرسة غير صحيح', full: 'اكتمل عدد المستخدمات', no_db: 'الخدمة غير مفعّلة بعد في المدرسة', bad_input: 'تأكدي من البيانات' }[j.error] || 'حدث خطأ (' + r.status + ')'); e.code = j.error; throw e; }
  return j;
}
function toast(t, kind) { const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 3800); }
const fmt = (ms) => { const d = new Date(ms), now = new Date(); const same = d.toDateString() === now.toDateString(); return same ? d.toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('ar-SA-u-nu-latn', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' }); };
const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');

// ───── الشاشات ─────
function render() {
  const app = $('#app');
  if (!S.cfg) { app.innerHTML = `<div class="center"><div class="logo">💬</div><h1>تواصل المدرسة</h1><p class="muted">افتحي رابط التسجيل الذي أرسلته لكِ إدارة المدرسة.</p></div>`; return; }
  const school = S.cfg.n ? `<div class="school">${esc(S.cfg.n)}</div>` : '';
  if (!S.tok) {
    if (S.pend) { app.innerHTML = `<div class="center"><div class="logo">⏳</div><h1>طلبكِ قيد المراجعة</h1>${school}<p class="muted">أرسلنا طلب عضويتكِ باسم المستخدم <b dir="ltr">${esc(S.pend.username)}</b>. ستتمكنين من الدخول فور قبوله من إدارة المدرسة.</p><button class="btn primary" data-act="checkPend">تحققي الآن</button><button class="btn link" data-act="cancelPend">الدخول بحساب آخر</button>${S.err ? `<p class="err">${esc(S.err)}</p>` : ''}</div>`; return; }
    const reg = S.authTab === 'reg';
    app.innerHTML = `<div class="auth"><div class="logo">💬</div><h1>تواصل المدرسة</h1>${school}
      <div class="seg"><button class="${!reg ? 'on' : ''}" data-act="authTab" data-id="login">الدخول</button><button class="${reg ? 'on' : ''}" data-act="authTab" data-id="reg">تسجيل جديد</button></div>
      <form id="authForm" autocomplete="on">
        ${reg ? `<label>الاسم الكامل<input name="name" required minlength="3" maxlength="80" autocomplete="name"></label>
        <label>الصفة<select name="role" required><option value="">اختاري…</option><option value="teacher">معلمة</option><option value="admin">إدارية</option></select></label>
        <label>رقم الجوال (اختياري)<input name="phone" type="tel" dir="ltr" inputmode="tel" maxlength="15" autocomplete="tel"></label>` : ''}
        <label>اسم المستخدم (بالإنجليزي)<input name="username" required dir="ltr" autocapitalize="none" autocomplete="username" pattern="[A-Za-z0-9._\\-]{3,40}" placeholder="مثال: noura.s"></label>
        <label>كلمة المرور<input name="pass" type="password" required minlength="6" dir="ltr" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
        ${reg ? '<label>تأكيد كلمة المرور<input name="pass2" type="password" required minlength="6" dir="ltr" autocomplete="new-password"></label>' : ''}
        <button class="btn primary" type="submit" ${S.busy ? 'disabled' : ''}>${S.busy ? '⏳' : reg ? 'إرسال طلب العضوية' : 'دخول'}</button>
        ${S.err ? `<p class="err">${esc(S.err)}</p>` : ''}
        ${reg ? '<p class="muted small">يُراجع طلبكِ من إدارة المدرسة قبل التفعيل.</p>' : ''}
      </form></div>`;
    return;
  }
  const unread = S.inbox.filter((m) => !m.read_at).length;
  const tabs = [['inbox', '📬', 'الرسائل', unread], ...(S.user?.chat ? [['chat', '💬', 'المحادثة', 0]] : []), ['me', '👤', 'حسابي', 0]];
  if (!tabs.some((t) => t[0] === S.tab)) S.tab = 'inbox';
  let body = '';
  if (S.tab === 'inbox') body = S.inbox.length ? `<div class="list">${S.inbox.map((m) => `<div class="msg ${m.read_at ? '' : 'new'} ${S.open === m.id ? 'open' : ''}" data-act="openMsg" data-id="${m.id}"><div class="mh"><b>${esc(m.title || 'رسالة')}</b><span class="t">${fmt(m.created)}</span></div><div class="from">${esc(m.sender_name)}</div><div class="mb">${S.open === m.id ? linkify(m.body) : esc(String(m.body).slice(0, 120))}</div></div>`).join('')}</div>` : '<div class="empty">📭<p>لا رسائل بعد</p></div>';
  else if (S.tab === 'chat') body = `<div class="chat" id="chatBox">${S.chat.length ? S.chat.map((m) => `<div class="bub ${m.mine ? 'mine' : ''} ${m.sender === 'admin' ? 'adm' : ''}">${m.mine ? '' : `<div class="who">${esc(m.sender_name)}</div>`}<div>${linkify(m.body)}</div><div class="t">${fmt(m.created)}</div></div>`).join('') : '<div class="empty">💬<p>ابدئي المحادثة</p></div>'}</div>
    <form id="chatForm" class="chat-in"><textarea name="body" rows="1" maxlength="4000" placeholder="اكتبي رسالة…" required></textarea><button class="btn primary" type="submit">إرسال</button></form>`;
  else body = `<div class="card"><h3>${esc(S.user?.name || '')}</h3><p class="muted">${ROLE[S.user?.role] || ''} · <span dir="ltr">${esc(S.user?.username || '')}</span></p></div>
    <div class="card" id="pushCard"><h3>🔔 الإشعارات</h3><div id="pushState" class="muted">…</div></div>
    <div class="card"><h3>🔑 تغيير كلمة المرور</h3><form id="passForm"><label>كلمة المرور الجديدة<input name="pass" type="password" minlength="6" required dir="ltr" autocomplete="new-password"></label><button class="btn" type="submit">حفظ</button></form></div>
    <button class="btn danger wide" data-act="logout">تسجيل الخروج</button>`;
  app.innerHTML = `<header><div><b>تواصل المدرسة</b>${S.cfg.n ? `<span>${esc(S.cfg.n)}</span>` : ''}</div></header>
    <main>${body}</main>
    <nav>${tabs.map(([k, ic, l, n]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-id="${k}"><span class="ic">${ic}${n ? `<i>${n}</i>` : ''}</span>${l}</button>`).join('')}</nav>`;
  if (S.tab === 'chat') { const c = $('#chatBox'); if (c) c.scrollTop = c.scrollHeight; }
  if (S.tab === 'me') pushState();
}

// ───── البيانات ─────
async function loadInbox() { const j = await api('/st/inbox'); S.inbox = j.items || []; if (j.user) { S.user = j.user; LS.set('user', S.user); } }
async function loadChat() { if (!S.user?.chat) { S.chat = []; return; } try { S.chat = (await api('/st/chat')).items || []; } catch (e) { if (e.code === 'no_chat') { S.user.chat = false; S.chat = []; } else throw e; } }
async function refresh(quiet) {
  if (!S.tok) return;
  const before = JSON.stringify([S.inbox.map((m) => m.id + ':' + !!m.read_at), S.chat.length, S.user?.chat]);
  try { await loadInbox(); if (S.tab === 'chat' || !quiet) await loadChat(); } catch (e) { if (!quiet) toast(e.message, 'err'); return; }
  const after = JSON.stringify([S.inbox.map((m) => m.id + ':' + !!m.read_at), S.chat.length, S.user?.chat]);
  if (!quiet || before !== after) { const typing = document.activeElement?.name === 'body' ? document.activeElement.value : null; render(); if (typing) { const t = $('#chatForm textarea'); if (t) { t.value = typing; t.focus(); } } }
}
function logout(silent) {
  if (S.tok && !silent) api('/st/logout', { method: 'POST' }).catch(() => { });
  S.tok = null; S.user = null; S.inbox = []; S.chat = []; LS.set('tok', null); LS.set('user', null);
  caches.delete('staff-push').catch(() => { }); render();
}
async function doLogin(username, pass) {
  const j = await api(`/st/${S.cfg.s}/login`, { method: 'POST', body: JSON.stringify({ username, pass }) }, false);
  if (j.status === 'pending') return 'pending';
  if (j.status === 'disabled') throw new Error('الحساب موقوف، تواصلي مع إدارة المدرسة');
  S.tok = j.token; S.user = j.user; LS.set('tok', S.tok); LS.set('user', S.user); S.pend = null; LS.set('pend', null);
  await savePushCfg(); await refresh(false);
  return 'ok';
}

// ───── الإشعارات ─────
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
async function savePushCfg() { try { await (await caches.open('staff-push')).put('cfg', new Response(JSON.stringify({ url: S.cfg.r, tok: S.tok }))); } catch { } }
async function pushState() {
  const el = $('#pushState'); if (!el) return;
  if (isIOS() && !standalone()) { el.innerHTML = 'لتصلكِ الإشعارات: اضغطي زر المشاركة ⬆️ ثم «إضافة إلى الشاشة الرئيسية»، وافتحي التطبيق من الأيقونة.'; return; }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { el.textContent = 'هذا المتصفح لا يدعم الإشعارات.'; return; }
  const reg = await navigator.serviceWorker.getRegistration('./'), sub = reg && await reg.pushManager.getSubscription();
  el.innerHTML = sub && Notification.permission === 'granted' ? '<span class="ok">✓ الإشعارات مفعّلة في هذا الجوال</span>' : '<button class="btn primary" data-act="pushOn">🔔 تفعيل الإشعارات</button>';
}
async function pushOn() {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return toast('لم تُسمح الإشعارات. فعّليها من إعدادات الجوال', 'err');
    const reg = await navigator.serviceWorker.ready;
    const { key } = await (await fetch(S.cfg.r + '/push/key', { cache: 'no-store' })).json();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
    await api('/st/sub', { method: 'PUT', body: JSON.stringify({ endpoint: sub.endpoint }) });
    await savePushCfg();
    toast('✓ تفعّلت الإشعارات', 'ok'); pushState();
  } catch (e) { toast('تعذّر التفعيل: ' + e.message, 'err'); }
}

// ───── الأحداث ─────
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  if (a === 'authTab') { S.authTab = id; S.err = ''; render(); }
  if (a === 'tab') { S.tab = id; S.open = null; render(); if (id === 'chat') refresh(true).then(() => { loadChat().then(render).catch(() => { }); }); }
  if (a === 'openMsg') {
    const m = S.inbox.find((x) => String(x.id) === id); if (!m) return;
    S.open = S.open === m.id ? null : m.id;
    if (!m.read_at) { m.read_at = Date.now(); api('/st/read', { method: 'POST', body: JSON.stringify({ ids: [m.id] }) }).catch(() => { }); }
    render();
  }
  if (a === 'logout') { if (confirm('تسجيل الخروج من هذا الجوال؟')) logout(); }
  if (a === 'pushOn') pushOn();
  if (a === 'checkPend') { S.err = ''; try { const r = await doLogin(S.pend.username, S.pend.pass); if (r === 'pending') { S.err = 'ما زال الطلب قيد المراجعة'; render(); } } catch (err) { S.err = err.message; render(); } }
  if (a === 'cancelPend') { S.pend = null; LS.set('pend', null); S.authTab = 'login'; render(); }
});
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, d = Object.fromEntries(new FormData(f));
  if (f.id === 'authForm') {
    const reg = S.authTab === 'reg', username = String(d.username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) { S.err = 'اسم المستخدم بالأحرف الإنجليزية والأرقام فقط (3 أحرف فأكثر)'; return render(); }
    if (reg && d.pass !== d.pass2) { S.err = 'كلمتا المرور غير متطابقتين'; return render(); }
    S.busy = true; S.err = ''; render();
    try {
      const pass = await passHash(username, String(d.pass));
      if (reg) {
        await api(`/st/${S.cfg.s}/register`, { method: 'POST', body: JSON.stringify({ username, pass, name: String(d.name).trim(), role: d.role, phone: d.phone }) }, false);
        S.pend = { username, pass }; LS.set('pend', S.pend);
      } else if ((await doLogin(username, pass)) === 'pending') { S.pend = { username, pass }; LS.set('pend', S.pend); }
    } catch (err) { S.err = err.message; }
    S.busy = false; render();
  }
  if (f.id === 'chatForm') {
    const t = String(d.body || '').trim(); if (!t) return;
    f.querySelector('button').disabled = true;
    try { await api('/st/chat', { method: 'POST', body: JSON.stringify({ body: t }) }); await loadChat(); render(); } catch (err) { toast(err.message, 'err'); f.querySelector('button').disabled = false; }
  }
  if (f.id === 'passForm') {
    try { await api('/st/pass', { method: 'POST', body: JSON.stringify({ pass: await passHash(S.user.username, String(d.pass)) }) }); toast('✓ تغيّرت كلمة المرور', 'ok'); f.reset(); } catch (err) { toast(err.message, 'err'); }
  }
});
document.addEventListener('keydown', (e) => { if (e.target.name === 'body' && e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); e.target.form.requestSubmit(); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(true); });
function goHash(h) {
  h = String(h || location.hash);
  if (/#chat/.test(h) && S.user?.chat) { S.tab = 'chat'; loadChat().then(render).catch(() => { }); }
  const m = h.match(/#m(\d+)/); if (m) { S.tab = 'inbox'; S.open = Number(m[1]); const x = S.inbox.find((i) => i.id === S.open); if (x && !x.read_at) { x.read_at = Date.now(); api('/st/read', { method: 'POST', body: JSON.stringify({ ids: [x.id] }) }).catch(() => { }); } }
  if (/#(chat|m\d+)/.test(location.hash)) history.replaceState(null, '', location.pathname);
  render();
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => { });
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.go) refresh(true).then(() => goHash(e.data.go)); });
}
render();
if (S.tok) refresh(false).then(() => goHash());
else if (S.pend && S.cfg) doLogin(S.pend.username, S.pend.pass).catch(() => { }).finally(render);
setInterval(() => { if (document.visibilityState !== 'visible') return; if (S.tok) refresh(true); else if (S.pend && S.cfg) doLogin(S.pend.username, S.pend.pass).then(render).catch(() => { }); }, 20000);
