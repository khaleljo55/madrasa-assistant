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
  const u = await rlBestUrl(acUrl()); if (!RL_URL.test(u)) throw new Error('رابط خادم المزامنة غير معروف في هذا الجهاز');
  let r; try { r = await fetch(u + path, { ...opt, cache: 'no-store', headers: { 'Content-Type': 'application/json' } }); } catch { throw new Error(navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : 'تعذّر الوصول إلى الخادم'); }
  let j = {}; try { j = await r.json(); } catch { }
  if (!r.ok) { const e = new Error({ no_account: 'لا يوجد حساب مدرسة بهذا البريد', wrong: 'كلمة المرور غير صحيحة', locked: 'محاولات كثيرة، انتظري ربع ساعة ثم أعيدي المحاولة', other_school: 'هذا البريد مرتبط بحساب مدرسة آخر', forbidden: 'هذا الجهاز لا يملك صلاحية تعديل الحساب' }[j.error] || (r.status === 404 ? 'يلزم تحديث خادم المزامنة (Setup-Cloud-Sync.bat)' : 'خطأ من الخادم ' + r.status)); e.code = j.error; throw e; }
  return j;
}
async function acCheck(email = acEmail()) {
  if (!email || AC.checking || !RL_URL.test(acUrl())) return null;
  AC.checking = true;
  try { const aid = rlHex(await rlSha('madrasa-acct-id:' + acNorm(email))).slice(0, 32), r = await acFetch('/acct/' + aid); AC.exists = r.exists; AC.ch = r.ch || ''; AC.recovery = !!r.recovery; } catch { AC.exists = null; }
  AC.checking = false; return AC.exists;
}
// إنشاء الحساب أو تغيير كلمة المرور (من جهاز مرتبط فقط)
async function acSet(email, pass) {
  const { aid, key, v } = await acDerive(email, pass);
  await acFetch('/acct/' + aid, { method: 'PUT', body: JSON.stringify({ v, blob: await acSeal(key), ch: RELAY.id, tok: RELAY.tok }) });
  db.settings.acctEmail = acNorm(email); commit(false); AC.exists = true;
}
// الدخول من جهاز جديد
async function acLogin(email, pass) {
  const { aid, key, v } = await acDerive(email, pass);
  const { blob } = await acFetch(`/acct/${aid}/login`, { method: 'POST', body: JSON.stringify({ v }) });
  return acJoin(email, await acOpen(blob, key));
}
async function acOpen(blob, key) {
  const u8 = rlUnb64u(blob);
  try { return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(0, 12) }, key, u8.slice(12)))); } catch { throw new Error('تعذّر فتح الحساب'); }
}
async function acSeal(key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify({ u: RELAY.cfg.url, k: RELAY.cfg.k }))));
  const blob = new Uint8Array(12 + ct.length); blob.set(iv); blob.set(ct, 12); return rlB64u(blob);
}
async function acJoin(email, cfg) {
  const c = rlParse(rlCode({ url: cfg.u, k: cfg.k })); if (!c) throw new Error('بيانات الحساب غير صالحة');
  const had = Sync.hasLocalData();
  await rlJoin(c, 'manual');
  AC.ch = RELAY.id; AC.exists = true;
  // في الجهاز بيانات أيضاً: تُدمج تلقائياً (مع نسخة احتياطية قبلها) حتى لا يضيع شيء من الجهازين
  for (let i = 0; i < 100 && typeof MG !== 'undefined' && MG.busy; i++) await new Promise((r) => setTimeout(r, 100));
  if (Sync.conflict) await ACTIONS.syncMerge();
  if (had) { db.settings.acctEmail = acNorm(email); commit(false); return 'merged'; }
  db.settings.acctEmail = acNorm(email); commit(false); return 'loaded';
}
// إنشاء حساب المدرسة من هذا الجهاز (أول جهاز فقط)
async function acCreate(email, pass) {
  if (await acCheck(email)) throw Object.assign(new Error('يوجد حساب مدرسة بهذا البريد، سجّلي الدخول به'), { code: 'exists' });
  db.settings.acctEmail = acNorm(email);
  Sync.appCfg = { ...(Sync.appCfg || {}), syncRelay: Sync.appCfg?.syncRelay || window.MADRASA_RELAY || '' };
  AC.creating = true;
  try { await _acCreate(); } finally { AC.creating = false; }
  if (!rlOn()) throw new Error('تعذّر إنشاء الحساب، تأكدي من الإنترنت');
  closeModal(); await acSet(email, pass); AC.ch = RELAY.id;
}

function acModal(mode) {
  const set = mode === 'set', em = acEmail();
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal" style="width:460px"><div class="modal-h"><h2>${set ? '🔑 كلمة مرور حساب المدرسة' : '🔑 الدخول بحساب المدرسة'}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b"><div class="muted" style="margin-bottom:12px">${set ? 'بهذا البريد وكلمة المرور تدخلين من أي جهاز يُثبَّت عليه البرنامج (كمبيوتر أو جوال)، فتظهر بياناتكِ كاملة. كلمة المرور لا تُرسل لأي جهة، وتُستخدم لفتح مفتاح بياناتكِ داخل الجهاز فقط.' : 'أدخلي بريد حساب المدرسة وكلمة المرور، فتظهر بياناتكِ هنا وتتزامن مع أجهزتكِ الأخرى. إن كان في هذا الجهاز بيانات، يمكنكِ دمجها.'}</div>
      <form class="form" id="acForm" autocomplete="on"><div class="field full"><label>البريد الإلكتروني</label><input class="input" name="email" type="email" dir="ltr" required value="${esc(em)}" autocomplete="username"></div>
      <div class="field full"><label>كلمة المرور</label><input class="input" name="pass" type="password" dir="ltr" required minlength="8" autocomplete="${set ? 'new-password' : 'current-password'}"></div>
      ${set ? '<div class="field full"><label>تأكيد كلمة المرور</label><input class="input" name="pass2" type="password" dir="ltr" required minlength="8" autocomplete="new-password"></div><div class="muted" style="font-size:12.5px">8 أحرف أو أرقام على الأقل. إن نسيتِها، أنشئي كلمة جديدة من أي جهاز مرتبط.</div>' : ''}
      <div id="acErr" style="color:var(--red);font-weight:600"></div></form></div>
    <div class="modal-f"><button class="btn primary" data-act="acGo" data-id="${mode}">${set ? 'حفظ' : 'دخول'}</button><button class="btn" data-act="modalClose">إلغاء</button>${set ? '' : '<span class="spacer"></span><button class="btn sm" data-act="acForgot" style="border:0;color:var(--muted)">نسيت كلمة المرور؟</button>'}</div></div></div>`;
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
      if (el.dataset.id === 'set') { const first = !AC.recovery; await acSet(email, pass); render(); if (first) await acRecoveryNew(email, true); else { closeModal(); toast('✓ صار بإمكانكِ الدخول من أي جهاز بهذا البريد وكلمة المرور', 'ok'); } }
      else if (el.dataset.id === 'create') { el.textContent = '⏳ جارٍ الإنشاء…'; await acCreate(email, pass); render(); await acRecoveryNew(email, true); }
      else { el.textContent = '⏳ جارٍ الدخول…'; const r = await acLogin(email, pass); closeModal(); toast(r === 'merged' ? '🔀 تم الدخول ودُمجت بيانات هذا الجهاز مع بيانات الحساب، دون أن يضيع شيء' : '✓ تم الدخول وحُمّلت بياناتكِ', 'ok'); render(); }
    } catch (e) {
      if (!$('#acErr')) return toast(e.message, 'err');
      $('#acErr').innerHTML = esc(e.message) + (e.code === 'no_account' ? `<div style="margin-top:10px;color:var(--ink);font-weight:400">إن كان هذا أول جهاز للمدرسة، أنشئي الحساب الآن بهذا البريد وكلمة المرور:</div><button class="btn primary sm" style="margin-top:6px" data-act="acGo" data-id="create">✨ إنشاء حساب المدرسة</button>` : '');
      el.disabled = false; el.textContent = el.dataset.id === 'set' ? 'حفظ' : el.dataset.id === 'create' ? '✨ إنشاء حساب المدرسة' : 'دخول';
    }
  },
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.closest?.('#acForm')) { e.preventDefault(); $('[data-act=acGo]')?.click(); } });

// منع إنشاء مدرسة جديدة بالخطأ: إن وُجد حساب للبريد المطلوب، يُطلب الدخول
const _acCreate = ACTIONS.rlCreate;
ACTIONS.rlCreate = async (...a) => {
  const em = acEmail();
  if (em && (await acCheck(em))) { toast('يوجد حساب مدرسة لهذا البريد: سجّلي الدخول به بدل إنشاء حساب جديد', 'err'); return acModal('login'); }
  await _acCreate(...a);
  if (rlOn() && !AC.creating) setTimeout(() => acModal('set'), 300);
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
  const el = $('#syncBar'); if (!el || !db || Sync.conflict || AC.hide) return;
  const other = rlOn() && AC.exists && AC.ch && AC.ch !== RELAY.id; // هذا الجهاز على حساب منفصل قديم، والحساب الأساسي في جهاز آخر
  if (!other && (rlOn() || (!IS_WEBAPP && Sync.status === 'on' && !AC.exists))) return;
  el.insertAdjacentHTML('beforeend', `<div class="banner brand" style="margin:0 28px 10px;padding:10px 16px;flex-wrap:wrap"><span class="big">🔑</span><div><b>${other || (mgCount(db) > 0 && AC.exists) ? 'ادخلي بحساب المدرسة لدمج بيانات هذا الجهاز مع بياناتكِ الأساسية' : 'ادخلي بحساب المدرسة لتظهر بياناتكِ هنا'}</b><div class="muted">${other || (mgCount(db) > 0 && AC.exists) ? 'يُجمع ما في هذا الجهاز مع ما أضفتِه في أجهزتكِ الأخرى دون أن يضيع شيء، مع نسخة احتياطية قبلها.' : 'بالبريد وكلمة المرور نفسيهما من أي جهاز، دون رمز ربط.'}</div></div><span class="spacer"></span><button class="btn primary sm" data-act="acLoginOpen">🔑 تسجيل الدخول</button><button class="btn sm" data-act="acHide">لاحقاً</button></div>`);
};
ACTIONS.acHide = () => { AC.hide = true; renderSyncBar(); };
// جهاز مرتبط بلا كلمة مرور بعد: تذكير لطيف مرة في الإعدادات (يظهر في البطاقة)، ومعرفة وجود الحساب مسبقاً
(function acStart() { if (!db || typeof RELAY === 'undefined') return setTimeout(acStart, 600); renderSyncBar(); setTimeout(() => acCheck().then(() => { renderSyncBar(); if (ui.view === 'settings') render(); }), 3000); setInterval(() => { if (!document.hidden) acCheck().then(renderSyncBar); }, 30 * 60000); })();

// ═════════════ 🛟 رمز الاسترداد (1.11.0) ═════════════
// مفتاح احتياطي تحفظه الأستاذة (مطبوعاً أو في مكان آمن). يُشفَّر به مفتاح المدرسة نسخةً ثانية في الخادم،
// فإذا نُسيت كلمة المرور من كل الأجهزة: البريد + رمز الاسترداد ← كلمة مرور جديدة، دون أن يضيع شيء.
const AC_ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // بلا 0/O و1/I/L تجنباً للالتباس
const acNormCode = (c) => String(c || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
async function acRDerive(email, code) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(acNormCode(code)), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 200000, salt: new TextEncoder().encode('madrasa-recov:' + acNorm(email)) }, base, 512));
  return { key: await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']), rv: rlB64u(bits.slice(32)) };
}
async function acRecoveryNew(email = acEmail(), first) {
  const r = crypto.getRandomValues(new Uint8Array(24)), code = Array.from(r, (b) => AC_ALPHA[b % AC_ALPHA.length]).join('').match(/.{4}/g).join('-');
  const aid = rlHex(await rlSha('madrasa-acct-id:' + acNorm(email))).slice(0, 32), { key, rv } = await acRDerive(email, code);
  await acFetch(`/acct/${aid}/recovery`, { method: 'PUT', body: JSON.stringify({ rv, rblob: await acSeal(key), ch: RELAY.id, tok: RELAY.tok }) });
  AC.recovery = true; db.settings.acctRecoveryAt = todayISO(); commit(false);
  $('#modalRoot').innerHTML = `<div class="modal-back"><div class="modal" style="width:480px"><div class="modal-h"><h2>🛟 رمز الاسترداد</h2></div>
    <div class="modal-b">${first ? '<div class="banner brand" style="margin-bottom:12px"><span>✅</span><div>تم حفظ كلمة المرور. بقيت خطوة مهمة واحدة:</div></div>' : ''}
      <p style="margin-top:0">إذا نسيتِ كلمة المرور يوماً من كل الأجهزة، تدخلين بهذا الرمز وتختارين كلمة جديدة، فلا يضيع شيء من عملكِ. <b>اطبعيه أو اكتبيه واحفظيه في مكان آمن.</b></p>
      <div dir="ltr" style="font:700 22px/1.6 ui-monospace,Consolas,monospace;letter-spacing:1px;text-align:center;padding:14px;background:var(--amber-soft);border:2px dashed #f0c77a;border-radius:12px;user-select:all">${code}</div>
      <div class="muted" style="font-size:12.5px;margin-top:8px">لا يُعرض مرة أخرى. البريد: <span dir="ltr">${esc(acNorm(email))}</span>. لا تعطيه لأحد: من يملكه مع البريد يستطيع فتح بياناتكِ.</div>
      <label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-weight:600"><input type="checkbox" id="acRSaved"> حفظتُ الرمز في مكان آمن</label></div>
    <div class="modal-f"><button class="btn primary" data-act="acRDone" disabled id="acRDoneBtn">تم</button><button class="btn" data-act="acRPrint">🖨 طباعة</button><button class="btn" data-act="acRCopy">📋 نسخ</button></div></div></div>`;
  modalCtx = { acRCode: code, email: acNorm(email), locked: true };
}
async function acRecover(email, code, pass) {
  const aid = rlHex(await rlSha('madrasa-acct-id:' + acNorm(email))).slice(0, 32), { key, rv } = await acRDerive(email, code);
  const { blob } = await acFetch(`/acct/${aid}/recover`, { method: 'POST', body: JSON.stringify({ rv }) });
  const r = await acJoin(email, await acOpen(blob, key));
  await acSet(email, pass); // كلمة المرور الجديدة؛ ورمز الاسترداد يبقى صالحاً
  return r;
}
function acForgotModal() {
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal" style="width:460px"><div class="modal-h"><h2>🛟 نسيت كلمة المرور</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b"><div class="muted" style="margin-bottom:12px">إن كان أحد أجهزتكِ ما زال داخلاً على الحساب، غيّري كلمة المرور منه: الإعدادات ← المزامنة المشفّرة ← «تغيير كلمة المرور». وإلا فأدخلي رمز الاسترداد الذي حفظتِه عند إنشاء الحساب.</div>
      <form class="form" id="acRForm"><div class="field full"><label>البريد الإلكتروني</label><input class="input" name="email" type="email" dir="ltr" required value="${esc(acEmail())}"></div>
      <div class="field full"><label>رمز الاسترداد</label><input class="input" name="code" dir="ltr" required placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" style="font-family:ui-monospace,Consolas,monospace;letter-spacing:1px" autocomplete="off"></div>
      <div class="field full"><label>كلمة المرور الجديدة</label><input class="input" name="pass" type="password" dir="ltr" required minlength="8" autocomplete="new-password"></div>
      <div class="field full"><label>تأكيد كلمة المرور</label><input class="input" name="pass2" type="password" dir="ltr" required minlength="8" autocomplete="new-password"></div>
      <div id="acRErr" style="color:var(--red);font-weight:600"></div></form></div>
    <div class="modal-f"><button class="btn primary" data-act="acRGo">استعادة الحساب</button><button class="btn" data-act="modalClose">إلغاء</button></div></div></div>`;
  modalCtx = { acRecover: true };
}
Object.assign(ACTIONS, {
  acForgot: () => acForgotModal(),
  acRNew: () => confirmBox('إنشاء رمز استرداد جديد؟ الرمز القديم سيتوقف عن العمل.', () => acRecoveryNew().catch((e) => toast(e.message, 'err')), 'نعم، أنشئي رمزاً جديداً'),
  acRCopy: async () => { try { await navigator.clipboard.writeText(modalCtx.acRCode); toast('نُسخ الرمز ✓', 'ok'); } catch { toast('حدّدي الرمز وانسخيه'); } },
  acRPrint: () => { const c = modalCtx; printDoc('رمز استرداد حساب المدرسة', `<h2 style="text-align:center">🛟 رمز استرداد حساب «المساعد الإداري»</h2><p>${esc(db.settings.schoolName || '')}</p><p><b>البريد:</b> <span dir="ltr">${esc(c.email)}</span></p><p style="font:700 22pt monospace;text-align:center;letter-spacing:2px;border:2px dashed #999;padding:14px" dir="ltr">${c.acRCode}</p><p>عند نسيان كلمة المرور من كل الأجهزة: «تسجيل الدخول» ← «نسيت كلمة المرور؟» ← البريد وهذا الرمز ← كلمة مرور جديدة.</p><p><b>احفظي هذه الورقة في مكان آمن، ولا تعطيها لأحد.</b></p><p class="muted">أُنشئ في ${fmtH(todayISO())} — ${fmtG(todayISO())}</p>`); },
  acRDone: () => { closeModal(); toast('✓ حسابكِ محمي: كلمة المرور ورمز الاسترداد', 'ok'); render(); },
  acRGo: async (el) => {
    const f = $('#acRForm'), email = acNorm(f.email.value), code = f.code.value, pass = f.pass.value, err = $('#acRErr');
    if (acNormCode(code).length !== 24) return (err.textContent = 'الرمز 24 حرفاً ورقماً، تأكدي منه');
    if (pass.length < 8) return (err.textContent = 'كلمة المرور 8 أحرف على الأقل');
    if (pass !== f.pass2.value) return (err.textContent = 'كلمتا المرور غير متطابقتين');
    el.disabled = true; el.textContent = '⏳ جارٍ الاستعادة…'; err.textContent = '';
    try { const r = await acRecover(email, code, pass); closeModal(); toast(r === 'merged' ? '✓ استُعيد الحساب بكلمة مرور جديدة، ودُمجت بيانات هذا الجهاز' : '✓ استُعيد الحساب بكلمة مرور جديدة وحُمّلت بياناتكِ', 'ok'); render(); }
    catch (e) { err.textContent = e.code === 'wrong_code' ? 'رمز الاسترداد غير صحيح' : e.code === 'no_recovery' ? 'لم يُنشأ رمز استرداد لهذا الحساب' : e.message; el.disabled = false; el.textContent = 'استعادة الحساب'; }
  },
});
document.addEventListener('change', (e) => { if (e.target.id === 'acRSaved') { const b = $('#acRDoneBtn'); if (b) b.disabled = !e.target.checked; } });
// نافذة الرمز لا تُغلق بالنقر خارجها قبل التأكيد
const _acModalBack = ACTIONS.modalBack;
if (_acModalBack) ACTIONS.modalBack = (el, e) => { if (modalCtx?.locked) return; return _acModalBack(el, e); };
// بطاقة المزامنة: حالة رمز الاسترداد
const _acCard2 = relayCard;
relayCard = function () {
  const html = _acCard2();
  if (!rlOn() || !db.settings.acctEmail) return html;
  return html.replace('<div class="muted" style="margin-top:8px">البيانات تُشفَّر', `<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${AC.recovery ? `<span class="chip green">🛟 رمز الاسترداد محفوظ${db.settings.acctRecoveryAt ? ' منذ ' + fmtG(db.settings.acctRecoveryAt) : ''}</span><button class="btn sm" data-act="acRNew">رمز جديد</button>` : AC.recovery === false ? '<span class="chip red">🛟 لا يوجد رمز استرداد</span><button class="btn sm primary" data-act="acRNew">إنشاء رمز استرداد</button>' : ''}</div>
      <div class="muted" style="margin-top:8px">البيانات تُشفَّر`);
};
// تذكير واضح أعلى الصفحة إن كان الحساب بلا رمز استرداد
const _acBar2 = renderSyncBar;
renderSyncBar = function () {
  _acBar2();
  const el = $('#syncBar'); if (!el || !db || !rlOn() || !db.settings.acctEmail || AC.recovery !== false || AC.hideR || Sync.conflict) return;
  el.insertAdjacentHTML('beforeend', `<div class="banner" style="margin:0 28px 10px;padding:10px 16px;flex-wrap:wrap"><span class="big">🛟</span><div><b>احمي حسابكِ برمز استرداد</b><div class="muted">إذا نسيتِ كلمة المرور من كل الأجهزة، يُعيد لكِ الرمز حسابكِ وبياناتكِ كاملة.</div></div><span class="spacer"></span><button class="btn primary sm" data-act="acRNew2">🛟 إنشاء الرمز الآن</button><button class="btn sm" data-act="acHideR">لاحقاً</button></div>`);
};
ACTIONS.acRNew2 = () => acRecoveryNew().catch((e) => toast(e.message, 'err'));
ACTIONS.acHideR = () => { AC.hideR = true; renderSyncBar(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalCtx?.locked) e.stopImmediatePropagation(); }, true);
