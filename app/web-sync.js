// ═════════════ ☁️ مزامنة نسخة الجوال مع OneDrive عبر الإنترنت (1.1.0) ═════════════
// تعمل فقط في نسخة الويب (الجوال)، لا في البرنامج المثبَّت على الكمبيوتر.
// تسجيل الدخول بحساب مايكروسوفت (OAuth 2.0 + PKCE لتطبيق صفحة واحدة)، ثم قراءة/كتابة الملفات نفسها
// التي يستخدمها الكمبيوتر: «بيانات المساعد الإداري/data.json» و«.../library/*» في جذر OneDrive.
// الرموز تُحفظ في الجهاز فقط. مايكروسوفت تطلب تجديد الدخول كل 24 ساعة لهذا النوع من التطبيقات،
// ويحاول البرنامج التجديد تلقائياً دون كتابة كلمة المرور ما دامت جلسة مايكروسوفت قائمة.
(function () {
  const IS_WEB = !window.madrasaNative && /^https?:$/.test(location.protocol);
  if (!IS_WEB) return;
  const CFG = window.WEB_CFG || {};
  const FOLDER = 'بيانات المساعد الإداري';
  const AUTH = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
  const SCOPES = 'Files.ReadWrite User.Read offline_access openid profile';
  const G = 'https://graph.microsoft.com/v1.0';
  const redirect = () => location.origin + location.pathname;
  const clientId = () => (localStorage.getItem('ms_client_id') || CFG.clientId || '').trim();
  const W = { auth: null, email: '', need: false, err: '' };

  // ───── PKCE ─────
  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const rand = (n = 48) => b64u(crypto.getRandomValues(new Uint8Array(n)));
  async function login(silent) {
    if (!clientId()) { toast('أدخلي «معرّف التطبيق» في إعدادات المزامنة أولاً', 'err'); return; }
    const verifier = rand(), state = rand(16);
    const challenge = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    localStorage.setItem('ms_pkce', JSON.stringify({ verifier, state, silent: !!silent, at: Date.now() }));
    const q = new URLSearchParams({ client_id: clientId(), response_type: 'code', redirect_uri: redirect(), response_mode: 'query', scope: SCOPES, code_challenge: challenge, code_challenge_method: 'S256', state });
    const hint = Sync.wantEmail?.() || W.email; if (hint) q.set('login_hint', hint);
    if (silent) q.set('prompt', 'none');
    else if (localStorage.getItem('ms_switch')) { q.set('prompt', 'select_account'); q.delete('login_hint'); localStorage.removeItem('ms_switch'); }
    location.assign(`${AUTH}/authorize?${q}`);
  }
  async function tokenRequest(body) {
    const r = await fetch(`${AUTH}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId(), scope: SCOPES, ...body }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description?.split('\r\n')[0] || j.error || 'HTTP ' + r.status);
    const now = Date.now();
    W.auth = { access: j.access_token, exp: now + (j.expires_in - 120) * 1000, refresh: j.refresh_token || W.auth?.refresh, rexp: j.refresh_token ? now + 23.5 * 3600e3 : W.auth?.rexp };
    await IDB.put('kv', 'msAuth', W.auth);
    return W.auth.access;
  }
  // عند العودة من صفحة مايكروسوفت
  async function handleRedirect() {
    const p = new URLSearchParams(location.search);
    if (!p.has('code') && !p.has('error')) return false;
    const saved = JSON.parse(localStorage.getItem('ms_pkce') || '{}');
    history.replaceState(null, '', redirect());
    localStorage.removeItem('ms_pkce');
    if (p.get('state') !== saved.state) { W.err = 'تعذّر التحقق من تسجيل الدخول؛ حاولي مرة أخرى'; return true; }
    if (p.has('error')) { if (saved.silent) W.need = true; else W.err = p.get('error_description') || p.get('error'); return true; }
    try { await tokenRequest({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirect(), code_verifier: saved.verifier }); W.need = false; }
    catch (e) { W.err = e.message; }
    return true;
  }
  async function token() {
    if (W.auth?.access && Date.now() < W.auth.exp) return W.auth.access;
    if (W.auth?.refresh && Date.now() < (W.auth.rexp || 0)) {
      try { return await tokenRequest({ grant_type: 'refresh_token', refresh_token: W.auth.refresh }); } catch { }
    }
    W.need = true; renderSyncBar();
    throw new Error('يلزم تجديد تسجيل الدخول');
  }
  async function gfetch(url, opt = {}) {
    const r = await fetch(url.startsWith('http') ? url : G + url, { ...opt, headers: { Authorization: 'Bearer ' + (await token()), ...(opt.headers || {}) } });
    if (r.status === 401) { W.auth.exp = 0; W.need = true; throw new Error('انتهت صلاحية الدخول'); }
    return r;
  }
  const pathOf = (...parts) => '/me/drive/root:/' + [FOLDER, ...parts].map(encodeURIComponent).join('/');
  async function download(rel) {
    const r = await gfetch(`${rel}?select=id,%40microsoft.graph.downloadUrl`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('OneDrive ' + r.status);
    const u = (await r.json())['@microsoft.graph.downloadUrl'];
    const d = await fetch(u); if (!d.ok) throw new Error('تنزيل ' + d.status);
    return d;
  }
  async function upload(rel, data) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/json' });
    if (blob.size <= 4 * 1024 * 1024) {
      const r = await gfetch(`${rel}:/content`, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type || 'application/octet-stream' } });
      if (!r.ok) throw new Error('رفع ' + r.status); return true;
    }
    const s = await gfetch(`${rel}:/createUploadSession`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }) });
    if (!s.ok) throw new Error('جلسة رفع ' + s.status);
    const url = (await s.json()).uploadUrl, step = 5 * 1024 * 1024; // من مضاعفات 320 كيلوبايت
    for (let i = 0; i < blob.size; i += step) {
      const part = blob.slice(i, Math.min(i + step, blob.size));
      const r = await fetch(url, { method: 'PUT', headers: { 'Content-Range': `bytes ${i}-${i + part.size - 1}/${blob.size}` }, body: part });
      if (!r.ok && r.status !== 202) throw new Error('رفع جزء ' + r.status);
    }
    return true;
  }
  SyncFS.graph = {
    readText: async (n) => { const d = await download(pathOf(n)); return d ? d.text() : null; },
    writeText: (n, t) => upload(pathOf(n), t),
    list: async (sub) => {
      const out = []; let u = `${pathOf(sub)}:/children?$select=name&$top=999`;
      while (u) { const r = await gfetch(u); if (r.status === 404) return out; if (!r.ok) throw new Error('OneDrive ' + r.status); const j = await r.json(); j.value.forEach((x) => out.push(x.name)); u = j['@odata.nextLink'] || null; }
      return out;
    },
    readBlob: async (sub, n) => { const d = await download(pathOf(sub, n)); return d ? d.blob() : null; },
    writeBlob: (sub, n, blob) => upload(pathOf(sub, n), blob),
  };

  // ───── ربطها بنظام المزامنة القائم ─────
  Sync.supported = () => true;
  Object.defineProperty(Sync, 'fs', { get() { return SyncFS.graph; }, configurable: true });
  Object.defineProperty(Sync, 'label', { get() { return 'OneDrive'; }, configurable: true });
  Sync.init = async function () {
    try {
      this.base = (await IDB.get('kv', 'syncBase')) || 0;
      W.auth = (await IDB.get('kv', 'msAuth')) || null;
      W.email = (await IDB.get('kv', 'msEmail')) || '';
      const back = await handleRedirect();
      if (!W.auth) { this.status = 'off'; renderSyncBar(); if (back && W.err) toast(W.err, 'err'); return; }
      // تجديد صامت عند انتهاء مدة الدخول (24 ساعة) دون كتابة كلمة المرور
      if (Date.now() >= (W.auth.rexp || 0) && !back && (await IDB.get('kv', 'msAuto')) !== false) { await IDB.put('kv', 'msAuto', false); return login(true); }
      await IDB.put('kv', 'msAuto', true);
      if (!W.email) { const me = await (await gfetch('/me?$select=mail,userPrincipalName')).json(); W.email = String(me.mail || me.userPrincipalName || '').toLowerCase(); await IDB.put('kv', 'msEmail', W.email); }
      const want = this.wantEmail();
      if (want && W.email && W.email !== want) { this.status = 'mismatch'; this.mismatch = { found: W.email }; renderSyncBar(); return; }
      this.status = 'on'; this.cfg = null; this.known = null;
      const first = back;
      const remote = await this.readRemote();
      if (first && remote && this.hasLocalData() && (remote.meta?.updatedAt || 0) > this.base) this.setConflict(remote);
      else if (first && remote) { await this.load(remote, true); toast('☁️ رُبط التطبيق بـ OneDrive وحُمّلت البيانات', 'ok'); }
      else await this.reconcile();
    } catch (e) { this.status = W.need ? 'off' : 'error'; this.error = e.message; }
    renderSyncBar(); if (typeof render === 'function' && db) render();
  };
  // قراءة صارمة: خطأ الشبكة ليس «لا توجد بيانات» — حتى لا تُكتب بيانات الجوال الفارغة فوق بيانات الكمبيوتر
  Sync.readRemote = async function () { const t = await SyncFS.graph.readText('data.json'); return t ? JSON.parse(t) : null; };
  const _check = Sync.check;
  Sync.check = async function () {
    if (this.status === 'error' && W.auth && !W.need && navigator.onLine !== false) this.status = 'on';
    return _check.call(this);
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Sync.check(); });
  window.addEventListener('online', () => Sync.check());
  const _renderBar = renderSyncBar;
  renderSyncBar = function () {
    const el = $('#syncBar'); if (!el) return;
    const bar = (ic, title, sub, btns) => `<div class="banner" style="margin:0 28px 10px;padding:10px 16px"><span>${ic}</span><div><b>${title}</b><div class="muted">${sub}</div></div><span class="spacer"></span>${btns}</div>`;
    if (Sync.conflict) return _renderBar();
    if (W.auth && W.need) el.innerHTML = bar('☁️', 'تجديد الدخول إلى OneDrive', 'تطلب مايكروسوفت تأكيد الدخول كل 24 ساعة.', '<button class="btn primary sm" data-act="msLogin">تجديد الآن</button>');
    else if (Sync.status === 'mismatch') el.innerHTML = bar('🔒', 'المزامنة متوقفة لحماية البيانات', `الحساب المسجّل <span dir="ltr">${esc(W.email)}</span> والمطلوب <span dir="ltr">${esc(Sync.wantEmail())}</span>.`, '<button class="btn sm primary" data-act="msSwitch">الدخول بالحساب الصحيح</button>');
    else if (Sync.status === 'error') el.innerHTML = bar('⚠️', 'تعذّرت المزامنة مع OneDrive', navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت؛ ستُستأنف المزامنة عند عودة الاتصال، وتعديلاتكِ محفوظة في الجوال.' : esc(Sync.error || ''), '<button class="btn sm primary" data-act="syncNow">إعادة المحاولة</button>');
    else el.innerHTML = '';
  };
  // بطاقة المزامنة في الإعدادات (نسخة الجوال)
  syncCard = function () {
    const on = Sync.status === 'on', mm = Sync.status === 'mismatch';
    return `<div class="card" style="grid-column:1/-1"><h3>☁️ المزامنة مع OneDrive</h3>
      <div class="muted" style="margin-bottom:10px">سجّلي الدخول بحساب مايكروسوفت نفسه المستخدم في كمبيوتر المدرسة، فتتطابق بيانات الجوال والكمبيوتر تلقائياً.</div>
      ${!clientId() ? `<div class="field"><label>معرّف التطبيق (Application ID)</label><input class="input" dir="ltr" id="msCid" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></div><button class="btn sm primary" data-act="msCid">حفظ</button>` : `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="chip ${on ? 'green' : mm ? 'red' : 'amber'}">${on ? 'تعمل ✓' : mm ? 'حساب غير مطابق' : W.auth ? (W.need ? 'تحتاج تجديد الدخول' : 'متوقفة') : 'غير مربوطة'}</span>${W.email ? `<span class="muted" dir="ltr">${esc(W.email)}</span>` : ''}</div>
      ${mm ? `<div style="color:var(--red);margin-top:8px">الحساب المسجّل ${esc(W.email)} ليس الحساب المطلوب ${esc(Sync.wantEmail())}. سجّلي الخروج ثم الدخول بالحساب الصحيح.</div>` : ''}
      ${Sync.error && !on ? `<div class="muted" style="margin-top:6px;color:var(--red)">${esc(Sync.error)}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${!W.auth || W.need || mm ? `<button class="btn primary" data-act="msLogin">🔐 ${W.auth ? 'تسجيل الدخول' : 'الدخول بحساب مايكروسوفت'}</button>` : `<button class="btn sm" data-act="syncNow">🔄 مزامنة الآن</button>`}${W.auth ? '<button class="btn sm danger" data-act="msLogout">تسجيل الخروج</button>' : ''}</div>`}</div>`;
  };
  Object.assign(ACTIONS, {
    msLogin: () => login(false),
    msLogout: () => confirmBox('تسجيل الخروج من OneDrive في هذا الجهاز؟ تبقى البيانات في الجوال.', async () => { W.auth = null; W.email = ''; await IDB.del('kv', 'msAuth'); await IDB.del('kv', 'msEmail'); Sync.status = 'off'; render(); }, 'نعم، سجّلي الخروج'),
    msSwitch: async () => { W.auth = null; W.email = ''; await IDB.del('kv', 'msAuth'); await IDB.del('kv', 'msEmail'); localStorage.setItem('ms_switch', '1'); login(false); },
    msCid: () => { const v = $('#msCid').value.trim(); if (!/^[0-9a-f-]{36}$/i.test(v)) return toast('المعرّف غير صحيح', 'err'); localStorage.setItem('ms_client_id', v); render(); },
  });
  // بطاقات خاصة ببرنامج الكمبيوتر لا معنى لها في الجوال (التحديث هنا تلقائي عند فتح التطبيق)
  const _setAfter = VIEWS.settings.after;
  VIEWS.settings.after = function () {
    [...$$('#view .card')].forEach((c) => { if (/التحديثات|الإدخال الصوتي/.test(c.querySelector('h3')?.textContent || '')) c.remove(); });
    return _setAfter?.call(this);
  };
  window.__webSync = W; // للاختبار
})();
