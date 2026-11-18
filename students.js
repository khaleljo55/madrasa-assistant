// ═════════════ 👧 شؤون الطالبات (1.0.6) ═════════════
// استيراد Excel، ملف لكل طالبة، الغياب اليومي، التميز والشهادات، إشعار أولياء الأمور بالبريد، وإحصائيات.

(function addNavStudents() {
  const i = NAV_TREE.findIndex((x) => x.group === 'teachers');
  NAV_TREE.splice(i >= 0 ? i + 1 : NAV_TREE.length - 1, 0, { id: 'students', ic: '👧', label: 'شؤون الطالبات' });
  NAV.length = 0; NAV.push(...NAV_TREE.flatMap((n) => (n.items ? n.items : [n])));
})();
addHook('beforeStart', () => {
  if (!Array.isArray(db.students)) db.students = [];
  if (!Array.isArray(db.studentLog)) db.studentLog = [];
});

const SL_TYPES = {
  absent: { l: 'غياب', ic: '🔴', cls: 'red' },
  late: { l: 'تأخر', ic: '🟠', cls: 'amber' },
  excused: { l: 'غياب بعذر', ic: '🔵', cls: 'blue' },
  achieve: { l: 'إنجاز وتميز', ic: '🏅', cls: 'green' },
  behavior: { l: 'ملاحظة سلوكية', ic: '⚠️', cls: 'amber' },
  hifz: { l: 'حفظ ومراجعة', ic: '📖', cls: 'brand' },
  note: { l: 'ملاحظة عامة', ic: '📝', cls: '' },
  leave: { l: 'استئذان وخروج', ic: '🚪', cls: 'blue' },
};
const ATT = [['present', 'حاضرة', 'green'], ['absent', 'غائبة', 'red'], ['late', 'متأخرة', 'amber'], ['excused', 'بعذر', 'blue']];
const STU_FIELDS = [
  ['name', 'اسم الطالبة', ['اسم الطالبة', 'اسم الطالب', 'الاسم', 'الطالبة', 'name']],
  ['grade', 'الصف', ['الصف', 'المرحلة', 'المستوى', 'grade']],
  ['cls', 'الفصل', ['الفصل', 'الشعبة', 'class', 'section']],
  ['halaqa', 'الحلقة', ['الحلقة', 'المعلمة']],
  ['idNo', 'رقم الهوية', ['الهوية', 'السجل', 'رقم الطالب', 'id']],
  ['guardian', 'ولي الأمر', ['ولي الأمر', 'ولي الامر', 'اسم ولي', 'guardian']],
  ['guardianEmail', 'بريد ولي الأمر', ['بريد', 'ايميل', 'إيميل', 'البريد', 'email', 'mail']],
  ['guardianPhone', 'جوال ولي الأمر', ['جوال', 'الجوال', 'هاتف', 'رقم التواصل', 'phone', 'mobile']],
];
const student = (id) => db.students.find((s) => s.id === id);
const sClass = (s) => [s.grade, s.cls].filter(Boolean).join(' / ') || 'بدون فصل';
const sClasses = () => [...new Set(db.students.map(sClass))].sort((a, b) => a.localeCompare(b, 'ar', { numeric: true }));
const sYear = () => (typeof yearRange === 'function' ? yearRange() : ['0000-00-00', '9999-12-31']);
function sLog(id, inYear = true) { const [ys, ye] = sYear(); return db.studentLog.filter((e) => e.studentId === id && (!inYear || (e.date >= ys && e.date <= ye))); }
function sCounts(id) { const c = { absent: 0, late: 0, excused: 0, achieve: 0, behavior: 0, hifz: 0, note: 0, leave: 0 }; sLog(id).forEach((e) => c[e.type]++); return c; }
const attOf = (id, d) => db.studentLog.find((e) => e.studentId === id && e.date === d && ['absent', 'late', 'excused'].includes(e.type));
const sFill = (tpl, s, extra = {}) => String(tpl).replace(/\{الاسم\}/g, s.name).replace(/\{الفصل\}/g, sClass(s)).replace(/\{ولي الأمر\}/g, s.guardian || 'ولي الأمر الكريم').replace(/\{المدرسة\}/g, db.settings.schoolName || 'المدرسة').replace(/\{التاريخ\}/g, extra.date ? `${dayName(extra.date)} ${fmtH(extra.date)}` : '').replace(/\{الحالة\}/g, extra.state || '').replace(/\{السبب\}/g, extra.reason || '');
const STU_MSG = {
  absent: ['غياب الطالبة {الاسم}', 'المكرم/ {ولي الأمر}\nالسلام عليكم ورحمة الله وبركاته\n\nنفيدكم بأن ابنتكم الطالبة {الاسم} ({الفصل}) سُجّلت {الحالة} يوم {التاريخ}.\nنأمل التواصل مع المدرسة عند وجود عذر، شاكرين تعاونكم.\n\n{المدرسة}'],
  achieve: ['تهنئة بتميز الطالبة {الاسم}', 'المكرم/ {ولي الأمر}\nالسلام عليكم ورحمة الله وبركاته\n\nيسعدنا أن نزف إليكم تميز ابنتكم الطالبة {الاسم} ({الفصل}): {السبب}.\nبارك الله فيها وفي جهودكم.\n\n{المدرسة}'],
};
const stuMsg = (k) => db.settings['stuMsg_' + k] || STU_MSG[k];
const gmail = (to, su, body) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to || '')}&su=${encodeURIComponent(su || '')}&body=${encodeURIComponent(body || '')}`;

// ───── القائمة الرئيسية ─────
function stuFiltered() {
  const q = normName(ui.stuQ || ''), c = ui.stuClass || '';
  return db.students.filter((s) => (!c || sClass(s) === c) && (!q || normName(`${s.name} ${s.idNo || ''} ${s.guardian || ''} ${s.halaqa || ''}`).includes(q)))
    .sort((a, b) => sClass(a).localeCompare(sClass(b), 'ar', { numeric: true }) || a.name.localeCompare(b.name, 'ar'));
}
function stuList() {
  const list = stuFiltered(), shown = list.slice(0, 500);
  const classes = sClasses();
  return `<div class="toolbar"><input class="input" id="stuSearch" placeholder="🔍 بحث بالاسم أو الهوية أو ولي الأمر" value="${esc(ui.stuQ || '')}" style="max-width:300px">
      <select class="input" data-change="stuClass" style="width:auto"><option value="">كل الفصول (${db.students.length})</option>${classes.map((c) => `<option ${ui.stuClass === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <span class="spacer" style="flex:1"></span><span class="muted">${list.length} طالبة</span></div>
    ${db.students.length ? `<div class="card" style="padding:0;overflow:auto"><table class="table"><thead><tr><th>الطالبة</th><th>الفصل</th><th>الحلقة</th><th>غياب</th><th>تأخر</th><th>تميز</th><th>ولي الأمر</th><th></th></tr></thead><tbody>
      ${shown.map((s) => { const c = sCounts(s.id); return `<tr><td><a href="#" class="link" data-act="stuOpen" data-id="${s.id}"><b>${esc(s.name)}</b></a></td><td>${esc(sClass(s))}</td><td>${esc(s.halaqa || '')}</td>
        <td>${c.absent ? `<span class="chip red">${c.absent}</span>` : '—'}</td><td>${c.late ? `<span class="chip amber">${c.late}</span>` : '—'}</td><td>${c.achieve ? `<span class="chip green">${c.achieve}</span>` : '—'}</td>
        <td><div>${esc(s.guardian || '')}</div>${s.guardianEmail ? `<div class="muted" dir="ltr" style="font-size:12px;text-align:right">${esc(s.guardianEmail)}</div>` : ''}</td>
        <td class="actions"><button class="icon-btn" data-act="stuEntry" data-id="${s.id}" title="إضافة ملاحظة أو إنجاز">➕</button><button class="icon-btn" data-act="stuEdit" data-id="${s.id}" title="تعديل">✏️</button></td></tr>`; }).join('')}
    </tbody></table>${list.length > shown.length ? `<div class="muted" style="padding:10px">يُعرض أول 500؛ استخدمي البحث أو تصفية الفصل.</div>` : ''}</div>`
    : `<div class="card">${emptyState('👧', 'أضيفي الطالبات من ملف Excel (مثل ملف نظام نور) أو بلصق الأسماء.<br>بعدها: الغياب اليومي، وملف لكل طالبة، والتميز والشهادات، وإشعار أولياء الأمور بالبريد.')}
      <div style="display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap"><button class="btn primary" data-act="stuImport">⬆ استيراد من Excel</button><button class="btn" data-act="stuTemplate">⬇ نموذج Excel فارغ</button><button class="btn" data-act="stuPaste">📋 لصق الأسماء</button></div></div>`}`;
}
function stuAttendance() {
  const d = ui.attDate || todayISO(), classes = sClasses();
  if (!ui.attClass || !classes.includes(ui.attClass)) ui.attClass = classes[0] || '';
  const list = db.students.filter((s) => sClass(s) === ui.attClass).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const dayAll = db.students.map((s) => attOf(s.id, d)).filter(Boolean);
  const cnt = (t) => dayAll.filter((e) => e.type === t).length;
  const pending = dayAll.filter((e) => e.type !== 'excused' && !e.emailed && student(e.studentId)?.guardianEmail).length;
  return `<div class="toolbar"><label class="muted">اليوم</label><input type="date" class="input" value="${d}" data-change="attDate" style="width:auto">
      <label class="muted">الفصل</label><select class="input" data-change="attClass" style="width:auto">${classes.map((c) => `<option ${ui.attClass === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <button class="btn sm" data-act="attAllPresent">✓ الكل حاضرات</button><span class="spacer" style="flex:1"></span>
      <span class="chip red">غائبات: ${cnt('absent')}</span><span class="chip amber">متأخرات: ${cnt('late')}</span><span class="chip blue">بعذر: ${cnt('excused')}</span>
      <button class="btn ${pending ? 'primary' : ''} sm" data-act="stuNotify" data-id="absent">📧 إشعار أولياء الأمور${pending ? ` (${pending})` : ''}</button></div>
    ${list.length ? `<div class="card att-list">${list.map((s, i) => { const e = attOf(s.id, d), st = e?.type || 'present'; return `<div class="att-row"><span class="muted att-n">${i + 1}</span><a href="#" class="link grow" data-act="stuOpen" data-id="${s.id}">${esc(s.name)}</a>
      <div class="seg att-seg">${ATT.map(([k, l, c]) => `<button class="${st === k ? 'on att-' + c : ''}" data-act="stuAtt" data-id="${s.id}" data-s="${k}">${l}</button>`).join('')}</div>${e?.emailed ? '<span class="chip" title="أُرسل إشعار">📧</span>' : ''}</div>`; }).join('')}</div>`
      : `<div class="card">${emptyState('🗓️', 'أضيفي الطالبات أولاً من تبويب «القائمة»')}</div>`}
    <div class="muted" style="margin-top:8px;font-size:12.5px">الطالبات حاضرات افتراضياً؛ اضغطي «غائبة» أو «متأخرة» فقط لمن تنطبق عليها. يُحفظ كل شيء تلقائياً.</div>`;
}
function stuHonors() {
  const [ys, ye] = sYear();
  const ach = db.studentLog.filter((e) => e.type === 'achieve' && e.date >= ys && e.date <= ye).sort((a, b) => b.date.localeCompare(a.date));
  const by = {}; ach.forEach((e) => (by[e.studentId] = (by[e.studentId] || 0) + 1));
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const pending = ach.filter((e) => !e.emailed && student(e.studentId)?.guardianEmail).length;
  return `<div class="toolbar"><button class="btn primary" data-act="stuAchieve">🏅 تسجيل تميز</button><button class="btn" data-act="stuCerts">🎓 شهادات شكر جماعية (PDF)</button>
      <button class="btn" data-act="stuNotify" data-id="achieve">📧 تهنئة أولياء الأمور${pending ? ` (${pending})` : ''}</button></div>
    <div class="grid g2" style="align-items:start">
      <div class="card"><h3>🏆 لوحة الشرف — هذا العام</h3>${top.length ? `<div class="list">${top.map(([id, n], i) => { const s = student(id); return s ? `<div class="li"><span class="honor-rank r${i}">${i + 1}</span><div class="grow"><a href="#" class="link t" data-act="stuOpen" data-id="${id}">${esc(s.name)}</a><div class="s">${esc(sClass(s))}</div></div><span class="chip green">${n} تميز</span></div>` : ''; }).join('')}</div>` : emptyState('🏆', 'سجّلي تميز الطالبات لتظهر لوحة الشرف')}</div>
      <div class="card"><h3>🏅 آخر حالات التميز</h3>${ach.length ? `<div class="list" style="max-height:60vh;overflow:auto">${ach.slice(0, 60).map((e) => { const s = student(e.studentId); return s ? `<div class="li"><div class="grow"><div class="t">${esc(s.name)} <span class="muted">· ${esc(sClass(s))}</span></div><div class="s">${esc(e.text || '')} · ${fmtH(e.date)}</div></div>${e.emailed ? '<span class="chip">📧 أُرسلت</span>' : ''}<button class="icon-btn" data-act="stuCertOne" data-id="${e.id}" title="شهادة">🎓</button></div>` : ''; }).join('')}</div>` : emptyState('🏅', 'لا توجد حالات تميز بعد')}</div>
    </div>`;
}
VIEWS.students = {
  actions: () => `<button class="btn" data-act="stuExport">⬇ Excel</button><button class="btn" data-act="stuImport">⬆ استيراد Excel</button><button class="btn primary" data-act="stuAdd">＋ طالبة</button>`,
  render() {
    const tab = ui.stuTab || 'list';
    return `<div class="seg" style="margin-bottom:14px">${[['list', '📋 القائمة'], ['att', '🗓️ الغياب اليومي'], ['leave', '🚪 الاستئذان'], ['honor', '🏅 التميز والشكر']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="stuTab" data-id="${k}">${l}</button>`).join('')}</div>
      ${tab === 'att' ? stuAttendance() : tab === 'leave' ? stuLeaves() : tab === 'honor' ? stuHonors() : stuList()}`;
  },
};

// ───── ملف الطالبة ─────
VIEWS.student = {
  actions: () => `<button class="btn" data-act="nav" data-id="students">→ الطالبات</button><button class="btn" data-act="stuPrint">🖨 طباعة الملف</button><button class="btn" data-act="stuCertCur">🎓 شهادة شكر</button><button class="btn primary" data-act="stuEntry" data-id="${ui.studentId}">➕ إضافة</button>`,
  render() {
    const s = student(ui.studentId);
    if (!s) return `<div class="card">${emptyState('👧', 'اختاري طالبة من القائمة')}</div>`;
    const c = sCounts(s.id), log = sLog(s.id, false).sort((a, b) => b.date.localeCompare(a.date));
    const stat = (n, l, col = '') => `<div class="card stat"><span class="n" ${col ? `style="color:${col}"` : ''}>${n}</span><span class="l">${l}</span></div>`;
    return `<div class="card tp-head"><div class="tp-avatar">${esc(s.name.trim()[0] || '؟')}</div><div class="grow"><div class="tp-name">${esc(s.name)}</div>
        <div class="muted">${esc(sClass(s))}${s.halaqa ? ' · الحلقة: ' + esc(s.halaqa) : ''}${s.idNo ? ` · الهوية: <span dir="ltr">${esc(s.idNo)}</span>` : ''}</div>
        <div class="muted">ولي الأمر: ${esc(s.guardian || '—')}${s.guardianPhone ? ` · <span dir="ltr">${esc(s.guardianPhone)}</span>` : ''}${s.guardianEmail ? ` · <span dir="ltr">${esc(s.guardianEmail)}</span>` : ''}</div>
        ${s.hifz ? `<div class="muted">📖 المحفوظ: <b>${esc(s.hifz)}</b></div>` : ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${s.guardianEmail ? `<button class="btn sm" data-act="openUrl" data-id="${esc(gmail(s.guardianEmail))}">📧 مراسلة ولي الأمر</button>` : ''}<button class="btn sm" data-act="stuEdit" data-id="${s.id}">✏️ تعديل</button><button class="btn sm danger" data-act="stuDel" data-id="${s.id}">🗑️</button></div></div>
      <div class="grid g4" style="margin:16px 0">${stat(c.absent, 'غياب', c.absent ? 'var(--red)' : '')}${stat(c.late, 'تأخر', c.late ? 'var(--amber)' : '')}${stat(c.excused, 'غياب بعذر')}${stat(c.achieve, 'تميز', c.achieve ? 'var(--green)' : '')}</div>
      <div class="card"><h3>🗂️ السجل${log.length ? ` (${log.length})` : ''}</h3>${log.length ? `<div class="list">${log.map((e) => { const T = SL_TYPES[e.type] || SL_TYPES.note; return `<div class="li"><span>${T.ic}</span><div class="grow"><div class="t">${T.l}${e.text ? ' — ' + esc(e.text) : ''}</div><div class="s">${dayName(e.date)} ${fmtH(e.date)} (${fmtG(e.date)})${e.emailed ? ' · 📧 أُبلغ ولي الأمر' : ''}</div></div>${['absent', 'late', 'achieve'].includes(e.type) && s.guardianEmail ? `<button class="btn sm" data-act="stuMailOne" data-id="${e.id}">📧</button>` : ''}<button class="icon-btn" data-act="stuLogDel" data-id="${e.id}">🗑️</button></div>`; }).join('')}</div>` : emptyState('🌿', 'لا توجد ملاحظات أو غياب مسجّل')}</div>`;
  },
  after() { const s = student(ui.studentId); if (s) $('#pageTitle').textContent = `👧 ${s.name}`; },
};

// ───── النماذج ─────
const stuFieldsForm = () => [
  { key: 'name', label: 'اسم الطالبة', type: 'text', required: true, full: true },
  { key: 'grade', label: 'الصف', type: 'text', list: [...new Set(db.students.map((s) => s.grade).filter(Boolean))] },
  { key: 'cls', label: 'الفصل / الشعبة', type: 'text', list: [...new Set(db.students.map((s) => s.cls).filter(Boolean))] },
  { key: 'halaqa', label: 'الحلقة', type: 'text', list: [...new Set(db.students.map((s) => s.halaqa).filter(Boolean))] },
  { key: 'idNo', label: 'رقم الهوية', type: 'text' },
  { key: 'guardian', label: 'اسم ولي الأمر', type: 'text' },
  { key: 'guardianEmail', label: 'بريد ولي الأمر', type: 'email' },
  { key: 'guardianPhone', label: 'جوال ولي الأمر', type: 'tel' },
  { key: 'hifz', label: 'المحفوظ الحالي', type: 'text', hint: 'مثال: جزء عمّ كاملاً + سورة الملك' },
  { key: 'notes', label: 'ملاحظات', type: 'textarea', full: true, rows: 2 },
];
function openStudent(s) {
  formModal({ title: s ? `تعديل — ${s.name}` : 'إضافة طالبة', fields: stuFieldsForm(), values: s || {}, wide: true,
    validate: (v) => (v.guardianEmail && !/^\S+@\S+\.\S+$/.test(v.guardianEmail) ? 'بريد ولي الأمر غير صحيح' : null),
    onSave: (v) => { if (s) Object.assign(s, v); else db.students.push({ id: uid(), ...v, createdAt: todayISO() }); commit(); toast(s ? 'حُفظ التعديل' : 'أُضيفت الطالبة', 'ok'); } });
}
function openEntry(sid, preset = {}) {
  const s = student(sid);
  formModal({ title: `إضافة إلى سجل ${s.name}`, fields: [
    { key: 'type', label: 'النوع', type: 'select', options: Object.entries(SL_TYPES).map(([k, t]) => [k, `${t.ic} ${t.l}`]) },
    { key: 'date', label: 'التاريخ', type: 'date' },
    { key: 'text', label: 'التفاصيل', type: 'textarea', full: true, rows: 2, voice: true, hint: 'مثال: حفظت سورة الملك كاملة، أو: المركز الأول في مسابقة التلاوة' },
  ], values: { type: 'achieve', date: todayISO(), ...preset }, onSave: (v) => {
    if (['absent', 'late', 'excused'].includes(v.type)) db.studentLog = db.studentLog.filter((e) => !(e.studentId === sid && e.date === v.date && ['absent', 'late', 'excused'].includes(e.type)));
    db.studentLog.push({ id: uid(), studentId: sid, ...v }); commit(); toast('أُضيف إلى السجل', 'ok');
  } });
}

// ───── الاستيراد ─────
const STU = { rows: null, map: null, file: '' };
function stuDetect(rows) {
  // صف العناوين: أول صف (من أول 10) فيه عمود يشبه «الاسم»
  let hi = rows.slice(0, 10).findIndex((r) => r.some((c) => /اسم|name/i.test(String(c))));
  if (hi < 0) hi = 0;
  const head = rows[hi].map((h) => String(h).replace(/\s+/g, ' ').trim());
  const map = {}; const used = new Set();
  STU_FIELDS.forEach(([k, , keys]) => { const j = head.findIndex((h, i) => !used.has(i) && keys.some((x) => h.toLowerCase().includes(x.toLowerCase()))); if (j >= 0) { map[k] = j; used.add(j); } });
  if (map.name == null) map.name = 0;
  return { hi, head, map };
}
function stuImportModal() {
  const { rows, hi, head, map } = STU;
  const data = rows.slice(hi + 1).filter((r) => String(r[map.name] ?? '').trim());
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal wide"><div class="modal-h"><h2>⬆ استيراد الطالبات — ${esc(STU.file)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b"><div class="muted" style="margin-bottom:10px">تعرّف البرنامج على الأعمدة تلقائياً؛ تأكدي منها أو غيّريها. وُجدت <b>${data.length}</b> طالبة.</div>
      <div class="form">${STU_FIELDS.map(([k, l]) => `<div class="field"><label>${l}${k === 'name' ? ' <span style="color:var(--red)">*</span>' : ''}</label><select class="input" data-change="stuMap" data-id="${k}"><option value="">— لا يوجد —</option>${head.map((h, i) => `<option value="${i}" ${map[k] === i ? 'selected' : ''}>${esc(h || 'عمود ' + (i + 1))}</option>`).join('')}</select></div>`).join('')}</div>
      <div class="section-title">معاينة</div><div style="overflow:auto"><table class="table"><thead><tr>${STU_FIELDS.filter(([k]) => map[k] != null).map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${data.slice(0, 5).map((r) => `<tr>${STU_FIELDS.filter(([k]) => map[k] != null).map(([k]) => `<td>${esc(r[map[k]] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="muted" style="margin-top:8px">الطالبة الموجودة مسبقاً (بنفس رقم الهوية، أو بنفس الاسم إن لم توجد هوية) تُحدَّث بياناتها ولا تتكرر، ويبقى سجلها كما هو.</div></div>
    <div class="modal-f"><button class="btn primary" data-act="stuImportGo">استيراد ${data.length} طالبة</button><button class="btn" data-act="modalClose">إلغاء</button></div></div></div>`;
  modalCtx = {};
}

// ───── إشعار أولياء الأمور (طابور رسائل Gmail) ─────
const NQ = { kind: null, list: [], i: 0 };
function stuNotifyModal() {
  const [su, body] = stuMsg(NQ.kind), cur = NQ.list[NQ.i];
  const done = NQ.i >= NQ.list.length;
  const msgFor = (e) => { const s = student(e.studentId); const ex = { date: e.date, state: SL_TYPES[e.type]?.l === 'تأخر' ? 'متأخرة' : 'غائبة', reason: e.text || '' }; return [sFill(su, s, ex), sFill(body, s, ex)]; };
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal wide"><div class="modal-h"><h2>📧 ${NQ.kind === 'achieve' ? 'تهنئة أولياء الأمور' : 'إشعار أولياء الأمور بالغياب والتأخر'}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b">
      <details class="adv"><summary>✏️ تعديل نص الرسالة</summary><div class="form" style="margin-top:10px">
        <div class="field full"><label>الموضوع</label><input class="input" data-change="stuMsgSu" value="${esc(su)}"></div>
        <div class="field full"><label>النص</label><textarea class="input" rows="7" data-change="stuMsgBody">${esc(body)}</textarea><span class="hint">الرموز: {الاسم} {الفصل} {ولي الأمر} {التاريخ} {الحالة} {السبب} {المدرسة}</span></div></div></details>
      ${done ? `<div class="empty"><span class="e-ic">✅</span>انتهت الرسائل (${NQ.list.length}).</div>` : `
        <div class="muted" style="margin:10px 0">الرسالة ${NQ.i + 1} من ${NQ.list.length} — تُفتح في Gmail جاهزة، اضغطي «إرسال» هناك ثم عودي هنا للتالية.</div>
        <div class="card" style="background:#f8faf9"><b>إلى: ${esc(student(cur.studentId).guardian || '')} &lt;<span dir="ltr">${esc(student(cur.studentId).guardianEmail)}</span>&gt;</b><div style="white-space:pre-wrap;margin-top:8px">${esc(msgFor(cur)[1])}</div></div>`}
    </div>
    <div class="modal-f">${done ? '' : `<button class="btn primary" data-act="stuNotifyOpen">📧 فتح الرسالة في Gmail</button><button class="btn" data-act="stuNotifySkip">تخطّي</button>`}<button class="btn" data-act="modalClose">إغلاق</button></div></div></div>`;
  modalCtx = { notify: true, msgFor };
}

// ───── الشهادات ─────
function stuCertObjs(name, reason) {
  const keep = [DS.size, DS.teacherName]; DS.size = 'landscape'; DS.teacherName = '';
  const x = dTemplate('cert'); [DS.size, DS.teacherName] = keep;
  x.objs.forEach((o) => {
    if (o.t !== 'text') return;
    if (/^ل?الأستاذة\s*\//.test(o.text)) o.text = `للطالبة / ${name}`;
    else if (/أن تتقدم/.test(o.text)) o.text = 'يسرّ إدارة المدرسة أن تتقدم بخالص الشكر والتقدير';
    else if (/نظير جهودها/.test(o.text)) o.text = reason ? `${reason}` : 'لتميّزها واجتهادها';
    else if (/سائلين المولى/.test(o.text)) o.text = 'متمنين لها مزيداً من التفوق والنجاح';
  });
  return x;
}
async function stuCertsPdf(items) {
  const L = await loadPdfLib(); const doc = await L.PDFDocument.create();
  const [w, h] = DSIZES.landscape;
  for (const [name, reason] of items) {
    const x = stuCertObjs(name, reason);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d');
    ctx.fillStyle = x.bg; ctx.fillRect(0, 0, w, h); x.objs.forEach((o) => dPaint(ctx, o));
    const b = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.93));
    const img = await doc.embedJpg(await b.arrayBuffer());
    doc.addPage([842, 595]).drawImage(img, { x: 0, y: 0, width: 842, height: 595 });
  }
  return new Blob([await doc.save()], { type: 'application/pdf' });
}
function stuCertToDesigner(name, reason) {
  const x = stuCertObjs(name, reason);
  Object.assign(DS, { size: 'landscape', bg: x.bg, objs: x.objs, sel: null, id: null, name: `شهادة شكر — ${name}`, undo: [], redo: [] });
  ui.tool = 'designer'; go('tools'); toast('جُهّزت الشهادة باسمها — عدّليها ثم صدّريها PDF أو صورة', 'ok');
}

Object.assign(ACTIONS, {
  stuTab: (el) => { ui.stuTab = el.dataset.id; render(); },
  stuAdd: () => openStudent(null),
  stuEdit: (el) => openStudent(student(el.dataset.id)),
  stuOpen: (el, e) => { e?.preventDefault(); ui.studentId = el.dataset.id; go('student'); },
  stuDel: (el) => { const s = student(el.dataset.id); confirmBox(`حذف الطالبة «${s.name}» وسجلها؟`, () => { db.students = db.students.filter((x) => x !== s); db.studentLog = db.studentLog.filter((e) => e.studentId !== s.id); ui.view = 'students'; commit(); }); },
  stuEntry: (el) => openEntry(el.dataset.id),
  stuLogDel: (el) => confirmBox('حذف هذا البند من السجل؟', () => { db.studentLog = db.studentLog.filter((e) => e.id !== el.dataset.id); commit(); }),
  stuPaste: () => formModal({ title: 'لصق أسماء الطالبات', wide: true, fields: [{ key: 'grade', label: 'الصف', type: 'text' }, { key: 'cls', label: 'الفصل', type: 'text' }, { key: 'list', label: 'الأسماء — طالبة في كل سطر', type: 'textarea', full: true, rows: 12 }],
    onSave: (v) => { const names = prLines(v.list); names.forEach((n) => { if (!db.students.some((s) => normName(s.name) === normName(n) && s.grade === v.grade && s.cls === v.cls)) db.students.push({ id: uid(), name: n, grade: v.grade, cls: v.cls, createdAt: todayISO() }); }); commit(); toast(`أُضيفت ${names.length} طالبة`, 'ok'); } }),
  stuTemplate: async () => { openBlob(await buildXlsx([STU_FIELDS.map(([, l]) => l), ['مثال: سارة محمد', 'الأول', '1', 'حلقة أبي بكر', '', 'محمد', 'parent@gmail.com', '05xxxxxxxx']], STU_FIELDS.map(() => 22), 'الطالبات'), 'نموذج-الطالبات.xlsx', true); toast('حُفظ النموذج في «التنزيلات»', 'ok'); },
  stuImport: async () => {
    const [f] = await pickFiles('.xlsx,.csv'); if (!f) return;
    try { const wb = await readWorkbook(f); if (!wb.length) return toast('الملف فارغ', 'err'); STU.rows = wb[0].rows; STU.file = f.name; Object.assign(STU, stuDetect(STU.rows)); stuImportModal(); }
    catch (e) { toast('تعذّرت قراءة الملف: ' + e.message, 'err'); }
  },
  stuImportGo: () => {
    const { rows, hi, map } = STU; let add = 0, upd = 0;
    rows.slice(hi + 1).forEach((r) => {
      const v = {}; STU_FIELDS.forEach(([k]) => { if (map[k] != null) v[k] = String(r[map[k]] ?? '').trim(); });
      if (!v.name) return;
      const ex = db.students.find((s) => (v.idNo && s.idNo && s.idNo === v.idNo) || (!v.idNo && normName(s.name) === normName(v.name)));
      if (ex) { Object.entries(v).forEach(([k, x]) => { if (x) ex[k] = x; }); upd++; } else { db.students.push({ id: uid(), ...v, createdAt: todayISO() }); add++; }
    });
    closeModal(); ui.stuTab = 'list'; commit(); toast(`أُضيفت ${add} طالبة${upd ? ` وحُدّثت ${upd}` : ''}`, 'ok');
  },
  stuExport: async () => {
    const rows = [[...STU_FIELDS.map(([, l]) => l), 'المحفوظ', 'غياب', 'تأخر', 'بعذر', 'تميز'], ...stuFiltered().map((s) => { const c = sCounts(s.id); return [...STU_FIELDS.map(([k]) => s[k] || ''), s.hifz || '', c.absent, c.late, c.excused, c.achieve]; })];
    openBlob(await buildXlsx(rows, rows[0].map((h, i) => (i === 0 ? 28 : 14)), 'الطالبات'), 'الطالبات.xlsx', true); toast('حُفظ ملف Excel في «التنزيلات»', 'ok');
  },
  stuAtt: (el) => {
    const d = ui.attDate || todayISO(), id = el.dataset.id, st = el.dataset.s;
    const old = attOf(id, d); db.studentLog = db.studentLog.filter((e) => e !== old);
    if (st !== 'present') db.studentLog.push({ id: uid(), studentId: id, date: d, type: st, text: '' });
    commit(false);
    const row = el.closest('.att-row'); row.querySelectorAll('.att-seg button').forEach((b) => { const c = ATT.find((a) => a[0] === b.dataset.s)[2]; b.className = b.dataset.s === st ? 'on att-' + c : ''; });
    clearTimeout(ST.attT); ST.attT = setTimeout(render, 900);
  },
  attAllPresent: () => { const d = ui.attDate || todayISO(); const ids = new Set(db.students.filter((s) => sClass(s) === ui.attClass).map((s) => s.id)); db.studentLog = db.studentLog.filter((e) => !(ids.has(e.studentId) && e.date === d && ['absent', 'late', 'excused'].includes(e.type))); commit(); },
  stuAchieve: () => {
    if (!db.students.length) return toast('أضيفي الطالبات أولاً');
    formModal({ title: '🏅 تسجيل تميز', wide: true, fields: [
      { key: 'sid', label: 'الطالبة', type: 'select', full: true, options: db.students.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((s) => [s.id, `${s.name} — ${sClass(s)}`]) },
      { key: 'date', label: 'التاريخ', type: 'date' }, { key: 'text', label: 'سبب التميز', type: 'text', full: true, required: true, hint: 'مثال: المركز الأول في مسابقة حفظ جزء عمّ' }],
      values: { date: todayISO() }, onSave: (v) => { db.studentLog.push({ id: uid(), studentId: v.sid, date: v.date, type: 'achieve', text: v.text }); commit(); toast('سُجّل التميز', 'ok'); } });
  },
  stuNotify: (el) => {
    const kind = el.dataset.id, d = ui.attDate || todayISO();
    const list = db.studentLog.filter((e) => !e.emailed && student(e.studentId)?.guardianEmail && (kind === 'achieve' ? e.type === 'achieve' : (['absent', 'late'].includes(e.type) && e.date === d)));
    if (!list.length) return toast(kind === 'achieve' ? 'لا توجد حالات تميز لم يُبلَّغ أولياء أمورها' : 'لا توجد غائبات أو متأخرات لهن بريد ولي أمر في هذا اليوم');
    Object.assign(NQ, { kind, list, i: 0 }); stuNotifyModal();
  },
  stuNotifyOpen: () => { const e = NQ.list[NQ.i], s = student(e.studentId); const [su, b] = modalCtx.msgFor(e); api.openUrl(gmail(s.guardianEmail, su, b)); e.emailed = true; e.emailedAt = todayISO(); commit(false); NQ.i++; stuNotifyModal(); },
  stuNotifySkip: () => { NQ.i++; stuNotifyModal(); },
  stuMailOne: (el) => { const e = db.studentLog.find((x) => x.id === el.dataset.id); Object.assign(NQ, { kind: e.type === 'achieve' ? 'achieve' : 'absent', list: [e], i: 0 }); stuNotifyModal(); },
  stuCertOne: (el) => { const e = db.studentLog.find((x) => x.id === el.dataset.id); stuCertToDesigner(student(e.studentId).name, e.text ? `لتميّزها: ${e.text}` : ''); },
  stuCertCur: () => { const s = student(ui.studentId); const last = sLog(s.id).filter((e) => e.type === 'achieve').pop(); stuCertToDesigner(s.name, last?.text ? `لتميّزها: ${last.text}` : ''); },
  stuCerts: () => {
    const classes = sClasses();
    formModal({ title: '🎓 شهادات شكر جماعية', wide: true, fields: [
      { key: 'who', label: 'لمن؟', type: 'select', full: true, options: [['ach', 'المتميزات المسجّلات هذا العام (كل تميز بسببه)'], ...classes.map((c) => ['c:' + c, `كل طالبات ${c}`])] },
      { key: 'reason', label: 'نص الشكر (للفصل كاملاً)', type: 'text', full: true, hint: 'مثال: لانضباطها وتميزها في الفصل الدراسي الأول' }],
      values: { who: 'ach' }, onSave: async (v) => {
        let items;
        if (v.who === 'ach') { const [ys, ye] = sYear(); items = db.studentLog.filter((e) => e.type === 'achieve' && e.date >= ys && e.date <= ye && student(e.studentId)).map((e) => [student(e.studentId).name, e.text ? `لتميّزها: ${e.text}` : '']); }
        else items = db.students.filter((s) => sClass(s) === v.who.slice(2)).sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((s) => [s.name, v.reason || '']);
        if (!items.length) return toast('لا توجد طالبات لهذا الاختيار');
        toast(`جارٍ إنشاء ${items.length} شهادة…`);
        try { openBlob(await stuCertsPdf(items), `شهادات-شكر-${items.length}.pdf`, true); toast('حُفظ ملف الشهادات في «التنزيلات» — صفحة لكل طالبة', 'ok'); } catch (e) { toast('تعذّر الإنشاء: ' + e.message, 'err'); }
      } });
  },
  stuPrint: () => {
    const s = student(ui.studentId); if (!s) return; const c = sCounts(s.id), log = sLog(s.id).sort((a, b) => a.date.localeCompare(b.date));
    printDoc(`ملف الطالبة — ${s.name}`, `<table><tbody><tr><th style="width:140px">الاسم</th><td>${esc(s.name)}</td><th style="width:120px">الفصل</th><td>${esc(sClass(s))}</td></tr><tr><th>الحلقة</th><td>${esc(s.halaqa || '')}</td><th>المحفوظ</th><td>${esc(s.hifz || '')}</td></tr><tr><th>ولي الأمر</th><td>${esc(s.guardian || '')}</td><th>التواصل</th><td dir="ltr">${esc([s.guardianPhone, s.guardianEmail].filter(Boolean).join(' · '))}</td></tr></tbody></table>
      <p>غياب: <b>${c.absent}</b> — تأخر: <b>${c.late}</b> — بعذر: <b>${c.excused}</b> — تميز: <b>${c.achieve}</b></p>
      ${log.length ? `<table><thead><tr><th>التاريخ</th><th>النوع</th><th>التفاصيل</th></tr></thead><tbody>${log.map((e) => `<tr><td>${fmtH(e.date)}</td><td>${SL_TYPES[e.type]?.l || ''}</td><td>${esc(e.text || '')}</td></tr>`).join('')}</tbody></table>` : ''}`);
  },
});
Object.assign(CHANGES, {
  stuClass: (el) => { ui.stuClass = el.value; render(); },
  attDate: (el) => { if (el.value) { ui.attDate = el.value; render(); } },
  attClass: (el) => { ui.attClass = el.value; render(); },
  stuMap: (el) => { const v = el.value; if (v === '') delete STU.map[el.dataset.id]; else STU.map[el.dataset.id] = +v; stuImportModal(); },
  stuMsgSu: (el) => { const m = stuMsg(NQ.kind); db.settings['stuMsg_' + NQ.kind] = [el.value, m[1]]; commit(false); stuNotifyModal(); },
  stuMsgBody: (el) => { const m = stuMsg(NQ.kind); db.settings['stuMsg_' + NQ.kind] = [m[0], el.value]; commit(false); stuNotifyModal(); },
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'stuSearch') return;
  clearTimeout(ST.stuT); ST.stuT = setTimeout(() => { ui.stuQ = e.target.value; const pos = e.target.selectionStart; render(); const n = $('#stuSearch'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250);
});

// لوحة اليوم: غياب الطالبات
addHook('dashCards', (t) => {
  if (!db.students?.length) return '';
  const day = db.studentLog.filter((e) => e.date === t && ['absent', 'late', 'excused'].includes(e.type));
  const a = day.filter((e) => e.type === 'absent').length, l = day.filter((e) => e.type === 'late').length;
  return `<div class="card"><h3>👧 الطالبات اليوم</h3><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="chip red">غائبات: ${a}</span><span class="chip amber">متأخرات: ${l}</span><span class="chip">من ${db.students.length}</span></div><button class="btn sm primary" data-act="stuGoAtt">🗓️ تسجيل غياب اليوم</button></div>`;
});
ACTIONS.stuGoAtt = () => { ui.stuTab = 'att'; ui.attDate = todayISO(); go('students'); };

// الجداول والإحصائيات: جداول من بيانات الطالبات
ST_APP.push(['stuClass', '👧 الطالبات حسب الفصل'], ['stuAbs', '📋 غياب الطالبات حسب الفصل'], ['stuAch', '🏅 تميز الطالبات حسب الفصل']);
const _stFromApp = stFromApp;
stFromApp = function (kind) {
  if (!kind.startsWith('stu')) return _stFromApp(kind);
  const classes = sClasses(), [ys, ye] = sYear(), inY = (e) => e.date >= ys && e.date <= ye;
  const count = (fn) => classes.map((c) => [c, db.students.filter((s) => sClass(s) === c).reduce((n, s) => n + fn(s), 0)]);
  if (kind === 'stuClass') return ['أعداد الطالبات حسب الفصل', [['الفصل', 'عدد الطالبات'], ...count(() => 1)], 'column'];
  if (kind === 'stuAbs') return ['غياب الطالبات حسب الفصل (هذا العام)', [['الفصل', 'غياب', 'تأخر'], ...classes.map((c) => { const ids = new Set(db.students.filter((s) => sClass(s) === c).map((s) => s.id)); const L = db.studentLog.filter((e) => ids.has(e.studentId) && inY(e)); return [c, L.filter((e) => e.type === 'absent').length, L.filter((e) => e.type === 'late').length]; })], 'column'];
  return ['تميز الطالبات حسب الفصل (هذا العام)', [['الفصل', 'حالات التميز'], ...count((s) => db.studentLog.filter((e) => e.studentId === s.id && e.type === 'achieve' && inY(e)).length)], 'bar'];
};

// ───── 🚪 استئذان الطالبات وخروجهن (1.0.8) ─────
function stuLeaves() {
  const d = ui.leaveDate || todayISO();
  const list = db.studentLog.filter((e) => e.type === 'leave' && e.date === d).sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  return `<div class="toolbar"><label class="muted">اليوم</label><input type="date" class="input" value="${d}" data-change="leaveDate" style="width:auto"><span class="spacer" style="flex:1"></span>
      <span class="chip blue">استئذان اليوم: ${list.length}</span><button class="btn primary" data-act="leaveNew">🚪 تسجيل استئذان</button></div>
    ${list.length ? `<div class="card" style="padding:0;overflow:auto"><table class="table"><thead><tr><th>الوقت</th><th>الطالبة</th><th>الفصل</th><th>المستلم</th><th>السبب</th><th></th></tr></thead><tbody>
      ${list.map((e) => { const s = student(e.studentId); return s ? `<tr><td dir="ltr" style="text-align:right">${esc(e.time || '')}</td><td><a href="#" class="link" data-act="stuOpen" data-id="${s.id}"><b>${esc(s.name)}</b></a></td><td>${esc(sClass(s))}</td><td>${esc(e.receiver || '')}${e.relation ? ` <span class="muted">(${esc(e.relation)})</span>` : ''}</td><td>${esc(e.text || '')}</td>
        <td class="actions"><button class="btn sm" data-act="leaveSlip" data-id="${e.id}">🖨 قسيمة</button><button class="icon-btn" data-act="stuLogDel" data-id="${e.id}">🗑️</button></td></tr>` : ''; }).join('')}</tbody></table></div>`
      : `<div class="card">${emptyState('🚪', 'لا يوجد استئذان مسجّل في هذا اليوم.<br>سجّلي خروج الطالبة مع ولي أمرها، واطبعي قسيمة الخروج بضغطة.')}</div>`}`;
}
function leaveSlip(e) {
  const s = student(e.studentId), school = db.settings.schoolName || '';
  const one = (copy) => `<div class="slip"><div style="display:flex;justify-content:space-between"><b>${esc(school)}</b><span>${copy}</span></div>
    <h2 style="text-align:center;margin:8px 0">قسيمة خروج طالبة</h2>
    <table><tbody><tr><td style="width:28%"><b>اسم الطالبة</b></td><td>${esc(s.name)}</td></tr><tr><td><b>الفصل</b></td><td>${esc(sClass(s))}</td></tr>
    <tr><td><b>اليوم والتاريخ</b></td><td>${dayName(e.date)} ${fmtH(e.date)}</td></tr><tr><td><b>وقت الخروج</b></td><td>${esc(e.time || '')}</td></tr>
    <tr><td><b>المستلم</b></td><td>${esc(e.receiver || '')}${e.relation ? ` (${esc(e.relation)})` : ''}${e.receiverId ? ` — هوية: ${esc(e.receiverId)}` : ''}</td></tr><tr><td><b>السبب</b></td><td>${esc(e.text || '')}</td></tr></tbody></table>
    <table class="noborder" style="width:100%;margin-top:10px"><tbody><tr><td style="text-align:center">توقيع المستلم<br><br>.................</td><td style="text-align:center">${esc(db.settings.signerTitle || 'المساعد الإداري')}<br><br>.................</td></tr></tbody></table></div>`;
  printDoc(`قسيمة خروج — ${s.name}`, `${one('نسخة المدرسة')}<div style="border-top:2px dashed #999;margin:18px 0"></div>${one('نسخة البوابة')}`);
}
const nowHM = () => new Date().toTimeString().slice(0, 5);
Object.assign(ACTIONS, {
  leaveNew: () => {
    if (!db.students.length) return toast('أضيفي الطالبات أولاً');
    formModal({ title: '🚪 تسجيل استئذان طالبة', wide: true, fields: [
      { key: 'sid', label: 'الطالبة', type: 'select', full: true, options: db.students.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((s) => [s.id, `${s.name} — ${sClass(s)}`]) },
      { key: 'time', label: 'وقت الخروج', type: 'time' }, { key: 'date', label: 'التاريخ', type: 'date' },
      { key: 'receiver', label: 'اسم المستلم', type: 'text', required: true }, { key: 'relation', label: 'صلة القرابة', type: 'select', options: ['الأب', 'الأم', 'الأخ', 'الأخت', 'السائق', 'أخرى'] },
      { key: 'receiverId', label: 'رقم هوية المستلم (اختياري)', type: 'text' }, { key: 'text', label: 'سبب الاستئذان', type: 'text', full: true, list: ['موعد طبي', 'ظرف عائلي', 'مرض', 'سفر'] },
      { key: 'print', label: 'طباعة قسيمة الخروج بعد الحفظ', type: 'checkbox', full: true }],
      values: { date: ui.leaveDate || todayISO(), time: nowHM(), relation: 'الأب', print: true },
      onSave: (v) => { const e = { id: uid(), studentId: v.sid, date: v.date, type: 'leave', time: v.time, receiver: v.receiver, relation: v.relation, receiverId: v.receiverId, text: v.text }; db.studentLog.push(e); commit(); toast('سُجّل الاستئذان', 'ok'); if (v.print) setTimeout(() => leaveSlip(e), 80); } });
  },
  leaveSlip: (el) => leaveSlip(db.studentLog.find((e) => e.id === el.dataset.id)),
});
CHANGES.leaveDate = (el) => { if (el.value) { ui.leaveDate = el.value; render(); } };
