// ═════════════ 🎙️ الطابور الصباحي والإذاعة المدرسية (1.0.8) ═════════════
// برنامج الطابور بأوقاته، وجدول الإذاعة على الفصول، ومولّد إذاعة كاملة بأدوار الطالبات، وسجل الطابور وتقييم الإذاعات.

(function addNavAssembly() {
  const g = NAV_TREE.find((x) => x.group === 'super');
  g.items.unshift({ id: 'assembly', ic: '🎙️', label: 'الطابور والإذاعة' });
  NAV.length = 0; NAV.push(...NAV_TREE.flatMap((n) => (n.items ? n.items : [n])));
})();
const AS_SEGMENTS = [['اصطفاف الطالبات وتنظيم الصفوف', 5], ['التمارين الصباحية', 5], ['الإذاعة المدرسية', 8], ['السلام الملكي', 2], ['توجيهات الإدارة', 3], ['الانصراف المنظّم إلى الفصول', 3]];
const AS_RATE = [['excellent', 'ممتاز', 'green'], ['vgood', 'جيد جداً', 'brand'], ['good', 'جيد', 'blue'], ['weak', 'يحتاج متابعة', 'amber']];
const RADIO_ROLES = ['التقديم', 'القرآن الكريم', 'الحديث الشريف', 'كلمة الصباح', 'هل تعلمين؟', 'المسابقة', 'حكمة اليوم', 'الدعاء والختام'];
addHook('beforeStart', () => {
  if (!db.assembly) db.assembly = { start: '06:45', segments: AS_SEGMENTS.map(([n, m]) => ({ id: uid(), name: n, min: m })), plan: [], log: {}, part: {} };
  db.assembly.part = db.assembly.part || {};
});
const AS = () => db.assembly;
const asClasses = () => { const s = typeof sClasses === 'function' ? sClasses() : []; return s.length && db.students.length ? s : [...new Set(db.timetable.map((x) => x.className))].sort(typeof classSort === 'function' ? classSort : undefined); };
const radioOn = (d) => AS().plan.find((p) => p.date === d) || null;
const addMin = (hm, m) => { const [h, mi] = hm.split(':').map(Number); const t = h * 60 + mi + m; return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const occOnDate = (d) => db.occasions.find((o) => occNextDate(o, d) === d);

// ───── محتوى الإذاعة ─────
function radioContent(topic) {
  if (RADIO_TOPICS[topic]) return RADIO_TOPICS[topic];
  const o = db.occasions.find((x) => x.name === topic);
  if (o) { const k = kitOf(o); return { verse: null, hadith: null, word: k.broadcast, know: k.tips, quiz: [[`ما شعار مبادرتنا بمناسبة ${o.name}؟`, k.slogan]], wisdom: k.slogan, idea: k.idea }; }
  return RADIO_TOPICS['حسن الخلق'];
}
function radioTopics() { return [...Object.keys(RADIO_TOPICS), ...db.occasions.map((o) => o.name)]; }
// اختيار الطالبات الأقل مشاركة لأدوار الإذاعة
function radioCast(className) {
  const list = (db.students || []).filter((s) => sClass(s) === className);
  if (!list.length) return RADIO_ROLES.map(() => '');
  const P = AS().part, sorted = list.slice().sort((a, b) => (P[a.id] || 0) - (P[b.id] || 0) || a.name.localeCompare(b.name, 'ar'));
  return RADIO_ROLES.map((_, i) => sorted[i % sorted.length]);
}
function radioProgram(p, cast) {
  const c = radioContent(p.topic), d = p.date, nm = (i) => (cast[i]?.name ? esc(cast[i].name) : '..........................');
  const sec = (i, body) => `<tr><td style="width:22%;vertical-align:top"><b>${RADIO_ROLES[i]}</b><br><span style="color:#555">${nm(i)}</span></td><td>${body}</td></tr>`;
  return `${letterhead()}<h1 style="text-align:center">برنامج الإذاعة المدرسية</h1>
    <p style="text-align:center"><b>${esc(p.topic || '')}</b><br>${dayName(d)} ${fmtH(d)} (${fmtG(d)})${p.className ? ' · ' + esc(p.className) : ''}${p.teacherId ? ' · إشراف: ' + esc(tName(p.teacherId)) : ''}</p>
    <table><tbody>
    ${sec(0, `بسم الله الرحمن الرحيم، والصلاة والسلام على أشرف الأنبياء والمرسلين. صباح العلم والإيمان، صباح الجد والاجتهاد. نرحب بكم في إذاعتنا الصباحية لهذا اليوم، ${dayName(d)} ${fmtH(d)}، وموضوعها: «${esc(p.topic || '')}». ونبدأ بخير ما نبدأ به: آيات من القرآن الكريم.`)}
    ${sec(1, c.verse ? `قال الله تعالى: ﴿${esc(c.verse[0])}﴾ <span style="color:#555">[${esc(c.verse[1])}]</span><br><span style="color:#777;font-size:90%">تُتلى الآية مع ما قبلها وما بعدها من المصحف.</span>` : 'تلاوة آيات مناسبة من القرآن الكريم تختارها المشرفة.')}
    ${sec(2, c.hadith ? `قال رسول الله صلى الله عليه وسلم: «${esc(c.hadith[0])}» <span style="color:#555">(${esc(c.hadith[1])})</span>` : 'حديث نبوي مناسب للمناسبة تختاره المشرفة.')}
    ${sec(3, esc(c.word) + (c.idea ? `<br><br><b>مبادرتنا:</b> ${esc(c.idea)}` : ''))}
    ${sec(4, `<ul>${c.know.map((k) => `<li>هل تعلمين ${/^أن /.test(k) ? '' : 'أن: '}${esc(k)}؟</li>`).join('')}</ul>`)}
    ${sec(5, c.quiz.map(([q, a], i) => `<b>السؤال ${i + 1}:</b> ${esc(q)}<br><span style="color:#555">الإجابة: ${esc(a)}</span>`).join('<br><br>'))}
    ${sec(6, `«${esc(c.wisdom)}»`)}
    ${sec(7, 'اللهم انفعنا بما علّمتنا، وعلّمنا ما ينفعنا، وزدنا علماً. اللهم احفظ بلادنا وولاة أمرنا، ووفقنا لما تحب وترضى. وفي الختام نشكر لكم حسن الإصغاء، والسلام عليكم ورحمة الله وبركاته.')}
    </tbody></table>
    <p><br></p><table class="noborder" style="width:100%"><tbody><tr><td style="width:50%;text-align:center"><b>المعلمة المشرفة</b><br>${p.teacherId ? esc(tName(p.teacherId)) : ''}<br>..........................</td><td style="width:50%;text-align:center"><b>${esc(db.settings.signerTitle || 'المساعد الإداري')}</b><br>${esc(db.settings.employeeName || '')}<br>..........................</td></tr></tbody></table>`;
}

// ───── الواجهة ─────
function asToday() {
  const d = ui.asDate || todayISO(), A = AS(), p = radioOn(d), L = A.log[d] || {};
  const day = parse(d).getDay(), mt = typeof morningType === 'function' ? morningType() : null;
  const sup = mt ? db.duties?.roster?.[day]?.[mt.id] || [] : [], absT = dutyAbsent(d);
  const late = (db.studentLog || []).filter((e) => e.date === d && e.type === 'late').length;
  let t = A.start || '06:45';
  return `<div class="toolbar"><label class="muted">اليوم</label><input type="date" class="input" value="${d}" data-change="asDate" style="width:auto"><span class="muted">${dayName(d)}</span><span class="spacer" style="flex:1"></span><button class="btn sm" data-act="asRunPrint">🖨 برنامج الطابور</button></div>
    <div class="grid g2" style="align-items:start">
      <div class="card"><h3>⏱️ برنامج الطابور</h3><div class="as-run">${A.segments.map((s) => { const from = t; t = addMin(t, +s.min || 0); return `<div class="as-seg"><span class="as-time" dir="ltr">${from}</span><span class="grow">${esc(s.name)}</span><span class="muted">${s.min} د</span></div>`; }).join('')}<div class="as-seg end"><span class="as-time" dir="ltr">${t}</span><span class="grow muted">بداية الحصة الأولى</span></div></div>
        ${sup.length ? `<div class="section-title" style="margin:12px 0 6px">👩‍🏫 المناوبات في الطابور</div><div class="duty-load">${sup.map((id) => `<span class="chip ${absT.has(id) ? 'red' : 'brand'}">${esc(tName(id))}${absT.has(id) ? ' — غائبة' : ''}</span>`).join('')}</div>` : ''}</div>
      <div class="card"><h3>🎙️ إذاعة اليوم</h3>${p ? `<div class="as-radio"><div><b>${esc(p.topic || 'بدون موضوع')}</b></div><div class="muted">${esc(p.className || 'لم يُحدَّد فصل')}${p.teacherId ? ' · إشراف ' + esc(tName(p.teacherId)) : ''}</div></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><button class="btn sm primary" data-act="radioGen" data-id="${p.id}">✨ تجهيز الإذاعة كاملة</button></div>`
        : `<div class="muted">لا توجد إذاعة مجدولة لهذا اليوم.</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><button class="btn sm primary" data-act="radioQuick">✨ تجهيز إذاعة لهذا اليوم</button><button class="btn sm" data-act="asTab" data-id="plan">📅 جدول الإذاعة</button></div>`}</div>
    </div>
    <div class="card" style="margin-top:16px"><h3>📝 ملاحظات الطابور — ${dayName(d)} ${fmtH(d)}</h3>
      <div class="form">
        <div class="field"><label>انضباط الطابور</label><div class="seg">${AS_RATE.map(([k, l]) => `<button class="${L.discipline === k ? 'on' : ''}" data-act="asRate" data-k="discipline" data-id="${k}">${l}</button>`).join('')}</div></div>
        <div class="field"><label>تقييم الإذاعة (من 10)</label><div class="seg as-score">${[6, 7, 8, 9, 10].map((n) => `<button class="${L.radioScore === n ? 'on' : ''}" data-act="asScore" data-id="${n}">${n}</button>`).join('')}</div></div>
        <div class="field"><label>المتأخرات عن الطابور</label><div class="muted" style="padding-top:8px">${late ? `<b>${late}</b> طالبة مسجّلة «متأخرة» في الغياب اليومي` : 'لا يوجد تأخر مسجّل'} <button class="btn sm" data-act="stuGoAtt">تسجيل</button></div></div>
        <div class="field full"><label>ملاحظات (إيجابيات، ملاحظات تحتاج متابعة، مقترحات)</label><textarea class="input" rows="3" data-change="asNotes" placeholder="مثال: تميّز أداء الفصل في التمارين، ضعف الصوت في الإذاعة، تأخر بعض الطالبات عن الاصطفاف…">${esc(L.notes || '')}</textarea></div>
      </div>${L.notes || L.discipline ? '<div class="muted" style="font-size:12.5px">✓ تُحفظ الملاحظات تلقائياً</div>' : ''}</div>`;
}
function asPlan() {
  const A = AS(), from = todayISO(), list = A.plan.filter((p) => ui.asAll || p.date >= addDays(from, -7)).sort((a, b) => a.date.localeCompare(b.date));
  const classes = asClasses(), topics = radioTopics();
  return `<div class="toolbar"><button class="btn primary" data-act="radioAuto">✨ توزيع الإذاعة على الفصول تلقائياً</button><button class="btn" data-act="radioAdd">＋ يوم</button><button class="btn" data-act="radioPlanPrint">🖨 طباعة الجدول</button>
      <span class="spacer" style="flex:1"></span><label class="muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" ${ui.asAll ? 'checked' : ''} data-change="asAll"> إظهار الأيام السابقة</label></div>
    ${list.length ? `<div class="card" style="padding:0;overflow:auto"><table class="table"><thead><tr><th>اليوم</th><th>الفصل</th><th>المعلمة المشرفة</th><th>الموضوع</th><th>التقييم</th><th></th></tr></thead><tbody>
      ${list.map((p) => { const sc = A.log[p.date]?.radioScore; return `<tr class="${p.date === from ? 'sel-row' : ''}"><td>${dayName(p.date)} <span class="muted">${fmtH(p.date)}</span></td>
        <td><select class="input" data-change="radioSet" data-k="className" data-id="${p.id}"><option value="">—</option>${classes.map((c) => `<option ${p.className === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></td>
        <td><select class="input" data-change="radioSet" data-k="teacherId" data-id="${p.id}"><option value="">—</option>${sortedTeachers().map((t) => `<option value="${t.id}" ${p.teacherId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></td>
        <td><select class="input" data-change="radioSet" data-k="topic" data-id="${p.id}">${topics.map((x) => `<option ${p.topic === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></td>
        <td>${sc ? `<span class="chip green">${sc}/10</span>` : '—'}</td>
        <td class="actions"><button class="btn sm" data-act="radioGen" data-id="${p.id}">✨ تجهيز</button><button class="icon-btn" data-act="radioDel" data-id="${p.id}">🗑️</button></td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="card">${emptyState('📅', 'وزّعي الإذاعة على الفصول تلقائياً لأسابيع قادمة، مع موضوع لكل يوم، ويُستبدل الموضوع بالمناسبة إذا وافق يومها.<br>بعدها «✨ تجهيز» يكتب الإذاعة كاملة بأسماء طالبات الفصل.')}</div>`}`;
}
function asLog() {
  const A = AS(), days = Object.entries(A.log).filter(([, v]) => v.notes || v.discipline || v.radioScore).sort((a, b) => b[0].localeCompare(a[0]));
  const by = {}; days.forEach(([d, v]) => { const c = v.className || radioOn(d)?.className; if (c && v.radioScore) { (by[c] = by[c] || []).push(v.radioScore); } });
  const board = Object.entries(by).map(([c, a]) => [c, a.reduce((x, y) => x + y, 0) / a.length, a.length]).sort((a, b) => b[1] - a[1]);
  return `<div class="grid g2" style="align-items:start">
    <div class="card"><h3>🏆 أفضل إذاعة — ترتيب الفصول</h3>${board.length ? `<div class="list">${board.map(([c, avg, n], i) => `<div class="li"><span class="honor-rank r${i}">${i + 1}</span><div class="grow"><div class="t">${esc(c)}</div><div class="s">${n} إذاعة</div></div><span class="chip green">${avg.toFixed(1)} / 10</span></div>`).join('')}</div>` : emptyState('🏆', 'قيّمي الإذاعة يومياً من «الطابور اليوم» ليظهر الترتيب')}</div>
    <div class="card"><h3>📝 سجل الطابور</h3>${days.length ? `<div class="list" style="max-height:62vh;overflow:auto">${days.slice(0, 80).map(([d, v]) => { const R = AS_RATE.find((r) => r[0] === v.discipline); return `<div class="li"><div class="grow"><div class="t">${dayName(d)} ${fmtH(d)}</div><div class="s">${v.notes ? esc(v.notes) : ''}</div></div>${R ? `<span class="chip ${R[2]}">${R[1]}</span>` : ''}${v.radioScore ? `<span class="chip">🎙️ ${v.radioScore}</span>` : ''}</div>`; }).join('')}</div><button class="btn sm" style="margin-top:10px" data-act="asLogPrint">🖨 طباعة السجل</button>` : emptyState('📝', 'لا توجد ملاحظات مسجّلة بعد')}</div></div>`;
}
function asSetup() {
  const A = AS(); let t = A.start;
  return `<div class="card"><h3>⚙️ تنظيم الطابور</h3><div class="muted" style="margin-bottom:12px">رتّبي فقرات الطابور ومدة كل فقرة، فتُحسب الأوقات تلقائياً وتظهر في «الطابور اليوم» وفي البرنامج المطبوع.</div>
    <div class="field" style="max-width:200px"><label>بداية الطابور</label><input type="time" class="input" value="${A.start}" data-change="asStart"></div>
    <div class="as-setup">${A.segments.map((s, i) => { const from = t; t = addMin(t, +s.min || 0); return `<div class="as-srow"><span class="as-time" dir="ltr">${from}</span><input class="input" value="${esc(s.name)}" data-change="asSeg" data-k="name" data-id="${i}"><input class="input" type="number" min="1" max="60" value="${s.min}" data-change="asSeg" data-k="min" data-id="${i}" style="width:80px"><span class="muted">دقيقة</span>
      <button class="icon-btn" data-act="asSegMove" data-id="${i}" data-d="-1">▲</button><button class="icon-btn" data-act="asSegMove" data-id="${i}" data-d="1">▼</button><button class="icon-btn" data-act="asSegDel" data-id="${i}">🗑️</button></div>`; }).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="btn sm" data-act="asSegAdd">＋ فقرة</button><span class="muted" style="padding-top:6px">ينتهي الطابور: <b dir="ltr">${t}</b></span></div></div>`;
}
VIEWS.assembly = {
  actions: () => `<button class="btn" data-act="radioQuick">✨ إذاعة سريعة</button>`,
  render() {
    const tab = ui.asTab || 'today';
    return `<div class="seg" style="margin-bottom:14px">${[['today', '☀️ الطابور اليوم'], ['plan', '📅 جدول الإذاعة'], ['log', '📝 السجل والتقييم'], ['setup', '⚙️ تنظيم الطابور']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="asTab" data-id="${k}">${l}</button>`).join('')}</div>
      ${tab === 'plan' ? asPlan() : tab === 'log' ? asLog() : tab === 'setup' ? asSetup() : asToday()}`;
  },
};
const asLogOf = (d) => (AS().log[d] = AS().log[d] || {});
function radioOpen(p) {
  const cast = radioCast(p.className);
  const html = radioProgram(p, cast);
  db.documents = db.documents || [];
  const doc = { id: uid(), title: `الإذاعة المدرسية — ${p.topic} — ${fmtH(p.date)}`, html, updatedAt: todayISO() };
  db.documents.push(doc);
  cast.forEach((s) => { if (s?.id) AS().part[s.id] = (AS().part[s.id] || 0) + 1; });
  p.docId = doc.id; DOCS.id = doc.id; commit(false); go('letters');
  toast(cast.some((s) => s?.name) ? 'جُهّزت الإذاعة كاملة بأدوار طالبات الفصل — عدّليها أو صدّريها Word أو اطبعيها' : 'جُهّزت الإذاعة كاملة — أضيفي أسماء الطالبات أو اختاري فصلاً له طالبات مسجّلات', 'ok');
}
Object.assign(ACTIONS, {
  asTab: (el) => { ui.asTab = el.dataset.id; render(); },
  asRate: (el) => { asLogOf(ui.asDate || todayISO())[el.dataset.k] = el.dataset.id; commit(); },
  asScore: (el) => { const d = ui.asDate || todayISO(), L = asLogOf(d); L.radioScore = +el.dataset.id; L.className = radioOn(d)?.className || L.className || ''; commit(); },
  radioGen: (el) => { const p = AS().plan.find((x) => x.id === el.dataset.id); if (p.docId && db.documents?.some((x) => x.id === p.docId)) { confirmBox('هذه الإذاعة مُجهّزة من قبل. فتح المُجهّزة، أم إنشاء نسخة جديدة بأدوار جديدة؟', () => radioOpen(p), 'نسخة جديدة'); $('#modalRoot .modal-f').insertAdjacentHTML('afterbegin', `<button class="btn primary" data-act="radioOpenDoc" data-id="${p.docId}">فتح المُجهّزة</button>`); return; } radioOpen(p); },
  radioOpenDoc: (el) => { closeModal(); DOCS.id = el.dataset.id; go('letters'); },
  radioQuick: () => {
    const d = ui.asDate || todayISO(), o = occOnDate(d), classes = asClasses();
    formModal({ title: '✨ تجهيز إذاعة', fields: [
      { key: 'date', label: 'اليوم', type: 'date' }, { key: 'topic', label: 'الموضوع', type: 'select', options: radioTopics() },
      { key: 'className', label: 'الفصل (لتوزيع الأدوار على طالباته)', type: 'select', options: ['', ...classes] }, { key: 'teacherId', label: 'المعلمة المشرفة', type: 'select', options: [['', '—'], ...sortedTeachers().map((t) => [t.id, t.name])] }],
      values: { date: d, topic: o ? o.name : Object.keys(RADIO_TOPICS)[new Date(d).getDate() % Object.keys(RADIO_TOPICS).length], className: radioOn(d)?.className || '' },
      onSave: (v) => { let p = radioOn(v.date); if (!p) { p = { id: uid(), date: v.date }; AS().plan.push(p); } Object.assign(p, { topic: v.topic, className: v.className, teacherId: v.teacherId }); radioOpen(p); } });
  },
  radioAuto: () => {
    const classes = asClasses();
    if (!classes.length) return toast('أضيفي الطالبات (أو جدول الحصص) أولاً لتظهر الفصول', 'err');
    formModal({ title: '✨ توزيع الإذاعة على الفصول', fields: [
      { key: 'from', label: 'من تاريخ', type: 'date' }, { key: 'weeks', label: 'عدد الأسابيع', type: 'number', min: 1, max: 20 },
      { key: 'days', label: 'أيام الإذاعة', type: 'select', options: [['all', 'كل أيام الدراسة (الأحد إلى الخميس)'], ['mon-wed', 'الاثنين والأربعاء'], ['sun-tue-thu', 'الأحد والثلاثاء والخميس']] },
      { key: 'keep', label: 'الإبقاء على الأيام المجدولة مسبقاً', type: 'checkbox', full: true }],
      values: { from: todayISO(), weeks: 4, days: 'all', keep: true },
      onSave: (v) => {
        const allow = { all: [0, 1, 2, 3, 4], 'mon-wed': [1, 3], 'sun-tue-thu': [0, 2, 4] }[v.days], topics = Object.keys(RADIO_TOPICS);
        const last = AS().plan.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
        let ci = last ? (classes.indexOf(last.className) + 1) % classes.length : 0, ti = last ? (topics.indexOf(last.topic) + 1) % topics.length : 0, n = 0;
        for (let d = v.from, k = 0; k < (+v.weeks || 4) * 7; k++, d = addDays(d, 1)) {
          if (!allow.includes(parse(d).getDay()) || (typeof acadOff === 'function' && acadOff(d))) continue;
          const ex = radioOn(d); if (ex && v.keep) continue;
          const o = occOnDate(d), p = ex || { id: uid(), date: d };
          Object.assign(p, { className: classes[ci % classes.length], topic: o ? o.name : topics[ti % topics.length] });
          if (!ex) AS().plan.push(p);
          ci++; if (!o) ti++; n++;
        }
        ui.asTab = 'plan'; commit(); toast(`جُدولت ${n} إذاعة على ${classes.length} فصول`, 'ok');
      } });
  },
  radioAdd: () => { const last = AS().plan.map((p) => p.date).sort().pop(); let d = last ? addDays(last, 1) : todayISO(); while (parse(d).getDay() > 4 || (typeof acadOff === 'function' && acadOff(d))) d = addDays(d, 1); AS().plan.push({ id: uid(), date: d, className: '', topic: occOnDate(d)?.name || Object.keys(RADIO_TOPICS)[0] }); commit(); },
  radioDel: (el) => { AS().plan = AS().plan.filter((p) => p.id !== el.dataset.id); commit(); },
  radioPlanPrint: () => { const L = AS().plan.filter((p) => p.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date)); printDoc('جدول الإذاعة المدرسية', `<table><thead><tr><th>اليوم</th><th>التاريخ</th><th>الفصل</th><th>المشرفة</th><th>الموضوع</th></tr></thead><tbody>${L.map((p) => `<tr><td>${dayName(p.date)}</td><td>${fmtH(p.date)}</td><td>${esc(p.className || '')}</td><td>${p.teacherId ? esc(tName(p.teacherId)) : ''}</td><td>${esc(p.topic || '')}</td></tr>`).join('')}</tbody></table>`); },
  asRunPrint: () => { const d = ui.asDate || todayISO(), A = AS(), p = radioOn(d); let t = A.start; printDoc(`برنامج الطابور الصباحي — ${dayName(d)} ${fmtH(d)}`, `<table><thead><tr><th style="width:90px">الوقت</th><th>الفقرة</th><th style="width:90px">المدة</th></tr></thead><tbody>${A.segments.map((s) => { const f = t; t = addMin(t, +s.min || 0); return `<tr><td dir="ltr">${f}</td><td>${esc(s.name)}${/إذاعة/.test(s.name) && p ? ` — ${esc(p.className || '')} · ${esc(p.topic || '')}` : ''}</td><td>${s.min} دقائق</td></tr>`; }).join('')}</tbody></table>`); },
  asLogPrint: () => { const days = Object.entries(AS().log).filter(([, v]) => v.notes || v.discipline || v.radioScore).sort((a, b) => a[0].localeCompare(b[0])); printDoc('سجل الطابور الصباحي', `<table><thead><tr><th>اليوم</th><th>الانضباط</th><th>الإذاعة</th><th>الملاحظات</th></tr></thead><tbody>${days.map(([d, v]) => `<tr><td>${dayName(d)} ${fmtH(d)}</td><td>${AS_RATE.find((r) => r[0] === v.discipline)?.[1] || ''}</td><td>${v.radioScore ? v.radioScore + '/10' : ''}</td><td>${esc(v.notes || '')}</td></tr>`).join('')}</tbody></table>`); },
  asSegAdd: () => { AS().segments.push({ id: uid(), name: 'فقرة جديدة', min: 3 }); commit(); },
  asSegDel: (el) => { AS().segments.splice(+el.dataset.id, 1); commit(); },
  asSegMove: (el) => { const S = AS().segments, i = +el.dataset.id, j = i + +el.dataset.d; if (j < 0 || j >= S.length) return; [S[i], S[j]] = [S[j], S[i]]; commit(); },
});
Object.assign(CHANGES, {
  asDate: (el) => { if (el.value) { ui.asDate = el.value; render(); } },
  asNotes: (el) => { const d = ui.asDate || todayISO(); asLogOf(d).notes = el.value; asLogOf(d).className = radioOn(d)?.className || ''; commit(false); },
  asAll: (el) => { ui.asAll = el.checked; render(); },
  radioSet: (el) => { const p = AS().plan.find((x) => x.id === el.dataset.id); p[el.dataset.k] = el.value; commit(false); },
  asStart: (el) => { if (el.value) { AS().start = el.value; commit(); } },
  asSeg: (el) => { const s = AS().segments[+el.dataset.id]; s[el.dataset.k] = el.dataset.k === 'min' ? Math.max(1, Math.min(60, +el.value || 1)) : el.value; commit(); },
});
// لوحة اليوم: إذاعة اليوم
addHook('dashCards', (t) => {
  const p = radioOn(t); if (!p) return '';
  return `<div class="card"><h3>🎙️ إذاعة اليوم</h3><div><b>${esc(p.topic || '')}</b></div><div class="muted" style="margin:4px 0 10px">${esc(p.className || '')}${p.teacherId ? ' · ' + esc(tName(p.teacherId)) : ''}</div><button class="btn sm primary" data-act="radioGen" data-id="${p.id}">✨ تجهيز الإذاعة</button> <button class="btn sm" data-act="nav" data-id="assembly">☀️ الطابور</button></div>`;
});
