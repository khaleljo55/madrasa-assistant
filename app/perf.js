// ═════════════ 📈 الأداء الوظيفي (1.2.0) ═════════════
// يتابع دورة الأداء السنوية كما في دليل وزارة التعليم لشاغلي الوظائف الإدارية:
// الأهداف 50% (4 إلى 6 أهداف قابلة للقياس) والجدارات 50%، وميثاق في بداية الدورة، ومراجعة نصف سنوية،
// وتقييم نهائي في «فارس»، ثم التظلم بشواهد PDF لكل عنصر. الدورة سنوية مع السنة الميلادية.
// البرنامج لا يرسل شيئاً إلى فارس؛ يجمع الشواهد ويقيس التقدم من بيانات البرنامج نفسها ويذكّر بالمواعيد.
const PERF_COMPS = ['المسؤولية والالتزام', 'العمل الجماعي والتعاون', 'التواصل الفعّال', 'تحقيق النتائج وجودة العمل', 'المبادرة والإبداع', 'التطوير الذاتي'];
const PERF_GOALS = [
  { title: 'إدخال سجلات غياب وإجازات المنسوبات في نظام فارس أولاً بأول', indicator: 'نسبة السجلات المُدخلة في فارس', metric: 'faris', target: 95, weight: 20 },
  { title: 'تغطية حصص الانتظار كاملة وبتوزيع عادل', indicator: 'نسبة الحصص الشاغرة المغطاة ببديلة', metric: 'subs', target: 100, weight: 20 },
  { title: 'متابعة اطلاع المعلمات على التعاميم في موعدها', indicator: 'نسبة التعاميم المكتمل اطلاعها', metric: 'circ', target: 100, weight: 15 },
  { title: 'تنفيذ مبادرات الأيام العالمية والوطنية المعتمدة', indicator: 'عدد المبادرات المنفّذة', metric: 'occ', target: 8, weight: 15 },
  { title: 'توثيق الاجتماعات بمحاضر ومتابعة قراراتها', indicator: 'عدد المحاضر الموثّقة', metric: 'meet', target: 10, weight: 15 },
  { title: 'التطوير المهني بحضور برامج تدريبية', indicator: 'عدد البرامج التدريبية', metric: 'manual', target: 3, weight: 15 },
];
const PERF_METRICS = { manual: 'يدوي (أدخلي النسبة)', faris: 'من سجل الغياب: نسبة المُدخل في فارس', subs: 'من حصص الانتظار: نسبة المغطاة', circ: 'من التعاميم: نسبة المكتمل اطلاعها', occ: 'من المناسبات: عدد المنفّذة', meet: 'من المحاضر: عدد الاجتماعات' };
const PERF_STAGES = [['charter', 'إعداد ميثاق الأداء والاتفاق على الأهداف', '-02-15'], ['mid', 'المراجعة نصف السنوية', '-06-30'], ['final', 'التقييم النهائي في نظام فارس', '-12-15'], ['appeal', 'نهاية فترة التظلم', '']];
const perfNewCycle = (y) => ({ cycle: String(y), goals: PERF_GOALS.map((g) => ({ id: uid(), ...g, progress: 0 })), comps: PERF_COMPS.map((name) => ({ id: uid(), name, note: '' })), evidence: [], plan: [], stages: Object.fromEntries(PERF_STAGES.map(([k, , md]) => [k, { date: md ? y + md : '', done: !!md && y + md < todayISO(), est: !!md }])) });
// دورة أنشئت في منتصف السنة: المراحل التي فات موعدها التقديري تُعلَّم منجزة (يمكن إلغاء ذلك)
addHook('beforeStart', () => {
  if (!db.perf) db.perf = perfNewCycle(new Date().getFullYear());
  const P = db.perf; ['goals', 'comps', 'evidence', 'plan'].forEach((k) => { if (!Array.isArray(P[k])) P[k] = []; }); P.stages = P.stages || {};
});
const perf = () => db.perf;
const inCycle = (d) => d && d.slice(0, 4) === perf().cycle;
// قياس التقدم من بيانات البرنامج (ضمن سنة الدورة)
function perfMeasure(m) {
  const t = todayISO();
  if (m === 'faris') { const L = db.absences.filter((a) => inCycle(a.date)); return L.length ? { v: Math.round((L.filter((a) => a.faris).length / L.length) * 100), unit: '%', of: `${L.filter((a) => a.faris).length} من ${L.length} سجل` } : { v: null }; }
  if (m === 'subs' && typeof subsNeeded === 'function') {
    const days = new Set(); db.absences.forEach((a) => { for (let d = a.date; d <= (a.dateTo || a.date) && d <= t; d = addDays(d, 1)) if (inCycle(d) && !isWeekend(d)) days.add(d); });
    let need = 0, got = 0; days.forEach((d) => subsNeeded(d).forEach((x) => { need++; if (subOf(d, x)?.subId) got++; }));
    return need ? { v: Math.round((got / need) * 100), unit: '%', of: `${got} من ${need} حصة` } : { v: null };
  }
  if (m === 'circ') { const L = (db.circulars || []).filter((c) => inCycle(c.date)); if (!L.length) return { v: null }; const ok = L.filter((c) => { const [a, n] = cirProgress(c); return n && a === n; }).length; return { v: Math.round((ok / L.length) * 100), unit: '%', of: `${ok} من ${L.length} تعميم` }; }
  if (m === 'occ') { const n = db.occasions.filter((o) => o.status === 'done' && String(o.year) === perf().cycle).length; return { v: n, unit: '', of: `${n} مبادرة` }; }
  if (m === 'meet') { const n = (db.meetings || []).filter((x) => inCycle(x.date)).length; return { v: n, unit: '', of: `${n} محضر` }; }
  return { v: null };
}
function perfAch(g) {
  if (g.metric && g.metric !== 'manual') { const r = perfMeasure(g.metric); if (r.v == null) return { pct: null, r }; const pct = r.unit === '%' ? Math.min(100, Math.round((r.v / (+g.target || 100)) * 100)) : Math.min(100, Math.round((r.v / (+g.target || 1)) * 100)); return { pct, r }; }
  return { pct: Math.min(100, +g.progress || 0), r: { of: 'يدوي' } };
}
const perfEv = (ref) => perf().evidence.filter((e) => e.ref === ref);
const perfWeights = () => perf().goals.reduce((a, g) => a + (+g.weight || 0), 0);
function perfScore() { const G = perf().goals, W = perfWeights(); if (!G.length || !W) return null; let s = 0; G.forEach((g) => { s += ((perfAch(g).pct || 0) * (+g.weight || 0)) / W; }); return Math.round(s); }
function perfUpcoming(t = todayISO()) {
  return PERF_STAGES.map(([k, label]) => ({ k, label, ...(perf().stages[k] || {}) })).filter((s) => s.date && !s.done && t >= addDays(s.date, -14));
}

// ───── القسم ─────
NAV.push({ id: 'perf', ic: '📈', label: 'الأداء الوظيفي', badge: () => perfUpcoming().length });
const PERF_TABS = [['charter', '🎯 الميثاق'], ['evidence', '📎 الشواهد'], ['plan', '🗺️ خطة العمل'], ['stages', '⏰ المراحل والتذكيرات']];
VIEWS.perf = {
  actions: () => `<button class="btn" data-act="pfReport">🖨 تقرير الإنجاز</button><button class="btn" data-act="pfBundle">📄 ملف الشواهد PDF</button><button class="btn primary" data-act="pfEvNew">＋ شاهد</button>`,
  render() {
    const P = perf(), tab = PERF_TABS.some(([k]) => k === ui.pfTab) ? ui.pfTab : 'charter', sc = perfScore(), W = perfWeights(), up = perfUpcoming();
    const head = `<div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><span class="n">${sc == null ? '—' : sc + '%'}</span><span class="l">تحقق الأهداف (تقديري)</span></div>
      <div class="card stat"><span class="n">${P.goals.length}</span><span class="l">أهداف الميثاق${P.goals.length < 4 || P.goals.length > 6 ? ' <span style="color:var(--amber)">(المطلوب 4–6)</span>' : ''}</span></div>
      <div class="card stat"><span class="n">${P.evidence.length}</span><span class="l">شاهداً موثّقاً</span></div>
      <div class="card stat"><span class="n" style="color:${up.length ? 'var(--amber)' : 'inherit'}">${up.length}</span><span class="l">مرحلة قريبة أو متأخرة</span></div></div>
      <div class="seg" style="margin-bottom:14px;flex-wrap:wrap">${PERF_TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="pfTab" data-id="${k}">${l}</button>`).join('')}<span class="muted" style="align-self:center;padding:0 10px;font-size:13px">دورة ${esc(P.cycle)} <button class="btn sm ghost" data-act="pfCycle">تغيير</button></span></div>`;
    return head + (PERF_VIEW[tab]?.() || '');
  },
};
const PERF_VIEW = {
  charter() {
    const P = perf(), W = perfWeights();
    return `<div class="card"><h3>🎯 الأهداف (50% من التقييم) <span class="more"><button class="btn sm primary" data-act="pfGoalNew">＋ هدف</button></span></h3>
      <div class="muted" style="margin-bottom:10px">من 4 إلى 6 أهداف محددة وقابلة للقياس ومرتبطة بمهامكِ. الأهداف المرتبطة ببيانات البرنامج يُحسب تقدمها تلقائياً.${W !== 100 ? ` <b style="color:var(--amber)">مجموع الأوزان ${W}% ويُفضّل أن يكون 100%.</b>` : ''}</div>
      ${P.goals.length ? `<div class="list">${P.goals.map((g) => { const a = perfAch(g), ev = perfEv('g:' + g.id).length; return `<div class="li" style="align-items:flex-start"><span class="chip brand" style="min-width:52px;justify-content:center">${+g.weight || 0}%</span><div class="grow"><div class="t">${esc(g.title)}</div>
        <div class="s">${esc(g.indicator || '')}${g.target ? ` · المستهدف ${esc(g.target)}${['faris', 'subs', 'circ'].includes(g.metric) ? '%' : ''}` : ''} · ${esc(a.r.of || '')} · ${ev ? `${ev} شاهد` : '<span style="color:var(--amber)">بلا شاهد</span>'}</div>
        <div class="progress" style="margin-top:6px"><div style="width:${a.pct || 0}%;background:${(a.pct || 0) >= 100 ? 'var(--green)' : 'var(--brand)'}"></div></div></div>
        <b style="min-width:44px;text-align:center">${a.pct == null ? '—' : a.pct + '%'}</b><button class="icon-btn" data-act="pfGoalEdit" data-id="${g.id}">✏️</button><button class="icon-btn" data-act="pfGoalDel" data-id="${g.id}">🗑️</button></div>`; }).join('')}</div>` : emptyState('🎯', 'أضيفي أهداف ميثاق الأداء')}</div>
    <div class="card" style="margin-top:16px"><h3>🧭 الجدارات (50% من التقييم) <span class="more"><button class="btn sm" data-act="pfCompNew">＋ جدارة</button></span></h3>
      <div class="muted" style="margin-bottom:10px">قائمة مقترحة؛ طابقيها مع نموذج الجدارات في «فارس» وعدّليها. أرفقي لكل جدارة شواهد من عملكِ.</div>
      <div class="list">${P.comps.map((c) => { const ev = perfEv('c:' + c.id).length; return `<div class="li"><div class="grow"><div class="t">${esc(c.name)}</div>${c.note ? `<div class="s">${esc(c.note)}</div>` : ''}</div><span class="chip ${ev ? 'green' : 'amber'}">${ev ? `${ev} شاهد` : 'بلا شاهد'}</span><button class="icon-btn" data-act="pfCompEdit" data-id="${c.id}">✏️</button><button class="icon-btn" data-act="pfCompDel" data-id="${c.id}">🗑️</button></div>`; }).join('')}</div></div>`;
  },
  evidence() {
    const P = perf(), refs = perfRefs(), sug = perfSuggest();
    return `<div class="card"><h3>📎 ملف الشواهد</h3><div class="muted" style="margin-bottom:10px">عند التظلم تُقبل الشواهد بصيغة PDF فقط لكل عنصر، ولا تُقبل الروابط أو الصور أو الملفات المضغوطة. أرفقي PDF أو صورة، وزر «ملف الشواهد PDF» يجمع شواهد كل عنصر في ملف PDF واحد ويحوّل الصور إلى صفحات PDF.</div>
      ${refs.map(([ref, label]) => { const L = perfEv(ref); return `<div style="margin-top:14px"><div style="display:flex;align-items:center;gap:8px"><b>${esc(label)}</b><span class="chip ${L.length ? 'green' : 'amber'}">${L.length}</span><span style="flex:1"></span><button class="btn sm ghost" data-act="pfEvNew" data-ref="${ref}">＋ شاهد</button>${L.some((e) => e.file) ? `<button class="btn sm ghost" data-act="pfBundle" data-ref="${ref}">📄 PDF</button>` : ''}</div>
        ${L.length ? `<div class="list" style="margin-top:6px">${L.map((e) => `<div class="li"><span>${e.file ? fileIcon(e.file.ext) : '📝'}</span><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${e.date ? fmtG(e.date) : ''}${e.note ? ' · ' + esc(e.note) : ''}</div></div>${e.file ? `<button class="icon-btn" data-act="pfEvOpen" data-id="${e.id}">↗</button>` : ''}<button class="icon-btn" data-act="pfEvEdit" data-id="${e.id}">✏️</button><button class="icon-btn" data-act="pfEvDel" data-id="${e.id}">🗑️</button></div>`).join('')}</div>` : ''}</div>`; }).join('')}</div>
      <div class="card" style="margin-top:16px"><h3>✨ منجزات من البرنامج يمكن توثيقها</h3><div class="muted" style="margin-bottom:10px">من عملكِ المسجّل في البرنامج خلال دورة ${esc(P.cycle)}. أضيفي ما يناسب كشاهد، ثم أرفقي ملفه (مثل المحضر أو التقرير بصيغة PDF).</div>
        ${sug.length ? `<div class="list">${sug.map((s, i) => `<div class="li"><span>${s.ic}</span><div class="grow"><div class="t">${esc(s.title)}</div><div class="s">${s.date ? fmtG(s.date) : ''}</div></div><button class="btn sm" data-act="pfSug" data-i="${i}">＋ كشاهد</button></div>`).join('')}</div>` : emptyState('✨', 'لا توجد منجزات مسجّلة بعد في هذه الدورة')}</div>`;
  },
  plan() {
    const P = perf(), st = { todo: ['لم يبدأ', ''], doing: ['قيد التنفيذ', 'amber'], done: ['منجز', 'green'] };
    return `<div class="card"><h3>🗺️ خطة العمل السنوية <span class="more"><button class="btn sm" data-act="pfPlanPrint">🖨 طباعة</button><button class="btn sm primary" data-act="pfPlanNew">＋ نشاط</button></span></h3>
      <div class="muted" style="margin-bottom:10px">أنشطة تحقق أهداف الميثاق، لكل نشاط مدة ومسؤول ومؤشر. زر «مهمة» يضيف النشاط إلى قائمة المهام فيذكّركِ به في موعده.</div>
      ${P.plan.length ? `<div style="overflow:auto"><table class="table"><thead><tr><th>النشاط</th><th>الهدف</th><th>المدة</th><th>المسؤول</th><th>المؤشر</th><th>الحالة</th><th></th></tr></thead><tbody>${P.plan.slice().sort((a, b) => (a.from || '').localeCompare(b.from || '')).map((x) => { const g = P.goals.find((y) => y.id === x.goalId); return `<tr><td><b>${esc(x.activity)}</b></td><td class="muted" style="font-size:13px">${esc(g?.title || '—')}</td><td style="white-space:nowrap;font-size:13px">${x.from ? fmtGShort(x.from) : ''}${x.to ? ' ← ' + fmtGShort(x.to) : ''}</td><td>${esc(x.owner || '')}</td><td style="font-size:13px">${esc(x.kpi || '')}</td><td><button class="chip ${st[x.status || 'todo'][1]}" style="border:0;cursor:pointer" data-act="pfPlanSt" data-id="${x.id}">${st[x.status || 'todo'][0]}</button></td><td style="white-space:nowrap">${x.taskId ? '<span class="chip green">✓ مهمة</span>' : `<button class="btn sm ghost" data-act="pfPlanTask" data-id="${x.id}">＋ مهمة</button>`}<button class="icon-btn" data-act="pfPlanEdit" data-id="${x.id}">✏️</button><button class="icon-btn" data-act="pfPlanDel" data-id="${x.id}">🗑️</button></td></tr>`; }).join('')}</tbody></table></div>` : emptyState('🗺️', 'أضيفي أنشطة خطة العمل المرتبطة بأهدافكِ')}</div>`;
  },
  stages() {
    const P = perf(), t = todayISO();
    return `<div class="card"><h3>⏰ مراحل دورة الأداء ${esc(P.cycle)}</h3><div class="muted" style="margin-bottom:10px">تذكّركِ لوحة اليوم بكل مرحلة قبل موعدها بأسبوعين. المواعيد المقترحة تقديرية؛ عدّليها حسب تعميم إدارة التعليم.</div>
      <div class="list">${PERF_STAGES.map(([k, label]) => { const s = P.stages[k] || {}, late = s.date && !s.done && s.date < t, soon = s.date && !s.done && !late && t >= addDays(s.date, -14); return `<div class="li"><span class="check ${s.done ? 'on' : ''}" data-act="pfStageDone" data-id="${k}">${s.done ? '✓' : ''}</span><div class="grow"><div class="t">${label}</div><div class="s">${s.date ? `${dayName(s.date)} ${fmtG(s.date)} · ${fmtH(s.date)}${s.est ? ' · تقديري' : ''}` : 'لم يُحدَّد الموعد'}</div></div>${late ? '<span class="chip red">متأخرة</span>' : soon ? '<span class="chip amber">قريبة</span>' : s.done ? '<span class="chip green">تمّت</span>' : ''}<input class="input" type="date" value="${esc(s.date || '')}" data-change="pfStageDate" data-id="${k}" style="width:auto"></div>`; }).join('')}</div></div>
    <div class="card" style="margin-top:16px"><h3>📌 قبل التقييم النهائي</h3><div class="list">
      <div class="li"><span>${perf().goals.every((g) => perfEv('g:' + g.id).length) ? '✅' : '⚠️'}</span><div class="grow">لكل هدف شاهد واحد على الأقل</div><span class="chip">${perf().goals.filter((g) => perfEv('g:' + g.id).length).length} من ${perf().goals.length}</span></div>
      <div class="li"><span>${perf().comps.every((c) => perfEv('c:' + c.id).length) ? '✅' : '⚠️'}</span><div class="grow">لكل جدارة شاهد واحد على الأقل</div><span class="chip">${perf().comps.filter((c) => perfEv('c:' + c.id).length).length} من ${perf().comps.length}</span></div>
      <div class="li"><span>${perfWeights() === 100 ? '✅' : '⚠️'}</span><div class="grow">مجموع أوزان الأهداف 100%</div><span class="chip">${perfWeights()}%</span></div>
      <div class="li"><span>${perf().goals.length >= 4 && perf().goals.length <= 6 ? '✅' : '⚠️'}</span><div class="grow">عدد الأهداف من 4 إلى 6</div><span class="chip">${perf().goals.length}</span></div></div></div>`;
  },
};
const perfRefs = () => [...perf().goals.map((g) => ['g:' + g.id, '🎯 ' + g.title]), ...perf().comps.map((c) => ['c:' + c.id, '🧭 ' + c.name])];
function perfSuggest() {
  const out = [], have = new Set(perf().evidence.map((e) => e.src).filter(Boolean));
  (db.meetings || []).filter((m) => inCycle(m.date)).forEach((m) => out.push({ src: 'mt:' + m.id, ic: '📝', title: `محضر اجتماع: ${m.title || m.subject || ''}`.trim(), date: m.date }));
  (db.circulars || []).filter((c) => inCycle(c.date) && (() => { const [a, n] = cirProgress(c); return n && a === n; })()).forEach((c) => out.push({ src: 'cr:' + c.id, ic: '📜', title: `اكتمال الاطلاع على تعميم: ${c.subject}`, date: c.date }));
  db.occasions.filter((o) => o.status === 'done' && String(o.year) === perf().cycle).forEach((o) => out.push({ src: 'oc:' + o.id, ic: '🎉', title: `تنفيذ مبادرة: ${o.name}${o.initiative ? ' — ' + o.initiative : ''}`, date: '' }));
  (db.visits || []).filter((v) => inCycle(v.date)).forEach((v) => out.push({ src: 'vs:' + v.id, ic: '🤝', title: `استقبال زيارة: ${v.team}`, date: v.date }));
  return out.filter((s) => !have.has(s.src));
}
function perfEvForm(e, preset = {}) {
  formModal({ title: e ? 'تعديل الشاهد' : '📎 شاهد جديد', fields: [
    { key: 'title', label: 'وصف الشاهد', type: 'text', full: true, required: true },
    { key: 'ref', label: 'العنصر', type: 'select', full: true, options: perfRefs() },
    { key: 'date', label: 'التاريخ', type: 'date' }, { key: 'note', label: 'ملاحظة', type: 'text' },
    { key: 'file', label: 'الملف (PDF أو صورة)', type: 'file' }],
    values: e || { date: todayISO(), ref: preset.ref || perfRefs()[0]?.[0], title: preset.title || '', note: '' },
    onSave: (v) => { if (e) Object.assign(e, v); else perf().evidence.push({ id: uid(), src: preset.src || '', ...v }); commit(); toast('حُفظ الشاهد', 'ok'); } });
}
function perfGoalForm(g) {
  formModal({ title: g ? 'تعديل الهدف' : '🎯 هدف جديد', wide: true, fields: [
    { key: 'title', label: 'الهدف', type: 'text', full: true, required: true }, { key: 'indicator', label: 'مؤشر القياس', type: 'text', full: true },
    { key: 'weight', label: 'الوزن %', type: 'number', min: 0, max: 100 }, { key: 'target', label: 'المستهدف', type: 'number', min: 0 },
    { key: 'metric', label: 'طريقة القياس', type: 'select', full: true, options: Object.entries(PERF_METRICS) },
    { key: 'progress', label: 'نسبة الإنجاز اليدوية % (للقياس اليدوي)', type: 'number', min: 0, max: 100 }, { key: 'due', label: 'الموعد المستهدف', type: 'date' }],
    values: g || { weight: 15, target: 100, metric: 'manual', progress: 0 },
    onSave: (v) => { ['weight', 'target', 'progress'].forEach((k) => (v[k] = v[k] === '' ? '' : +v[k])); if (g) Object.assign(g, v); else perf().goals.push({ id: uid(), ...v }); commit(); } });
}
function perfPlanForm(x) {
  formModal({ title: x ? 'تعديل النشاط' : '🗺️ نشاط جديد', wide: true, fields: [
    { key: 'activity', label: 'النشاط', type: 'text', full: true, required: true },
    { key: 'goalId', label: 'الهدف المرتبط', type: 'select', full: true, options: [['', '—'], ...perf().goals.map((g) => [g.id, g.title])] },
    { key: 'from', label: 'من', type: 'date' }, { key: 'to', label: 'إلى', type: 'date' },
    { key: 'owner', label: 'المسؤول', type: 'text', list: [db.settings.employeeName || '', ...db.teachers.map((t) => t.name)].filter(Boolean) }, { key: 'kpi', label: 'مؤشر التحقق', type: 'text' }],
    values: x || { from: todayISO(), owner: db.settings.employeeName || '' },
    validate: (v) => (v.to && v.from && v.to < v.from ? 'تاريخ النهاية قبل البداية' : ''),
    onSave: (v) => { if (x) Object.assign(x, v); else perf().plan.push({ id: uid(), status: 'todo', ...v }); commit(); } });
}
// دمج شواهد عنصر (أو الكل) في ملف PDF واحد
async function perfBundle(ref) {
  const refs = ref ? perfRefs().filter(([r]) => r === ref) : perfRefs(), L = refs.flatMap(([r]) => perfEv(r).filter((e) => e.file));
  if (!L.length) return toast('لا توجد شواهد بملفات لدمجها', 'err');
  toast('جارٍ تجهيز ملف الشواهد…');
  try {
    const { PDFDocument } = await loadPdfLib(); const out = await PDFDocument.create(); let skipped = 0;
    for (const e of L) {
      const b = await getFileBlob(e.file.stored); if (!b) { skipped++; continue; }
      const bytes = new Uint8Array(await b.arrayBuffer()), ext = (e.file.ext || '').toLowerCase();
      if (ext === 'pdf') { const src = await PDFDocument.load(bytes, { ignoreEncryption: true }); (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p)); }
      else if (/^(jpe?g|png)$/.test(ext)) { const img = ext === 'png' ? await out.embedPng(bytes) : await out.embedJpg(bytes); const page = out.addPage([595.28, 841.89]); const s = Math.min(555 / img.width, 800 / img.height, 1); page.drawImage(img, { x: (595.28 - img.width * s) / 2, y: (841.89 - img.height * s) / 2, width: img.width * s, height: img.height * s }); }
      else skipped++;
    }
    if (!out.getPageCount()) return toast('الشواهد ليست PDF أو صوراً؛ حوّليها إلى PDF أولاً', 'err');
    const name = ref ? refs[0][1].replace(/^\S+\s/, '') : `ملف الشواهد ${perf().cycle}`;
    openBlob(new Blob([await out.save()], { type: 'application/pdf' }), `شواهد — ${name}`.replace(/[\\/:*?"<>|]/g, '').slice(0, 90) + '.pdf', true);
    toast(skipped ? `جُهّز الملف، وتُخطّي ${skipped} ملف ليس PDF أو صورة` : 'جُهّز ملف الشواهد ✓', 'ok');
  } catch (err) { toast('تعذّر تجهيز الملف: ' + err.message, 'err'); }
}
// ───── لوحة اليوم ─────
addHook('dashCards', (t) => {
  const y = +t.slice(0, 4);
  if (y > +perf().cycle && t.slice(5) <= '03-31') return `<div class="card"><h3>📈 الأداء الوظيفي</h3><div class="muted" style="margin-bottom:10px">بدأت دورة الأداء ${y}. ابدئي ميثاقاً جديداً بأهداف مقترحة، وتُحفظ دورة ${esc(perf().cycle)} في الأرشيف.</div><button class="btn sm primary" data-act="pfCycle">🎯 بدء دورة ${y}</button></div>`;
  const up = perfUpcoming(t); if (!up.length) return '';
  return `<div class="card"><h3>📈 الأداء الوظيفي <span class="more"><button class="btn sm ghost" data-act="pfGo" data-id="stages">المراحل</button></span></h3><div class="list">${up.map((s) => `<div class="li"><span>${s.date < t ? '🔴' : '⏰'}</span><div class="grow"><div class="t">${s.label}</div><div class="s">${s.date < t ? 'متأخرة · ' : ''}${dayName(s.date)} ${fmtG(s.date)}</div></div></div>`).join('')}</div>
    <div class="muted" style="font-size:13px;margin-top:8px">${perf().goals.filter((g) => !perfEv('g:' + g.id).length).length ? `${perf().goals.filter((g) => !perfEv('g:' + g.id).length).length} هدف بلا شاهد بعد.` : 'لكل هدف شاهد ✓'}</div></div>`;
});
const pfFind = (k, id) => perf()[k].find((x) => x.id === id);
Object.assign(ACTIONS, {
  pfTab: (el) => { ui.pfTab = el.dataset.id; render(); },
  pfGo: (el) => { ui.pfTab = el.dataset.id; go('perf'); },
  pfCycle: () => formModal({ title: 'دورة أداء جديدة', fields: [{ key: 'y', label: 'السنة الميلادية للدورة', type: 'number', min: 2024, max: 2100, required: true }], values: { y: +perf().cycle + 1 }, onSave: (v) => confirmBox(`بدء دورة ${v.y}؟ تُحفظ الدورة الحالية في الأرشيف داخل البيانات، وتبدأ أهداف جديدة مقترحة.`, () => { db.perfArchive = [...(db.perfArchive || []), perf()]; db.perf = perfNewCycle(v.y); commit(); }, 'نعم، ابدئي') }),
  pfGoalNew: () => perfGoalForm(null),
  pfGoalEdit: (el) => perfGoalForm(pfFind('goals', el.dataset.id)),
  pfGoalDel: (el) => { const g = pfFind('goals', el.dataset.id); confirmBox(`حذف الهدف «${g.title}»؟ تبقى شواهده محفوظة.`, () => { perf().goals = perf().goals.filter((x) => x !== g); commit(); }); },
  pfCompNew: () => formModal({ title: '🧭 جدارة', fields: [{ key: 'name', label: 'الجدارة', type: 'text', full: true, required: true }, { key: 'note', label: 'ملاحظة', type: 'text', full: true }], onSave: (v) => { perf().comps.push({ id: uid(), ...v }); commit(); } }),
  pfCompEdit: (el) => { const c = pfFind('comps', el.dataset.id); formModal({ title: 'تعديل الجدارة', fields: [{ key: 'name', label: 'الجدارة', type: 'text', full: true, required: true }, { key: 'note', label: 'ملاحظة', type: 'text', full: true }], values: c, onSave: (v) => { Object.assign(c, v); commit(); } }); },
  pfCompDel: (el) => { const c = pfFind('comps', el.dataset.id); confirmBox(`حذف الجدارة «${c.name}»؟`, () => { perf().comps = perf().comps.filter((x) => x !== c); commit(); }); },
  pfEvNew: (el) => perfEvForm(null, { ref: el.dataset.ref }),
  pfEvEdit: (el) => perfEvForm(pfFind('evidence', el.dataset.id)),
  pfEvDel: (el) => { const e = pfFind('evidence', el.dataset.id); confirmBox(`حذف الشاهد «${e.title}»؟`, () => { if (e.file) api.libDelete(e.file); perf().evidence = perf().evidence.filter((x) => x !== e); commit(); }); },
  pfEvOpen: async (el) => { const e = pfFind('evidence', el.dataset.id); const r = await api.libOpen(e.file); if (r) toast('تعذّر فتح الملف: ' + r, 'err'); },
  pfSug: (el) => { const s = perfSuggest()[+el.dataset.i]; if (s) perfEvForm(null, { title: s.title, src: s.src }); },
  pfBundle: (el) => perfBundle(el.dataset.ref || ''),
  pfPlanNew: () => perfPlanForm(null),
  pfPlanEdit: (el) => perfPlanForm(pfFind('plan', el.dataset.id)),
  pfPlanDel: (el) => { const x = pfFind('plan', el.dataset.id); confirmBox(`حذف النشاط «${x.activity}»؟`, () => { perf().plan = perf().plan.filter((y) => y !== x); commit(); }); },
  pfPlanSt: (el) => { const x = pfFind('plan', el.dataset.id); x.status = { todo: 'doing', doing: 'done', done: 'todo' }[x.status || 'todo']; commit(); },
  pfPlanTask: (el) => { const x = pfFind('plan', el.dataset.id), id = uid(); db.tasks.push({ id, title: x.activity, due: x.to || x.from || todayISO(), priority: 'medium', category: 'خطة العمل', status: 'todo', notes: x.kpi || '', createdAt: todayISO() }); x.taskId = id; commit(); toast('أُضيف النشاط إلى المهام', 'ok'); },
  pfPlanPrint: () => { const P = perf(); printDoc(`خطة العمل — ${P.cycle}`, `<table><thead><tr><th>م</th><th>النشاط</th><th>الهدف</th><th>من</th><th>إلى</th><th>المسؤول</th><th>مؤشر التحقق</th></tr></thead><tbody>${P.plan.slice().sort((a, b) => (a.from || '').localeCompare(b.from || '')).map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.activity)}</td><td>${esc(P.goals.find((g) => g.id === x.goalId)?.title || '')}</td><td>${x.from ? fmtG(x.from) : ''}</td><td>${x.to ? fmtG(x.to) : ''}</td><td>${esc(x.owner || '')}</td><td>${esc(x.kpi || '')}</td></tr>`).join('')}</tbody></table>`); },
  pfReport: () => {
    const P = perf(), sc = perfScore();
    printDoc(`تقرير الإنجاز — دورة الأداء ${P.cycle}`, `<p><b>الاسم:</b> ${esc(db.settings.employeeName || '')} &nbsp; <b>المدرسة:</b> ${esc(db.settings.schoolName || '')} &nbsp; <b>التاريخ:</b> ${fmtH(todayISO())}</p>
      <h3>الأهداف</h3><table><thead><tr><th>م</th><th>الهدف</th><th>الوزن</th><th>المؤشر</th><th>المستهدف</th><th>المتحقق</th><th>الشواهد</th></tr></thead><tbody>${P.goals.map((g, i) => { const a = perfAch(g); return `<tr><td>${i + 1}</td><td>${esc(g.title)}</td><td>${+g.weight || 0}%</td><td>${esc(g.indicator || '')}</td><td>${esc(g.target ?? '')}</td><td>${a.pct == null ? '—' : a.pct + '%'}<br><small>${esc(a.r.of || '')}</small></td><td>${perfEv('g:' + g.id).length}</td></tr>`; }).join('')}</tbody></table>
      ${sc != null ? `<p><b>نسبة تحقق الأهداف (تقديرية):</b> ${sc}%</p>` : ''}
      <h3>الجدارات</h3><table><thead><tr><th>م</th><th>الجدارة</th><th>الشواهد</th></tr></thead><tbody>${P.comps.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.name)}</td><td>${perfEv('c:' + c.id).map((e) => esc(e.title)).join('، ') || '—'}</td></tr>`).join('')}</tbody></table>
      <h3>الشواهد</h3><table><thead><tr><th>م</th><th>الشاهد</th><th>العنصر</th><th>التاريخ</th></tr></thead><tbody>${P.evidence.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.title)}</td><td>${esc((perfRefs().find(([r]) => r === e.ref) || [, ''])[1].replace(/^\S+\s/, ''))}</td><td>${e.date ? fmtG(e.date) : ''}</td></tr>`).join('')}</tbody></table>`);
  },
  pfStageDone: (el) => { const s = (perf().stages[el.dataset.id] = perf().stages[el.dataset.id] || {}); s.done = !s.done; commit(); },
});
CHANGES.pfStageDate = (el) => { const s = (perf().stages[el.dataset.id] = perf().stages[el.dataset.id] || {}); s.date = el.value; s.est = false; commit(); };
