/* المساعد الإداري — الإضافات: جدول الحصص، التقرير الشهري، القفل، أرصدة الإجازات، جدول المناوبة، التحديث التلقائي */
'use strict';

// ═════════════ أدوات مشتركة ═════════════
const normName = (s) => String(s || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ًٌٍَُِّْـ]/g, '').replace(/\s+/g, ' ').trim();
const toNum = (v) => parseInt(String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10);
const WEEKDAYS = [0, 1, 2, 3, 4]; // الأحد – الخميس
const ORDINALS = ['الاولي', 'الثانيه', 'الثالثه', 'الرابعه', 'الخامسه', 'السادسه', 'السابعه', 'الثامنه', 'التاسعه', 'العاشره'];
function findTeacher(name) {
  const n = normName(name); if (!n) return null;
  const exact = db.teachers.find((t) => normName(t.name) === n);
  if (exact) return exact;
  const part = db.teachers.filter((t) => { const m = normName(t.name); return n.split(' ').length >= 2 && (m.startsWith(n) || n.startsWith(m)); });
  return part.length === 1 ? part[0] : null;
}
function teacherByNameOrCreate(name, extra = {}) {
  let t = findTeacher(name);
  if (!t) { t = { id: uid(), name: String(name).trim(), email: '', phone: '', subject: '', ...extra }; db.teachers.push(t); t._new = true; }
  return t;
}
function parseDay(v) {
  const s = normName(v);
  const names = ['الاحد', 'الاثنين', 'الثلاثاء', 'الاربعاء', 'الخميس'];
  const i = names.findIndex((d) => s.includes(d) || s.includes(d.replace('ال', '')));
  if (i >= 0) return i;
  const en = ['sun', 'mon', 'tue', 'wed', 'thu'].findIndex((d) => s.toLowerCase().startsWith(d));
  if (en >= 0) return en;
  const n = toNum(v); return n >= 1 && n <= 5 ? n - 1 : -1;
}
function parsePeriod(v) {
  const n = toNum(v); if (n >= 1 && n <= 12) return n;
  const s = normName(v); const i = ORDINALS.findIndex((o) => s.includes(o)); return i >= 0 ? i + 1 : -1;
}
function headerIndex(head, ...names) {
  const H = head.map((h) => normName(h).replace(/\s/g, ''));
  return H.findIndex((h) => names.some((n) => h.includes(normName(n).replace(/\s/g, ''))));
}
const periodsList = () => Array.from({ length: Number(db.settings.periods) || 7 }, (_, i) => i + 1);
const classSort = (a, b) => String(a).localeCompare(String(b), 'ar', { numeric: true });

// ═════════════ القائمة ═════════════
(function addNav() {
  const grp = (g) => NAV_TREE.find((x) => x.group === g);
  grp('org').items.push({ id: 'report', ic: '📊', label: 'التقرير الشهري' });
  grp('teachers').items.push({ id: 'timetable', ic: '🗓️', label: 'جدول الحصص' });
  grp('super').items.unshift({ id: 'duties', ic: '🧭', label: 'جدول الإشراف والمناوبة' });
  NAV.length = 0; NAV.push(...NAV_TREE.flatMap((n) => (n.items ? n.items : [n])));
})();

addHook('beforeStart', () => {
  if (!Array.isArray(db.timetable)) db.timetable = [];
  if (!db.duties) db.duties = { types: [{ id: 'morning', name: 'المناوبة الصباحية' }, { id: 'break', name: 'الإشراف على الفسحة' }, { id: 'leave', name: 'الانصراف' }], roster: {} };
  if (!db.settings.leaveLimits) db.settings.leaveLimits = { 'إجازة اضطرارية': 5 };
  if (!db.settings.yearStart) { const d = new Date(); db.settings.yearStart = `${d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1}-08-01`; }
  if (db.settings.autoUpdate === undefined) db.settings.autoUpdate = true;
});

// ═════════════ 🗓️ جدول الحصص ═════════════
const TT_DAYS = DOW.slice(0, 5);
VIEWS.timetable = {
  actions: () => `<button class="btn" data-act="ttTemplate">⬇ تصدير Excel</button><button class="btn" data-act="ttImport">⬆ استيراد من Excel</button><button class="btn" data-act="ttPrint">🖨 طباعة</button><button class="btn primary" data-act="ttNew">＋ حصة</button>`,
  render() {
    const today = parse(todayISO()).getDay();
    if (ui.ttDay === undefined) ui.ttDay = today <= 4 ? today : 0;
    const mode = ui.ttMode || 'day';
    const tt = db.timetable;
    if (!tt.length) return `<div class="card">${emptyState('🗓️', 'لا يوجد جدول حصص بعد.<br>نزّلي ملف Excel الجاهز من «⬇ تصدير Excel»، واملئيه (اليوم، الحصة، الفصل، المعلمة، المادة)، ثم «⬆ استيراد من Excel».<br>أو أضيفي الحصص يدوياً من «＋ حصة».')}
      <div style="text-align:center;margin-top:6px"><button class="btn primary" data-act="ttTemplate">⬇ تنزيل ملف Excel الجاهز للتعبئة</button></div></div>`;
    const seg = `<div class="seg"><button class="${mode === 'day' ? 'on' : ''}" data-act="ttMode" data-id="day">حسب اليوم</button><button class="${mode === 'teacher' ? 'on' : ''}" data-act="ttMode" data-id="teacher">حسب المعلمة</button></div>`;
    if (mode === 'teacher') {
      const ts = sortedTeachers().filter((t) => tt.some((x) => x.teacherId === t.id));
      if (!ui.ttTeacher || !ts.some((t) => t.id === ui.ttTeacher)) ui.ttTeacher = ts[0]?.id;
      const mine = tt.filter((x) => x.teacherId === ui.ttTeacher);
      const load = Object.fromEntries(ts.map((t) => [t.id, tt.filter((x) => x.teacherId === t.id).length]));
      return `<div class="toolbar">${seg}<select class="input" data-change="ttTeacher">${ts.map((t) => `<option value="${t.id}" ${t.id === ui.ttTeacher ? 'selected' : ''}>${esc(t.name)} (${load[t.id]})</option>`).join('')}</select><span class="spacer"></span><span class="chip brand">نصابها: ${mine.length} حصة أسبوعياً</span></div>
        <div class="card"><div class="table-wrap"><table class="tt"><thead><tr><th>اليوم</th>${periodsList().map((p) => `<th>${p}</th>`).join('')}</tr></thead><tbody>
        ${WEEKDAYS.map((d) => `<tr><th>${TT_DAYS[d]}</th>${periodsList().map((p) => { const x = mine.find((y) => y.day === d && y.period === p); return `<td class="tt-cell ${x ? 'has' : ''}" data-act="ttCell" data-day="${d}" data-period="${p}" data-class="${esc(x?.className || '')}">${x ? `<b>${esc(x.className)}</b><span>${esc(x.subject || '')}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}
        </tbody></table></div></div>`;
    }
    const day = ui.ttDay;
    const classes = [...new Set(tt.map((x) => x.className))].sort(classSort);
    const rows = tt.filter((x) => x.day === day);
    return `<div class="toolbar">${seg}<div class="seg">${WEEKDAYS.map((d) => `<button class="${d === day ? 'on' : ''}" data-act="ttDay" data-id="${d}">${TT_DAYS[d]}</button>`).join('')}</div>
      <span class="spacer"></span><span class="muted">${rows.length} حصة · ${classes.length} فصل · اضغطي أي خانة للتعديل</span></div>
      <div class="card"><div class="table-wrap"><table class="tt"><thead><tr><th>الحصة</th>${classes.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
      ${periodsList().map((p) => `<tr><th>${p}</th>${classes.map((c) => { const x = rows.find((y) => y.period === p && y.className === c); return `<td class="tt-cell ${x ? 'has' : ''}" data-act="ttCell" data-day="${day}" data-period="${p}" data-class="${esc(c)}">${x ? `<b>${esc(tName(x.teacherId))}</b><span>${esc(x.subject || '')}</span>` : '<span class="tt-add">＋</span>'}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div></div>`;
  },
};
function openSlot(slot, preset = {}) {
  if (!db.teachers.length) { toast('أضيفي المعلمات أولاً', 'err'); return go('teachers'); }
  formModal({
    title: slot ? 'تعديل الحصة' : 'إضافة حصة',
    fields: [
      { key: 'day', label: 'اليوم', type: 'select', options: WEEKDAYS.map((d) => [String(d), TT_DAYS[d]]) },
      { key: 'period', label: 'الحصة', type: 'select', options: periodsList().map((p) => [String(p), `الحصة ${p}`]) },
      { key: 'className', label: 'الفصل', type: 'text', required: true, list: [...new Set(db.timetable.map((x) => x.className))].sort(classSort) },
      { key: 'teacherId', label: 'المعلمة', type: 'select', required: true, options: [['', '— اختاري —'], ...sortedTeachers().map((t) => [t.id, t.name])] },
      { key: 'subject', label: 'المادة', type: 'text', full: true, list: [...new Set(db.timetable.map((x) => x.subject).filter(Boolean))] },
    ],
    values: slot ? { ...slot, day: String(slot.day), period: String(slot.period) } : { day: String(ui.ttDay ?? 0), period: '1', ...preset },
    onSave: (v) => {
      const n = { day: +v.day, period: +v.period, className: v.className, teacherId: v.teacherId, subject: v.subject };
      const clash = db.timetable.find((x) => x !== slot && x.day === n.day && x.period === n.period && x.teacherId === n.teacherId && x.className !== n.className);
      if (clash) toast(`تنبيه: ${tName(n.teacherId)} لديها حصة أخرى في الوقت نفسه (فصل ${clash.className})`, 'err');
      const same = db.timetable.find((x) => x !== slot && x.day === n.day && x.period === n.period && x.className === n.className);
      if (same) db.timetable = db.timetable.filter((x) => x !== same);
      if (slot) Object.assign(slot, n); else db.timetable.push({ id: uid(), ...n });
      commit(); toast('تم الحفظ', 'ok');
    },
    extraButtons: slot ? `<button class="btn danger" data-act="ttDel" data-id="${slot.id}">حذف الحصة</button>` : '',
  });
}
Object.assign(ACTIONS, {
  ttMode: (el) => { ui.ttMode = el.dataset.id; render(); },
  ttDay: (el) => { ui.ttDay = +el.dataset.id; render(); },
  ttNew: () => openSlot(null),
  ttCell: (el) => {
    const d = +el.dataset.day, p = +el.dataset.period, c = el.dataset.class;
    const slot = ui.ttMode === 'teacher' ? db.timetable.find((x) => x.teacherId === ui.ttTeacher && x.day === d && x.period === p)
      : db.timetable.find((x) => x.day === d && x.period === p && x.className === c);
    openSlot(slot, { day: String(d), period: String(p), className: c, teacherId: ui.ttMode === 'teacher' ? ui.ttTeacher : '' });
  },
  ttDel: (el) => { db.timetable = db.timetable.filter((x) => x.id !== el.dataset.id); closeModal(); commit(); },
  ttTemplate: async () => {
    const head = ['اليوم', 'الحصة', 'الفصل', 'المعلمة', 'المادة'];
    const rows = db.timetable.length
      ? db.timetable.slice().sort((a, b) => a.day - b.day || a.period - b.period || classSort(a.className, b.className)).map((x) => [TT_DAYS[x.day], x.period, x.className, tName(x.teacherId), x.subject || ''])
      : [['الأحد', 1, '1/1', sortedTeachers()[0]?.name || 'اسم المعلمة', 'لغتي'], ['الأحد', 2, '1/1', 'اسم المعلمة', 'رياضيات']];
    openBlob(await buildXlsx([head, ...rows], [12, 8, 10, 30, 18]), db.timetable.length ? 'جدول-الحصص.xlsx' : 'نموذج-جدول-الحصص.xlsx', true);
    toast('حُفظ ملف Excel في «التنزيلات»', 'ok');
  },
  ttImport: async () => {
    const [f] = await pickFiles('.xlsx,.csv'); if (!f) return;
    let rows; try { rows = await readSheetRows(f); } catch (e) { return toast('تعذّرت قراءة الملف: ' + e.message, 'err'); }
    const head = rows[0] || [];
    const ix = { day: headerIndex(head, 'اليوم'), period: headerIndex(head, 'الحصة', 'الحصه'), cls: headerIndex(head, 'الفصل', 'الصف', 'الشعبة'), t: headerIndex(head, 'المعلمة', 'المعلم', 'الاسم'), sub: headerIndex(head, 'المادة') };
    if ([ix.day, ix.period, ix.cls, ix.t].some((i) => i < 0)) return toast('يجب أن يحتوي الملف على أعمدة: اليوم، الحصة، الفصل، المعلمة', 'err');
    const out = [], bad = [];
    rows.slice(1).forEach((r, i) => {
      const day = parseDay(r[ix.day]), period = parsePeriod(r[ix.period]), cls = String(r[ix.cls] || '').trim(), tn = String(r[ix.t] || '').trim();
      if (day < 0 || period < 0 || !cls || !tn) { if (r.some((x) => x)) bad.push(i + 2); return; }
      out.push({ day, period, className: cls, teacherName: tn, subject: ix.sub >= 0 ? String(r[ix.sub] || '').trim() : '' });
    });
    if (!out.length) return toast('لم يُعثر على حصص صالحة في الملف', 'err');
    const newT = [...new Set(out.map((x) => x.teacherName))].filter((n) => !findTeacher(n));
    $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal"><div class="modal-h"><h2>استيراد جدول الحصص</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
      <div class="modal-b"><div class="list">
        <div class="li"><div class="grow">حصص في الملف</div><b>${out.length}</b></div>
        <div class="li"><div class="grow">فصول</div><b>${new Set(out.map((x) => x.className)).size}</b></div>
        <div class="li"><div class="grow">معلمات جديدات سيُضفن لقائمة المعلمات</div><b>${newT.length}</b></div>
        ${bad.length ? `<div class="li"><div class="grow" style="color:var(--red)">صفوف تم تجاهلها: ${bad.slice(0, 15).join('، ')}${bad.length > 15 ? '…' : ''}</div></div>` : ''}
      </div>${newT.length ? `<div class="muted" style="margin-top:8px">${newT.slice(0, 8).map(esc).join('، ')}${newT.length > 8 ? '…' : ''}</div>` : ''}
      ${db.timetable.length ? `<label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="ttReplace" checked> استبدال الجدول الحالي (${db.timetable.length} حصة)</label>` : ''}</div>
      <div class="modal-f"><button class="btn primary" data-act="ttImportGo">استيراد</button><button class="btn" data-act="modalClose">إلغاء</button></div></div></div>`;
    modalCtx = { ttImport: out };
  },
  ttImportGo: () => {
    const out = modalCtx.ttImport, replace = $('#ttReplace') ? $('#ttReplace').checked : true;
    if (replace) db.timetable = [];
    out.forEach((x) => {
      const t = teacherByNameOrCreate(x.teacherName, x.subject ? { subject: x.subject } : {});
      db.timetable = db.timetable.filter((y) => !(y.day === x.day && y.period === x.period && y.className === x.className));
      db.timetable.push({ id: uid(), day: x.day, period: x.period, className: x.className, teacherId: t.id, subject: x.subject });
    });
    const added = db.teachers.filter((t) => t._new).length; db.teachers.forEach((t) => delete t._new);
    closeModal(); commit(); toast(`تم استيراد ${out.length} حصة${added ? ` وإضافة ${added} معلمة` : ''} ✓`, 'ok');
  },
  ttPrint: () => {
    const classes = [...new Set(db.timetable.map((x) => x.className))].sort(classSort);
    printDoc('جدول الحصص الأسبوعي', WEEKDAYS.map((d) => `<h3 style="margin:14px 0 6px">${TT_DAYS[d]}</h3><table><thead><tr><th>الحصة</th>${classes.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
      ${periodsList().map((p) => `<tr><td>${p}</td>${classes.map((c) => { const x = db.timetable.find((y) => y.day === d && y.period === p && y.className === c); return `<td>${x ? esc(tName(x.teacherId)) + (x.subject ? `<br><small>${esc(x.subject)}</small>` : '') : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`).join(''));
  },
});
CHANGES.ttTeacher = (el) => { ui.ttTeacher = el.value; render(); };

// استيراد وتصدير المعلمات من Excel
const _teachersActions = VIEWS.teachers.actions;
VIEWS.teachers.actions = () => `<button class="btn" data-act="tchXlsxOut">⬇ تصدير Excel</button><button class="btn" data-act="tchXlsxIn">⬆ استيراد من Excel</button>` + _teachersActions();
Object.assign(ACTIONS, {
  tchXlsxOut: async () => {
    const rows = [['اسم المعلمة', 'الجوال', 'البريد الإلكتروني', 'التخصص'], ...(db.teachers.length ? sortedTeachers().map((t) => [t.name, t.phone || '', t.email || '', t.subject || '']) : [['اسم المعلمة', '05xxxxxxxx', 'teachername@gmail.com', 'التخصص']])];
    openBlob(await buildXlsx(rows, [32, 16, 32, 18]), 'المعلمات.xlsx', true); toast('حُفظ ملف Excel في «التنزيلات»', 'ok');
  },
  tchXlsxIn: async () => {
    const [f] = await pickFiles('.xlsx,.csv'); if (!f) return;
    let rows; try { rows = await readSheetRows(f); } catch (e) { return toast('تعذّرت قراءة الملف: ' + e.message, 'err'); }
    const head = rows[0] || [];
    const ix = { n: headerIndex(head, 'اسم المعلمة', 'الاسم', 'المعلمة'), p: headerIndex(head, 'الجوال', 'الهاتف', 'الجوال'), e: headerIndex(head, 'البريد', 'الايميل', 'email'), s: headerIndex(head, 'التخصص', 'المادة') };
    if (ix.n < 0) return toast('يجب أن يحتوي الملف على عمود «اسم المعلمة»', 'err');
    let added = 0, updated = 0;
    rows.slice(1).forEach((r) => {
      const name = String(r[ix.n] || '').trim(); if (!name || name === 'اسم المعلمة') return;
      const data = { phone: ix.p >= 0 ? String(r[ix.p] || '').trim() : '', email: ix.e >= 0 ? String(r[ix.e] || '').trim() : '', subject: ix.s >= 0 ? String(r[ix.s] || '').trim() : '' };
      const t = findTeacher(name);
      if (t) { let ch = false; for (const k in data) if (data[k] && data[k] !== t[k]) { t[k] = data[k]; ch = true; } if (ch) updated++; }
      else { db.teachers.push({ id: uid(), name, ...data }); added++; }
    });
    commit(); toast(`أُضيفت ${added} معلمة وحُدّثت بيانات ${updated} ✓`, 'ok');
  },
});

// المتابعة السريعة لدخول الحصص من الجدول
addHook('entriesTop', (d) => {
  const wd = parse(d).getDay();
  const slots = db.timetable.filter((x) => x.day === wd);
  if (!slots.length) return '';
  const periods = [...new Set(slots.map((x) => x.period))].sort((a, b) => a - b);
  if (!periods.includes(ui.ttQuickP)) ui.ttQuickP = periods.find((p) => slots.filter((x) => x.period === p).some((x) => !db.classEntries.some((e) => e.date === d && e.period === p && e.className === x.className))) || periods[0];
  const p = ui.ttQuickP;
  const list = slots.filter((x) => x.period === p).sort((a, b) => classSort(a.className, b.className));
  const absent = new Set(db.absences.filter((a) => inRange(d, a.date, a.dateTo) && !/تأخر|خروج/.test(a.type)).map((a) => a.teacherId));
  return `<div class="card" style="margin-bottom:16px"><h3>🗓️ متابعة سريعة حسب جدول الحصص <span class="more"><button class="btn sm ghost" data-act="ttQuickAll">✓ الباقي «في الوقت»</button></span></h3>
    <div class="seg" style="margin-bottom:10px;flex-wrap:wrap">${periods.map((x) => { const done = slots.filter((s) => s.period === x).every((s) => db.classEntries.some((e) => e.date === d && e.period === x && e.className === s.className)); return `<button class="${x === p ? 'on' : ''}" data-act="ttQuickP" data-id="${x}">الحصة ${x}${done ? ' ✓' : ''}</button>`; }).join('')}</div>
    <div class="tq-list">${list.map((x) => {
      const e = db.classEntries.find((y) => y.date === d && y.period === p && y.className === x.className);
      return `<div class="tq-row"><span class="tq-class">${esc(x.className)}</span><div class="grow"><b>${esc(tName(x.teacherId))}</b>${absent.has(x.teacherId) ? ' <span class="chip red">غائبة اليوم</span>' : ''}<div class="s">${esc(x.subject || '')}</div></div>
        ${Object.entries(ENTRY_STATUS).map(([k, s]) => `<button class="btn sm tq-btn ${e?.status === k ? 'on ' + s.cls : ''}" data-act="ttQuick" data-slot="${x.id}" data-id="${k}">${s.label}</button>`).join('')}</div>`;
    }).join('')}</div></div>`;
});
function quickRecord(slot, status, d) {
  let e = db.classEntries.find((y) => y.date === d && y.period === slot.period && y.className === slot.className);
  const now = new Date(), time = d === todayISO() ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : '';
  if (e) { e.status = status; e.teacherId = slot.teacherId; }
  else db.classEntries.push(e = { id: uid(), date: d, period: slot.period, teacherId: slot.teacherId, className: slot.className, status, time, notes: '', emailed: false });
  return e;
}
Object.assign(ACTIONS, {
  ttQuickP: (el) => { ui.ttQuickP = +el.dataset.id; render(); },
  ttQuick: (el) => {
    const slot = db.timetable.find((x) => x.id === el.dataset.slot); if (!slot) return;
    quickRecord(slot, el.dataset.id, ui.entryDate || todayISO()); ui.lastPeriod = slot.period; commit();
    if (el.dataset.id === 'early') toast(`حضرت ${tName(slot.teacherId)} مبكراً ✓ — يمكنكِ إرسال الشكر من الزر أعلى الصفحة`);
  },
  ttQuickAll: () => {
    const d = ui.entryDate || todayISO(), wd = parse(d).getDay(); let n = 0;
    db.timetable.filter((x) => x.day === wd && x.period === ui.ttQuickP).forEach((x) => { if (!db.classEntries.some((e) => e.date === d && e.period === x.period && e.className === x.className)) { quickRecord(x, 'ontime', d); n++; } });
    commit(); toast(n ? `سُجّلت ${n} حصة «في الوقت»` : 'كل حصص هذه الفترة مسجّلة');
  },
});

// ═════════════ 📊 التقرير الشهري ═════════════
function monthRange(m) { const [y, mo] = m.split('-').map(Number); return [`${m}-01`, iso(new Date(y, mo, 0))]; }
function clipDays(a, from, to) { const s = a.date > from ? a.date : from, e = (a.dateTo || a.date) < to ? (a.dateTo || a.date) : to; return s <= e ? workDays(s, e) : 0; }
function buildReport(m) {
  const [from, to] = monthRange(m);
  const [y, mo] = m.split('-').map(Number);
  const title = `التقرير الشهري — ${MONTHS[mo - 1]} ${y}`;
  const absM = db.absences.filter((a) => a.date <= to && (a.dateTo || a.date) >= from);
  const isShort = (a) => /تأخر|خروج/.test(a.type);
  const entM = db.classEntries.filter((e) => e.date >= from && e.date <= to);
  const brkM = db.breakNotes.filter((b) => b.date >= from && b.date <= to);
  const visM = db.visits.filter((v) => v.date >= from && v.date <= to);
  const tasksDone = db.tasks.filter((t) => t.status === 'done' && t.doneAt && t.doneAt >= from && t.doneAt <= to);
  const occM = []; for (let d = from; d <= to; d = addDays(d, 1)) itemsForDate(d).filter((i) => i.kind === 'occ').forEach((i) => occM.push({ d, o: i.ref }));
  const absDays = absM.filter((a) => !isShort(a)).reduce((s, a) => s + clipDays(a, from, to), 0);
  const cnt = (k) => entM.filter((e) => e.status === k).length;
  const sumRow = [['سجلات الغياب والإجازات', absM.filter((a) => !isShort(a)).length], ['مجموع أيام الغياب (أيام عمل)', absDays], ['حالات التأخر والخروج', absM.filter(isShort).length],
    ['حصص تمت متابعتها', entM.length], ['حضور مبكر', cnt('early')], ['تأخر عن الحصة', cnt('late')], ['عدم حضور للحصة', cnt('absent')],
    ['ملاحظات الإشراف على الفسحة', brkM.length], ['المناسبات', occM.length], ['الزيارات', visM.length], ['المهام المنجزة', tasksDone.length]];
  const half = Math.ceil(sumRow.length / 2);
  let h = `${letterhead()}<h1 style="text-align:center">${esc(title)}</h1><p style="text-align:center">من ${fmtG(from)} إلى ${fmtG(to)} (${fmtH(from)} — ${fmtH(to)})</p>`;
  h += `<h2>أولاً: ملخص الشهر</h2><table><tbody>${sumRow.slice(0, half).map((r, i) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td><b>${sumRow[half + i]?.[0] || ''}</b></td><td>${sumRow[half + i]?.[1] ?? ''}</td></tr>`).join('')}</tbody></table>`;
  // الغياب حسب المعلمة
  const byT = {};
  absM.forEach((a) => { const r = byT[a.teacherId] = byT[a.teacherId] || { days: 0, short: 0, types: {} }; if (isShort(a)) r.short++; else { const n = clipDays(a, from, to); r.days += n; r.types[a.type] = (r.types[a.type] || 0) + n; } });
  const tRows = Object.entries(byT).sort((a, b) => b[1].days - a[1].days);
  h += `<h2>ثانياً: الغياب والإجازات حسب المعلمة</h2>${tRows.length ? `<table><tbody><tr><td><b>م</b></td><td><b>المعلمة</b></td><td><b>أيام الغياب</b></td><td><b>التفاصيل</b></td><td><b>تأخر / خروج</b></td></tr>
    ${tRows.map(([id, r], i) => `<tr><td>${i + 1}</td><td>${esc(tName(id))}</td><td>${r.days}</td><td>${Object.entries(r.types).map(([k, v]) => `${esc(k)}: ${v}`).join('، ') || '—'}</td><td>${r.short || '—'}</td></tr>`).join('')}</tbody></table>` : '<p>لا يوجد غياب مسجّل خلال الشهر.</p>'}`;
  // متابعة الحصص
  const byE = {};
  entM.forEach((e) => { const r = byE[e.teacherId] = byE[e.teacherId] || { early: 0, ontime: 0, late: 0, absent: 0 }; r[e.status]++; });
  const eRows = Object.entries(byE).sort((a, b) => b[1].early - a[1].early || a[1].late - b[1].late);
  h += `<h2>ثالثاً: متابعة دخول المعلمات للحصص</h2>${eRows.length ? `<table><tbody><tr><td><b>المعلمة</b></td><td><b>مبكرة</b></td><td><b>في الوقت</b></td><td><b>متأخرة</b></td><td><b>لم تحضر</b></td></tr>
    ${eRows.map(([id, r]) => `<tr><td>${esc(tName(id))}</td><td>${r.early}</td><td>${r.ontime}</td><td>${r.late}</td><td>${r.absent}</td></tr>`).join('')}</tbody></table>` : '<p>لا توجد متابعات مسجّلة خلال الشهر.</p>'}`;
  // الإشراف
  const cats = {}; brkM.forEach((b) => { cats[b.category] = (cats[b.category] || 0) + 1; });
  const imp = brkM.filter((b) => ['safety', 'behavior', 'health'].includes(b.category)).sort((a, b) => a.date.localeCompare(b.date));
  h += `<h2>رابعاً: الإشراف على الطالبات وقت الفسحة</h2>${brkM.length ? `<p>${Object.entries(cats).map(([k, v]) => `${BREAK_CATS[k] || k}: ${v}`).join(' — ')}</p>
    ${imp.length ? `<table><tbody><tr><td><b>التاريخ</b></td><td><b>الموقع</b></td><td><b>النوع</b></td><td><b>الملاحظة</b></td><td><b>الإجراء</b></td></tr>${imp.map((b) => `<tr><td>${fmtGShort(b.date)}</td><td>${esc(b.location)}</td><td>${BREAK_CATS[b.category]}</td><td>${esc(b.notes)}</td><td>${esc(b.action || '')}</td></tr>`).join('')}</tbody></table>` : ''}` : '<p>لا توجد ملاحظات إشراف خلال الشهر.</p>'}`;
  // المناسبات والزيارات
  h += `<h2>خامساً: الأيام العالمية والوطنية</h2>${occM.length ? `<table><tbody><tr><td><b>المناسبة</b></td><td><b>التاريخ</b></td><td><b>المبادرة</b></td><td><b>الحالة</b></td></tr>${occM.map(({ d, o }) => `<tr><td>${esc(o.name)}</td><td>${fmtG(d)}</td><td>${esc(o.initiative || '—')}</td><td>${OCC_STATUS[occStatus(o)].label}</td></tr>`).join('')}</tbody></table>` : '<p>لا توجد مناسبات خلال الشهر.</p>'}`;
  h += `<h2>سادساً: الزيارات</h2>${visM.length ? `<table><tbody><tr><td><b>التاريخ</b></td><td><b>الجهة</b></td><td><b>الحالة</b></td><td><b>الملاحظات والتوصيات</b></td></tr>${visM.map((v) => `<tr><td>${fmtG(v.date)}</td><td>${esc(v.team)}</td><td>${(VISIT_STATUS[v.status] || VISIT_STATUS.planned).label}</td><td>${esc(v.notes || '—')}</td></tr>`).join('')}</tbody></table>` : '<p>لا توجد زيارات خلال الشهر.</p>'}`;
  const md = { present: 0, late: 0, absent: 0, excused: 0 };
  Object.entries(db.morningLog || {}).filter(([k]) => k >= from && k <= to).forEach(([, v]) => Object.values(v).forEach((r) => { if (md[r.status] !== undefined) md[r.status]++; }));
  if (Object.values(md).some(Boolean)) h += `<h2>المناوبة الصباحية</h2><p>حضرت: ${md.present} — تأخرت: ${md.late} — غابت: ${md.absent} — بعذر: ${md.excused}</p>`;
  h += `<h2>سابعاً: المهام المنجزة (${tasksDone.length})</h2>${tasksDone.length ? `<ol>${tasksDone.slice(0, 25).map((t) => `<li>${esc(t.title)}</li>`).join('')}</ol>` : '<p>—</p>'}`;
  h += `<p><br></p><table class="noborder" style="width:100%"><tbody><tr><td style="width:50%;text-align:center"><b>${esc(db.settings.employeeName ? 'الموظفة: ' + db.settings.employeeName : 'الموظفة')}</b><br><br>..........................</td><td style="width:50%;text-align:center"><b>قائدة المدرسة</b><br><br>..........................</td></tr></tbody></table>`;
  return { title, html: h };
}
VIEWS.report = {
  actions: () => `<button class="btn" data-act="repEdit">📝 فتح في محرر المستندات</button><button class="btn" data-act="repPrint">🖨 طباعة / PDF</button><button class="btn primary" data-act="repWord">⬇ تصدير Word</button>`,
  render() {
    if (!ui.repMonth) ui.repMonth = todayISO().slice(0, 7);
    const r = buildReport(ui.repMonth);
    return `<div class="toolbar"><label class="muted">الشهر</label><input type="month" class="input" value="${ui.repMonth}" data-change="repMonth"><span class="spacer"></span><span class="muted">يُنشأ التقرير تلقائياً من بيانات الشهر</span></div>
      <div class="doc-wrap"><div class="doc-page" id="repPage">${r.html}</div></div>`;
  },
};
CHANGES.repMonth = (el) => { if (el.value) { ui.repMonth = el.value; render(); } };
Object.assign(ACTIONS, {
  repWord: async () => { try { const r = buildReport(ui.repMonth); openBlob(await htmlToDocx($('#repPage')), r.title + '.docx', true); toast('حُفظ ملف Word في «التنزيلات»', 'ok'); } catch (e) { toast('تعذّر التصدير: ' + e.message, 'err'); } },
  repPrint: () => { $('#print').innerHTML = `<div class="doc-print">${$('#repPage').innerHTML}</div>`; setTimeout(() => window.print(), 50); },
  repEdit: () => { const r = buildReport(ui.repMonth); db.documents = db.documents || []; const d = { id: uid(), title: r.title, html: r.html, updatedAt: todayISO() }; db.documents.push(d); DOCS.id = d.id; ui.tool = 'docs'; ui.view = 'tools'; commit(); toast('فُتح التقرير في محرر المستندات للتعديل', 'ok'); },
});

// ═════════════ 🧭 جدول الإشراف والمناوبة ═════════════
const dutyAbsent = (d) => new Set(db.absences.filter((a) => inRange(d, a.date, a.dateTo) && !/تأخر|خروج/.test(a.type)).map((a) => a.teacherId));
VIEWS.duties = {
  actions: () => `<button class="btn" data-act="dutyTypes">⚙️ أنواع الإشراف</button><button class="btn" data-act="dutyPrint">🖨 طباعة الجدول</button><button class="btn primary" data-act="dutyAuto">✨ توزيع تلقائي</button>`,
  render() {
    const D = db.duties, today = parse(todayISO()).getDay();
    if (!db.teachers.length) return `<div class="card">${emptyState('🧭', 'أضيفي المعلمات أولاً، ثم وزّعي الإشراف والمناوبة.')}</div>`;
    const load = {}; WEEKDAYS.forEach((d) => D.types.forEach((ty) => (D.roster[d]?.[ty.id] || []).forEach((id) => { load[id] = (load[id] || 0) + 1; })));
    const absT = dutyAbsent(todayISO());
    return `<div class="card"><div class="table-wrap"><table class="duty"><thead><tr><th>اليوم</th>${D.types.map((ty) => `<th>${esc(ty.name)}</th>`).join('')}</tr></thead><tbody>
      ${WEEKDAYS.map((d) => `<tr class="${d === today ? 'today' : ''}"><th>${TT_DAYS[d]}${d === today ? ' <span class="chip brand">اليوم</span>' : ''}</th>${D.types.map((ty) => {
        const ids = D.roster[d]?.[ty.id] || [];
        return `<td><div class="duty-cell">${ids.map((id) => `<span class="duty-chip ${d === today && absT.has(id) ? 'abs' : ''}" title="${d === today && absT.has(id) ? 'غائبة اليوم — تحتاج بديلة' : ''}">${esc(tName(id))}<button data-act="dutyRemove" data-day="${d}" data-type="${ty.id}" data-id="${id}">✕</button></span>`).join('')}
          <select class="duty-add" data-change="dutyAdd" data-day="${d}" data-type="${ty.id}"><option value="">＋</option>${sortedTeachers().filter((t) => !ids.includes(t.id)).map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div></td>`;
      }).join('')}</tr>`).join('')}
    </tbody></table></div></div>
    <div class="card" style="margin-top:16px"><h3>توزيع الأعباء الأسبوعي</h3><div class="duty-load">${sortedTeachers().map((t) => `<span class="chip ${load[t.id] ? '' : 'amber'}">${esc(t.name)}: ${load[t.id] || 0}</span>`).join('')}</div></div>`;
  },
};
Object.assign(CHANGES, {
  dutyAdd: (el) => { if (!el.value) return; const D = db.duties, d = el.dataset.day, ty = el.dataset.type; D.roster[d] = D.roster[d] || {}; (D.roster[d][ty] = D.roster[d][ty] || []).push(el.value); commit(); },
});
Object.assign(ACTIONS, {
  dutyRemove: (el) => { const r = db.duties.roster[el.dataset.day]?.[el.dataset.type]; if (r) { r.splice(r.indexOf(el.dataset.id), 1); commit(); } },
  dutyTypes: () => formModal({
    title: 'أنواع الإشراف والمناوبة', fields: [{ key: 'list', label: 'كل نوع في سطر', type: 'textarea', full: true, rows: 6, hint: 'مثال: المناوبة الصباحية، الإشراف على الفسحة، الانصراف، الإشراف على الصلاة' }],
    values: { list: db.duties.types.map((t) => t.name).join('\n') },
    onSave: (v) => {
      const names = v.list.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      if (!names.length) return toast('أضيفي نوعاً واحداً على الأقل', 'err');
      db.duties.types = names.map((n) => db.duties.types.find((t) => t.name === n) || { id: uid(), name: n }); commit();
    },
  }),
  dutyAuto: () => formModal({
    title: 'توزيع تلقائي عادل', fields: [
      { key: 'n', label: 'عدد المعلمات لكل نوع في اليوم', type: 'number', min: 1, max: 10 },
      { key: 'keep', label: 'الإبقاء على التوزيع الحالي وإكمال الناقص فقط', type: 'checkbox', full: true },
    ], values: { n: 2, keep: false },
    onSave: (v) => {
      const n = Math.max(1, +v.n || 2), T = sortedTeachers().map((t) => t.id), D = db.duties;
      if (!v.keep) D.roster = {};
      const load = Object.fromEntries(T.map((id) => [id, 0]));
      WEEKDAYS.forEach((d) => D.types.forEach((ty) => (D.roster[d]?.[ty.id] || []).forEach((id) => { if (id in load) load[id]++; })));
      WEEKDAYS.forEach((d) => {
        D.roster[d] = D.roster[d] || {};
        D.types.forEach((ty) => {
          const cur = D.roster[d][ty.id] = D.roster[d][ty.id] || [];
          while (cur.length < n) {
            const busy = new Set(Object.values(D.roster[d]).flat());
            const pick = T.filter((id) => !busy.has(id)).sort((a, b) => load[a] - load[b] || Math.random() - 0.5)[0];
            if (!pick) break; cur.push(pick); load[pick]++;
          }
        });
      });
      commit(); toast('تم توزيع الإشراف بالتساوي على المعلمات ✓', 'ok');
    },
  }),
  dutyPrint: () => {
    const D = db.duties;
    printDoc('جدول الإشراف والمناوبة الأسبوعي', `<table><thead><tr><th>اليوم</th>${D.types.map((t) => `<th>${esc(t.name)}</th>`).join('')}</tr></thead><tbody>${WEEKDAYS.map((d) => `<tr><td><b>${TT_DAYS[d]}</b></td>${D.types.map((ty) => `<td>${(D.roster[d]?.[ty.id] || []).map((id) => esc(tName(id))).join('<br>')}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
  },
});
addHook('dashCards', (t) => {
  const d = parse(t).getDay(); if (d > 4) return '';
  const D = db.duties, absT = dutyAbsent(t);
  const rows = D.types.map((ty) => ({ ty, ids: D.roster[d]?.[ty.id] || [] })).filter((r) => r.ids.length);
  if (!rows.length) return '';
  return `<div class="card"><h3>🧭 الإشراف والمناوبة اليوم <span class="more"><button class="btn sm ghost" data-act="nav" data-id="duties">الجدول</button></span></h3>
    <div class="list">${rows.map((r) => `<div class="li"><div class="grow"><div class="t">${esc(r.ty.name)}</div><div class="s">${r.ids.map((id) => absT.has(id) ? `<span style="color:var(--red)">${esc(tName(id))} (غائبة — تحتاج بديلة)</span>` : esc(tName(id))).join('، ')}</div></div></div>`).join('')}</div></div>`;
});

// ═════════════ ⚖️ أرصدة الإجازات ═════════════
const BAL_TYPES = () => ABSENCE_TYPES.filter((t) => !/تأخر|خروج|دورة|انتداب|بدون عذر/.test(t));
function yearRange() { const s = db.settings.yearStart; const e = addDays(iso(new Date(parse(s).getFullYear() + 1, parse(s).getMonth(), parse(s).getDate())), -1); return [s, e]; }
function usedDays(tid, type) { const [s, e] = yearRange(); return db.absences.filter((a) => a.teacherId === tid && a.type === type).reduce((n, a) => n + clipDays(a, s, e), 0); }
function balances(tid) { return Object.entries(db.settings.leaveLimits || {}).filter(([, lim]) => lim > 0).map(([type, lim]) => { const used = usedDays(tid, type); return { type, lim, used, left: lim - used }; }); }
addHook('absenceSide', () => {
  const lim = Object.entries(db.settings.leaveLimits || {}).filter(([, l]) => l > 0);
  if (!lim.length) return '';
  if (ui.absTeacher) {
    const b = balances(ui.absTeacher);
    return `<div class="card"><h3>⚖️ أرصدة ${esc(tName(ui.absTeacher))}</h3>${b.map((x) => `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(x.type)}</span><b style="color:${x.left < 0 ? 'var(--red)' : x.left <= 1 ? 'var(--amber)' : 'inherit'}">${x.used} من ${x.lim}</b></div><div class="progress"><div style="width:${Math.min(100, (x.used / x.lim) * 100)}%;background:${x.left < 0 ? 'var(--red)' : x.left <= 1 ? '#f0b429' : 'var(--brand)'}"></div></div></div>`).join('')}<div class="muted" style="font-size:12px">منذ ${fmtG(db.settings.yearStart)}</div></div>`;
  }
  const near = [];
  db.teachers.forEach((t) => balances(t.id).forEach((x) => { if (x.used > 0 && x.left <= 1) near.push({ t, ...x }); }));
  return `<div class="card"><h3>⚖️ أرصدة الإجازات <span class="more"><button class="btn sm ghost" data-act="balAll">الكل</button></span></h3>${near.length ? `<div class="list">${near.slice(0, 6).map((x) => `<div class="li"><div class="grow"><div class="t">${esc(x.t.name)}</div><div class="s">${esc(x.type)}</div></div><span class="chip ${x.left < 0 ? 'red' : 'amber'}">${x.used}/${x.lim}</span></div>`).join('')}</div>` : '<div class="muted">لا توجد معلمة قاربت على نفاد رصيدها</div>'}<div class="muted" style="font-size:12px;margin-top:6px">اختاري معلمة من القائمة أعلاه لعرض أرصدتها</div></div>`;
});
addHook('absenceSaved', (v) => {
  const lim = db.settings.leaveLimits?.[v.type]; if (!lim) return;
  const used = usedDays(v.teacherId, v.type);
  if (used > lim) setTimeout(() => toast(`⚠️ تجاوزت ${tName(v.teacherId)} رصيد «${v.type}»: ${used} من ${lim} أيام`, 'err'), 400);
  else if (used === lim) setTimeout(() => toast(`تنبيه: استنفدت ${tName(v.teacherId)} رصيد «${v.type}» كاملاً (${used} من ${lim})`), 400);
  else if (lim - used === 1) setTimeout(() => toast(`تنبيه: بقي لـ${tName(v.teacherId)} يوم واحد من رصيد «${v.type}»`), 400);
});
ACTIONS.balAll = () => {
  const types = Object.entries(db.settings.leaveLimits || {}).filter(([, l]) => l > 0);
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal wide"><div class="modal-h"><h2>⚖️ أرصدة الإجازات منذ ${fmtG(db.settings.yearStart)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b"><div class="table-wrap"><table><thead><tr><th>المعلمة</th>${types.map(([t, l]) => `<th>${esc(t)} (${l})</th>`).join('')}</tr></thead><tbody>
    ${sortedTeachers().map((t) => `<tr><td><b>${esc(t.name)}</b></td>${types.map(([ty, l]) => { const u = usedDays(t.id, ty); return `<td><span class="chip ${u > l ? 'red' : l - u <= 1 && u ? 'amber' : ''}">${u} / ${l}</span></td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div></div><div class="modal-f"><button class="btn" data-act="modalClose">إغلاق</button></div></div></div>`;
  modalCtx = {};
};

// ═════════════ 🔒 قفل البرنامج ═════════════
const LOCK = { locked: false, last: Date.now(), fails: 0, until: 0, resolve: null };
async function sha(text) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  catch { let h = 2166136261; for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return 'f' + (h >>> 0).toString(16); }
}
const lockCfg = () => db.settings.lock || {};
function showLock() {
  if (document.getElementById('lockScreen')) return;
  LOCK.locked = true;
  const el = document.createElement('div'); el.id = 'lockScreen'; el.className = 'lock-screen';
  el.innerHTML = `<div class="lock-card"><div class="logo" style="margin:0 auto 12px;width:56px;height:56px;font-size:28px">م</div>
    <div class="lock-title">المساعد الإداري</div><div class="muted">${esc(db.settings.schoolName || '')}</div>
    <div id="lockMain"><input type="password" class="input lock-pin" id="lockPin" inputmode="numeric" autocomplete="off" placeholder="••••" maxlength="8">
    <button class="btn primary lock-btn" data-act="lockTry">فتح</button><div id="lockMsg" class="lock-msg"></div>
    <button class="btn ghost sm" data-act="lockForgot" style="margin-top:6px">نسيتِ الرمز؟</button></div></div>`;
  document.body.appendChild(el);
  setTimeout(() => $('#lockPin')?.focus(), 50);
  document.getElementById('restOverlay')?.remove(); document.getElementById('cheer')?.remove();
}
function unlock() { document.getElementById('lockScreen')?.remove(); LOCK.locked = false; LOCK.last = Date.now(); LOCK.fails = 0; if (LOCK.resolve) { LOCK.resolve(); LOCK.resolve = null; } }
addHook('beforeStart', () => { if (!lockCfg().on) return; return new Promise((res) => { LOCK.resolve = res; showLock(); }); });
Object.assign(ACTIONS, {
  lockTry: async () => {
    const msg = $('#lockMsg'), pin = $('#lockPin').value.trim();
    if (Date.now() < LOCK.until) { msg.textContent = `انتظري ${Math.ceil((LOCK.until - Date.now()) / 1000)} ثانية`; return; }
    if ((await sha(lockCfg().salt + pin)) === lockCfg().hash) return unlock();
    LOCK.fails++; $('#lockPin').value = '';
    if (LOCK.fails >= 5) { LOCK.until = Date.now() + 30000; LOCK.fails = 0; msg.textContent = 'محاولات كثيرة — انتظري 30 ثانية'; } else msg.textContent = 'الرمز غير صحيح';
    $('#lockScreen .lock-card').classList.add('shake'); setTimeout(() => $('#lockScreen .lock-card')?.classList.remove('shake'), 400);
  },
  lockForgot: () => {
    $('#lockMain').innerHTML = `<div class="muted" style="margin:12px 0 6px">أدخلي «رمز الاسترداد» الذي ظهر لكِ عند تفعيل القفل</div>
      <input class="input lock-pin" id="lockRec" dir="ltr" placeholder="XXXX-XXXX" style="letter-spacing:3px"><button class="btn primary lock-btn" data-act="lockRecover">استرداد</button><div id="lockMsg" class="lock-msg"></div>`;
    setTimeout(() => $('#lockRec')?.focus(), 30);
  },
  lockRecover: async () => {
    const code = $('#lockRec').value.trim().toUpperCase().replace(/\s/g, '');
    if ((await sha(lockCfg().salt + code)) !== lockCfg().rhash) { $('#lockMsg').textContent = 'رمز الاسترداد غير صحيح'; return; }
    db.settings.lock = { ...lockCfg(), on: false }; await api.save(db); unlock(); commit(); toast('أُوقف القفل — يمكنكِ تعيين رمز جديد من الإعدادات', 'ok');
  },
  lockNow: () => { if (lockCfg().on) showLock(); },
  lockSetup: () => formModal({
    title: lockCfg().on ? 'تغيير رمز القفل' : 'تفعيل قفل البرنامج',
    fields: [
      ...(lockCfg().on ? [{ key: 'old', label: 'الرمز الحالي', type: 'password', full: true, required: true }] : []),
      { key: 'pin', label: 'الرمز الجديد (4 إلى 8 أرقام)', type: 'password', required: true },
      { key: 'pin2', label: 'تأكيد الرمز', type: 'password', required: true },
    ],
    validate: (v) => (!/^\d{4,8}$/.test(v.pin) ? 'الرمز يجب أن يكون من 4 إلى 8 أرقام' : v.pin !== v.pin2 ? 'الرمزان غير متطابقين' : null),
    onSave: async (v) => {
      if (lockCfg().on && (await sha(lockCfg().salt + v.old)) !== lockCfg().hash) return toast('الرمز الحالي غير صحيح', 'err');
      const salt = uid() + uid();
      const rec = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('').replace(/^(.{4})/, '$1-');
      db.settings.lock = { on: true, salt, hash: await sha(salt + v.pin), rhash: await sha(salt + rec), idle: lockCfg().idle ?? 15 };
      commit();
      $('#modalRoot').innerHTML = `<div class="modal-back"><div class="modal"><div class="modal-h"><h2>🔒 تم تفعيل القفل</h2></div>
        <div class="modal-b"><p>احتفظي بـ<b>رمز الاسترداد</b> هذا في مكان آمن (اكتبيه أو صوّريه). تحتاجينه إذا نسيتِ الرمز:</p>
        <div class="rec-code" dir="ltr">${rec}</div><p class="muted">لن يظهر هذا الرمز مرة أخرى.</p></div>
        <div class="modal-f"><button class="btn primary" data-act="modalClose">حفظته ✓</button></div></div></div>`;
      modalCtx = {};
    },
  }),
  lockOff: () => formModal({
    title: 'إيقاف القفل', fields: [{ key: 'old', label: 'الرمز الحالي', type: 'password', full: true, required: true }],
    onSave: async (v) => { if ((await sha(lockCfg().salt + v.old)) !== lockCfg().hash) return toast('الرمز غير صحيح', 'err'); db.settings.lock = { ...lockCfg(), on: false }; commit(); toast('أُوقف القفل', 'ok'); },
  }),
});
CHANGES.lockIdle = (el) => { db.settings.lock = { ...lockCfg(), idle: +el.value }; commit(false); };
['mousemove', 'keydown', 'mousedown', 'wheel'].forEach((ev) => document.addEventListener(ev, () => { if (!LOCK.locked) LOCK.last = Date.now(); }, { passive: true }));
document.addEventListener('keydown', (e) => {
  if (LOCK.locked && e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); ($('#lockRec') ? ACTIONS.lockRecover : ACTIONS.lockTry)(); }
  if (!LOCK.locked && e.ctrlKey && e.key.toLowerCase() === 'l' && lockCfg().on) { e.preventDefault(); showLock(); }
}, true);
setInterval(() => { const c = lockCfg(); if (db && c.on && c.idle > 0 && !LOCK.locked && Date.now() - LOCK.last > c.idle * 60000) showLock(); }, 20000);
// زر قفل سريع أسفل القائمة
(function lockButton() {
  const add = () => { const f = document.querySelector('.side-foot'); if (!f || document.getElementById('lockQuick')) return; const b = document.createElement('button'); b.id = 'lockQuick'; b.className = 'rest-chip'; b.textContent = '🔒 قفل'; b.dataset.act = 'lockNow'; b.style.marginInlineStart = '6px'; b.style.display = 'none'; f.querySelector('#restInfo')?.after(b); };
  add(); addHook('dashCards', () => { const b = document.getElementById('lockQuick'); if (b) b.style.display = lockCfg().on ? '' : 'none'; return ''; });
  setInterval(() => { const b = document.getElementById('lockQuick'); if (b && db) b.style.display = lockCfg().on ? '' : 'none'; }, 3000);
})();

// ═════════════ ⬆️ التحديث التلقائي ═════════════
const UPD = { info: null, busy: false, progress: 0, checked: false, version: '' };
const N = window.madrasaNative;
async function checkUpdate(manual) {
  if (!N?.updateCheck) { if (manual) toast('التحديث متاح في البرنامج المثبَّت فقط'); return; }
  try {
    const r = await N.updateCheck();
    UPD.checked = true; UPD.info = r?.available ? r : null;
    if (manual) toast(r?.available ? `يتوفر الإصدار ${r.version}` : r?.error ? 'تعذّر الاتصال بخادم التحديثات' : 'لديكِ أحدث إصدار ✓', r?.available ? 'ok' : '');
    renderUpdBar(); if (ui.view === 'settings') render();
  } catch { if (manual) toast('تعذّر البحث عن تحديث', 'err'); }
}
function renderUpdBar() {
  let el = document.getElementById('updBar');
  if (!el) { el = document.createElement('div'); el.id = 'updBar'; document.getElementById('syncBar')?.before(el); }
  const u = UPD.info;
  if (!u || UPD.dismissed) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="banner brand" style="margin:0 28px 10px;padding:10px 16px"><span class="big">🎉</span><div><b>يتوفر إصدار جديد من البرنامج (${esc(u.version)})</b><div class="muted">${UPD.busy ? `جارٍ التنزيل… ${UPD.progress}%` : 'التحديث يحافظ على كل بياناتكِ'}</div></div><span class="spacer"></span>
    ${UPD.busy ? `<div class="progress" style="width:160px"><div style="width:${UPD.progress}%"></div></div>` : '<button class="btn primary" data-act="updInstall">تحديث الآن</button><button class="btn ghost" data-act="updLater">لاحقاً</button>'}</div>`;
}
Object.assign(ACTIONS, {
  updCheck: () => checkUpdate(true),
  updLater: () => { UPD.dismissed = true; renderUpdBar(); },
  updInstall: async () => {
    if (!UPD.info || UPD.busy) return;
    UPD.busy = true; UPD.progress = 0; renderUpdBar();
    const r = await N.updateInstall(UPD.info.url);
    if (!r?.ok) { UPD.busy = false; renderUpdBar(); toast('تعذّر تنزيل التحديث: ' + (r?.error || ''), 'err'); }
    else toast('اكتمل التنزيل — سيُغلق البرنامج ويبدأ التثبيت', 'ok');
  },
});
CHANGES.autoUpdate = (el) => { db.settings.autoUpdate = el.checked; commit(false); };
if (N?.onUpdateProgress) N.onUpdateProgress((p) => { UPD.progress = p; renderUpdBar(); });
addHook('beforeStart', async () => { if (N?.appVersion) { try { UPD.version = await N.appVersion(); } catch { } } });
setTimeout(() => { if (db?.settings.autoUpdate && N?.updateCheck) checkUpdate(false); }, 12000);
setInterval(() => { if (db?.settings.autoUpdate && N?.updateCheck && !UPD.info) checkUpdate(false); }, 6 * 3600000);

// ═════════════ بطاقات الإعدادات ═════════════
addHook('settingsCards', () => {
  const c = lockCfg(), lim = db.settings.leaveLimits || {};
  return `<div class="card"><h3>🔒 قفل البرنامج</h3>
      <div class="muted" style="margin-bottom:10px">يطلب البرنامج رمزاً عند فتحه وبعد مدة من عدم الاستخدام، لحماية بيانات المعلمات والطالبات على الأجهزة المشتركة.</div>
      ${c.on ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="chip green">مفعّل ✓</span>
        <label class="muted">القفل بعد عدم الاستخدام</label><select class="input" data-change="lockIdle" style="width:auto">${[[5, '5 دقائق'], [10, '10 دقائق'], [15, '15 دقيقة'], [30, '30 دقيقة'], [0, 'لا يُقفل تلقائياً']].map(([v, l]) => `<option value="${v}" ${(c.idle ?? 15) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" data-act="lockNow">🔒 قفل الآن (Ctrl+L)</button><button class="btn sm" data-act="lockSetup">تغيير الرمز</button><button class="btn sm danger" data-act="lockOff">إيقاف القفل</button></div>`
      : '<button class="btn primary" data-act="lockSetup">تفعيل القفل برمز</button>'}
    </div>
    <div class="card"><h3>⬆️ التحديثات</h3>
      <div class="muted">الإصدار الحالي: <b>${esc(UPD.version || '—')}</b>${UPD.info ? ` · <b style="color:var(--brand)">يتوفر ${esc(UPD.info.version)}</b>` : UPD.checked ? ' · أحدث إصدار ✓' : ''}</div>
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" ${db.settings.autoUpdate !== false ? 'checked' : ''} data-change="autoUpdate"> البحث عن التحديثات تلقائياً</label>
      <div style="display:flex;gap:8px;margin-top:10px">${UPD.info ? '<button class="btn primary sm" data-act="updInstall">تحديث الآن</button>' : ''}<button class="btn sm" data-act="updCheck">البحث عن تحديث الآن</button></div>
    </div>
    <div class="card" style="grid-column:1/-1"><details class="adv" ${ui.balOpen ? 'open' : ''}><summary data-act="balToggle"><h3 style="display:inline-flex;margin:0">⚖️ أرصدة الإجازات</h3></summary>
      <div class="muted" style="margin:10px 0">حدّدي عدد الأيام المسموح بها في العام لكل نوع حسب الأنظمة المعمول بها لديكم، واتركي الخانة فارغة إذا لم يكن له حد. ينبّهكِ البرنامج عند اقتراب أي معلمة من رصيدها أو تجاوزه.</div>
      <div class="field" style="max-width:260px;margin-bottom:12px"><label>بداية العام الدراسي (لحساب الأرصدة)</label><input type="date" class="input" value="${db.settings.yearStart}" data-change="yearStart"></div>
      <div class="adv-grid">${BAL_TYPES().map((t) => `<label class="adv-item" style="justify-content:space-between;background:#f8faf9;border:1px solid var(--line);border-radius:10px;padding:8px 12px"><span>${esc(t)}</span><input type="number" min="0" max="365" class="input" style="width:80px;height:auto" value="${lim[t] || ''}" placeholder="—" data-change="leaveLimit" data-id="${esc(t)}"></label>`).join('')}</div>
    </details></div>`;
});
Object.assign(CHANGES, {
  yearStart: (el) => { if (el.value) { db.settings.yearStart = el.value; commit(false); } },
  leaveLimit: (el) => { const v = +el.value; db.settings.leaveLimits = db.settings.leaveLimits || {}; if (v > 0) db.settings.leaveLimits[el.dataset.id] = v; else delete db.settings.leaveLimits[el.dataset.id]; commit(false); toast('حُفظ الرصيد', 'ok'); },
});
ACTIONS.balToggle = (el, e) => { e.preventDefault(); ui.balOpen = !ui.balOpen; render(); };

// ═════════════ 🏅 الشهادات: قوالب جاهزة، ألوان، مسمّى التوقيع، اسم المعلمة ═════════════
const CERT_PALETTES = {
  green: { name: 'أخضر وذهبي', bg: '#fffdf6', frame: '#b8892b', accent: '#0f6b5c', title: '#0f6b5c', text: '#1d2b28', muted: '#6b7c78', soft: '#e3f1ee', nameC: '#b8892b' },
  blue: { name: 'أزرق ملكي', bg: '#f8fbff', frame: '#c9a227', accent: '#1e3a8a', title: '#1e3a8a', text: '#1f2937', muted: '#64748b', soft: '#e0e8fb', nameC: '#b8901f' },
  purple: { name: 'بنفسجي', bg: '#fdfaff', frame: '#a78bfa', accent: '#6d28d9', title: '#5b21b6', text: '#2e1065', muted: '#7c6f99', soft: '#efe7fd', nameC: '#6d28d9' },
  rose: { name: 'وردي هادئ', bg: '#fffafb', frame: '#e8a0b4', accent: '#be185d', title: '#9d174d', text: '#3b1d2a', muted: '#8a6b76', soft: '#fde4ee', nameC: '#be185d' },
  navy: { name: 'كحلي وفضي', bg: '#ffffff', frame: '#94a3b8', accent: '#0f172a', title: '#0f172a', text: '#1e293b', muted: '#64748b', soft: '#eef2f7', nameC: '#0f172a' },
  brown: { name: 'بني تراثي', bg: '#fdf8f0', frame: '#a16207', accent: '#713f12', title: '#713f12', text: '#3f2a14', muted: '#8b6f4e', soft: '#f6ead6', nameC: '#a16207' },
};
const CERT_TEMPLATES = [
  ['cert', 'شهادة شكر وتقدير — كلاسيكية'], ['cert-modern', 'شهادة شكر — عصرية بشريط جانبي'], ['cert-ribbon', 'شهادة شكر — بشريطين'],
  ['cert-excellence', 'شهادة تميّز'], ['cert-early', 'شهادة الالتزام بالحضور المبكر'], ['cert-initiative', 'شهادة شكر على مبادرة'],
];
const certSigner = () => ({ title: db.settings.signerTitle || 'المساعد الإداري', name: db.settings.signerName ?? db.settings.employeeName ?? '', principal: db.settings.showPrincipal ? (db.settings.principalName || '') : null });
const _dTemplate = dTemplate;
dTemplate = function (name) {
  if (!name.startsWith('cert')) return _dTemplate(name);
  const P = CERT_PALETTES[DS.palette] || CERT_PALETTES.green;
  const [w, h] = DSIZES[DS.size], cx = w / 2, school = db.settings.schoolName || 'اسم المدرسة', t = todayISO(), S = certSigner();
  const T = (text, x, y, size, color = P.text, bold = false, role) => ({ t: 'text', text, x, y, size, color, bold, ...(role ? { role } : {}) });
  const R = (x, y, ww, hh, stroke, lw, fill = '', r = 0) => ({ t: 'rect', x, y, w: ww, h: hh, color: stroke, lw, fill, r });
  const E = (x, y, ww, hh, stroke, lw, fill = '') => ({ t: 'ellipse', x, y, w: ww, h: hh, color: stroke, lw, fill });
  const name0 = DS.teacherName ? `الأستاذة / ${DS.teacherName}` : 'الأستاذة / ............................';
  const fs = (k) => Math.round(w / k);
  const lines = {
    'cert': ['شهادة شكر وتقدير', 'يسرّنا أن نتقدم بخالص الشكر والتقدير', 'نظير جهودها المتميزة وعطائها المستمر', 'سائلين المولى لها دوام التوفيق والسداد'],
    'cert-modern': ['شهادة شكر وتقدير', 'تتقدم إدارة المدرسة بالشكر الجزيل', 'تقديراً لإخلاصها وتميّزها في أداء رسالتها', 'متمنين لها مزيداً من النجاح والعطاء'],
    'cert-ribbon': ['شكر وتقدير', 'بكل الحب والتقدير نشكر', 'على ما تبذله من جهود مخلصة ومتميزة', 'جعل الله ذلك في موازين حسناتها'],
    'cert-excellence': ['شهادة تميّز', 'تُمنح هذه الشهادة', 'تقديراً لتميّزها وإبداعها في عملها', 'وتشجيعاً لها على مواصلة العطاء'],
    'cert-early': ['شهادة شكر وتقدير', 'تقديراً للالتزام والانضباط نشكر', 'لحرصها الدائم على الحضور المبكر إلى الحصص', 'فهي قدوة حسنة لطالباتنا وزميلاتها'],
    'cert-initiative': ['شهادة شكر وتقدير', 'يسرّنا أن نشكر', 'على مبادرتها المتميزة في ..........................', 'سائلين الله لها التوفيق والسداد'],
  }[name] || [];
  const sig = [];
  const sigY = h * 0.84;
  if (S.principal !== null) {
    sig.push(T(S.title, w * 0.72, sigY, 22, P.text, true), T(S.name || '..........................', w * 0.72, sigY + 34, 20, P.muted));
    sig.push(T('قائدة المدرسة', w * 0.28, sigY, 22, P.text, true), T(S.principal || '..........................', w * 0.28, sigY + 34, 20, P.muted));
    sig.push(T(`التاريخ: ${fmtH(t)}`, cx, sigY + 34, 18, P.muted));
  } else {
    sig.push(T(S.title, w * 0.28, sigY, 23, P.text, true), T(S.name || '..........................', w * 0.28, sigY + 36, 21, P.muted));
    sig.push(T(`التاريخ: ${fmtH(t)}`, w * 0.72, sigY + 18, 21, P.text));
  }
  const body = (y0, yTitle, titleSize = fs(17)) => [
    T(lines[0], cx, yTitle, titleSize, P.title, true),
    T(lines[1], cx, h * (y0), fs(38)),
    T(name0, cx, h * (y0 + 0.1), fs(28), P.nameC, true, 'name'),
    T(lines[2], cx, h * (y0 + 0.2), fs(38)),
    T(lines[3], cx, h * (y0 + 0.27), fs(40), P.muted),
  ];
  let objs;
  if (name === 'cert-modern') {
    objs = [R(w - 150, 0, 150, h, P.accent, 0, P.accent), R(w - 168, 0, 10, h, P.frame, 0, P.frame), R(36, 36, w - 240, h - 72, P.frame, 2),
      T('★', w - 75, h * 0.2, 54, '#ffffff'), T(school, (w - 150) / 2, 92, 22, P.muted), ...body(0.4, h * 0.25).map((o) => ({ ...o, x: (w - 150) / 2 })), ...sig.map((o) => ({ ...o, x: o.x * (w - 150) / w }))];
  } else if (name === 'cert-ribbon') {
    objs = [R(0, 0, w, 90, P.accent, 0, P.accent), R(0, 90, w, 8, P.frame, 0, P.frame), R(0, h - 70, w, 70, P.accent, 0, P.accent), R(0, h - 78, w, 8, P.frame, 0, P.frame),
      T(school, cx, 46, 24, '#ffffff', true), ...body(0.39, h * 0.25, fs(15)), ...sig.map((o) => ({ ...o, y: o.y - 30 }))];
  } else if (name === 'cert-excellence') {
    objs = [R(26, 26, w - 52, h - 52, P.frame, 6, '', 18), R(44, 44, w - 88, h - 88, P.accent, 1.5, '', 12),
      E(cx - 52, 66, 104, 104, P.frame, 5, P.soft), T('★', cx, 118, 56, P.frame), T(school, cx, 200, 22, P.muted), ...body(0.44, h * 0.34, fs(15))];
    objs.push(...sig);
  } else {
    objs = [R(28, 28, w - 56, h - 56, P.frame, 10), R(52, 52, w - 104, h - 104, P.accent, 2),
      R(40, 40, 36, 36, P.accent, 0, P.accent), R(w - 76, 40, 36, 36, P.accent, 0, P.accent), R(40, h - 76, 36, 36, P.accent, 0, P.accent), R(w - 76, h - 76, 36, 36, P.accent, 0, P.accent),
      T(school, cx, 120, 24, P.muted), ...body(0.42, h * 0.27), ...sig];
  }
  return { bg: P.bg, objs };
};
D_TEMPLATES.splice(D_TEMPLATES.findIndex((x) => x[0] === 'cert'), 1, ...CERT_TEMPLATES);
const _dTplChange = CHANGES.dTpl;
CHANGES.dTpl = (el) => { if (el.value.startsWith('cert')) DS.tpl = el.value; else DS.tpl = null; _dTplChange(el); };
const _designerRender = TOOL_VIEWS.designer.render;
TOOL_VIEWS.designer.render = function () {
  const html = _designerRender.call(this);
  const extra = `<div class="field"><label>ألوان الشهادة</label><div class="pal-row">${Object.entries(CERT_PALETTES).map(([k, p]) => `<button class="pal ${(DS.palette || 'green') === k ? 'on' : ''}" data-act="dPalette" data-id="${k}" title="${p.name}" style="background:linear-gradient(135deg,${p.accent} 50%,${p.frame} 50%)"></button>`).join('')}</div></div>
    <div class="field"><label>اسم المعلمة في الشهادة</label><select class="input" data-change="dTeacher"><option value="">— اختاري معلمة —</option>${sortedTeachers().map((t) => `<option ${DS.teacherName === t.name ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>`;
  return html.replace('<div class="field"><label>مقاس اللوحة</label>', extra + '<div class="field"><label>مقاس اللوحة</label>');
};
ACTIONS.dPalette = (el) => {
  DS.palette = el.dataset.id;
  if (DS.tpl) { const t = dTemplate(DS.tpl); dSnapshot(); DS.bg = t.bg; DS.objs = t.objs; DS.sel = null; }
  else toast('اختاري قالب شهادة أولاً ليُطبَّق عليه اللون');
  render();
};
CHANGES.dTeacher = (el) => {
  DS.teacherName = el.value;
  const o = DS.objs.find((x) => x.role === 'name') || DS.objs.find((x) => x.t === 'text' && /الأستاذة\s*\//.test(x.text));
  if (!o) { toast('اختاري قالب شهادة أولاً'); return; }
  dSnapshot(); o.text = el.value ? `الأستاذة / ${el.value}` : 'الأستاذة / ............................'; dDraw();
};
addHook('settingsCards', () => `<div class="card"><h3>🏅 التوقيع في الشهادات</h3>
  <div class="form">
    <div class="field"><label>مسمّى صاحبة التوقيع</label><input class="input" value="${esc(db.settings.signerTitle || 'المساعد الإداري')}" data-change="setting" data-id="signerTitle"></div>
    <div class="field"><label>الاسم</label><input class="input" value="${esc(db.settings.signerName ?? db.settings.employeeName ?? '')}" data-change="setting" data-id="signerName"></div>
    <div class="field full"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${db.settings.showPrincipal ? 'checked' : ''} data-change="settingBool" data-id="showPrincipal"> إضافة توقيع قائدة المدرسة أيضاً</label></div>
    ${db.settings.showPrincipal ? `<div class="field full"><label>اسم قائدة المدرسة</label><input class="input" value="${esc(db.settings.principalName || '')}" data-change="setting" data-id="principalName"></div>` : ''}
  </div><div class="muted" style="font-size:12px;margin-top:6px">تظهر هذه البيانات في قوالب الشهادات الجاهزة في المصمم.</div></div>`);
const _settingBool2 = CHANGES.settingBool;
CHANGES.settingBool = (el, e) => { _settingBool2(el, e); if (el.dataset.id === 'showPrincipal') render(); };

// ═════════════ الحصص السبع: لوحة الحصص في متابعة دخول الحصص ═════════════
(HOOKS.entriesTop = HOOKS.entriesTop || []).unshift((d) => {
  const per = periodsList(), wd = parse(d).getDay();
  const cur = ui.ttQuickP || ui.lastPeriod || 1;
  return `<div class="periods-board">${per.map((p) => {
    const rec = db.classEntries.filter((e) => e.date === d && e.period === p);
    const planned = db.timetable.filter((x) => x.day === wd && x.period === p).length;
    const c = (k) => rec.filter((e) => e.status === k).length;
    const full = planned && rec.length >= planned;
    return `<button class="pb-cell ${p === cur ? 'on' : ''} ${full ? 'full' : ''}" data-act="pbPick" data-id="${p}">
      <span class="pb-n">الحصة ${p}</span><span class="pb-c">${rec.length}${planned ? ` / ${planned}` : ''}</span>
      <span class="pb-dots">${c('early') ? `<i class="g">${c('early')}</i>` : ''}${c('late') ? `<i class="a">${c('late')}</i>` : ''}${c('absent') ? `<i class="r">${c('absent')}</i>` : ''}</span></button>`;
  }).join('')}</div>`;
});
ACTIONS.pbPick = (el) => { const p = +el.dataset.id; ui.ttQuickP = p; ui.lastPeriod = p; render(); const s = document.querySelector('#entryForm [name=period]'); if (s) s.value = String(p); };

// ═════════════ ☀️ سجل المناوبة الصباحية ═════════════
const MD_STATUS = { present: ['حضرت', 'green'], late: ['تأخرت', 'amber'], absent: ['غابت', 'red'], excused: ['بعذر', 'blue'] };
const morningType = () => db.duties.types.find((t) => t.id === 'morning') || db.duties.types.find((t) => /صباح/.test(t.name));
addHook('beforeStart', () => { if (!db.morningLog) db.morningLog = {}; if (db.duties && !morningType()) db.duties.types.unshift({ id: 'morning', name: 'المناوبة الصباحية' }); });
function morningCard() {
  const d = ui.mdDate || todayISO(), wd = parse(d).getDay(), mt = morningType();
  const log = db.morningLog[d] || {};
  const assigned = (mt && wd <= 4 ? db.duties.roster[wd]?.[mt.id] : []) || [];
  const ids = [...new Set([...assigned, ...Object.keys(log)])];
  const absT = dutyAbsent(d);
  return `<div class="card" style="margin-bottom:16px"><h3>☀️ سجل المناوبة الصباحية
      <span class="more" style="display:flex;gap:6px;align-items:center"><button class="btn sm" data-act="mdDay" data-id="-1">→</button><input type="date" class="input" value="${d}" data-change="mdDate" style="padding:3px 8px"><button class="btn sm" data-act="mdDay" data-id="1">←</button></span></h3>
    <div class="muted" style="margin:-6px 0 10px">${dayName(d)} ${fmtH(d)}${!assigned.length && wd <= 4 ? ' · لا توجد معلمات مكلفات في جدول المناوبة لهذا اليوم — أضيفيهن من الجدول أدناه' : ''}${wd > 4 ? ' · عطلة نهاية الأسبوع' : ''}</div>
    ${ids.length ? `<div class="tq-list">${ids.map((id) => { const r = log[id] || {}; return `<div class="tq-row"><div class="grow"><b>${esc(tName(id))}</b>${!assigned.includes(id) ? ' <span class="chip">بديلة</span>' : ''}${absT.has(id) ? ' <span class="chip red">لديها غياب مسجّل</span>' : ''}</div>
      ${Object.entries(MD_STATUS).map(([k, [l, c]]) => `<button class="btn sm tq-btn ${r.status === k ? 'on ' + c : ''}" data-act="mdSet" data-id="${id}" data-st="${k}">${l}</button>`).join('')}
      <input class="input" style="width:200px" placeholder="ملاحظة" value="${esc(r.note || '')}" data-change="mdNote" data-id="${id}"></div>`; }).join('')}</div>` : ''}
    <div style="display:flex;gap:8px;margin-top:10px;align-items:center"><select class="input" data-change="mdAdd" style="width:auto"><option value="">＋ إضافة معلمة بديلة</option>${sortedTeachers().filter((t) => !ids.includes(t.id)).map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
      <span class="spacer" style="flex:1"></span>${mdSummary(d)}</div></div>`;
}
function mdSummary(d) {
  const m = d.slice(0, 7), c = { present: 0, late: 0, absent: 0, excused: 0 };
  Object.entries(db.morningLog).filter(([k]) => k.startsWith(m)).forEach(([, v]) => Object.values(v).forEach((r) => { if (c[r.status] !== undefined) c[r.status]++; }));
  return `<span class="muted">هذا الشهر:</span> ${Object.entries(MD_STATUS).map(([k, [l, cl]]) => `<span class="chip ${cl}">${l}: ${c[k]}</span>`).join(' ')}`;
}
const _dutiesRender = VIEWS.duties.render;
VIEWS.duties.render = function () { return (db.teachers.length ? morningCard() : '') + _dutiesRender.call(this); };
const mdEntry = (d, id) => { db.morningLog[d] = db.morningLog[d] || {}; return (db.morningLog[d][id] = db.morningLog[d][id] || {}); };
Object.assign(ACTIONS, {
  mdDay: (el) => { ui.mdDate = addDays(ui.mdDate || todayISO(), +el.dataset.id); render(); },
  mdSet: (el) => { const d = ui.mdDate || todayISO(), r = mdEntry(d, el.dataset.id); r.status = r.status === el.dataset.st ? '' : el.dataset.st; commit(); },
});
Object.assign(CHANGES, {
  mdDate: (el) => { if (el.value) { ui.mdDate = el.value; render(); } },
  mdNote: (el) => { mdEntry(ui.mdDate || todayISO(), el.dataset.id).note = el.value; commit(false); },
  mdAdd: (el) => { if (el.value) { mdEntry(ui.mdDate || todayISO(), el.value); commit(); } },
});

// ═════════════ دمج الإشعارات المتكررة ═════════════
const _toast = toast;
toast = function (msg, kind = '') {
  const same = [...document.querySelectorAll('#toasts .toast')].find((t) => t.textContent === msg);
  if (same) { same.classList.remove('bump'); void same.offsetWidth; same.classList.add('bump'); return; }
  _toast(msg, kind);
};

// حفظ فوري لآخر التعديلات قبل إغلاق البرنامج
if (N?.onFlush) N.onFlush(async () => { clearTimeout(saveTimer); if (db) await api.save(db); });
window.addEventListener('beforeunload', () => { if (db) { clearTimeout(saveTimer); api.save(db); } });

// تنزيل نسخة البيانات المحفوظة تلقائياً قبل الترقية
addHook('settingsCards', () => db.flags?.preUpgradeBackup ? `<div class="card"><h3>🛟 نسخة ما قبل التحديث</h3><div class="muted">حفظ البرنامج نسخة كاملة من بياناتكِ تلقائياً قبل الترقية إلى الإصدار الحالي. نزّليها واحتفظي بها، ويمكن استعادتها من «استعادة نسخة».</div><button class="btn sm" style="margin-top:10px" data-act="preUpgradeDl">⬇ تنزيل نسخة ما قبل التحديث</button></div>` : '');
ACTIONS.preUpgradeDl = async () => {
  const b = await IDB.get('kv', db.flags.preUpgradeBackup).catch(() => null);
  if (!b) return toast('لم يُعثر على النسخة', 'err');
  downloadBlob(JSON.stringify(b.data), `نسخة-ما-قبل-التحديث-${b.date.slice(0, 10)}.json`, 'application/json'); toast('حُفظت النسخة في «التنزيلات»', 'ok');
};
