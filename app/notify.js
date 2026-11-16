// ═════════════ 🔔 تنبيهات ويندوز + 📊 التقرير الأسبوعي (1.0.7) ═════════════

// ───── التقرير الأسبوعي (الأحد إلى الخميس) ─────
const weekStart = (d) => addDays(d, -parse(d).getDay());
function buildWeekly(ws) {
  const we = addDays(ws, 4), nx = addDays(ws, 7), nxe = addDays(ws, 11), t = todayISO();
  const title = `التقرير الأسبوعي — ${fmtH(ws)}`;
  const isShort = (a) => /تأخر|خروج/.test(a.type);
  const abs = db.absences.filter((a) => a.date <= we && (a.dateTo || a.date) >= ws);
  const absDays = abs.filter((a) => !isShort(a)).reduce((s, a) => s + clipDays(a, ws, we), 0);
  const sl = (db.studentLog || []).filter((e) => e.date >= ws && e.date <= we);
  const done = db.tasks.filter((x) => x.status === 'done' && x.doneAt && x.doneAt >= ws && x.doneAt <= addDays(ws, 6));
  const late = db.tasks.filter((x) => x.status !== 'done' && x.due && x.due < t);
  const open = db.tasks.filter((x) => x.status !== 'done' && x.due >= ws && x.due <= addDays(ws, 6) && !(x.due < t));
  const corr = (db.correspondence || []).filter((c) => c.date >= ws && c.date <= we);
  const corrLateL = (db.correspondence || []).filter((c) => c.status !== 'done' && c.due && c.due < t);
  const vis = db.visits.filter((v) => v.date >= ws && v.date <= we);
  const occNext = db.occasions.map((o) => ({ o, d: occNextDate(o, ws) })).filter((x) => x.d >= ws && x.d <= nxe).sort((a, b) => a.d.localeCompare(b.d));
  const tasksNext = db.tasks.filter((x) => x.status !== 'done' && x.due >= nx && x.due <= nxe).sort((a, b) => a.due.localeCompare(b.due));
  const sum = [['سجلات غياب وإجازات المعلمات', abs.filter((a) => !isShort(a)).length], ['أيام غياب المعلمات (أيام عمل)', absDays], ['تأخر وخروج المعلمات', abs.filter(isShort).length],
    ['غياب الطالبات', sl.filter((e) => e.type === 'absent').length], ['تأخر الطالبات', sl.filter((e) => e.type === 'late').length], ['حالات تميز الطالبات', sl.filter((e) => e.type === 'achieve').length],
    ['المهام المنجزة', done.length], ['مهام متأخرة حالياً', late.length], ['الوارد', corr.filter((c) => c.kind === 'in').length], ['الصادر', corr.filter((c) => c.kind !== 'in').length], ['معاملات متأخرة الرد', corrLateL.length], ['الزيارات', vis.length]];
  const half = Math.ceil(sum.length / 2);
  let h = `${letterhead()}<h1 style="text-align:center">التقرير الأسبوعي</h1><p style="text-align:center">من ${dayName(ws)} ${fmtH(ws)} إلى ${dayName(we)} ${fmtH(we)} (${fmtG(ws)} — ${fmtG(we)})</p>`;
  h += `<h2>أولاً: ملخص الأسبوع</h2><table><tbody>${sum.slice(0, half).map((r, i) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td><b>${sum[half + i]?.[0] || ''}</b></td><td>${sum[half + i]?.[1] ?? ''}</td></tr>`).join('')}</tbody></table>`;
  h += `<h2>ثانياً: غياب المعلمات</h2>${abs.length ? `<table><tbody><tr><td><b>المعلمة</b></td><td><b>النوع</b></td><td><b>التاريخ</b></td><td><b>فارس</b></td></tr>${abs.sort((a, b) => a.date.localeCompare(b.date)).map((a) => `<tr><td>${esc(tName(a.teacherId))}</td><td>${esc(a.type)}</td><td>${fmtH(a.date)}${a.dateTo && a.dateTo !== a.date ? ' — ' + fmtH(a.dateTo) : ''}</td><td>${a.faris ? '✓' : 'لم يُدخل'}</td></tr>`).join('')}</tbody></table>` : '<p>لا يوجد غياب مسجّل هذا الأسبوع.</p>'}`;
  if (db.students?.length) {
    const byC = {}; sl.filter((e) => ['absent', 'late'].includes(e.type)).forEach((e) => { const s = student(e.studentId); if (!s) return; const c = byC[sClass(s)] = byC[sClass(s)] || { a: 0, l: 0 }; c[e.type === 'absent' ? 'a' : 'l']++; });
    const cnt = {}; sl.filter((e) => e.type === 'absent').forEach((e) => (cnt[e.studentId] = (cnt[e.studentId] || 0) + 1));
    const rep = Object.entries(cnt).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
    h += `<h2>ثالثاً: الطالبات</h2>${Object.keys(byC).length ? `<table><tbody><tr><td><b>الفصل</b></td><td><b>غياب</b></td><td><b>تأخر</b></td></tr>${Object.entries(byC).sort((a, b) => a[0].localeCompare(b[0], 'ar', { numeric: true })).map(([c, v]) => `<tr><td>${esc(c)}</td><td>${v.a}</td><td>${v.l}</td></tr>`).join('')}</tbody></table>` : '<p>لا غياب ولا تأخر مسجّل للطالبات هذا الأسبوع.</p>'}
      ${rep.length ? `<p><b>تكرر غيابهن (يومين فأكثر):</b> ${rep.map(([id, n]) => `${esc(student(id)?.name || '')} (${n})`).join('، ')}</p>` : ''}
      ${sl.some((e) => e.type === 'achieve') ? `<p><b>تميز:</b> ${sl.filter((e) => e.type === 'achieve').map((e) => `${esc(student(e.studentId)?.name || '')}${e.text ? ' — ' + esc(e.text) : ''}`).join('، ')}</p>` : ''}`;
  }
  h += `<h2>${db.students?.length ? 'رابعاً' : 'ثالثاً'}: المهام والمعاملات</h2><p><b>المنجزة (${done.length}):</b></p>${done.length ? `<ol>${done.slice(0, 20).map((x) => `<li>${esc(x.title)}</li>`).join('')}</ol>` : '<p>—</p>'}
    ${open.length ? `<p><b>مستحقة هذا الأسبوع ولم تُنجز بعد (${open.length}):</b></p><ol>${open.slice(0, 15).map((x) => `<li>${esc(x.title)} — ${dayName(x.due)} ${fmtH(x.due)}</li>`).join('')}</ol>` : ''}
    ${late.length ? `<p><b>المتأخرة (${late.length}):</b></p><ol>${late.slice(0, 15).map((x) => `<li>${esc(x.title)} — كان موعدها ${fmtH(x.due)}</li>`).join('')}</ol>` : ''}
    ${corrLateL.length ? `<p><b>معاملات متأخرة الرد:</b> ${corrLateL.map((c) => `${esc(c.number || '')} ${esc(c.subject || '')}`).join('، ')}</p>` : ''}`;
  h += `<h2>${db.students?.length ? 'خامساً' : 'رابعاً'}: الأسبوع القادم</h2>${occNext.length || tasksNext.length ? `${occNext.length ? `<p><b>المناسبات:</b> ${occNext.map(({ o, d }) => `${esc(o.name)} (${dayName(d)} ${fmtH(d)})`).join('، ')}</p>` : ''}${tasksNext.length ? `<p><b>مهام مستحقة:</b></p><ol>${tasksNext.slice(0, 15).map((x) => `<li>${esc(x.title)} — ${dayName(x.due)} ${fmtH(x.due)}</li>`).join('')}</ol>` : ''}` : '<p>لا توجد مناسبات أو مهام مجدولة.</p>'}`;
  h += `<p><br></p><table class="noborder" style="width:100%"><tbody><tr><td style="width:50%;text-align:center"><b>${esc(db.settings.employeeName ? 'الموظفة: ' + db.settings.employeeName : 'الموظفة')}</b><br><br>..........................</td><td style="width:50%;text-align:center"><b>قائدة المدرسة</b><br><br>..........................</td></tr></tbody></table>`;
  return { title, html: h };
}
const curReport = () => (ui.repMode === 'week' ? buildWeekly(ui.repWeek || weekStart(todayISO())) : buildReport(ui.repMonth));
const _repRender = VIEWS.report.render;
VIEWS.report.render = function () {
  const seg = `<div class="seg" style="margin-bottom:12px">${[['month', '📅 شهري'], ['week', '📊 أسبوعي']].map(([k, l]) => `<button class="${(ui.repMode || 'month') === k ? 'on' : ''}" data-act="repMode" data-id="${k}">${l}</button>`).join('')}</div>`;
  if (ui.repMode !== 'week') return seg + _repRender.call(this);
  if (!ui.repWeek) ui.repWeek = weekStart(todayISO());
  const r = buildWeekly(ui.repWeek);
  return `${seg}<div class="toolbar"><button class="btn sm" data-act="repWk" data-id="-7">→ الأسبوع السابق</button><input type="date" class="input" value="${ui.repWeek}" data-change="repWeek" style="width:auto"><button class="btn sm" data-act="repWk" data-id="7">الأسبوع التالي ←</button><span class="spacer"></span><span class="muted">يُنشأ التقرير تلقائياً من بيانات الأسبوع (الأحد إلى الخميس)</span></div>
    <div class="doc-wrap"><div class="doc-page" id="repPage">${r.html}</div></div>`;
};
Object.assign(ACTIONS, {
  repMode: (el) => { ui.repMode = el.dataset.id; render(); },
  repWk: (el) => { ui.repWeek = addDays(ui.repWeek || weekStart(todayISO()), +el.dataset.id); render(); },
  repWord: async () => { try { const r = curReport(); openBlob(await htmlToDocx($('#repPage')), r.title + '.docx', true); toast('حُفظ ملف Word في «التنزيلات»', 'ok'); } catch (e) { toast('تعذّر التصدير: ' + e.message, 'err'); } },
  repEdit: () => { const r = curReport(); db.documents = db.documents || []; const d = { id: uid(), title: r.title, html: r.html, updatedAt: todayISO() }; db.documents.push(d); DOCS.id = d.id; ui.tool = 'docs'; ui.view = 'tools'; commit(); toast('فُتح التقرير في محرر المستندات للتعديل', 'ok'); },
  repWeekly: () => { ui.repMode = 'week'; ui.repWeek = weekStart(todayISO()); go('report'); },
});
CHANGES.repWeek = (el) => { if (el.value) { ui.repWeek = weekStart(el.value); render(); } };
// لوحة اليوم: الخميس والجمعة والسبت
addHook('dashCards', (t) => {
  const g = parse(t).getDay(); if (![4, 5, 6].includes(g)) return '';
  return `<div class="card"><h3>📊 تقرير هذا الأسبوع</h3><div class="muted" style="margin-bottom:10px">ملخص الأسبوع جاهز: الغياب، والطالبات، والمهام، والمعاملات، والأسبوع القادم.</div><button class="btn sm primary" data-act="repWeekly">📊 فتح التقرير الأسبوعي</button></div>`;
});

// ───── تنبيهات ويندوز ─────
const NT = { sent: {} };
const ntOn = () => db?.settings.winNotify !== false && typeof Notification !== 'undefined';
function ntShow(key, title, body, view) {
  if (NT.sent[key]) return;
  NT.sent[key] = todayISO();
  try {
    const n = new Notification(title, { body, icon: 'icon.png', tag: key, silent: false });
    n.onclick = () => { window.madrasaNative?.focus?.(); window.focus(); if (view) { if (typeof view === 'function') view(); else go(view); } };
  } catch { }
  IDB.put('kv', 'notified', NT.sent).catch(() => { });
}
function ntCheck() {
  if (!ntOn() || !db) return;
  const t = todayISO(), now = new Date(), h = now.getHours();
  if (h < 6 || h > 20) return;
  const dueToday = db.tasks.filter((x) => x.status !== 'done' && x.due === t), overdue = db.tasks.filter((x) => x.status !== 'done' && x.due && x.due < t);
  if (dueToday.length) ntShow(`tasks:${t}`, `📌 ${dueToday.length === 1 ? 'مهمة مستحقة اليوم' : `${dueToday.length} مهام مستحقة اليوم`}`, dueToday.slice(0, 3).map((x) => '• ' + x.title).join('\n'), 'tasks');
  if (overdue.length) ntShow(`overdue:${t}`, `⏰ ${overdue.length === 1 ? 'مهمة متأخرة' : `${overdue.length} مهام متأخرة`}`, overdue.slice(0, 3).map((x) => '• ' + x.title).join('\n'), 'tasks');
  const cl = (db.correspondence || []).filter((c) => c.status !== 'done' && c.due && c.due <= t);
  if (cl.length) ntShow(`corr:${t}`, `📨 ${cl.length === 1 ? 'معاملة حان موعد الرد عليها' : `${cl.length} معاملات حان موعد الرد عليها`}`, cl.slice(0, 3).map((c) => `• ${c.number || ''} ${c.subject || ''}`).join('\n'), 'mail');
  db.occasions.forEach((o) => {
    if (occStatus(o) === 'done') return;
    const d = occNextDate(o), dd = diffDays(t, d);
    if (dd === 7 || dd === 1 || dd === 0) ntShow(`occ:${o.id}:${d}:${dd}`, `🎉 ${o.name} ${dd === 0 ? 'اليوم' : dd === 1 ? 'غداً' : 'بعد أسبوع'}`, kitExists(o) ? 'حقيبة المبادرة جاهزة' : 'افتحي «حقيبة المبادرة» لتجهيز العرض والبروشور والإذاعة بضغطة', () => { go('occasions'); setTimeout(() => kitModal(o), 50); });
  });
  if (now.getDay() === 4 && h >= 11) ntShow(`week:${weekStart(t)}`, '📊 التقرير الأسبوعي جاهز', 'ملخص الأسبوع جاهز للطباعة أو التصدير', ACTIONS.repWeekly);
}
IDB.get('kv', 'notified').then((v) => { if (v) { const cut = addDays(todayISO(), -40); NT.sent = Object.fromEntries(Object.entries(v).filter(([, d]) => d >= cut)); } }).catch(() => { })
  .finally(() => { setTimeout(ntCheck, 20000); setInterval(ntCheck, 5 * 60000); });
addHook('settingsCards', () => `<div class="card"><h3>🔔 تنبيهات ويندوز</h3><div class="muted" style="margin-bottom:10px">تظهر في زاوية الشاشة حتى والبرنامج مصغّر: المهام المستحقة والمتأخرة، والمعاملات التي حان موعد الرد عليها، والمناسبات قبلها بأسبوع ويوم، والتقرير الأسبوعي كل خميس. مرة واحدة في اليوم لكل تنبيه، بين 6 صباحاً و8 مساءً.</div>
  <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${db.settings.winNotify !== false ? 'checked' : ''} data-change="ntToggle"> تفعيل تنبيهات ويندوز</label>
  <button class="btn sm" style="margin-top:10px" data-act="ntTest">🔔 تجربة تنبيه</button></div>`);
CHANGES.ntToggle = (el) => { db.settings.winNotify = el.checked; commit(false); };
ACTIONS.ntTest = () => { const k = 'test:' + Date.now(); ntShow(k, '🔔 المساعد الإداري', 'هكذا تظهر التنبيهات. اضغطي عليها لفتح البرنامج.', 'dashboard'); };
