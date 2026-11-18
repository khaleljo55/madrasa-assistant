// ═════════════ 📧 إرسال النسخة الاحتياطية اليومية بالبريد (1.1.0) ═════════════
// في وقت محدد كل يوم (برنامج الكمبيوتر فقط):
// - إن كان الإرسال التلقائي مُعدّاً (Gmail + كلمة مرور التطبيقات): تُرسل النسخة دون أي تدخل.
// - وإلا: تنبيه + تجهيز الملف + فتح مجلده ورسالة Gmail جاهزة، وما عليها إلا إرفاق الملف والإرسال.
// النسخة اليومية المعتادة في OneDrive / Google Drive تبقى كما هي.
const NBM = window.madrasaNative?.bkmail || null;
const BM = { cred: { user: '', hasPass: false }, ready: null, busy: false, snooze: 0, last: '' };
const bmCfg = () => ({ on: true, time: '13:00', to: '', ...(db.settings.bkMail || {}) });
const bmTo = () => bmCfg().to || BM.cred.user || Sync.wantEmail() || '';
const bmSubject = (day) => `🛟 نسخة احتياطية — المساعد الإداري — ${dayName(day)} ${fmtH(day)}`;
const bmBody = (day, dataOnly) => `نسخة احتياطية من «المساعد الإداري» ليوم ${dayName(day)} ${fmtH(day)} (${day}).\n${school()}\n\nللاستعادة: الإعدادات ← المزامنة والنسخ ← استعادة نسخة، واختاري الملف المرفق كما هو.${dataOnly ? '\n\nملاحظة: هذه النسخة للبيانات فقط لأن المرفقات كبيرة على البريد؛ المرفقات محفوظة في النسخة اليومية في OneDrive.' : ''}`;

// تجهيز الملف: كاملة بالمرفقات إن كانت مناسبة لحجم البريد، وإلا البيانات فقط
async function bmPrepare(day) {
  let r = await NBM.prepare(day, await bkText(), false);
  if (r.ok && r.size > 17 * 1024 * 1024) r = { ...(await NBM.prepare(day, JSON.stringify({ ...db, _backup: { at: new Date().toISOString(), device: deviceId(), dataOnly: true } }), true)), dataOnly: true };
  if (!r.ok) throw new Error(r.error || 'تعذّر تجهيز الملف');
  return r;
}
async function bmMarkDone(day, via) {
  BM.last = day; await IDB.put('kv', 'bkMailLast', day).catch(() => { });
  db.settings.bkMailLast = day; db.settings.bkMailVia = via; commit(false); // يمنع الإرسال المكرر من كمبيوتر آخر
}
async function bmRun(manual) {
  if (!NBM || BM.busy) return;
  BM.busy = true;
  const day = todayISO();
  try {
    if (manual) toast('جارٍ تجهيز النسخة…');
    const f = await bmPrepare(day);
    if (BM.cred.user && BM.cred.hasPass) {
      const r = await NBM.send({ to: bmTo(), subject: bmSubject(day), text: bmBody(day, f.dataOnly), path: f.path, fromName: db.settings.employeeName || 'المساعد الإداري' });
      if (r.ok) {
        BM.ready = null; await bmMarkDone(day, 'auto');
        toast(`📧 أُرسلت النسخة الاحتياطية إلى ${r.to}`, 'ok');
        if (!manual) bmNotify('📧 أُرسلت نسخة اليوم الاحتياطية', `إلى ${r.to}`);
        BM.busy = false; bmBar(); if (ui.view === 'settings') render(); return;
      }
      BM.error = r.error;
      toast('تعذّر الإرسال التلقائي: ' + r.error + ' — جهّزت لكِ الرسالة لإرسالها يدوياً', 'err');
    }
    BM.ready = { day, ...f };
    if (manual) bmSendManual();
    else bmNotify('🛟 نسخة اليوم الاحتياطية جاهزة', 'اضغطي هنا لإرسالها إلى بريدكِ');
  } catch (e) { if (manual) toast('تعذّر تجهيز النسخة: ' + e.message, 'err'); BM.error = e.message; }
  BM.busy = false; bmBar(); if (ui.view === 'settings') render();
}
function bmNotify(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission === 'denied') return;
    const n = new Notification(title, { body, tag: 'bkmail' });
    n.onclick = () => { window.madrasaNative?.focus?.(); if (BM.ready) bmSendManual(); };
  } catch { }
}
async function bmSendManual() {
  const f = BM.ready; if (!f) return;
  await NBM.reveal(f.path);
  api.openUrl(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(bmTo())}&su=${encodeURIComponent(bmSubject(f.day))}&body=${encodeURIComponent(bmBody(f.day, f.dataOnly))}`);
  toast("فُتح مجلد النسخة ورسالة Gmail: اسحبي ملف النسخة من المجلد إلى الرسالة ثم اضغطي «إرسال»", "ok");
  BM.ready = null; await bmMarkDone(f.day, 'manual'); bmBar();
}
// شريط التنبيه أعلى الصفحة
function bmBar() {
  let el = $('#bmBar');
  if (!el) { const sb = $('#syncBar'); if (!sb) return; el = document.createElement('div'); el.id = 'bmBar'; sb.after(el); }
  el.innerHTML = BM.ready && Date.now() > BM.snooze ? `<div class="banner brand" style="margin:0 28px 10px;padding:10px 16px"><span class="big">🛟</span><div><b>نسخة اليوم الاحتياطية جاهزة للإرسال</b><div class="muted">سيُفتح مجلد الملف ورسالة Gmail جاهزة؛ اسحبي الملف إلى الرسالة واضغطي «إرسال».</div></div><span class="spacer"></span><button class="btn primary sm" data-act="bmSend">📧 إرسال عبر Gmail</button><button class="btn sm" data-act="bmLater">لاحقاً</button></div>` : '';
}
async function bmTick() {
  if (!NBM || !db) return;
  const c = bmCfg(), day = todayISO();
  if (!c.on || BM.busy || BM.ready) return;
  if (BM.last === day || db.settings.bkMailLast === day) return;
  const [h, m] = String(c.time || '13:00').split(':').map(Number), now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + (m || 0)) return;
  bmRun(false);
}
if (NBM) {
  Promise.all([NBM.get().then((c) => { BM.cred = c; }).catch(() => { }), IDB.get('kv', 'bkMailLast').then((v) => { BM.last = v || ''; }).catch(() => { })])
    .finally(() => { setTimeout(bmTick, 90000); setInterval(bmTick, 60000); });
  addHook('settingsCards', () => {
    const c = bmCfg(), auto = BM.cred.user && BM.cred.hasPass;
    return `<div class="card"><h3>📧 النسخة الاحتياطية بالبريد</h3>
      <div class="muted" style="margin-bottom:10px">كل يوم في الوقت المحدد تُجهَّز نسخة كاملة وتُرسل إلى بريدكِ لحفظها، إضافة إلى النسخة اليومية في السحابة.</div>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${c.on ? 'checked' : ''} data-change="bmOn"> تفعيل الإرسال اليومي</label>
      <div class="form" style="margin-top:10px"><div class="field"><label>الوقت</label><input class="input" type="time" value="${esc(c.time)}" data-change="bmTime"></div>
        <div class="field"><label>يُرسل إلى</label><input class="input" type="email" dir="ltr" value="${esc(c.to)}" placeholder="${esc(BM.cred.user || Sync.wantEmail() || 'name@gmail.com')}" data-change="bmToSet"></div></div>
      <div style="margin-top:6px">${auto ? `<span class="chip green">الإرسال تلقائي ✓ من <span dir="ltr">${esc(BM.cred.user)}</span></span>` : '<span class="chip amber">يدوي: تنبيه + رسالة Gmail جاهزة</span>'}
        ${db.settings.bkMailLast ? `<span class="muted" style="font-size:12.5px;margin-inline-start:6px">آخر إرسال: ${dayName(db.settings.bkMailLast)} ${fmtH(db.settings.bkMailLast)}</span>` : ''}</div>
      ${BM.error ? `<div style="color:var(--red);font-size:12.5px;margin-top:6px">⚠️ ${esc(BM.error)}</div>` : ''}
      <details class="adv" style="margin-top:12px" ${ui.bmOpen ? 'open' : ''}><summary data-act="bmToggle">⚙️ الإرسال التلقائي دون تدخل (اختياري)</summary>
        <div class="muted" style="margin:8px 0">يحتاج بريد Gmail مع «كلمة مرور التطبيقات» (من حساب Google ← الأمان ← التحقق بخطوتين ← كلمات مرور التطبيقات). تُحفظ مشفّرة في هذا الجهاز فقط. <a href="#" data-act="openUrl" data-id="https://myaccount.google.com/apppasswords">فتح الصفحة</a></div>
        <div class="form"><div class="field"><label>بريد Gmail المُرسِل</label><input class="input" id="bmUser" type="email" dir="ltr" value="${esc(BM.cred.user)}" placeholder="name@gmail.com"></div>
          <div class="field"><label>كلمة مرور التطبيقات ${BM.cred.hasPass ? '<span class="chip green" style="font-size:11px">محفوظة</span>' : ''}</label><input class="input" id="bmPass" type="password" dir="ltr" placeholder="${BM.cred.hasPass ? 'اتركيها فارغة للإبقاء على المحفوظة' : 'xxxx xxxx xxxx xxxx'}" autocomplete="off"></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn sm primary" data-act="bmSave">حفظ واختبار</button>${auto ? '<button class="btn sm danger" data-act="bmClear">إيقاف الإرسال التلقائي</button>' : ''}</div></details>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn sm primary" data-act="bmNow" ${BM.busy ? 'disabled' : ''}>📧 إرسال نسخة الآن</button></div></div>`;
  });
  Object.assign(ACTIONS, {
    bmNow: () => bmRun(true),
    bmSend: () => bmSendManual(),
    bmLater: () => { BM.snooze = Date.now() + 2 * 3600e3; bmBar(); setTimeout(bmBar, 2 * 3600e3 + 1000); toast('سأذكّركِ بعد ساعتين'); },
    bmToggle: (el, e) => { e.preventDefault(); ui.bmOpen = !ui.bmOpen; render(); },
    bmSave: async () => {
      const user = $('#bmUser').value.trim(), pass = $('#bmPass').value.trim();
      try { BM.cred = await NBM.set({ user, pass: pass || '' }); } catch (e) { return toast(e.message.replace(/^.*Error: /, ''), 'err'); }
      if (!BM.cred.user || !BM.cred.hasPass) { render(); return toast('أدخلي البريد وكلمة مرور التطبيقات', 'err'); }
      toast('جارٍ الاختبار…');
      const r = await NBM.test();
      if (r.ok) { BM.error = ''; toast('✓ الإرسال التلقائي جاهز', 'ok'); } else { BM.error = r.error; toast('فشل الاختبار: ' + r.error, 'err'); }
      render();
    },
    bmClear: () => confirmBox('إيقاف الإرسال التلقائي وحذف كلمة مرور التطبيقات من هذا الجهاز؟ سيستمر التنبيه اليومي برسالة Gmail جاهزة.', async () => { BM.cred = await NBM.set({ pass: null }); BM.error = ''; render(); }, 'نعم، أوقفيه'),
  });
  Object.assign(CHANGES, {
    bmOn: (el) => { db.settings.bkMail = { ...bmCfg(), on: el.checked }; commit(false); },
    bmTime: (el) => { if (!/^\d{2}:\d{2}$/.test(el.value)) return; db.settings.bkMail = { ...bmCfg(), time: el.value }; commit(false); },
    bmToSet: (el) => { const v = el.value.trim(); if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return toast('البريد غير صحيح', 'err'); db.settings.bkMail = { ...bmCfg(), to: v }; commit(false); },
  });
}
