// ═════════════ 🗓️ التقويم الدراسي ورسائل المناسبات المدرسية (1.2.0) ═════════════
// - تقويم العام الدراسي: الفصول والإجازات الرسمية والإضافية (تعليم المنطقة)، قابل للتعديل الكامل.
// - يُستبعد ما فيه من إجازات من: حصص الانتظار، وجدول الإذاعة، وبطاقة صباح اليوم، ويظهر في التقويم.
// - رسائل جاهزة للمعلمات: تهنئة قبل كل إجازة، واستقبال في أول يوم، وترحيب بالعودة، وختام العام؛
//   يذكّر بها البرنامج في وقتها، وتُرسل عبر Gmail أو رسالة نصية بعد مراجعتها.
// المصدر: قرار الفصلين الدراسيين (وزارة التعليم، 5 أغسطس 2025)، ومواعيد 1448هـ كما نشرتها صحيفة عاجل نقلاً عن الوزارة.
const ACAD_1448 = {
  year: '1448', start: '2026-08-23', end: '2027-06-24', staffStart: '',
  terms: [
    { id: 'tm1', name: 'الفصل الدراسي الأول', from: '2026-08-23', to: '2027-01-07' },
    { id: 'tm2', name: 'الفصل الدراسي الثاني', from: '2027-01-17', to: '2027-06-24' },
  ],
  holidays: [
    { id: 'h0', name: 'إجازة اليوم الوطني', from: '2026-09-23', to: '2026-09-23', kind: 'official', note: 'تحققي من الإعلان الرسمي' },
    { id: 'h1', name: 'إجازة الخريف', from: '2026-11-20', to: '2026-11-28', kind: 'official' },
    { id: 'h2', name: 'إجازة منتصف العام', from: '2027-01-08', to: '2027-01-16', kind: 'official' },
    { id: 'h3', name: 'إجازة يوم التأسيس', from: '2027-02-19', to: '2027-02-22', kind: 'official' },
    { id: 'h4', name: 'إجازة عيد الفطر', from: '2027-02-26', to: '2027-03-13', kind: 'official' },
    { id: 'h5', name: 'إجازة عيد الأضحى', from: '2027-05-07', to: '2027-05-22', kind: 'official' },
  ],
  next: { admin: '2027-08-10', teachers: '2027-08-15', students: '2027-08-22' },
  sent: {}, src: '1448',
};
const ACAD_TPL = {
  welcome: { subject: 'أهلاً بكنّ في العام الدراسي {العام}هـ', body: 'الزميلات الفاضلات\nالسلام عليكم ورحمة الله وبركاته\n\nيسعدنا أن نرحب بكنّ في عامنا الدراسي الجديد {العام}هـ، سائلين الله أن يجعله عام خير وتوفيق وإنجاز.\n\nنتطلع إلى عام مثمر نعمل فيه معاً لخدمة طالباتنا وكتاب الله، وأبواب الإدارة مفتوحة لكل ما يعين على ذلك.\n\nدمتنّ بخير،\n{الموظفة}\n{المدرسة}' },
  congrats: { subject: 'تهنئة بمناسبة {الإجازة}', body: 'الزميلات الفاضلات\nالسلام عليكم ورحمة الله وبركاته\n\nبمناسبة {الإجازة} نتقدم لكنّ بخالص الشكر والتقدير على جهودكنّ المخلصة خلال الفترة الماضية، متمنين لكنّ إجازة سعيدة مليئة بالراحة والطمأنينة. {عبارة_المناسبة}\n\nموعد العودة بإذن الله: يوم {يوم_العودة} {تاريخ_العودة}.\n\nدمتنّ بخير،\n{الموظفة}\n{المدرسة}' },
  return: { subject: 'حيّاكنّ الله بعد {الإجازة}', body: 'الزميلات الفاضلات\nالسلام عليكم ورحمة الله وبركاته\n\nحمداً لله على سلامتكنّ، وأهلاً بعودتكنّ بعد {الإجازة}. نسأل الله أن تكون الأيام القادمة أيام عطاء وتوفيق لنا ولطالباتنا.\n\nدمتنّ بخير،\n{الموظفة}\n{المدرسة}' },
  end: { subject: 'ختام العام الدراسي {العام}هـ', body: 'الزميلات الفاضلات\nالسلام عليكم ورحمة الله وبركاته\n\nمع ختام العام الدراسي {العام}هـ نشكر لكنّ ما بذلتنّه من جهد وعطاء، ونسأل الله أن يجعله في موازين حسناتكنّ، وأن تكون الإجازة الصيفية إجازة سعيدة.\n\nدمتنّ بخير،\n{الموظفة}\n{المدرسة}' },
};
const ACAD_TYPES = { welcome: '👋 استقبال أول يوم', congrats: '🌷 تهنئة بالإجازة', return: '🤍 ترحيب بالعودة', end: '🎓 ختام العام' };
addHook('beforeStart', () => {
  if (!db.acad) db.acad = JSON.parse(JSON.stringify(ACAD_1448)); // أول تشغيل: تقويم 1448هـ جاهز ويُعدَّل
  const A = db.acad; A.terms = A.terms || []; A.holidays = A.holidays || []; A.sent = A.sent || {};
});
const acad = () => db.acad;
const acadHoliday = (d) => (db.acad?.holidays || []).find((h) => inRange(d, h.from, h.to));
const acadInYear = (d) => db.acad?.start && db.acad?.end && d >= db.acad.start && d <= db.acad.end;
// يوم إجازة مدرسية (لا يشمل عطلة نهاية الأسبوع)
function acadOff(d) { return !!acadHoliday(d); }
const acadSchoolDay = (d) => acadInYear(d) && !isWeekend(d) && !acadHoliday(d) && !!acadTerm(d);
const acadTerm = (d) => (db.acad?.terms || []).find((t) => inRange(d, t.from, t.to));
const acadSun = (d) => addDays(d, -parse(d).getDay());
function acadWeek(d) {
  const T = acadTerm(d); if (!T) return null;
  const weeks = []; for (let w = acadSun(T.from); w <= T.to; w = addDays(w, 7)) { let has = false; for (let i = 0; i < 5; i++) { const x = addDays(w, i); if (x >= T.from && x <= T.to && acadSchoolDay(x)) { has = true; break; } } if (has) weeks.push(w); }
  const i = weeks.indexOf(acadSun(d));
  return { term: T, n: i + 1, total: weeks.length };
}
const acadSchoolDays = (a, b) => { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (acadSchoolDay(d)) n++; return n; };
const acadPrevSchool = (d) => { for (let i = 1, x = addDays(d, -1); i < 20; i++, x = addDays(x, -1)) if (acadSchoolDay(x)) return x; return null; };
const acadNextSchool = (d) => { for (let i = 1, x = addDays(d, 1); i < 60; i++, x = addDays(x, 1)) if (acadSchoolDay(x)) return x; return null; };
const acadNextHoliday = (d) => (db.acad?.holidays || []).filter((h) => (h.to || h.from) >= d).sort((a, b) => a.from.localeCompare(b.from))[0];

// ───── رسائل المناسبات ─────
function acadMsgs() {
  const A = acad(); if (!A?.start) return [];
  const out = [], first = A.staffStart || A.start;
  out.push({ key: 'welcome:' + first, type: 'welcome', date: first, title: 'استقبال المعلمات في أول يوم دراسي' });
  A.holidays.forEach((h) => {
    const before = acadPrevSchool(h.from), after = acadNextSchool(h.to || h.from);
    if (before && h.from > A.start) out.push({ key: 'congrats:' + h.id, type: 'congrats', date: before, h, back: after, title: `تهنئة بـ${h.name}` });
    if (after && after <= A.end) out.push({ key: 'return:' + h.id, type: 'return', date: after, h, title: `الترحيب بالعودة بعد ${h.name}` });
  });
  out.push({ key: 'end:' + A.end, type: 'end', date: A.end, title: 'ختام العام الدراسي' });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
const acadTpl = (type) => ({ ...ACAD_TPL[type], ...((db.settings.acadTpl || {})[type] || {}) });
function acadFill(s, m) {
  const h = m.h, back = m.back || (h && acadNextSchool(h.to || h.from));
  const occ = h ? (/عيد/.test(h.name) ? 'تقبّل الله منّا ومنكنّ صالح الأعمال، وكل عام وأنتنّ بخير.' : /الوطني|التأسيس/.test(h.name) ? 'دام عزّ الوطن، وحفظ الله قيادتنا وبلادنا.' : '') : '';
  const v = { 'العام': acad().year || '', 'الإجازة': h?.name || '', 'يوم_العودة': back ? dayName(back) : '', 'تاريخ_العودة': back ? `${fmtH(back)} الموافق ${fmtG(back)}` : '', 'المدرسة': db.settings.schoolName || '', 'الموظفة': db.settings.employeeName || '', 'عبارة_المناسبة': occ };
  return String(s).replace(/\{([^{}]+)\}/g, (all, k) => (k in v ? v[k] : all)).replace(/ +\n/g, '\n');
}
const acadDue = (t = todayISO()) => acadMsgs().filter((m) => !acad().sent[m.key] && t >= addDays(m.date, -2) && t <= addDays(m.date, 1));
function acadMsgModal(key) {
  const m = acadMsgs().find((x) => x.key === key); if (!m) return;
  const T = acadTpl(m.type), to = db.teachers.filter((t) => t.email).length, ph = db.teachers.filter((t) => t.phone).length;
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal wide"><div class="modal-h"><h2>${ACAD_TYPES[m.type].split(' ')[0]} ${esc(m.title)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b"><div class="muted" style="margin-bottom:10px">موعد الإرسال: ${dayName(m.date)} ${fmtH(m.date)} · إلى ${to} معلمة لهن بريد${ph ? ` · ${ph} لهن جوال` : ''}. راجعي النص وعدّليه كما تحبين قبل الإرسال.</div>
      <div class="field"><label>العنوان</label><input class="input" id="acSub" value="${esc(acadFill(T.subject, m))}"></div>
      <div class="field" style="margin-top:10px"><label>نص الرسالة</label><textarea class="input" id="acBody" rows="12">${esc(acadFill(T.body, m))}</textarea></div></div>
    <div class="modal-f"><button class="btn primary" data-act="acMail">📧 فتح في Gmail</button>${ph ? '<button class="btn" data-act="acSms">📱 رسالة نصية</button>' : ''}<button class="btn" data-act="acDone">✓ أُرسلت</button><span style="flex:1"></span><button class="btn ghost" data-act="acSkip">تخطي هذه الرسالة</button></div></div></div>`;
  modalCtx = { acKey: key };
}
const acadMark = (key, v) => { acad().sent[key] = v; commit(false); };

// ───── شريط العام الدراسي (كل خانة أسبوع) ─────
function acadStrip() {
  const A = acad(), t = todayISO(); if (!A.start || !A.end) return '';
  let html = '', lastM = -1, wi = 0, lastLab = -9;
  for (let w = acadSun(A.start); w <= A.end; w = addDays(w, 7)) {
    let sch = 0, hol = 0, name = '';
    for (let i = 0; i < 5; i++) { const x = addDays(w, i); if (x < A.start || x > A.end) continue; const h = acadHoliday(x); if (h) { hol++; name = h.name; } else if (acadTerm(x)) sch++; }
    const m = parse(w).getMonth(); let lab = ''; if (m !== lastM && wi - lastLab >= 3) { lab = MONTHS[m]; lastLab = wi; } lastM = m; wi++;
    const cls = hol && !sch ? 'hol' : hol ? 'part' : sch ? 'sch' : 'gap', now = t >= w && t <= addDays(w, 6);
    html += `<div class="ac-wk ${cls} ${now ? 'now' : ''}" title="${esc(`${fmtG(w)}${name ? ' — ' + name : ''}`)}"><span class="ac-m">${lab}</span></div>`;
  }
  return `<div class="ac-strip">${html}</div><div class="ac-legend"><span><i class="sch"></i> أسبوع دراسي</span><span><i class="part"></i> فيه إجازة</span><span><i class="hol"></i> إجازة</span><span><i class="now"></i> هذا الأسبوع</span></div>`;
}

// ───── القسم ─────
const acadNav = { id: 'acad', ic: '🗓️', label: 'التقويم الدراسي' };
NAV.push(acadNav);
function acadSummary(t) {
  const A = acad(), w = acadWeek(t), h = acadHoliday(t), nh = acadNextHoliday(t);
  if (!A?.start) return '';
  if (t < A.start) return `<span class="chip brand">يبدأ العام الدراسي ${A.year}هـ بعد ${daysLabel(diffDays(t, A.start))}</span>`;
  if (t > A.end) return `<span class="chip">انتهى العام الدراسي ${A.year}هـ</span>${A.next?.students ? ` <span class="muted">· العام القادم يبدأ ${fmtG(A.next.students)}</span>` : ''}`;
  const parts = [];
  if (h) parts.push(`<span class="chip amber">🏖 ${esc(h.name)} · العودة ${dayName(acadNextSchool(h.to) || h.to)} ${fmtG(acadNextSchool(h.to) || h.to)}</span>`);
  else if (w) parts.push(`<span class="chip brand">الأسبوع ${w.n} من ${w.total} · ${esc(w.term.name)}</span>`);
  if (!h && nh) { const n = acadSchoolDays(t, addDays(nh.from, -1)); parts.push(`<span class="chip">${esc(nh.name)} بعد ${plural(n, 'يوم دراسي واحد', 'يومين دراسيين', 'أيام دراسية', 'يوماً دراسياً')} (${fmtG(nh.from)})</span>`); }
  parts.push(`<span class="chip">متبقٍ على نهاية العام: ${plural(acadSchoolDays(t, A.end), 'يوم دراسي واحد', 'يومان دراسيان', 'أيام دراسية', 'يوماً دراسياً')}</span>`);
  return parts.join(' ');
}
VIEWS.acad = {
  actions: () => `<button class="btn" data-act="acYear">⚙️ بيانات العام</button><button class="btn primary" data-act="acHolNew">＋ إجازة</button>`,
  render() {
    const A = acad(), t = todayISO(), msgs = acadMsgs();
    const hol = A.holidays.slice().sort((a, b) => a.from.localeCompare(b.from));
    return `<div class="card" style="margin-bottom:16px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${acadSummary(t)}</div>
      <div style="margin-top:14px">${acadStrip()}</div>
      ${A.src === '1448' ? `<div class="muted" style="font-size:12.5px;margin-top:10px">مواعيد 1448هـ مأخوذة من الإعلان المنشور عن وزارة التعليم. أضيفي الإجازات الإضافية التي تعلنها إدارة تعليم المنطقة بزر «＋ إجازة»، وعدّلي أي موعد عند الحاجة.</div>` : ''}</div>
    <div class="grid g2" style="align-items:start">
      <div class="card"><h3>📘 الفصول الدراسية</h3><div class="list">${A.terms.map((x) => `<div class="li"><div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${dayName(x.from)} ${fmtH(x.from)} ← ${dayName(x.to)} ${fmtH(x.to)}<br>${fmtG(x.from)} ← ${fmtG(x.to)} · ${plural(acadSchoolDays(x.from, x.to), 'يوم دراسي', 'يومان', 'أيام دراسية', 'يوماً دراسياً')}</div></div><button class="icon-btn" data-act="acTermEdit" data-id="${x.id}">✏️</button></div>`).join('')}</div>
        <div class="muted" style="font-size:13px;margin-top:10px">بداية الدراسة: ${fmtG(A.start)} · نهاية العام: بعد دوام ${dayName(A.end)} ${fmtG(A.end)}${A.staffStart ? ` · أول دوام للمعلمات: ${fmtG(A.staffStart)}` : ''}</div></div>
      <div class="card"><h3>🏖 الإجازات</h3>${hol.length ? `<div class="list">${hol.map((h) => { const past = (h.to || h.from) < t, now = inRange(t, h.from, h.to); return `<div class="li" style="${past ? 'opacity:.55' : ''}"><div class="grow"><div class="t">${esc(h.name)} ${h.kind === 'extra' ? '<span class="chip blue" style="font-size:11px">إضافية</span>' : ''} ${now ? '<span class="chip amber" style="font-size:11px">الآن</span>' : ''}</div><div class="s">${fmtG(h.from)}${h.to && h.to !== h.from ? ` ← ${fmtG(h.to)}` : ''} · ${fmtH(h.from)}${h.note ? ` · ${esc(h.note)}` : ''}</div></div><button class="icon-btn" data-act="acHolEdit" data-id="${h.id}">✏️</button><button class="icon-btn" data-act="acHolDel" data-id="${h.id}">🗑️</button></div>`; }).join('')}</div>` : emptyState('🏖', 'لا توجد إجازات مسجّلة')}</div>
    </div>
    <div class="card" style="margin-top:16px"><h3>💌 رسائل المعلمات في مناسبات العام <span class="more"><button class="btn sm ghost" data-act="acTpls">✏️ قوالب الرسائل</button></span></h3>
      <div class="muted" style="margin-bottom:10px">يذكّركِ البرنامج في لوحة اليوم قبل موعد كل رسالة بيومين، والرسالة جاهزة تراجعينها وترسلينها عبر Gmail أو رسالة نصية.</div>
      <div class="list">${msgs.map((m) => { const s = A.sent[m.key], due = !s && t >= addDays(m.date, -2) && t <= addDays(m.date, 1), past = !s && m.date < addDays(t, -1); return `<div class="li" style="${past ? 'opacity:.55' : ''}"><span class="chip ${s === 'skip' ? '' : s ? 'green' : due ? 'amber' : 'brand'}" style="min-width:118px;justify-content:center">${ACAD_TYPES[m.type]}</span><div class="grow"><div class="t">${esc(m.title)}</div><div class="s">${dayName(m.date)} ${fmtH(m.date)} · ${fmtG(m.date)}${s ? (s === 'skip' ? ' · تُخطّيت' : ` · أُرسلت ${fmtG(s)}`) : due ? ' · حان موعدها' : past ? ' · فات موعدها' : ''}</div></div><button class="btn sm ${due ? 'primary' : ''}" data-act="acOpen" data-id="${esc(m.key)}">${s && s !== 'skip' ? 'عرض' : 'تجهيز'}</button></div>`; }).join('')}</div></div>`;
  },
};
// ───── لوحة اليوم ─────
addHook('dashCards', (t) => {
  const A = acad(); if (!A?.start) return '';
  const due = acadDue(t);
  return `<div class="card"><h3>🗓️ التقويم الدراسي <span class="more"><button class="btn sm ghost" data-act="nav" data-id="acad">التقويم</button></span></h3>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${acadSummary(t)}</div>
    ${due.length ? `<div class="list" style="margin-top:12px">${due.map((m) => `<div class="li"><span>💌</span><div class="grow"><div class="t">${esc(m.title)}</div><div class="s">رسالة جاهزة للمعلمات · ${dayName(m.date)} ${fmtG(m.date)}</div></div><button class="btn sm primary" data-act="acOpen" data-id="${esc(m.key)}">تجهيز</button></div>`).join('')}</div>` : ''}</div>`;
});
// ───── الإجازات في التقويم العام ─────
const _acItems = itemsForDate;
itemsForDate = function (d) { const out = _acItems(d), h = acadHoliday(d); if (h) out.unshift({ kind: 'hol', label: h.name, ref: h }); return out; };

const acTeachersBcc = () => db.teachers.map((t) => t.email).filter(Boolean);
Object.assign(ACTIONS, {
  acOpen: (el) => acadMsgModal(el.dataset.id),
  acMail: () => {
    const to = acTeachersBcc(); if (!to.length) return toast('لا توجد معلمات لهن بريد إلكتروني', 'err');
    api.openUrl(`https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(to.join(','))}&su=${encodeURIComponent($('#acSub').value)}&body=${encodeURIComponent($('#acBody').value)}`);
    const k = modalCtx.acKey; acadMark(k, todayISO()); closeModal(); render(); toast('فُتحت الرسالة في Gmail ✓', 'ok');
  },
  acSms: () => {
    const k = modalCtx.acKey, m = acadMsgs().find((x) => x.key === k), sub = $('#acSub').value;
    const short = m.type === 'congrats' ? `الأستاذة {الاسم}: ${sub}. نشكر جهودكِ ونتمنى لكِ إجازة سعيدة${m.back ? `، والعودة ${dayName(m.back)} ${fmtG(m.back)}` : ''}. {المدرسة}` : `الأستاذة {الاسم}: ${sub}. {المدرسة}`;
    closeModal();
    smsCompose({ title: m.title, kind: 'service', recipients: db.teachers.map((t) => ({ to: t.phone, name: t.name, vars: { 'الاسم': t.name, 'المدرسة': db.settings.schoolName || '' } })), template: short, onSent: () => acadMark(k, todayISO()) });
  },
  acDone: () => { acadMark(modalCtx.acKey, todayISO()); closeModal(); render(); },
  acSkip: () => { acadMark(modalCtx.acKey, 'skip'); closeModal(); render(); },
  acHolNew: () => acadHolForm(null),
  acHolEdit: (el) => acadHolForm(acad().holidays.find((h) => h.id === el.dataset.id)),
  acHolDel: (el) => { const h = acad().holidays.find((x) => x.id === el.dataset.id); confirmBox(`حذف «${h.name}» من التقويم؟`, () => { acad().holidays = acad().holidays.filter((x) => x !== h); commit(); }); },
  acTermEdit: (el) => { const x = acad().terms.find((y) => y.id === el.dataset.id); formModal({ title: 'تعديل ' + x.name, fields: [{ key: 'name', label: 'الاسم', type: 'text', full: true, required: true }, { key: 'from', label: 'البداية', type: 'date', required: true }, { key: 'to', label: 'النهاية', type: 'date', required: true }], values: x, validate: (v) => (v.to < v.from ? 'تاريخ النهاية قبل البداية' : ''), onSave: (v) => { Object.assign(x, v); acad().src = 'edited'; commit(); } }); },
  acYear: () => {
    const A = acad();
    formModal({ title: '⚙️ بيانات العام الدراسي', fields: [
      { key: 'year', label: 'العام الدراسي (هجري)', type: 'text', required: true }, { key: 'start', label: 'بداية الدراسة للطالبات', type: 'date', required: true },
      { key: 'staffStart', label: 'أول يوم دوام للمعلمات (اختياري)', type: 'date', hint: 'تُرسل رسالة الاستقبال في هذا اليوم، وإلا في أول يوم دراسة' }, { key: 'end', label: 'آخر يوم دراسي', type: 'date', required: true }],
      values: A, validate: (v) => (v.end <= v.start ? 'نهاية العام قبل بدايته' : ''), onSave: (v) => { Object.assign(A, v); A.src = 'edited'; commit(); } });
  },
  acTpls: () => {
    const T = Object.fromEntries(Object.keys(ACAD_TPL).map((k) => [k, acadTpl(k)]));
    formModal({ title: '✏️ قوالب رسائل المناسبات', wide: true, fields: Object.keys(ACAD_TPL).flatMap((k) => [{ key: k + '_s', label: `${ACAD_TYPES[k]} — العنوان`, type: 'text', full: true }, { key: k + '_b', label: 'النص', type: 'textarea', full: true, rows: 6 }]),
      values: Object.fromEntries(Object.entries(T).flatMap(([k, v]) => [[k + '_s', v.subject], [k + '_b', v.body]])),
      extraButtons: '<span class="muted" style="font-size:12px">المتغيرات: {الإجازة} {يوم_العودة} {تاريخ_العودة} {العام} {المدرسة} {الموظفة} {عبارة_المناسبة}</span>',
      onSave: (v) => { db.settings.acadTpl = Object.fromEntries(Object.keys(ACAD_TPL).map((k) => [k, { subject: v[k + '_s'] || ACAD_TPL[k].subject, body: v[k + '_b'] || ACAD_TPL[k].body }])); commit(); toast('حُفظت القوالب', 'ok'); } });
  },
});
function acadHolForm(h) {
  formModal({ title: h ? 'تعديل الإجازة' : '🏖 إجازة جديدة', fields: [
    { key: 'name', label: 'اسم الإجازة', type: 'text', full: true, required: true, list: ['إجازة إضافية', 'إجازة مطوّلة', 'تعليق الدراسة الحضورية'] },
    { key: 'from', label: 'من', type: 'date', required: true }, { key: 'to', label: 'إلى', type: 'date' },
    { key: 'kind', label: 'النوع', type: 'select', options: [['official', 'رسمية (وزارة التعليم)'], ['extra', 'إضافية (إدارة تعليم المنطقة)']] },
    { key: 'note', label: 'ملاحظة', type: 'text' }],
    values: h || { kind: 'extra', from: todayISO() },
    validate: (v) => (v.to && v.to < v.from ? 'تاريخ النهاية قبل البداية' : ''),
    onSave: (v) => { if (!v.to) v.to = v.from; if (h) Object.assign(h, v); else acad().holidays.push({ id: uid(), ...v }); commit(); toast('حُفظت الإجازة', 'ok'); } });
}
