// ═════════════ 📜 التعاميم · 📝 المحاضر · 🚶 سجل الزوار (1.0.9) ═════════════
addHook('beforeStart', () => {
  if (!Array.isArray(db.circulars)) db.circulars = [];
  if (!Array.isArray(db.meetings)) db.meetings = [];
  if (!Array.isArray(db.visitors)) db.visitors = [];
});
const school = () => db.settings.schoolName || '';

// ───── 📜 التعاميم وتوقيع الاطلاع ─────
const cirTargets = (c) => (c.audience?.length ? c.audience : db.teachers.map((t) => t.id)).filter((id) => teacher(id));
const cirProgress = (c) => { const T = cirTargets(c); return [T.filter((id) => c.acks?.[id]).length, T.length]; };
VIEWS.circulars = {
  actions: () => `<button class="btn primary" data-act="cirNew">＋ تعميم</button>`,
  render() {
    const q = normName(ui.cirQ || ''), list = db.circulars.filter((c) => !q || normName(`${c.number} ${c.subject} ${c.source}`).includes(q)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return `<div class="toolbar"><input class="input" id="cirSearch" placeholder="🔍 بحث بالرقم أو الموضوع أو الجهة" value="${esc(ui.cirQ || '')}" style="max-width:320px"><span class="spacer" style="flex:1"></span><span class="muted">${list.length} تعميم</span></div>
    ${list.length ? `<div class="grid g2">${list.map((c) => { const [a, n] = cirProgress(c), pct = n ? Math.round((a / n) * 100) : 0, late = c.due && c.due < todayISO() && a < n; return `<div class="card cir-card">
      <div style="display:flex;gap:8px;align-items:flex-start"><div class="grow"><div class="t" style="font-weight:700">${esc(c.subject)}</div><div class="muted" style="font-size:13px">${c.number ? 'رقم ' + esc(c.number) + ' · ' : ''}${esc(c.source || '')} · ${fmtH(c.date)}</div></div>${c.file ? `<button class="icon-btn" data-act="cirFile" data-id="${c.id}" title="فتح المرفق">📎</button>` : ''}</div>
      ${c.summary ? `<div style="margin:8px 0;font-size:14px">${esc(c.summary)}</div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:8px"><span>اطّلعت <b>${a}</b> من ${n}</span>${late ? '<span class="chip red">تجاوز موعد الاطلاع</span>' : a === n && n ? '<span class="chip green">اطّلع الجميع ✓</span>' : c.due ? `<span class="muted">الموعد: ${fmtH(c.due)}</span>` : ''}</div>
      <div class="progress"><div style="width:${pct}%;background:${a === n ? 'var(--green)' : 'var(--brand)'}"></div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><button class="btn sm primary" data-act="cirAcks" data-id="${c.id}">✍️ الاطلاع</button><button class="btn sm" data-act="cirPrint" data-id="${c.id}">🖨 كشف التوقيع</button><button class="btn sm" data-act="cirEdit" data-id="${c.id}">✏️</button><button class="icon-btn" data-act="cirDel" data-id="${c.id}">🗑️</button></div></div>`; }).join('')}</div>`
      : `<div class="card">${emptyState('📜', 'سجّلي التعاميم الواردة ومرفقاتها، وتابعي اطلاع المعلمات عليها، واطبعي كشف التوقيع بضغطة.')}</div>`}`;
  },
};
function openCircular(c) {
  formModal({ title: c ? 'تعديل التعميم' : '📜 تعميم جديد', wide: true, fields: [
    { key: 'subject', label: 'الموضوع', type: 'text', full: true, required: true, voice: true },
    { key: 'number', label: 'رقم التعميم', type: 'text' }, { key: 'date', label: 'التاريخ', type: 'date' },
    { key: 'source', label: 'الجهة المصدرة', type: 'text', list: [...new Set(db.circulars.map((x) => x.source).filter(Boolean)), 'وزارة التعليم', 'إدارة التعليم', 'مكتب التعليم'] },
    { key: 'due', label: 'آخر موعد للاطلاع (اختياري)', type: 'date' },
    { key: 'summary', label: 'ملخص التعميم', type: 'textarea', full: true, rows: 3, voice: true },
    { key: 'file', label: 'المرفق (PDF أو صورة)', type: 'file' }],
    values: c || { date: todayISO(), source: 'إدارة التعليم' },
    onSave: (v) => { if (c) Object.assign(c, v); else db.circulars.push({ id: uid(), acks: {}, audience: [], ...v }); commit(); toast('حُفظ التعميم', 'ok'); } });
}
function cirAcksModal(c) {
  const T = cirTargets(c), [a, n] = cirProgress(c);
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal wide"><div class="modal-h"><h2>✍️ الاطلاع — ${esc(c.subject)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b"><div class="toolbar"><span class="chip ${a === n ? 'green' : 'brand'}">اطّلعت ${a} من ${n}</span><span class="spacer" style="flex:1"></span><button class="btn sm" data-act="cirAll" data-id="${c.id}">✓ الكل</button></div>
      <div class="cir-acks">${T.map((id) => `<label class="cir-ack ${c.acks?.[id] ? 'on' : ''}"><input type="checkbox" data-change="cirAck" data-c="${c.id}" data-id="${id}" ${c.acks?.[id] ? 'checked' : ''}><span class="grow">${esc(tName(id))}</span><span class="muted" style="font-size:12px">${c.acks?.[id] ? fmtH(c.acks[id]) : ''}</span></label>`).join('')}</div></div>
    <div class="modal-f"><button class="btn primary" data-act="cirRemind" data-id="${c.id}">📧 تذكير من لم تطّلع</button><button class="btn" data-act="cirRemindSms" data-id="${c.id}">📱 تذكير برسالة نصية</button><button class="btn" data-act="modalClose">إغلاق</button></div></div></div>`;
  modalCtx = { cir: c.id };
}
const cirById = (id) => db.circulars.find((x) => x.id === id);
Object.assign(ACTIONS, {
  cirNew: () => openCircular(null),
  cirEdit: (el) => openCircular(cirById(el.dataset.id)),
  cirDel: (el) => { const c = cirById(el.dataset.id); confirmBox(`حذف التعميم «${c.subject}»؟`, () => { if (c.file) api.libDelete(c.file); db.circulars = db.circulars.filter((x) => x !== c); commit(); }); },
  cirFile: async (el) => { const c = cirById(el.dataset.id); const e = await api.libOpen(c.file); if (e) toast('تعذّر فتح الملف: ' + e, 'err'); },
  cirAcks: (el) => cirAcksModal(cirById(el.dataset.id)),
  cirAll: (el) => { const c = cirById(el.dataset.id); c.acks = c.acks || {}; cirTargets(c).forEach((id) => (c.acks[id] = c.acks[id] || todayISO())); commit(false); cirAcksModal(c); },
  cirPrint: (el) => { const c = cirById(el.dataset.id); printDoc(`كشف الاطلاع على تعميم — ${c.subject}`, `<p><b>الموضوع:</b> ${esc(c.subject)}${c.number ? ` &nbsp; <b>رقم التعميم:</b> ${esc(c.number)}` : ''} &nbsp; <b>التاريخ:</b> ${fmtH(c.date)}${c.source ? ` &nbsp; <b>الجهة:</b> ${esc(c.source)}` : ''}</p>${c.summary ? `<p>${esc(c.summary)}</p>` : ''}
    <table><thead><tr><th style="width:40px">م</th><th>اسم المعلمة</th><th style="width:150px">تاريخ الاطلاع</th><th style="width:170px">التوقيع</th></tr></thead><tbody>${cirTargets(c).map((id, i) => `<tr><td>${i + 1}</td><td>${esc(tName(id))}</td><td>${c.acks?.[id] ? fmtH(c.acks[id]) : ''}</td><td></td></tr>`).join('')}</tbody></table>`); },
  cirRemind: (el) => { const c = cirById(el.dataset.id), to = cirTargets(c).filter((id) => !c.acks?.[id]).map((id) => teacher(id)?.email).filter(Boolean); if (!to.length) return toast('لا توجد معلمات لم يطّلعن ولهن بريد'); api.openUrl(`https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(to.join(','))}&su=${encodeURIComponent('للاطلاع: ' + c.subject)}&body=${encodeURIComponent(`الزميلات الفاضلات\nالسلام عليكم ورحمة الله وبركاته\n\nنأمل الاطلاع على التعميم: ${c.subject}${c.number ? ` (رقم ${c.number})` : ''}${c.summary ? `\n\n${c.summary}` : ''}\n\nوالتوقيع بالعلم لدى المساعدة الإدارية${c.due ? ` قبل ${fmtH(c.due)}` : ''}.\n\n${school()}`)}`); },
  cirRemindSms: (el) => { const c = cirById(el.dataset.id), ids = cirTargets(c).filter((id) => !c.acks?.[id]); smsCompose({ title: 'تذكير بالاطلاع على تعميم', recipients: ids.map((id) => ({ to: teacher(id)?.phone, name: tName(id), vars: { 'الاسم': tName(id), 'المدرسة': school() } })), template: `الأستاذة {الاسم}: نأمل الاطلاع على تعميم «${c.subject}» والتوقيع بالعلم. {المدرسة}` }); },
});
CHANGES.cirAck = (el) => { const c = cirById(el.dataset.c); c.acks = c.acks || {}; if (el.checked) c.acks[el.dataset.id] = todayISO(); else delete c.acks[el.dataset.id]; commit(false); cirAcksModal(c); };
document.addEventListener('input', (e) => { if (e.target.id !== 'cirSearch') return; clearTimeout(CS.ct); CS.ct = setTimeout(() => { ui.cirQ = e.target.value; const p = e.target.selectionStart; render(); const n = $('#cirSearch'); if (n) { n.focus(); n.setSelectionRange(p, p); } }, 250); });

// ───── 📝 محاضر الاجتماعات والقرارات ─────
const MT_KINDS = ['اجتماع المعلمات', 'مجلس المدرسة', 'لجنة التميز', 'لجنة التوجيه والإرشاد', 'لجنة الاختبارات', 'اجتماع أولياء الأمور', 'أخرى'];
const MT = { e: null };
const decState = (d) => { const t = db.tasks.find((x) => x.id === d.taskId); return t ? (t.status === 'done' ? 'done' : t.due && t.due < todayISO() ? 'late' : 'open') : 'open'; };
VIEWS.meetings = {
  actions: () => `<button class="btn primary" data-act="mtNew">＋ محضر اجتماع</button>`,
  render() {
    const list = db.meetings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const allDec = list.flatMap((m) => (m.decisions || []).map((d) => ({ m, d, st: decState(d) })));
    const open = allDec.filter((x) => x.st !== 'done');
    return `${allDec.length ? `<div class="grid g4" style="margin-bottom:14px"><div class="card stat"><span class="n">${list.length}</span><span class="l">محاضر</span></div><div class="card stat"><span class="n">${allDec.length}</span><span class="l">قرارات</span></div><div class="card stat"><span class="n" style="color:var(--green)">${allDec.length - open.length}</span><span class="l">نُفّذت</span></div><div class="card stat"><span class="n" style="color:var(--red)">${open.filter((x) => x.st === 'late').length}</span><span class="l">متأخرة</span></div></div>` : ''}
      ${list.length ? `<div class="list">${list.map((m) => { const D = m.decisions || [], dn = D.filter((d) => decState(d) === 'done').length; return `<div class="card li" style="margin-bottom:10px"><span style="font-size:24px">📝</span><div class="grow"><div class="t">${esc(m.title)}</div><div class="s">${esc(m.kind || '')} · ${dayName(m.date)} ${fmtH(m.date)} · الحاضرات ${(m.attendees || []).length}${D.length ? ` · القرارات: ${dn}/${D.length} منفّذة` : ''}</div></div>
        <button class="btn sm" data-act="mtPrint" data-id="${m.id}">🖨 المحضر</button><button class="btn sm" data-act="mtWord" data-id="${m.id}">⬇ Word</button><button class="btn sm primary" data-act="mtEdit" data-id="${m.id}">✏️ فتح</button><button class="icon-btn" data-act="mtDel" data-id="${m.id}">🗑️</button></div>`; }).join('')}</div>`
      : `<div class="card">${emptyState('📝', 'سجّلي محاضر الاجتماعات: الحاضرات، والبنود، والقرارات.<br>كل قرار يتحول إلى مهمة بمسؤولة وموعد، ويُتابَع تنفيذه تلقائياً.')}</div>`}
      ${open.length ? `<div class="card" style="margin-top:14px"><h3>📌 قرارات لم تُنفّذ بعد</h3><div class="list">${open.map(({ m, d, st }) => `<div class="li"><div class="grow"><div class="t">${esc(d.text)}</div><div class="s">${esc(m.title)}${d.owner ? ' · ' + esc(tName(d.owner) || d.owner) : ''}${d.due ? ' · ' + fmtH(d.due) : ''}</div></div><span class="chip ${st === 'late' ? 'red' : 'amber'}">${st === 'late' ? 'متأخر' : 'قيد التنفيذ'}</span>${d.taskId ? `<button class="btn sm" data-act="taskEdit" data-id="${d.taskId}">المهمة</button>` : ''}</div>`).join('')}</div></div>` : ''}`;
  },
};
function mtEditor() {
  const E = MT.e, T = sortedTeachers();
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal wide"><div class="modal-h"><h2>📝 ${E.id ? 'محضر اجتماع' : 'محضر جديد'}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b"><div class="form">
      <div class="field full"><label>عنوان الاجتماع <span style="color:var(--red)">*</span></label><input class="input" data-mt="title" value="${esc(E.title)}"></div>
      <div class="field"><label>النوع</label><select class="input" data-mt="kind">${MT_KINDS.map((k) => `<option ${E.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="field"><label>التاريخ</label><input type="date" class="input" data-mt="date" value="${E.date}"></div>
      <div class="field"><label>الوقت</label><input type="time" class="input" data-mt="time" value="${E.time || ''}"></div>
      <div class="field"><label>المكان</label><input class="input" data-mt="place" value="${esc(E.place || '')}"></div>
      <div class="field full"><label>الحاضرات (${E.attendees.length}) <button type="button" class="icon-btn" data-act="mtAllAtt">الكل</button></label><div class="st-chips" style="max-height:140px;overflow:auto">${T.map((t) => `<label class="st-chip ${E.attendees.includes(t.id) ? 'on' : ''}"><input type="checkbox" data-mtatt="${t.id}" ${E.attendees.includes(t.id) ? 'checked' : ''}>${esc(t.name)}</label>`).join('')}</div></div>
      <div class="field full"><label>بنود الاجتماع (بند في كل سطر)</label><textarea class="input" rows="4" data-mt="agenda">${esc(E.agenda || '')}</textarea></div>
      <div class="field full"><label>ملخص النقاش (اختياري)</label><textarea class="input" rows="3" data-mt="notes">${esc(E.notes || '')}</textarea></div>
    </div>
    <div class="section-title">✅ القرارات والتوصيات <span class="muted" style="font-weight:400;font-size:12.5px">— كل قرار له مسؤولة وموعد يتحول إلى مهمة</span></div>
    <div class="mt-decs">${E.decisions.map((d, i) => `<div class="mt-dec"><span class="muted">${i + 1}</span><input class="input" data-mtd="${i}" data-k="text" value="${esc(d.text)}" placeholder="نص القرار">
      <select class="input" data-mtd="${i}" data-k="owner"><option value="">المسؤولة</option>${T.map((t) => `<option value="${t.id}" ${d.owner === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      <input type="date" class="input" data-mtd="${i}" data-k="due" value="${d.due || ''}"><button type="button" class="icon-btn" data-act="mtDecDel" data-id="${i}">🗑️</button></div>`).join('')}</div>
    <button type="button" class="btn sm" data-act="mtDecAdd" style="margin-top:8px">＋ قرار</button></div>
    <div class="modal-f"><button class="btn primary" data-act="mtSave">حفظ المحضر</button><button class="btn" data-act="modalClose">إلغاء</button></div></div></div>`;
  modalCtx = { mt: true };
}
function mtHtml(m) {
  const absent = sortedTeachers().filter((t) => !(m.attendees || []).includes(t.id));
  return `${letterhead()}<h1 style="text-align:center">محضر ${esc(m.kind || 'اجتماع')}</h1><h2 style="text-align:center">${esc(m.title)}</h2>
    <table><tbody><tr><td><b>اليوم والتاريخ</b></td><td>${dayName(m.date)} ${fmtH(m.date)} (${fmtG(m.date)})</td><td><b>الوقت</b></td><td>${esc(m.time || '')}</td></tr><tr><td><b>المكان</b></td><td>${esc(m.place || '')}</td><td><b>عدد الحاضرات</b></td><td>${(m.attendees || []).length}</td></tr></tbody></table>
    ${prLines(m.agenda).length ? `<h3>بنود الاجتماع</h3><ol>${prLines(m.agenda).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    ${m.notes ? `<h3>ملخص النقاش</h3><p>${esc(m.notes)}</p>` : ''}
    ${(m.decisions || []).length ? `<h3>القرارات والتوصيات</h3><table><tbody><tr><td style="width:40px"><b>م</b></td><td><b>القرار</b></td><td><b>المسؤولة</b></td><td><b>موعد التنفيذ</b></td></tr>${m.decisions.map((d, i) => `<tr><td>${i + 1}</td><td>${esc(d.text)}</td><td>${d.owner ? esc(tName(d.owner)) : ''}</td><td>${d.due ? fmtH(d.due) : ''}</td></tr>`).join('')}</tbody></table>` : ''}
    <h3>الحاضرات</h3><table><tbody><tr><td style="width:40px"><b>م</b></td><td><b>الاسم</b></td><td style="width:170px"><b>التوقيع</b></td></tr>${(m.attendees || []).map((id, i) => `<tr><td>${i + 1}</td><td>${esc(tName(id))}</td><td></td></tr>`).join('')}</tbody></table>
    ${absent.length ? `<p><b>المعتذرات/الغائبات:</b> ${absent.map((t) => esc(t.name)).join('، ')}</p>` : ''}
    <p><br></p><table class="noborder" style="width:100%"><tbody><tr><td style="width:50%;text-align:center"><b>مقررة الاجتماع</b><br>${esc(db.settings.employeeName || '')}<br>..........................</td><td style="width:50%;text-align:center"><b>قائدة المدرسة</b><br><br>..........................</td></tr></tbody></table>`;
}
const mtById = (id) => db.meetings.find((x) => x.id === id);
Object.assign(ACTIONS, {
  mtNew: () => { MT.e = { title: '', kind: MT_KINDS[0], date: todayISO(), time: '', place: '', attendees: [], agenda: '', notes: '', decisions: [] }; mtEditor(); },
  mtEdit: (el) => { MT.e = JSON.parse(JSON.stringify(mtById(el.dataset.id))); MT.e.decisions = MT.e.decisions || []; MT.e.attendees = MT.e.attendees || []; mtEditor(); },
  mtAllAtt: () => { MT.e.attendees = db.teachers.map((t) => t.id); mtEditor(); },
  mtDecAdd: () => { MT.e.decisions.push({ id: uid(), text: '', owner: '', due: '' }); mtEditor(); setTimeout(() => $$('.mt-dec input[data-k=text]').pop()?.focus(), 30); },
  mtDecDel: (el) => { MT.e.decisions.splice(+el.dataset.id, 1); mtEditor(); },
  mtSave: () => {
    const E = MT.e; E.title = E.title.trim(); if (!E.title) return toast('اكتبي عنوان الاجتماع', 'err');
    E.decisions = E.decisions.filter((d) => d.text.trim());
    let m = E.id && mtById(E.id);
    // كل قرار بموعد أو مسؤولة يتحول إلى مهمة، وتُحدَّث المهمة عند تعديل القرار
    E.decisions.forEach((d) => {
      if (!d.due && !d.owner) return;
      const title = `قرار: ${d.text}`, notes = `من محضر «${E.title}» — ${fmtH(E.date)}${d.owner ? ' · المسؤولة: ' + tName(d.owner) : ''}`;
      const t = db.tasks.find((x) => x.id === d.taskId);
      if (t) Object.assign(t, { title, due: d.due || t.due, notes });
      else { const nt = { id: uid(), createdAt: todayISO(), title, due: d.due || addDays(E.date, 7), priority: 'med', status: 'todo', category: 'قرارات الاجتماعات', notes }; db.tasks.push(nt); d.taskId = nt.id; }
    });
    if (m) Object.assign(m, E); else { m = { ...E, id: uid() }; db.meetings.push(m); }
    closeModal(); commit(); toast(`حُفظ المحضر${E.decisions.some((d) => d.taskId) ? ' وتحولت القرارات إلى مهام' : ''}`, 'ok');
  },
  mtDel: (el) => { const m = mtById(el.dataset.id); confirmBox(`حذف محضر «${m.title}»؟ (تبقى المهام الناتجة عنه)`, () => { db.meetings = db.meetings.filter((x) => x !== m); commit(); }); },
  mtPrint: (el) => { $('#print').innerHTML = `<div class="doc-print">${mtHtml(mtById(el.dataset.id))}</div>`; setTimeout(() => window.print(), 50); },
  mtWord: async (el) => { const m = mtById(el.dataset.id), box = document.createElement('div'); box.innerHTML = mtHtml(m); try { openBlob(await htmlToDocx(box), `محضر — ${stSafeName(m.title)}.docx`, true); toast('حُفظ ملف Word في «التنزيلات»', 'ok'); } catch (e) { toast('تعذّر التصدير: ' + e.message, 'err'); } },
});
document.addEventListener('input', (e) => {
  const el = e.target; if (!MT.e || !modalCtx?.mt) return;
  if (el.dataset.mt) MT.e[el.dataset.mt] = el.value;
  if (el.dataset.mtd != null) MT.e.decisions[+el.dataset.mtd][el.dataset.k] = el.value;
});
document.addEventListener('change', (e) => {
  const el = e.target; if (!MT.e || !modalCtx?.mt) return;
  if (el.dataset.mt) MT.e[el.dataset.mt] = el.value;
  if (el.dataset.mtd != null) MT.e.decisions[+el.dataset.mtd][el.dataset.k] = el.value;
  if (el.dataset.mtatt) { const A = MT.e.attendees, id = el.dataset.mtatt; if (el.checked && !A.includes(id)) A.push(id); if (!el.checked) A.splice(A.indexOf(id), 1); el.parentElement.classList.toggle('on', el.checked); }
});

// ───── 🚶 سجل الزوار ─────
const VS_KINDS = ['ولي أمر', 'جهة رسمية', 'مشرفة تربوية', 'زائرة', 'مورّد / صيانة', 'أخرى'];
VIEWS.visitors = {
  actions: () => `<button class="btn" data-act="vsXlsx">⬇ Excel</button><button class="btn" data-act="vsPrint">🖨 سجل اليوم</button><button class="btn primary" data-act="vsNew">＋ زائر</button>`,
  render() {
    const d = ui.vsDate || todayISO(), list = db.visitors.filter((v) => v.date === d).sort((a, b) => (b.timeIn || '').localeCompare(a.timeIn || ''));
    const inside = list.filter((v) => !v.timeOut).length;
    return `<div class="toolbar"><label class="muted">اليوم</label><input type="date" class="input" value="${d}" data-change="vsDate" style="width:auto"><span class="spacer" style="flex:1"></span><span class="chip brand">زوار اليوم: ${list.length}</span>${inside ? `<span class="chip amber">داخل المدرسة الآن: ${inside}</span>` : ''}</div>
      ${list.length ? `<div class="card" style="padding:0;overflow:auto"><table class="table"><thead><tr><th>الدخول</th><th>الخروج</th><th>الاسم</th><th>الصفة</th><th>الغرض</th><th>المقابَلة</th><th></th></tr></thead><tbody>
        ${list.map((v) => `<tr><td dir="ltr" style="text-align:right">${esc(v.timeIn || '')}</td><td>${v.timeOut ? `<span dir="ltr">${esc(v.timeOut)}</span>` : `<button class="btn sm" data-act="vsOut" data-id="${v.id}">🚪 خروج الآن</button>`}</td><td><b>${esc(v.name)}</b>${v.phone ? `<div class="muted" dir="ltr" style="font-size:12px;text-align:right">${esc(v.phone)}</div>` : ''}</td><td>${esc(v.kind || '')}${v.studentId && student(v.studentId) ? `<div class="muted" style="font-size:12px">ولي أمر: ${esc(student(v.studentId).name)}</div>` : ''}</td><td>${esc(v.purpose || '')}</td><td>${esc(v.meet || '')}</td>
          <td class="actions"><button class="icon-btn" data-act="vsEdit" data-id="${v.id}">✏️</button><button class="icon-btn" data-act="vsDel" data-id="${v.id}">🗑️</button></td></tr>`).join('')}</tbody></table></div>`
      : `<div class="card">${emptyState('🚶', 'سجّلي زوار المدرسة: أولياء الأمور والجهات الرسمية وغيرهم، بوقت الدخول والخروج والغرض.')}</div>`}`;
  },
};
function openVisitor(v) {
  formModal({ title: v ? 'تعديل بيانات الزائر' : '🚶 تسجيل زائر', wide: true, fields: [
    { key: 'name', label: 'اسم الزائر', type: 'text', required: true, voice: true }, { key: 'kind', label: 'الصفة', type: 'select', options: VS_KINDS },
    { key: 'phone', label: 'الجوال', type: 'tel' }, { key: 'idNo', label: 'رقم الهوية (اختياري)', type: 'text' },
    ...((db.students || []).length ? [{ key: 'studentId', label: 'الطالبة (لولي الأمر)', type: 'select', options: [['', '—'], ...db.students.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((s) => [s.id, `${s.name} — ${sClass(s)}`])] }] : []),
    { key: 'purpose', label: 'الغرض من الزيارة', type: 'text', full: true, list: ['متابعة مستوى الطالبة', 'استلام طالبة', 'مراجعة إدارية', 'زيارة إشرافية', 'صيانة'] },
    { key: 'meet', label: 'المقابَلة', type: 'text', list: ['قائدة المدرسة', 'الوكيلة', 'الموجهة الطلابية', ...db.teachers.map((t) => t.name)] },
    { key: 'date', label: 'التاريخ', type: 'date' }, { key: 'timeIn', label: 'وقت الدخول', type: 'time' }, { key: 'timeOut', label: 'وقت الخروج', type: 'time' },
    { key: 'notes', label: 'ملاحظات', type: 'textarea', full: true, rows: 2 }],
    values: v || { date: ui.vsDate || todayISO(), timeIn: new Date().toTimeString().slice(0, 5), kind: 'ولي أمر' },
    onSave: (x) => { if (v) Object.assign(v, x); else db.visitors.push({ id: uid(), ...x }); commit(); toast('سُجّل الزائر', 'ok'); } });
}
const vsById = (id) => db.visitors.find((x) => x.id === id);
Object.assign(ACTIONS, {
  vsNew: () => openVisitor(null),
  vsEdit: (el) => openVisitor(vsById(el.dataset.id)),
  vsDel: (el) => confirmBox('حذف هذا الزائر من السجل؟', () => { db.visitors = db.visitors.filter((x) => x.id !== el.dataset.id); commit(); }),
  vsOut: (el) => { vsById(el.dataset.id).timeOut = new Date().toTimeString().slice(0, 5); commit(); },
  vsPrint: () => { const d = ui.vsDate || todayISO(), L = db.visitors.filter((v) => v.date === d).sort((a, b) => (a.timeIn || '').localeCompare(b.timeIn || '')); printDoc(`سجل الزوار — ${dayName(d)} ${fmtH(d)}`, `<table><thead><tr><th>م</th><th>الاسم</th><th>الصفة</th><th>الجوال</th><th>الغرض</th><th>المقابَلة</th><th>الدخول</th><th>الخروج</th></tr></thead><tbody>${L.map((v, i) => `<tr><td>${i + 1}</td><td>${esc(v.name)}</td><td>${esc(v.kind || '')}</td><td dir="ltr">${esc(v.phone || '')}</td><td>${esc(v.purpose || '')}</td><td>${esc(v.meet || '')}</td><td>${esc(v.timeIn || '')}</td><td>${esc(v.timeOut || '')}</td></tr>`).join('')}</tbody></table>`); },
  vsXlsx: async () => { const rows = [['التاريخ', 'الاسم', 'الصفة', 'الجوال', 'الغرض', 'المقابَلة', 'الدخول', 'الخروج', 'ملاحظات'], ...db.visitors.slice().sort((a, b) => (a.date + a.timeIn).localeCompare(b.date + b.timeIn)).map((v) => [`${v.date} (${fmtH(v.date)})`, v.name, v.kind || '', v.phone || '', v.purpose || '', v.meet || '', v.timeIn || '', v.timeOut || '', v.notes || ''])]; openBlob(await buildXlsx(rows, [22, 24, 14, 14, 28, 18, 9, 9, 28], 'الزوار'), 'سجل-الزوار.xlsx', true); toast('حُفظ ملف Excel في «التنزيلات»', 'ok'); },
});
CHANGES.vsDate = (el) => { if (el.value) { ui.vsDate = el.value; render(); } };
