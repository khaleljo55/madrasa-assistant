// ═════════════ 🔄 حصص الانتظار + 📰 نشرة اليوم (1.0.8) ═════════════
// من جدول الحصص والغياب: حصص الغائبات، واقتراح بديلة متفرغة بعدل، وورقة الانتظار، ونشرة الصباح.

(function addNavSubs() {
  const g = NAV_TREE.find((x) => x.group === 'teachers');
  const i = g.items.findIndex((x) => x.id === 'absence');
  g.items.splice(i >= 0 ? i + 1 : g.items.length, 0, { id: 'subs', ic: '🔄', label: 'حصص الانتظار', badge: () => subsPending(todayISO()) });
  NAV.length = 0; NAV.push(...NAV_TREE.flatMap((n) => (n.items ? n.items : [n])));
})();
addHook('beforeStart', () => { if (!Array.isArray(db.substitutions)) db.substitutions = []; });

const wd = (d) => parse(d).getDay();
// حصص الغائبات في يوم معيّن من جدول الحصص
function subsNeeded(d) {
  const abs = dutyAbsent(d), day = wd(d);
  return db.timetable.filter((x) => x.day === day && abs.has(x.teacherId)).sort((a, b) => a.period - b.period || tName(a.teacherId).localeCompare(tName(b.teacherId), 'ar'));
}
const subKey = (x) => `${x.period}|${x.className}|${x.teacherId}`;
const subOf = (d, x) => db.substitutions.find((s) => s.date === d && s.key === subKey(x));
const subsPending = (d) => { if (!db?.timetable?.length) return 0; return subsNeeded(d).filter((x) => !subOf(d, x)?.subId).length; };
// عبء الانتظار هذا الشهر لكل معلمة
function subLoad(d) { const m = d.slice(0, 7), L = {}; db.substitutions.filter((s) => s.subId && s.date.startsWith(m)).forEach((s) => (L[s.subId] = (L[s.subId] || 0) + 1)); return L; }
// المعلمات المتاحات لحصة: لا حصة لها في الوقت نفسه، وغير غائبة، وغير مكلّفة بانتظار آخر في الحصة نفسها
function subCandidates(d, x) {
  const day = wd(d), abs = dutyAbsent(d), L = subLoad(d);
  const busy = new Set(db.timetable.filter((t) => t.day === day && t.period === x.period).map((t) => t.teacherId));
  db.substitutions.filter((s) => s.date === d && s.period === x.period && s.key !== subKey(x) && s.subId).forEach((s) => busy.add(s.subId));
  const dayLoad = (id) => db.timetable.filter((t) => t.day === day && t.teacherId === id).length + db.substitutions.filter((s) => s.date === d && s.subId === id && s.key !== subKey(x)).length;
  return sortedTeachers().filter((t) => !abs.has(t.id) && !busy.has(t.id)).map((t) => ({ t, month: L[t.id] || 0, day: dayLoad(t.id) }))
    .sort((a, b) => a.month - b.month || a.day - b.day || a.t.name.localeCompare(b.t.name, 'ar'));
}
function subSet(d, x, subId) {
  let s = subOf(d, x);
  if (!s) { s = { id: uid(), date: d, key: subKey(x), period: x.period, className: x.className, subject: x.subject || '', absentId: x.teacherId, subId: '' }; db.substitutions.push(s); }
  s.subId = subId || '';
}

VIEWS.subs = {
  actions: () => `<button class="btn" data-act="subsMail">📧 إبلاغ البديلات</button><button class="btn" data-act="subsPrint">🖨 ورقة الانتظار</button><button class="btn primary" data-act="subsAuto">✨ توزيع تلقائي</button>`,
  render() {
    const d = ui.subsDate || todayISO();
    if (!db.timetable.length) return `<div class="card">${emptyState('🔄', 'حصص الانتظار تعتمد على «جدول الحصص».<br>أدخلي الجدول أولاً (أو استورديه من Excel)، ثم يُحسب الانتظار تلقائياً عند تسجيل غياب أي معلمة.')}<div style="text-align:center;margin-top:12px"><button class="btn primary" data-act="nav" data-id="timetable">🗓️ فتح جدول الحصص</button></div></div>`;
    const need = subsNeeded(d), abs = [...dutyAbsent(d)], L = subLoad(d);
    const done = need.filter((x) => subOf(d, x)?.subId).length;
    const top = Object.entries(L).sort((a, b) => b[1] - a[1]);
    return `<div class="toolbar"><label class="muted">اليوم</label><input type="date" class="input" value="${d}" data-change="subsDate" style="width:auto"><span class="muted">${dayName(d)}</span>
        <span class="spacer" style="flex:1"></span>${need.length ? `<span class="chip ${done === need.length ? 'green' : 'amber'}">وُزّع ${done} من ${need.length}</span>` : ''}<button class="btn sm" data-act="nav" data-id="absence">＋ تسجيل غياب معلمة</button></div>
      ${wd(d) > 4 || (typeof acadOff === 'function' && acadOff(d)) ? `<div class="card">${emptyState('🌴', wd(d) > 4 ? 'هذا اليوم عطلة نهاية الأسبوع' : `هذا اليوم ضمن ${esc(acadHoliday(d).name)}`)}</div>` : !abs.length ? `<div class="card">${emptyState('✅', 'لا توجد معلمات غائبات في هذا اليوم.<br>عند تسجيل غياب معلمة في «سجل الغياب» تظهر حصصها هنا تلقائياً.')}</div>`
      : !need.length ? `<div class="card">${emptyState('📭', `الغائبات: ${abs.map((id) => esc(tName(id))).join('، ')}<br>ليس لهن حصص في جدول ${dayName(d)}.`)}</div>`
      : `<div class="card" style="padding:0;overflow:auto"><table class="table"><thead><tr><th>الحصة</th><th>الفصل</th><th>المادة</th><th>المعلمة الغائبة</th><th>البديلة (المتفرغات الأقل انتظاراً أولاً)</th></tr></thead><tbody>
        ${need.map((x) => { const s = subOf(d, x), c = subCandidates(d, x); return `<tr class="${s?.subId ? '' : 'sub-open'}"><td><b>${x.period}</b></td><td>${esc(x.className)}</td><td>${esc(x.subject || '')}</td><td>${esc(tName(x.teacherId))}</td>
          <td><select class="input" data-change="subPick" data-k="${esc(subKey(x))}"><option value="">— اختاري بديلة —</option>${s?.subId && !c.some((o) => o.t.id === s.subId) ? `<option value="${s.subId}" selected>${esc(tName(s.subId))}</option>` : ''}${c.map((o) => `<option value="${o.t.id}" ${s?.subId === o.t.id ? 'selected' : ''}>${esc(o.t.name)} — انتظار الشهر: ${o.month} · حصصها اليوم: ${o.day}</option>`).join('')}</select>${!c.length ? '<div class="muted" style="font-size:12px">لا توجد معلمة متفرغة في هذه الحصة</div>' : ''}</td></tr>`; }).join('')}
      </tbody></table></div>`}
      <div class="card" style="margin-top:16px"><h3>⚖️ عدالة توزيع الانتظار — ${MONTHS[+d.slice(5, 7) - 1]}</h3>${top.length ? `<div class="duty-load">${sortedTeachers().map((t) => `<span class="chip ${L[t.id] ? '' : 'green'}">${esc(t.name)}: ${L[t.id] || 0}</span>`).join('')}</div>` : '<div class="muted">لم تُوزَّع حصص انتظار هذا الشهر بعد.</div>'}</div>`;
  },
};
Object.assign(CHANGES, {
  subsDate: (el) => { if (el.value) { ui.subsDate = el.value; render(); } },
  subPick: (el) => { const d = ui.subsDate || todayISO(); const x = subsNeeded(d).find((y) => subKey(y) === el.dataset.k); if (x) { subSet(d, x, el.value); commit(); } },
});
function subsText(d) {
  return subsNeeded(d).map((x) => { const s = subOf(d, x); return `الحصة ${x.period} — ${x.className}${x.subject ? ' (' + x.subject + ')' : ''}: بدلاً من ${tName(x.teacherId)} ← ${s?.subId ? tName(s.subId) : 'لم تُحدَّد'}`; }).join('\n');
}
function subsTable(d) {
  const need = subsNeeded(d);
  return need.length ? `<table><tbody><tr><td><b>الحصة</b></td><td><b>الفصل</b></td><td><b>المادة</b></td><td><b>الغائبة</b></td><td><b>البديلة</b></td><td><b>التوقيع</b></td></tr>${need.map((x) => { const s = subOf(d, x); return `<tr><td>${x.period}</td><td>${esc(x.className)}</td><td>${esc(x.subject || '')}</td><td>${esc(tName(x.teacherId))}</td><td><b>${s?.subId ? esc(tName(s.subId)) : '—'}</b></td><td></td></tr>`; }).join('')}</tbody></table>` : '<p>لا توجد حصص انتظار.</p>';
}
Object.assign(ACTIONS, {
  subsAuto: () => {
    const d = ui.subsDate || todayISO(); let n = 0, miss = 0;
    subsNeeded(d).forEach((x) => { if (subOf(d, x)?.subId) return; const c = subCandidates(d, x); if (c[0]) { subSet(d, x, c[0].t.id); n++; } else miss++; });
    commit(); toast(n ? `وُزّعت ${n} حصة بعدل${miss ? ` — ${miss} بلا معلمة متفرغة` : ''}` : miss ? 'لا توجد معلمات متفرغات للحصص المتبقية' : 'كل الحصص موزعة', n ? 'ok' : '');
  },
  subsPrint: () => { const d = ui.subsDate || todayISO(); printDoc(`حصص الانتظار — ${dayName(d)} ${fmtH(d)}`, `<p>${dayName(d)} ${fmtH(d)} الموافق ${fmtG(d)}</p>${subsTable(d)}`); },
  subsMail: () => {
    const d = ui.subsDate || todayISO(), ids = [...new Set(subsNeeded(d).map((x) => subOf(d, x)?.subId).filter(Boolean))];
    const to = ids.map((id) => teacher(id)?.email).filter(Boolean);
    if (!to.length) return toast('لا توجد بديلات لهن بريد في هذا اليوم');
    api.openUrl(`https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(to.join(','))}&su=${encodeURIComponent(`حصص الانتظار — ${dayName(d)} ${fmtH(d)}`)}&body=${encodeURIComponent(`الزميلات الفاضلات\nالسلام عليكم ورحمة الله وبركاته\n\nنأمل التكرم بتغطية حصص الانتظار التالية يوم ${dayName(d)} ${fmtH(d)}:\n\n${subsText(d)}\n\nشاكرين تعاونكن،\n${db.settings.employeeName || ''}`)}`);
    toast(`فُتحت الرسالة لـ${to.length} بديلة في Gmail`, 'ok');
  },
});

// ───── 📰 نشرة اليوم ─────
function bulletin(d) {
  const day = wd(d), abs = db.absences.filter((a) => inRange(d, a.date, a.dateTo)), duties = [];
  (db.duties?.types || []).forEach((ty) => { const ids = db.duties.roster?.[day]?.[ty.id] || []; if (ids.length) duties.push([ty.name, ids]); });
  const absSet = dutyAbsent(d), occ = db.occasions.map((o) => ({ o, d: occNextDate(o, d) })).filter((x) => diffDays(d, x.d) >= 0 && diffDays(d, x.d) <= 3).sort((a, b) => a.d.localeCompare(b.d));
  const tasks = db.tasks.filter((x) => x.status !== 'done' && x.due && x.due <= d).sort((a, b) => a.due.localeCompare(b.due));
  const radio = typeof radioOn === 'function' ? radioOn(d) : null;
  const visits = db.visits.filter((v) => v.date === d);
  let h = `${letterhead()}<h1 style="text-align:center">نشرة اليوم</h1><p style="text-align:center">${dayName(d)} ${fmtH(d)} — ${fmtG(d)}</p>`;
  h += `<h2>👩‍🏫 الغياب</h2>${abs.length ? `<ul>${abs.map((a) => `<li><b>${esc(tName(a.teacherId))}</b> — ${esc(a.type)}${a.dateTo && a.dateTo !== a.date ? ` (حتى ${fmtH(a.dateTo)})` : ''}</li>`).join('')}</ul>` : '<p>لا يوجد غياب مسجّل.</p>'}`;
  if (db.timetable.length && subsNeeded(d).length) h += `<h2>🔄 حصص الانتظار</h2>${subsTable(d)}`;
  if (duties.length) h += `<h2>🧭 الإشراف والمناوبة</h2><table><tbody>${duties.map(([n, ids]) => `<tr><td style="width:30%"><b>${esc(n)}</b></td><td>${ids.map((id) => esc(tName(id)) + (absSet.has(id) ? ' <b>(غائبة — تحتاج بديلة)</b>' : '')).join('، ')}</td></tr>`).join('')}</tbody></table>`;
  if (radio) h += `<h2>🎙️ الإذاعة المدرسية</h2><p>${esc(radio.className || '')}${radio.teacherId ? ' — بإشراف ' + esc(tName(radio.teacherId)) : ''}${radio.topic ? ` · الموضوع: <b>${esc(radio.topic)}</b>` : ''}</p>`;
  if (occ.length) h += `<h2>🎉 المناسبات</h2><ul>${occ.map(({ o, d: x }) => `<li>${esc(o.name)} — ${x === d ? '<b>اليوم</b>' : dayName(x) + ' ' + fmtH(x)}${o.initiative ? ' · ' + esc(o.initiative) : ''}</li>`).join('')}</ul>`;
  if (visits.length) h += `<h2>🤝 الزيارات</h2><ul>${visits.map((v) => `<li>${esc(v.team || 'زيارة')}${v.time ? ' — ' + esc(v.time) : ''}${v.escort ? ' · المرافقة: ' + esc(v.escort) : ''}</li>`).join('')}</ul>`;
  if (tasks.length) h += `<h2>📌 مهام مستحقة</h2><ol>${tasks.slice(0, 12).map((x) => `<li>${esc(x.title)}${x.due < d ? ' <b>(متأخرة)</b>' : ''}</li>`).join('')}</ol>`;
  return { title: `نشرة اليوم — ${dayName(d)} ${fmtH(d)}`, html: h };
}
function bulletinText(d) { const box = document.createElement('div'); box.innerHTML = bulletin(d).html.replace(/<\/(h1|h2|p|li|tr)>/g, '$&\n'); box.querySelector('table.noborder')?.remove(); return box.innerText.replace(/\n{3,}/g, '\n\n').trim(); }
function bulletinModal(d) {
  const b = bulletin(d);
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal wide"><div class="modal-h"><h2>📰 ${esc(b.title)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b"><div class="doc-page bulletin" id="bulPage">${b.html}</div></div>
    <div class="modal-f"><button class="btn primary" data-act="bulPrint">🖨 طباعة / PDF</button><button class="btn" data-act="bulMail">📧 إرسال للمعلمات</button><button class="btn" data-act="bulCopy">📋 نسخ النص</button><button class="btn" data-act="bulEdit">📝 تعديل في المحرر</button><button class="btn" data-act="modalClose">إغلاق</button></div></div></div>`;
  modalCtx = { bulletin: d };
}
Object.assign(ACTIONS, {
  bulOpen: () => bulletinModal(todayISO()),
  bulPrint: () => { const d = modalCtx.bulletin; const h = $('#bulPage').innerHTML; closeModal(); $('#print').innerHTML = `<div class="doc-print">${h}</div>`; setTimeout(() => window.print(), 50); void d; },
  bulCopy: async () => { try { await navigator.clipboard.writeText(bulletinText(modalCtx.bulletin)); toast('نُسخت النشرة', 'ok'); } catch { toast('تعذّر النسخ', 'err'); } },
  bulMail: () => { const d = modalCtx.bulletin, to = db.teachers.map((t) => t.email).filter(Boolean); if (!to.length) return toast('لا توجد معلمات لهن بريد'); api.openUrl(`https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(to.join(','))}&su=${encodeURIComponent(bulletin(d).title)}&body=${encodeURIComponent(bulletinText(d))}`); toast('فُتحت النشرة في Gmail', 'ok'); },
  bulEdit: () => { const b = bulletin(modalCtx.bulletin); closeModal(); db.documents = db.documents || []; const doc = { id: uid(), title: b.title, html: b.html, updatedAt: todayISO() }; db.documents.push(doc); DOCS.id = doc.id; go('letters'); commit(false); },
});
addHook('dashCards', (t) => {
  if (wd(t) > 4 || (typeof acadOff === 'function' && acadOff(t))) return '';
  const p = subsPending(t), need = db.timetable.length ? subsNeeded(t).length : 0;
  return `<div class="card"><h3>📰 صباح اليوم</h3><div class="muted" style="margin-bottom:10px">نشرة اليوم جاهزة: الغياب، والانتظار، والإشراف، والإذاعة، والمناسبات، والمهام.</div>
    ${need ? `<div style="margin-bottom:10px"><span class="chip ${p ? 'amber' : 'green'}">🔄 حصص الانتظار: ${p ? `${p} بلا بديلة` : 'موزعة كلها ✓'}</span></div>` : ''}
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm primary" data-act="bulOpen">📰 نشرة اليوم</button>${need ? '<button class="btn sm" data-act="nav" data-id="subs">🔄 الانتظار</button>' : ''}</div></div>`;
});
