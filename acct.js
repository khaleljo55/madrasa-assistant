// ═════════════ 🔑 حساب المدرسة: الدخول من أي جهاز ببريد وكلمة مرور (1.8.0) ═════════════
// بدل «رمز الربط»: يُشفَّر مفتاح المزامنة بكلمة المرور داخل الجهاز (PBKDF2 بـ 200 ألف دورة ثم AES-GCM)،
// ويُحفظ مشفّراً في الخادم مع «مُحقِّق» مشتق من كلمة المرور. عند الدخول من جهاز جديد يُجلب ويُفك هنا فقط،
// ثم ينضم الجهاز إلى بيانات المدرسة نفسها (مع خيار الدمج إن كان فيه بيانات). الخادم لا يرى كلمة المرور ولا البيانات.
// ويمنع إنشاء «مدرسة جديدة» بالخطأ: إن وُجد حساب للبريد نفسه، يُطلب الدخول بدل الإنشاء.
const AC = { exists: null, checking: false, busy: false };
const acUrl = () => (RELAY.cfg?.url || Sync.appCfg?.syncRelay || window.MADRASA_RELAY || '').replace(/\/+$/, '');
const acNorm = (e) => String(e || '').trim().toLowerCase();
const acEmail = () => acNorm(db.settings.acctEmail || Sync.wantEmail() || '');
async function acDerive(email, pass) {
  email = acNorm(email);
  const aid = rlHex(await rlSha('madrasa-acct-id:' + email)).slice(0, 32);
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 200000, salt: new TextEncoder().encode('madrasa-acct:' + email) }, base, 512));
  const key = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { aid, key, v: rlB64u(bits.slice(32)) };
}
async function acFetch(path, opt = {}) {
  const u = acUrl(); if (!RL_URL.test(u)) throw new Error('رابط خادم المزامنة غير معروف في هذا الجهاز');
  let r; try { r = await fetch(u + path, { ...opt, cache: 'no-store', headers: { 'Content-Type': 'application/json' } }); } catch { throw new Error(navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : 'تعذّر الوصول إلى الخادم'); }
  let j = {}; try { j = await r.json(); } catch { }
  if (!r.ok) { const e = new Error({ no_account: 'لا يوجد حساب مدرسة بهذا البريد', wrong: 'كلمة المرور غير صحيحة', locked: 'محاولات كثيرة، انتظري ربع ساعة ثم أعيدي المحاولة', other_school: 'هذا البريد مرتبط بحساب مدرسة آخر', forbidden: 'هذا الجهاز لا يملك صلاحية تعديل الحساب' }[j.error] || (r.status === 404 ? 'يلزم تحديث خادم المزامنة (Setup-Cloud-Sync.bat)' : 'خطأ من الخادم ' + r.status)); e.code = j.error; throw e; }
  return j;
}
async function acCheck(email = acEmail()) {
  if (!email || AC.checking || !RL_URL.test(acUrl())) return null;
  AC.checking = true;
  try { const { aid } = { aid: rlHex(await rlSha('madrasa-acct-id:' + acNorm(email))).slice(0, 32) }; AC.exists = (await acFetch('/acct/' + aid)).exists; } catch { AC.exists = null; }
  AC.checking = false; return AC.exists;
}
// إنشاء الحساب أو تغيير كلمة المرور (من جهاز مرتبط فقط)
async function acSet(email, pass) {
  const { aid, key, v } = await acDerive(email, pass);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify({ u: RELAY.cfg.url, k: RELAY.cfg.k }))));
  const blob = new Uint8Array(12 + ct.length); blob.set(iv); blob.set(ct, 12);
  await acFetch('/acct/' + aid, { method: 'PUT', body: JSON.stringify({ v, blob: rlB64u(blob), ch: RELAY.id, tok: RELAY.tok }) });
  db.settings.acctEmail = acNorm(email); commit(false); AC.exists = true;
}
// الدخول من جهاز جديد
async function acLogin(email, pass) {
  const { aid, key, v } = await acDerive(email, pass);
  const { blob } = await acFetch(`/acct/${aid}/login`, { method: 'POST', body: JSON.stringify({ v }) });
  const u8 = rlUnb64u(blob);
  let cfg; try { cfg = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(0, 12) }, key, u8.slice(12)))); } catch { throw new Error('تعذّر فتح الحساب'); }
  const c = rlParse(rlCode({ url: cfg.u, k: cfg.k })); if (!c) throw new Error('بيانات الحساب غير صالحة');
  await rlJoin(c, 'manual');
  db.settings.acctEmail = acNorm(email); if (!Sync.conflict) commit(false);
}

function acModal(mode) {
  const set = mode === 'set', em = acEmail();
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal" style="width:460px"><div class="modal-h"><h2>${set ? '🔑 كلمة مرور حساب المدرسة' : '🔑 الدخول بحساب المدرسة'}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b"><div class="muted" style="margin-bottom:12px">${set ? 'بهذا البريد وكلمة المرور تدخلين من أي جهاز يُثبَّت عليه البرنامج (كمبيوتر أو جوال)، فتظهر بياناتكِ كاملة. كلمة المرور لا تُرسل لأي جهة، وتُستخدم لفتح مفتاح بياناتكِ داخل الجهاز فقط.' : 'أدخلي بريد حساب المدرسة وكلمة المرور، فتظهر بياناتكِ هنا وتتزامن مع أجهزتكِ الأخرى. إن كان في هذا الجهاز بيانات، يمكنكِ دمجها.'}</div>
      <form class="form" id="acForm" autocomplete="on"><div class="field full"><label>البريد الإلكتروني</label><input class="input" name="email" type="email" dir="ltr" required value="${esc(em)}" autocomplete="username"></div>
      <div class="field full"><label>كلمة المرور</label><input class="input" name="pass" type="password" dir="ltr" required minlength="8" autocomplete="${set ? 'new-password' : 'current-password'}"></div>
      ${set ? '<div class="field full"><label>تأكيد كلمة المرور</label><input class="input" name="pass2" type="password" dir="ltr" required minlength="8" autocomplete="new-password"></div><div class="muted" style="font-size:12.5px">8 أحرف أو أرقام على الأقل. إن نسيتِها، أنشئي كلمة جديدة من أي جهاز مرتبط.</div>' : ''}
      <div id="acErr" style="color:var(--red);font-weight:600"></div></form></div>
    <div class="modal-f"><button class="btn primary" data-act="acGo" data-id="${mode}">${set ? 'حفظ' : 'دخول'}</button><button class="btn" data-act="modalClose">إلغاء</button></div></div></div>`;
  modalCtx = { acMode: mode };
  setTimeout(() => $('#acForm [name=' + (em ? 'pass' : 'email') + ']')?.focus(), 40);
}
Object.assign(ACTIONS, {
  acLoginOpen: () => acModal('login'),
  acSetOpen: () => acModal('set'),
  acGo: async (el) => {
    const f = $('#acForm'), email = acNorm(f.email.value), pass = f.pass.value, err = $('#acErr');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return (err.textContent = 'البريد غير صحيح');
    if (pass.length < 8) return (err.textContent = 'كلمة المرور 8 أحرف على الأقل');
    if (el.dataset.id === 'set' && pass !== f.pass2.value) return (err.textContent = 'كلمتا المرور غير متطابقتين');
    el.disabled = true; el.textContent = '⏳'; err.textContent = '';
    try {
      if (el.dataset.id === 'set') { await acSet(email, pass); closeModal(); toast('✓ صار بإمكانكِ الدخول من أي جهاز بهذا البريد وكلمة المرور', 'ok'); render(); }
      else { el.textContent = '⏳ جارٍ الدخول…'; await acLogin(email, pass); closeModal(); toast(Sync.conflict ? 'في هذا الجهاز بيانات أيضاً: اختاري «دمج البيانات» من الشريط أعلى الصفحة' : '✓ تم الدخول وحُمّلت بياناتكِ', 'ok'); render(); }
    } catch (e) { if ($('#acErr')) { $('#acErr').textContent = e.message; el.disabled = false; el.textContent = el.dataset.id === 'set' ? 'حفظ' : 'دخول'; } else toast(e.message, 'err'); }
  },
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.closest?.('#acForm')) { e.preventDefault(); $('[data-act=acGo]')?.click(); } });

// منع إنشاء مدرسة جديدة بالخطأ: إن وُجد حساب للبريد المطلوب، يُطلب الدخول
const _acCreate = ACTIONS.rlCreate;
ACTIONS.rlCreate = async (...a) => {
  const em = acEmail();
  if (em && (await acCheck(em))) { toast('يوجد حساب مدرسة لهذا البريد: سجّلي الدخول به بدل إنشاء حساب جديد', 'err'); return acModal('login'); }
  await _acCreate(...a);
  if (rlOn()) setTimeout(() => acModal('set'), 300);
};

// بطاقة المزامنة: الدخول أولاً، وكلمة المرور للأجهزة المرتبطة
const _acCard = relayCard;
relayCard = function () {
  const html = _acCard();
  if (rlOn()) {
    const has = !!db.settings.acctEmail;
    return html.replace('<div class="muted" style="margin-top:8px">البيانات تُشفَّر', `<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${has ? `<span class="chip green">🔑 الدخول من أي جهاز: <span dir="ltr">${esc(db.settings.acctEmail)}</span></span><button class="btn sm" data-act="acSetOpen">تغيير كلمة المرور</button>` : '<span class="chip amber">🔑 لم تُنشأ كلمة مرور الدخول بعد</span><button class="btn sm primary" data-act="acSetOpen">إنشاء كلمة مرور للدخول من أي جهاز</button>'}</div>
      <div class="muted" style="margin-top:8px">البيانات تُشفَّر`);
  }
  return html.replace('<h3>🔐 المزامنة المشفّرة (الكمبيوتر والجوال)</h3>', `<h3>🔐 المزامنة المشفّرة (الكمبيوتر والجوال)</h3>
    <div class="banner brand" style="margin-bottom:12px"><span class="big">🔑</span><div><b>الدخول بحساب المدرسة</b><div class="muted">إن كان للمدرسة حساب (من جهاز آخر)، ادخلي ببريده وكلمة مروره.</div></div><span class="spacer"></span><button class="btn primary" data-act="acLoginOpen">دخول</button></div>`);
};
// أعلى الصفحة في جهاز غير مرتبط: دعوة واضحة للدخول
const _acBar = renderSyncBar;
renderSyncBar = function () {
  _acBar();
  const el = $('#syncBar'); if (!el || !db || rlOn() || Sync.conflict || AC.hide || (!IS_WEBAPP && Sync.status === 'on')) return;
  el.insertAdjacentHTML('beforeend', `<div class="banner brand" style="margin:0 28px 10px;padding:10px 16px;flex-wrap:wrap"><span class="big">🔑</span><div><b>ادخلي بحساب المدرسة لتظهر بياناتكِ هنا</b><div class="muted">بالبريد وكلمة المرور نفسيهما من أي جهاز، دون رمز ربط.</div></div><span class="spacer"></span><button class="btn primary sm" data-act="acLoginOpen">🔑 تسجيل الدخول</button><button class="btn sm" data-act="acHide">لاحقاً</button></div>`);
};
ACTIONS.acHide = () => { AC.hide = true; renderSyncBar(); };
// جهاز مرتبط بلا كلمة مرور بعد: تذكير لطيف مرة في الإعدادات (يظهر في البطاقة)، ومعرفة وجود الحساب مسبقاً
(function acStart() { if (!db || typeof RELAY === 'undefined') return setTimeout(acStart, 600); renderSyncBar(); setTimeout(() => acCheck().then(() => { if (ui.view === 'settings') render(); }), 4000); })();
