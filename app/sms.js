// ═════════════ 📱 الرسائل النصية (1.0.9) ═════════════
// عبر مزوّد رسمي باسم مرسل (تقنيات، يونيفونك، فور جوالي، أو رابط مخصص)، أو من جوال الأستاذة نفسه
// (تطبيق SMS Gateway على أندرويد، أو يدوياً رسالةً رسالة). المفاتيح محفوظة مشفّرة في جهازها فقط.

const NSMS = window.madrasaNative?.sms;
const SMS = { cfg: { provider: 'none' }, q: null };
addHook('beforeStart', () => { if (!Array.isArray(db.smsLog)) db.smsLog = []; });
if (NSMS) NSMS.get().then((c) => (SMS.cfg = c)).catch(() => { });
const SMS_PROV = {
  none: ['— غير مفعّلة —', ''],
  taqnyat: ['تقنيات (Taqnyat)', 'مزوّد سعودي مرخّص. أنشئي «توكن» من لوحة تقنيات، واستخدمي اسم المرسل المعتمد.'],
  unifonic: ['يونيفونك (Unifonic)', 'مزوّد سعودي مرخّص. تحتاجين AppSid واسم المرسل المعتمد.'],
  jawaly: ['فور جوالي (4jawaly)', 'مزوّد سعودي مرخّص. تحتاجين مفتاح API والسر واسم المرسل المعتمد.'],
  smsgate: ['📱 جوالي (أندرويد) — SMS Gateway', 'تُرسل الرسائل من رقم جوالكِ عبر تطبيق «SMS Gateway for Android» المجاني. ثبّتيه على الجوال، وفعّلي «Cloud server»، وانسخي اسم المستخدم وكلمة المرور الظاهرين فيه.'],
  manual: ['📱 جوالي — يدوياً رسالةً رسالة', 'تُفتح كل رسالة جاهزة في تطبيق الرسائل (Phone Link في ويندوز)، وتضغطين إرسال. مناسب للأعداد القليلة أو لجوال آيفون.'],
  custom: ['مزوّد آخر (إعداد يدوي)', 'لموبايلي أعمال أو مسجات أو غيرهما: انسخي بيانات الربط من دليل المزوّد (رابط الإرسال، والترويسة، وصيغة الطلب).'],
};
const smsOn = () => SMS.cfg.provider && SMS.cfg.provider !== 'none';
// توحيد الرقم إلى الصيغة الدولية السعودية 9665xxxxxxxx
function smsNum(v) {
  let s = stDigits(v || '').replace(/[^\d+]/g, '');
  if (!s) return null;
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('00')) s = s.slice(2);
  if (/^05\d{8}$/.test(s)) s = '966' + s.slice(1);
  else if (/^5\d{8}$/.test(s)) s = '966' + s;
  return /^\d{10,15}$/.test(s) ? s : null;
}
const smsParts = (t) => { const ar = /[^\x00-\x7F]/.test(t), n = [...t].length; return n <= (ar ? 70 : 160) ? 1 : Math.ceil(n / (ar ? 67 : 153)); };
const smsFill = (tpl, v) => String(tpl).replace(/\{([^}]+)\}/g, (m, k) => (v[k] ?? m));

// ───── نافذة الإرسال الموحّدة ─────
// recipients: [{ to, name, vars:{...}, ref }]  ·  template: نص بالرموز  ·  kind: 'service' | 'awareness'
function smsCompose({ title, recipients, template, kind = 'service', onSent }) {
  const ok = recipients.map((r) => ({ ...r, to: smsNum(r.to) })).filter((r) => r.to);
  const skipped = recipients.length - ok.length;
  SMS.q = { title, list: ok, template, kind, onSent, skipped, i: 0 };
  smsComposeRender();
}
function smsComposeRender() {
  const Q = SMS.q, first = Q.list[0], txt = first ? smsFill(Q.template, first.vars || {}) : Q.template;
  const parts = Q.list.reduce((a, r) => a + smsParts(smsFill(Q.template, r.vars || {})), 0);
  const h = new Date().getHours(), night = Q.kind === 'awareness' && (h >= 22 || h < 9);
  const manual = SMS.cfg.provider === 'manual';
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal wide"><div class="modal-h"><h2>📱 ${esc(Q.title)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b">
      ${!smsOn() ? `<div class="banner amber" style="margin-bottom:12px"><span class="big">⚙️</span><div><b>خدمة الرسائل النصية غير مفعّلة</b><div class="muted">فعّليها من الإعدادات ← الرسائل النصية، باختيار مزوّد أو جوالكِ.</div></div><span class="spacer"></span><button class="btn primary" data-act="smsSetup">الإعداد الآن</button></div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="chip brand">المستلمون: ${Q.list.length}</span><span class="chip">الرسائل المحتسبة تقريباً: ${parts}</span>${Q.skipped ? `<span class="chip amber">بلا رقم صحيح: ${Q.skipped}</span>` : ''}<span class="chip">${esc(SMS_PROV[SMS.cfg.provider]?.[0] || '')}</span></div>
      ${night ? '<div class="banner amber" style="margin-bottom:10px"><span class="big">🌙</span><div>الرسائل التوعوية لا تُرسل من 10 مساءً إلى 9 صباحاً حسب ضوابط الهيئة. يُفضّل التأجيل.</div></div>' : ''}
      <div class="field"><label>نص الرسالة</label><textarea class="input" rows="5" id="smsTpl">${esc(Q.template)}</textarea>
        <span class="hint">الرموز المتاحة: ${[...new Set(Q.list.flatMap((r) => Object.keys(r.vars || {})))].map((k) => `{${k}}`).join(' ') || '—'} · العربية: 70 حرفاً للرسالة الواحدة</span></div>
      <div class="section-title">معاينة${first ? ` — ${esc(first.name || first.to)}` : ''}</div>
      <div class="sms-bubble" id="smsPrev">${esc(txt)}</div><div class="muted" id="smsPrevN" style="font-size:12px;margin-top:4px">${[...txt].length} حرفاً · ${smsParts(txt)} رسالة</div>
      ${manual && Q.i > 0 ? `<div class="muted" style="margin-top:10px">أُرسلت ${Q.i} من ${Q.list.length}</div>` : ''}
    </div>
    <div class="modal-f">${smsOn() && Q.list.length ? (manual ? `<button class="btn primary" data-act="smsManualNext">📱 فتح الرسالة ${Q.i + 1} من ${Q.list.length}</button>` : `<button class="btn primary" data-act="smsGo">📤 إرسال ${Q.list.length} رسالة</button>`) : ''}<button class="btn" data-act="modalClose">إغلاق</button></div></div></div>`;
  modalCtx = { sms: true };
}
function smsLogAdd(r, res) { db.smsLog.unshift({ id: uid(), at: new Date().toISOString(), to: r.to, name: r.name || '', text: r.text, ok: !!res.ok, error: res.error || '', provider: SMS.cfg.provider, title: SMS.q?.title || '' }); if (db.smsLog.length > 3000) db.smsLog.length = 3000; }
Object.assign(ACTIONS, {
  smsSetup: () => { closeModal(); ui.setTab = 'comm'; go('settings'); },
  smsGo: async (el) => {
    const Q = SMS.q; Q.template = $('#smsTpl').value;
    const list = Q.list.map((r) => ({ ...r, text: smsFill(Q.template, r.vars || {}) }));
    el.disabled = true; el.textContent = '⏳ جارٍ الإرسال…';
    let res;
    try { res = await NSMS.send(list.map((r) => ({ to: r.to, text: r.text }))); } catch (e) { toast('تعذّر الإرسال: ' + e.message, 'err'); el.disabled = false; return; }
    list.forEach((r, i) => smsLogAdd(r, res[i] || {}));
    const okN = res.filter((x) => x?.ok).length, bad = res.filter((x) => !x?.ok);
    Q.onSent?.(list.filter((_, i) => res[i]?.ok));
    commit(false); closeModal();
    toast(bad.length ? `أُرسلت ${okN} وتعذّرت ${bad.length}: ${bad[0].error || ''}` : `📱 أُرسلت ${okN} رسالة`, bad.length ? 'err' : 'ok');
  },
  smsManualNext: () => {
    const Q = SMS.q; Q.template = $('#smsTpl').value;
    const r = Q.list[Q.i], text = smsFill(Q.template, r.vars || {});
    const u = `sms:+${r.to}?body=${encodeURIComponent(text)}`; if (window.madrasaNative?.openSms) window.madrasaNative.openSms(u); else window.location.href = u;
    smsLogAdd({ ...r, text }, { ok: true }); Q.onSent?.([{ ...r, text }]); commit(false);
    Q.i++; if (Q.i >= Q.list.length) { closeModal(); toast('انتهت الرسائل', 'ok'); } else smsComposeRender();
  },
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'smsTpl' || !SMS.q) return;
  const f = SMS.q.list[0], t = smsFill(e.target.value, f?.vars || {});
  $('#smsPrev').textContent = t; $('#smsPrevN').textContent = `${[...t].length} حرفاً · ${smsParts(t)} رسالة`;
});

// ───── إعدادات الخدمة ─────
function smsSettingsCard() {
  if (!NSMS) return '<div class="card"><h3>📱 الرسائل النصية</h3><div class="muted">متاحة في البرنامج المثبّت فقط.</div></div>';
  const c = SMS.cfg, p = c.provider || 'none';
  const f = (k, l, ph = '', type = 'text', ltr = true) => `<div class="field"><label>${l}</label><input class="input" type="${type}" ${ltr ? 'dir="ltr"' : ''} data-sms="${k}" value="${type === 'password' ? '' : esc(c[k] || '')}" placeholder="${type === 'password' ? (c['has_' + k] ? '•••••••• (محفوظ — اكتبي لتغييره)' : ph) : esc(ph)}"></div>`;
  const fields = {
    taqnyat: f('token', 'التوكن (Bearer Token)', 'من لوحة تقنيات ← المطورون', 'password') + f('sender', 'اسم المرسل المعتمد', 'مثال: SchoolName'),
    unifonic: f('appSid', 'AppSid', 'من لوحة يونيفونك', 'password') + f('sender', 'اسم المرسل المعتمد'),
    jawaly: f('apiKey', 'API Key', '', 'password') + f('apiSecret', 'API Secret', '', 'password') + f('sender', 'اسم المرسل المعتمد') + f('jawalyUrl', 'رابط الإرسال (اختياري)', 'https://api-sms.4jawaly.com/api/v1/account/area/sms/send'),
    smsgate: `<div class="field"><label>طريقة الاتصال بالجوال</label><select class="input" data-sms="gateMode"><option value="cloud" ${c.gateMode !== 'local' ? 'selected' : ''}>عبر الإنترنت (Cloud server) — يعمل من أي مكان</option><option value="local" ${c.gateMode === 'local' ? 'selected' : ''}>عبر شبكة الواي فاي نفسها (Local server)</option></select></div>`
      + (c.gateMode === 'local' ? f('gateHost', 'عنوان الجوال في الشبكة', '192.168.1.20:8080') : '') + f('gateUser', 'اسم المستخدم (Username)') + f('password', 'كلمة المرور (Password)', '', 'password') + f('gateSim', 'رقم الشريحة (اختياري: 1 أو 2)', '1'),
    custom: f('customUrl', 'رابط الإرسال (https)', 'https://...') + f('customHeader', 'اسم ترويسة المفتاح (اختياري)', 'Authorization') + f('customHeaderValue', 'قيمة الترويسة', 'Bearer {key}') + f('customAuth', 'المفتاح السري {key}', '', 'password') + f('sender', 'اسم المرسل {sender}')
      + `<div class="field full"><label>صيغة الطلب (JSON)</label><textarea class="input" dir="ltr" rows="4" data-sms="customBody" placeholder='{"numbers":{to_json},"message":"{text}","sender":"{sender}"}'>${esc(c.customBody || '')}</textarea><span class="hint">الرموز: {to} {to_json} {text} {sender} {key}</span></div>`,
  }[p] || '';
  return `<div class="card" style="grid-column:1/-1"><h3>📱 الرسائل النصية</h3>
    <div class="form"><div class="field full"><label>طريقة الإرسال</label><select class="input" data-change="smsProv">${Object.entries(SMS_PROV).map(([k, [l]]) => `<option value="${k}" ${p === k ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="hint">${esc(SMS_PROV[p]?.[1] || 'اختاري مزوّد رسائل (باسم مرسل رسمي للمدرسة) أو جوالكِ.')}</span></div>${fields}</div>
    ${p !== 'none' ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${p !== 'manual' ? '<button class="btn primary sm" data-act="smsSave">💾 حفظ</button>' : ''}<button class="btn sm" data-act="smsTest">📤 رسالة تجربة</button>${['taqnyat', 'smsgate'].includes(p) ? '<button class="btn sm" data-act="smsBal">💳 الرصيد / الاتصال</button>' : ''}<span class="muted" id="smsBalOut" style="padding-top:6px"></span></div>` : ''}
    <div class="muted" style="margin-top:10px;font-size:12.5px">🔒 المفاتيح تُحفظ مشفّرة في هذا الجهاز فقط، ولا تدخل المزامنة ولا النسخ الاحتياطية. على كل جهاز يُضبط الإعداد مرة واحدة.<br>📋 اسم المرسل الرسمي يُسجَّل للمدرسة (جهة حكومية) عبر المزوّد بخطاب تفويض من المدرسة؛ ولا يُسجَّل باسم شخص.</div></div>`;
}
addHook('settingsCards', smsSettingsCard);
Object.assign(CHANGES, {
  smsProv: async (el) => { SMS.cfg = await NSMS.set({ provider: el.value }); render(); },
});
Object.assign(ACTIONS, {
  smsSave: async () => {
    const patch = {}; $$('[data-sms]').forEach((x) => { patch[x.dataset.sms] = x.value.trim(); });
    try { SMS.cfg = await NSMS.set(patch); toast('حُفظ إعداد الرسائل', 'ok'); render(); } catch (e) { toast(e.message, 'err'); }
  },
  smsTest: async () => {
    if (SMS.cfg.provider !== 'manual') await ACTIONS.smsSave();
    formModal({ title: '📤 رسالة تجربة', fields: [{ key: 'to', label: 'رقم الجوال', type: 'tel', required: true, hint: 'مثال: 05xxxxxxxx' }], onSave: (v) => {
      if (!smsNum(v.to)) return toast('رقم غير صحيح', 'err');
      smsCompose({ title: 'رسالة تجربة', recipients: [{ to: v.to, name: 'تجربة', vars: { المدرسة: db.settings.schoolName || '' } }], template: 'رسالة تجربة من «المساعد الإداري» — {المدرسة}' });
    } });
  },
  smsBal: async () => { const o = $('#smsBalOut'); o.textContent = '…'; const r = await NSMS.balance(); o.textContent = r.ok ? r.text : '⚠️ ' + r.error; },
});

// ───── قسم «الرسائل النصية»: إرسال جماعي وسجل ─────
function smsGroups() {
  const g = [['all', `أولياء أمور كل الطالبات (${db.students?.length || 0})`]];
  if (typeof sClasses === 'function') sClasses().forEach((c) => g.push(['c:' + c, `أولياء أمور ${c}`]));
  g.push(['absToday', 'أولياء أمور الغائبات والمتأخرات اليوم'], ['teachers', `المعلمات (${db.teachers.length})`], ['manual', 'أرقام أكتبها بنفسي']);
  return g;
}
function smsRecipients(gid, extra) {
  const school = db.settings.schoolName || '';
  const stu = (s, ex = {}) => ({ to: s.guardianPhone, name: s.guardian || s.name, vars: { 'اسم الطالبة': s.name, 'الفصل': sClass(s), 'ولي الأمر': s.guardian || 'ولي الأمر', 'المدرسة': school, ...ex }, ref: { student: s.id } });
  if (gid === 'teachers') return db.teachers.map((t) => ({ to: t.phone, name: t.name, vars: { 'الاسم': t.name, 'المدرسة': school } }));
  if (gid === 'manual') return prLines(extra).map((n) => ({ to: n, name: n, vars: { 'المدرسة': school } }));
  if (gid === 'absToday') { const t = todayISO(); return db.studentLog.filter((e) => e.date === t && ['absent', 'late'].includes(e.type)).map((e) => { const s = student(e.studentId); return s ? stu(s, { 'الحالة': e.type === 'late' ? 'متأخرة' : 'غائبة', 'التاريخ': fmtH(t) }) : null; }).filter(Boolean); }
  return (db.students || []).filter((s) => gid === 'all' || 'c:' + sClass(s) === gid).map((s) => stu(s));
}
VIEWS.sms = {
  actions: () => `<button class="btn" data-act="smsSetup">⚙️ إعداد الخدمة</button><button class="btn primary" data-act="smsNew">✍️ رسالة جديدة</button>`,
  render() {
    const L = db.smsLog.slice(0, 300), okN = db.smsLog.filter((x) => x.ok).length;
    return `${!smsOn() ? `<div class="card" style="margin-bottom:14px">${emptyState('📱', 'لم تُفعَّل خدمة الرسائل النصية بعد.<br>اختاري مزوّد رسائل باسم المدرسة، أو أرسلي من جوالكِ (أندرويد تلقائياً، أو يدوياً).')}<div style="text-align:center;margin-top:10px"><button class="btn primary" data-act="smsSetup">⚙️ الإعداد الآن</button></div></div>` : ''}
      <div class="grid g4" style="margin-bottom:14px"><div class="card stat"><span class="n">${db.smsLog.length}</span><span class="l">رسائل في السجل</span></div><div class="card stat"><span class="n" style="color:var(--green)">${okN}</span><span class="l">أُرسلت</span></div><div class="card stat"><span class="n" style="color:var(--red)">${db.smsLog.length - okN}</span><span class="l">تعذّرت</span></div><div class="card stat"><span class="n" style="font-size:16px">${esc(SMS_PROV[SMS.cfg.provider]?.[0] || '—')}</span><span class="l">طريقة الإرسال</span></div></div>
      <div class="card" style="padding:0;overflow:auto"><table class="table"><thead><tr><th>الوقت</th><th>إلى</th><th>الموضوع</th><th>النص</th><th>الحالة</th></tr></thead><tbody>
      ${L.length ? L.map((x) => `<tr><td style="white-space:nowrap">${fmtH(x.at.slice(0, 10))}<div class="muted" style="font-size:12px" dir="ltr">${x.at.slice(11, 16)}</div></td><td>${esc(x.name)}<div class="muted" dir="ltr" style="font-size:12px;text-align:right">+${esc(x.to)}</div></td><td>${esc(x.title)}</td><td style="max-width:380px">${esc(x.text)}</td><td>${x.ok ? '<span class="chip green">أُرسلت</span>' : `<span class="chip red" title="${esc(x.error)}">تعذّرت</span>`}</td></tr>`).join('') : `<tr><td colspan="5">${emptyState('🗂️', 'لا توجد رسائل مرسلة بعد')}</td></tr>`}</tbody></table></div>`;
  },
};
Object.assign(ACTIONS, {
  smsNew: () => formModal({ title: '✍️ رسالة نصية جديدة', wide: true, fields: [
    { key: 'g', label: 'إلى', type: 'select', full: true, options: smsGroups() },
    { key: 'nums', label: 'الأرقام (رقم في كل سطر — عند اختيار «أرقام أكتبها بنفسي»)', type: 'textarea', full: true, rows: 3 },
    { key: 'kind', label: 'نوع الرسالة', type: 'select', options: [['service', 'خدمية (غياب، استئذان، تنبيه)'], ['awareness', 'توعوية (مناسبة، نصيحة)']] }],
    onSave: (v) => {
      const R = smsRecipients(v.g, v.nums);
      if (!R.length) return toast('لا يوجد مستلمون لهذا الاختيار', 'err');
      const isT = v.g === 'teachers', isM = v.g === 'manual';
      smsCompose({ title: 'رسالة جماعية', recipients: R, kind: v.kind, template: isT ? 'الأستاذة {الاسم}، ' + '\n\n{المدرسة}' : isM ? '\n{المدرسة}' : 'ولي أمر الطالبة {اسم الطالبة}، \n\n{المدرسة}' });
    } }),
});

// ───── الربط بأقسام البرنامج ─────
const SMS_TPL = {
  absent: 'نفيدكم بأن ابنتكم {اسم الطالبة} {الحالة} اليوم. {المدرسة}',
  achieve: '{المدرسة}: يسعدنا تميز ابنتكم {اسم الطالبة}: {السبب}. بارك الله فيها وفيكم.',
  leave: '{المدرسة}: خرجت ابنتكم {اسم الطالبة} الساعة {الوقت} مع {المستلم}. السبب: {السبب}.',
  subs: 'الأستاذة {الاسم}: نأمل تغطية حصة الانتظار — {الحصص}. شكراً لتعاونكِ. {المدرسة}',
};
function stuSmsList(entries, extra = () => ({})) {
  const school = db.settings.schoolName || '';
  return entries.map((e) => { const s = student(e.studentId); return s ? { to: s.guardianPhone, name: s.guardian || s.name, ref: { entry: e.id }, vars: { 'اسم الطالبة': s.name, 'الفصل': sClass(s), 'المدرسة': school, 'التاريخ': `${dayName(e.date)} ${fmtH(e.date)}`, ...extra(e, s) } } : null; }).filter(Boolean);
}
const markSms = (sent) => { const ids = new Set(sent.map((r) => r.ref?.entry).filter(Boolean)); db.studentLog.forEach((e) => { if (ids.has(e.id)) { e.sms = true; e.smsAt = todayISO(); } }); };
Object.assign(ACTIONS, {
  smsAbsent: () => {
    const d = ui.attDate || todayISO();
    const L = db.studentLog.filter((e) => e.date === d && ['absent', 'late'].includes(e.type) && !e.sms);
    if (!L.length) return toast('لا توجد غائبات أو متأخرات لم يُرسل لأولياء أمورهن');
    smsCompose({ title: `إشعار الغياب والتأخر — ${dayName(d)}`, recipients: stuSmsList(L, (e) => ({ 'الحالة': e.type === 'late' ? 'متأخرة' : 'غائبة' })), template: SMS_TPL.absent, onSent: (s) => { markSms(s); render(); } });
  },
  smsAchieve: () => {
    const L = db.studentLog.filter((e) => e.type === 'achieve' && !e.sms);
    if (!L.length) return toast('لا توجد حالات تميز لم يُرسل لأولياء أمورهن');
    smsCompose({ title: 'تهنئة أولياء الأمور بالتميز', recipients: stuSmsList(L, (e) => ({ 'السبب': e.text || 'تميزها' })), template: SMS_TPL.achieve, onSent: (s) => { markSms(s); render(); } });
  },
  smsOneEntry: (el) => {
    const e = db.studentLog.find((x) => x.id === el.dataset.id);
    const tpl = e.type === 'achieve' ? SMS_TPL.achieve : e.type === 'leave' ? SMS_TPL.leave : SMS_TPL.absent;
    smsCompose({ title: 'رسالة لولي الأمر', recipients: stuSmsList([e], (x) => ({ 'الحالة': x.type === 'late' ? 'متأخرة' : 'غائبة', 'السبب': x.text || '', 'الوقت': x.time || '', 'المستلم': x.receiver || '' })), template: tpl, onSent: (s) => { markSms(s); render(); } });
  },
  smsGuardian: () => { const s = student(ui.studentId); smsCompose({ title: `رسالة لولي أمر ${s.name}`, recipients: [{ to: s.guardianPhone, name: s.guardian || s.name, vars: { 'اسم الطالبة': s.name, 'الفصل': sClass(s), 'المدرسة': db.settings.schoolName || '' } }], template: 'ولي أمر الطالبة {اسم الطالبة}، \n\n{المدرسة}' }); },
  smsSubs: () => {
    const d = ui.subsDate || todayISO(), by = {};
    subsNeeded(d).forEach((x) => { const s = subOf(d, x); if (s?.subId) (by[s.subId] = by[s.subId] || []).push(`الحصة ${x.period} (${x.className})`); });
    const R = Object.entries(by).map(([id, p]) => ({ to: teacher(id)?.phone, name: tName(id), vars: { 'الاسم': tName(id), 'الحصص': `${dayName(d)}: ${p.join('، ')}`, 'المدرسة': db.settings.schoolName || '' } }));
    if (!R.length) return toast('لم تُوزَّع حصص انتظار بعد');
    smsCompose({ title: 'إبلاغ البديلات', recipients: R, template: SMS_TPL.subs });
  },
  smsKit: (el) => {
    const o = occById(el.dataset.id), k = kitOf(o), school = db.settings.schoolName || '';
    const R = [...new Map((db.students || []).filter((s) => smsNum(s.guardianPhone)).map((s) => [smsNum(s.guardianPhone), { to: s.guardianPhone, name: s.guardian || s.name, vars: { 'المدرسة': school } }])).values()];
    if (!R.length) return toast('لا توجد أرقام جوال لأولياء الأمور');
    smsCompose({ title: `${o.name} — أولياء الأمور`, kind: 'awareness', recipients: R, template: `${school}: ${o.name} — «${k.slogan}». ${k.tips[0] || ''}` });
  },
});
// أزرار الرسائل في الواجهات القائمة (تُضاف بعد الرسم)
function smsInject() {
  const v = ui.view;
  const add = (sel, html, where = 'afterend') => { const el = $(sel); if (el && !el.parentElement.querySelector('[data-sms-btn]')) el.insertAdjacentHTML(where, html); };
  if (v === 'students') {
    add('#view [data-act=stuNotify][data-id=absent]', '<button class="btn sm" data-sms-btn data-act="smsAbsent">📱 رسالة نصية</button>');
    add('#view [data-act=stuNotify][data-id=achieve]', '<button class="btn" data-sms-btn data-act="smsAchieve">📱 تهنئة برسالة نصية</button>');
    $$('#view [data-act=leaveSlip]').forEach((b) => { if (!b.parentElement.querySelector('[data-sms-btn]')) b.insertAdjacentHTML('afterend', `<button class="btn sm" data-sms-btn data-act="smsOneEntry" data-id="${b.dataset.id}">📱</button>`); });
  }
  if (v === 'student') { add('#view .tp-head [data-act=stuEdit]', '<button class="btn sm" data-sms-btn data-act="smsGuardian">📱 رسالة نصية</button>', 'beforebegin'); $$('#view [data-act=stuMailOne]').forEach((b) => { if (!b.parentElement.querySelector('[data-sms-btn]')) b.insertAdjacentHTML('afterend', `<button class="btn sm" data-sms-btn data-act="smsOneEntry" data-id="${b.dataset.id}">📱</button>`); }); }
  if (v === 'subs') add('#topActions [data-act=subsMail]', '<button class="btn" data-sms-btn data-act="smsSubs">📱 رسالة للبديلات</button>');
}
const _smsRender = render;
render = function () { _smsRender(); try { smsInject(); } catch { } };
// زر في حقيبة المبادرة
const _kitModal = kitModal;
kitModal = function (o) { _kitModal(o); const b = $('#modalRoot [data-act=kitMail][data-k=g]'); if (b) b.insertAdjacentHTML('afterend', `<button class="btn sm" data-act="smsKit" data-id="${o.id}">📱 رسالة نصية لأولياء الأمور</button>`); };
// خيار في نموذج الاستئذان: إرسال رسالة نصية بعد الحفظ
const _leaveNew = ACTIONS.leaveNew;
ACTIONS.leaveNew = () => {
  _leaveNew();
  const f = $('#mform'); if (!f || !smsOn()) return;
  f.insertAdjacentHTML('beforeend', '<div class="field full"><label style="display:flex;gap:8px;align-items:center;font-weight:500"><input type="checkbox" id="leaveSms" checked> إرسال رسالة نصية لولي الأمر بعد الحفظ</label></div>');
  const cb = modalCtx.onSave;
  SMS.leaveWant = true; $('#leaveSms').onchange = (e) => (SMS.leaveWant = e.target.checked);
  modalCtx.onSave = (v) => { const want = SMS.leaveWant; const before = new Set(db.studentLog.map((e) => e.id)); cb(v); if (want) { const e = db.studentLog.find((x) => !before.has(x.id)); if (e) setTimeout(() => ACTIONS.smsOneEntry({ dataset: { id: e.id } }), 600); } };
};
