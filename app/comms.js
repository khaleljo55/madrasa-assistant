// ═════════════ 📲 تطبيق التواصل: إدارة المعلمات والإداريات (1.5.0) والطالبات (1.6.0) من البرنامج الرئيسي ═════════════
// تطبيق مستقل للمنسوبات (…/staff/) يستقبل الرسائل والإشعارات، وفيه محادثة داخلية بصلاحية تمنحها الأستاذة وتسحبها.
// يعتمد على خادم المزامنة المشفّرة (قاعدة D1)، وكلمة عبور القناة هي صلاحية الإدارة.
// المحتوى هنا (الرسائل والأسماء) يُحفظ في قاعدة الخادم غير مشفّر من الطرفين، فلا تُرسل عبره بيانات طالبات حساسة.
const CM = { grp: 'staff', tab: 'req', sTab: 'req', users: [], sent: [], sentS: [], chat: [], threads: [], dmUid: null, dm: [], loading: false, at: 0, err: '', sum: { pending: 0, chatLast: 0, dmLast: 0 }, notified: { pending: 0, chat: 0, dm: 0 }, to: 'all', pick: new Set(), sTo: 'students', sPick: new Set(), sCls: new Set() };
const STAFF_BASE = 'https://khaleljo55.github.io/madrasa-assistant/staff/';
const CM_ROLE = { teacher: 'معلمة', admin: 'إدارية', student: 'طالبة' };
const cmStaff = (u) => u.role !== 'student', cmStu = (u) => u.role === 'student';
const cmReady = () => typeof RELAY !== 'undefined' && !!(RELAY.cfg && RELAY.id && RELAY.tok);
const cmFrom = () => (db.settings.employeeName ? 'الأستاذة ' + String(db.settings.employeeName).trim().split(/\s+/)[0] : 'الإدارة');
const cmSeenChat = () => Number(db.settings.commsSeenChat || 0);
async function cmApi(path, opt = {}) {
  let r;
  try { r = await fetch(`${RELAY.cfg.url}/v1/${RELAY.id}/staff/${path}`, { ...opt, cache: 'no-store', headers: { Authorization: 'Bearer ' + RELAY.tok, 'Content-Type': 'application/json' } }); }
  catch { throw new Error(navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : 'تعذّر الوصول إلى الخادم'); }
  let j = {}; try { j = await r.json(); } catch { }
  if (r.status === 503 || (r.status === 404 && j.error === 'not_found' && !path.includes('/'))) { const e = new Error('يلزم تحديث خادم المزامنة: شغّلي Setup-Cloud-Sync.bat مرة واحدة من الكمبيوتر'); e.code = 'no_db'; throw e; }
  if (!r.ok) throw new Error({ no_recipients: 'لا توجد مستلمات مفعّلات', empty: 'اكتبي الرسالة' }[j.error] || 'خطأ من الخادم ' + r.status);
  return j;
}
const cmLink = (dir = 'staff') => {
  let base = STAFF_BASE.replace(/staff\/$/, dir + '/');
  if (IS_WEBAPP && /^https?:/.test(location.protocol)) base = new URL(dir + '/', location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '')).href;
  return `${base}#s=${RELAY.id}&r=${encodeURIComponent(RELAY.cfg.url)}&n=${encodeURIComponent(db.settings.schoolName || '')}`;
};
async function cmLoad(force) {
  if (!cmReady() || CM.loading || (!force && Date.now() - CM.at < 15000)) return;
  CM.loading = true;
  try {
    const [u, s, s2, c, sum, th, dm] = await Promise.all([cmApi('users'), cmApi('sent'), cmApi('sent?grp=student'), cmApi('chat'), cmApi('summary'), cmApi('dm'), CM.dmUid ? cmApi('dm/' + CM.dmUid).catch(() => ({ items: [] })) : null]);
    CM.users = u.users || []; CM.sent = s.items || []; CM.sentS = s2.items || []; CM.chat = c.items || []; CM.sum = sum; CM.threads = th.threads || []; if (dm) CM.dm = dm.items || []; CM.err = ''; CM.at = Date.now();
    if (CM.grp === 'staff' && CM.tab === 'chat') cmMarkChat();
    if (CM.grp === 'student' && CM.sTab === 'dm') cmMarkDm();
  } catch (e) { CM.err = e.message; CM.at = Date.now(); }
  CM.loading = false;
  if (ui.view === 'comms') { const ta = $('#cmChatIn')?.value, tb = $('#cmDmIn')?.value; render(); if (ta) { const t = $('#cmChatIn'); if (t) t.value = ta; } if (tb) { const t = $('#cmDmIn'); if (t) t.value = tb; } }
  else renderNav();
}
function cmMarkChat() { const last = CM.chat.filter((m) => !m.mine).reduce((a, m) => Math.max(a, m.id), 0); if (last > cmSeenChat()) { db.settings.commsSeenChat = last; commit(false); } }
const cmSeenDm = () => db.settings.commsSeenDm || {};
function cmMarkDm() {
  let ch = false;
  const t = CM.dmUid && CM.threads.find((x) => x.uid === CM.dmUid);
  if (t && t.lastIn > (cmSeenDm()[CM.dmUid] || 0)) { db.settings.commsSeenDm = { ...cmSeenDm(), [CM.dmUid]: t.lastIn }; ch = true; }
  if ((CM.sum.dmLast || 0) > Number(db.settings.commsDmTab || 0)) { db.settings.commsDmTab = CM.sum.dmLast; ch = true; }
  if (ch) commit(false);
}
const cmBadge = () => (cmReady() ? (CM.sum.pending || 0) + (CM.sum.chatLast > cmSeenChat() ? 1 : 0) + (CM.sum.dmLast > Number(db.settings.commsDmTab || 0) ? 1 : 0) : 0);

NAV.push({ id: 'comms', ic: '📲', label: 'تطبيق التواصل', badge: cmBadge });
VIEWS.comms = {
  render() {
    if (!cmReady()) return `<div class="card"><h3>📲 تطبيق التواصل للمعلمات والإداريات</h3><div class="muted" style="margin-bottom:12px">تطبيق بسيط على جوال كل معلمة وإدارية، تصلهن فيه رسائلكِ وإشعاراتكِ مباشرة بدل البريد والرسائل النصية، مع محادثة داخلية لمن تختارين.</div>
      <div class="banner"><span class="big">🔐</span><div>يعمل بعد تفعيل «المزامنة المشفّرة» من الإعدادات.</div><span class="spacer"></span><button class="btn primary" data-act="setGo" data-id="sync">فتح الإعدادات</button></div></div>`;
    setTimeout(() => cmLoad(false), 0);
    const ps = CM.users.filter((u) => cmStu(u) && u.status === 'pending').length, pf = CM.users.filter((u) => cmStaff(u) && u.status === 'pending').length;
    const grpSw = `<div class="seg" style="margin-bottom:12px">${[['staff', '👩‍🏫 المعلمات والإداريات', pf + (CM.sum.chatLast > cmSeenChat() ? 1 : 0)], ['student', '🎒 الطالبات', ps + (CM.sum.dmLast > Number(db.settings.commsDmTab || 0) ? 1 : 0)]].map(([k, l, n]) => `<button class="${CM.grp === k ? 'on' : ''}" data-act="cmGrp" data-id="${k}" style="font-size:15px;padding:8px 16px">${l}${n ? ` <span class="badge">${n}</span>` : ''}</button>`).join('')}</div>`;
    if (CM.grp === 'student') return grpSw + cmStudentView();
    const pend = CM.users.filter((u) => cmStaff(u) && u.status === 'pending'), act = CM.users.filter((u) => cmStaff(u) && u.status !== 'pending');
    const newChat = CM.sum.chatLast > cmSeenChat() && CM.tab !== 'chat';
    const tabs = [['req', '📥 طلبات العضوية', pend.length], ['users', '👥 المنسوبات', 0], ['send', '📬 الرسائل', 0], ['chat', '💬 المحادثة الداخلية', newChat ? '●' : 0], ['link', '🔗 رابط التسجيل', 0]];
    let body = '';
    if (CM.err) body += `<div class="banner" style="margin-bottom:12px"><span>⚠️</span><div>${esc(CM.err)}</div><span class="spacer"></span><button class="btn sm" data-act="cmReload">إعادة المحاولة</button></div>`;
    if (CM.tab === 'req') body += pend.length ? `<div class="grid g2">${pend.map((u) => `<div class="card"><div style="display:flex;gap:10px;align-items:center"><span style="font-size:30px">${u.role === 'admin' ? '🗂️' : '👩‍🏫'}</span><div class="grow"><b>${esc(u.name)}</b><div class="muted">${CM_ROLE[u.role] || ''} · <span dir="ltr">${esc(u.username)}</span>${u.phone ? ` · <span dir="ltr">${esc(u.phone)}</span>` : ''}</div><div class="muted" style="font-size:12px">${new Date(u.created).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })}</div></div></div>
        <label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input type="checkbox" id="cmc_${u.id}"> السماح لها بالمحادثة الداخلية</label>
        <div style="display:flex;gap:8px"><button class="btn primary sm" data-act="cmAccept" data-id="${u.id}">✓ قبول</button><button class="btn sm danger" data-act="cmReject" data-id="${u.id}">✕ رفض</button></div></div>`).join('')}</div>`
      : emptyState('📥', CM.loading && !CM.at ? 'جارٍ التحميل…' : 'لا طلبات جديدة. أرسلي «رابط التسجيل» للمعلمات والإداريات.');
    if (CM.tab === 'users') body += act.length ? `<div class="card"><div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الصفة</th><th>اسم المستخدم</th><th>آخر دخول</th><th>الحالة</th><th title="تظهر لها المحادثة الداخلية وتشارك فيها">💬 المحادثة</th><th></th></tr></thead><tbody>
        ${act.map((u) => `<tr><td><b>${esc(u.name)}</b>${u.phone ? `<div class="muted" dir="ltr" style="text-align:right">${esc(u.phone)}</div>` : ''}</td><td>${CM_ROLE[u.role] || ''}</td><td dir="ltr">${esc(u.username)}</td><td class="muted">${u.seen ? new Date(u.seen).toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'short' }) : '—'}</td>
          <td>${u.status === 'active' ? '<span class="chip green">مفعّلة</span>' : '<span class="chip red">موقوفة</span>'}</td>
          <td><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" ${u.chat ? 'checked' : ''} data-change="cmChat" data-id="${u.id}"> ${u.chat ? 'تراها' : 'لا تراها'}</label></td>
          <td style="white-space:nowrap"><button class="btn sm" data-act="cmToggle" data-id="${u.id}">${u.status === 'active' ? '⏸ إيقاف' : '▶ تفعيل'}</button> <button class="btn sm" data-act="cmReset" data-id="${u.id}" title="كلمة مرور مؤقتة">🔑</button> <button class="btn sm danger" data-act="cmDel" data-id="${u.id}" title="حذف">🗑️</button></td></tr>`).join('')}</tbody></table></div></div>
        <div class="muted" style="margin-top:8px;font-size:12.5px">💬 «المحادثة»: تظهر المحادثة الداخلية فقط لمن تفعّلين لها الخيار، ويمكنكِ سحبها في أي وقت فتختفي من جوالها فوراً.</div>`
      : emptyState('👥', 'لا منسوبات بعد');
    if (CM.tab === 'send') {
      const active = CM.users.filter((u) => cmStaff(u) && u.status === 'active');
      body += `<div class="grid g2" style="align-items:start"><div class="card"><h3>✍️ رسالة جديدة</h3><div class="form">
        <div class="field full"><label>إلى</label><div class="seg">${[['all', 'الجميع'], ['teacher', 'المعلمات'], ['admin', 'الإداريات'], ['pick', 'تحديد']].map(([k, l]) => `<button class="${CM.to === k ? 'on' : ''}" data-act="cmTo" data-id="${k}">${l}</button>`).join('')}</div>
          ${CM.to === 'pick' ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${active.map((u) => `<label class="chip ${CM.pick.has(u.id) ? 'brand' : ''}" style="cursor:pointer"><input type="checkbox" style="display:none" ${CM.pick.has(u.id) ? 'checked' : ''} data-change="cmPick" data-id="${u.id}">${esc(u.name)}</label>`).join('') || '<span class="muted">لا منسوبات مفعّلات</span>'}</div>` : ''}
          <span class="hint">${cmCount()} مستلمة</span></div>
        <div class="field full"><label>العنوان</label><input class="input" id="cmTitle" maxlength="150" placeholder="مثال: اجتماع المعلمات"></div>
        <div class="field full"><label>الرسالة</label><textarea class="input" id="cmBody" rows="6" maxlength="4000" placeholder="اكتبي الرسالة…"></textarea></div></div>
        <button class="btn primary" style="margin-top:10px" data-act="cmSend">📤 إرسال</button>
        <div class="muted" style="font-size:12.5px;margin-top:8px">تصل إشعاراً فورياً في جوالاتهن، وتبقى في صندوق الرسائل. لا ترسلي بيانات طالبات حساسة.</div></div>
        <div class="card"><h3>📤 المرسلة</h3>${CM.sent.length ? `<div class="list">${CM.sent.map((m) => `<div class="li"><div class="grow"><div class="t">${esc(m.title || String(m.body).slice(0, 50))}</div><div class="s">${new Date(m.created).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
          <button class="chip ${m.rd === m.n ? 'green' : 'amber'}" data-act="cmReads" data-id="${m.id}" style="border:0;cursor:pointer">👁 اطّلعت ${m.rd} من ${m.n}</button><button class="icon-btn" data-act="cmSentDel" data-id="${m.id}" title="حذف">🗑️</button></div>`).join('')}</div>` : emptyState('📭', 'لم تُرسل رسائل بعد')}</div></div>`;
    }
    if (CM.tab === 'chat') {
      const members = CM.users.filter((u) => u.status === 'active' && u.chat);
      body += `<div class="card"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px"><h3 style="margin:0">💬 المحادثة الداخلية</h3><span class="muted">المشاركات (${members.length}): ${members.map((u) => esc(u.name)).join('، ') || '—'}</span><span class="spacer"></span><button class="btn sm" data-act="cmTab" data-id="users">إدارة الصلاحيات</button></div>
        <div class="cm-chat" id="cmChat">${CM.chat.length ? CM.chat.map((m) => `<div class="cm-bub ${m.mine ? 'mine' : ''}">${m.mine ? '' : `<div class="who">${esc(m.sender_name)}</div>`}<div>${esc(m.body).replace(/\n/g, '<br>')}</div><div class="t">${new Date(m.created).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' })} <button class="cm-del" data-act="cmChatDel" data-id="${m.id}" title="حذف الرسالة">🗑️</button></div></div>`).join('') : '<div class="muted" style="text-align:center;padding:30px">لا رسائل بعد</div>'}</div>
        <div style="display:flex;gap:8px;margin-top:10px"><textarea class="input" id="cmChatIn" rows="2" maxlength="4000" placeholder="اكتبي رسالة للمحادثة…"></textarea><button class="btn primary" data-act="cmChatSend">إرسال</button></div></div>`;
      setTimeout(() => { const c = $('#cmChat'); if (c) c.scrollTop = c.scrollHeight; }, 0);
    }
    if (CM.tab === 'link') {
      const L = cmLink();
      body += `<div class="card"><h3>🔗 رابط التسجيل للمعلمات والإداريات</h3><div class="muted" style="margin-bottom:10px">أرسليه لهن، فتفتحه كل واحدة من جوالها، وتسجّل باسمها واسم مستخدم وكلمة مرور، ثم يصلكِ طلبها هنا لتقبليه.</div>
        <textarea class="input" readonly rows="3" dir="ltr" id="cmLinkBox" style="font-size:12.5px">${esc(L)}</textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn primary" data-act="cmCopy">📋 نسخ الرابط</button><button class="btn" data-act="cmWa">🟢 إرسال عبر واتساب</button><button class="btn" data-act="cmMailT">📧 إرسال للمعلمات بالبريد</button></div>
        <div class="card" style="margin-top:14px;background:var(--brand-soft);border:0"><b>📱 خطوات المعلمة:</b><ol style="margin:6px 0 0;padding-inline-start:20px"><li>تفتح الرابط من Safari (آيفون) أو Chrome (أندرويد).</li><li>تضيفه إلى الشاشة الرئيسية (زر المشاركة ⬆️ ← «إضافة إلى الشاشة الرئيسية»).</li><li>تفتح «تواصل المدرسة» من الأيقونة ← «تسجيل جديد».</li><li>بعد قبولكِ: «حسابي» ← «تفعيل الإشعارات».</li></ol></div></div>`;
    }
    return grpSw + `<div class="seg" style="margin-bottom:14px;flex-wrap:wrap">${tabs.map(([k, l, n]) => `<button class="${CM.tab === k ? 'on' : ''}" data-act="cmTab" data-id="${k}">${l}${n ? ` <span class="badge">${n}</span>` : ''}</button>`).join('')}</div>${body}`;
  },
  actions: () => (cmReady() ? `<button class="btn" data-act="cmReload">🔄 تحديث</button>` : ''),
};
function cmCount() { const a = CM.users.filter((u) => cmStaff(u) && u.status === 'active'); return CM.to === 'all' ? a.length : CM.to === 'pick' ? a.filter((u) => CM.pick.has(u.id)).length : a.filter((u) => u.role === CM.to).length; }
const cmUser = (id) => CM.users.find((u) => u.id === id);
async function cmUpdate(id, patch, msg) { try { const r = await cmApi('users/' + id, { method: 'POST', body: JSON.stringify(patch) }); const i = CM.users.findIndex((u) => u.id === id); if (i >= 0 && r.user) CM.users[i] = r.user; if (msg) toast(msg, 'ok'); } catch (e) { toast(e.message, 'err'); } CM.sum.pending = CM.users.filter((u) => u.status === 'pending').length; render(); }
// كلمة مرور مؤقتة بنفس طريقة تطبيق المنسوبات (PBKDF2 في الجهاز)
async function cmPassHash(username, pass) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  return rlB64u(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 100000, salt: new TextEncoder().encode(`madrasa-staff:${RELAY.id}:${username}`) }, key, 256)));
}
function cmInfo(title, html) {
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal" style="width:460px"><div class="modal-h"><h2>${esc(title)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div><div class="modal-b">${html}</div><div class="modal-f"><button class="btn primary" data-act="modalClose">تم</button></div></div></div>`;
  modalCtx = {};
}
Object.assign(ACTIONS, {
  cmTab: (el) => { CM.tab = el.dataset.id; if (CM.tab === 'chat') { cmMarkChat(); cmLoad(true); } render(); },
  cmReload: () => cmLoad(true),
  cmAccept: (el) => { const id = el.dataset.id, chat = !!$('#cmc_' + id)?.checked; cmUpdate(id, { status: 'active', chat }, `✓ قُبلت ${cmUser(id)?.name || ''}، ووصلها إشعار`); },
  cmReject: (el) => { const u = cmUser(el.dataset.id); confirmBox(`رفض طلب ${u?.name || ''} وحذفه؟`, async () => { try { await cmApi('users/' + u.id, { method: 'DELETE' }); CM.users = CM.users.filter((x) => x.id !== u.id); CM.sum.pending = CM.users.filter((x) => x.status === 'pending').length; } catch (e) { toast(e.message, 'err'); } render(); }, 'نعم، ارفضيه'); },
  cmToggle: (el) => { const u = cmUser(el.dataset.id); cmUpdate(u.id, { status: u.status === 'active' ? 'disabled' : 'active' }, u.status === 'active' ? `أُوقف حساب ${u.name} وخرجت من جوالها` : `فُعّل حساب ${u.name}`); },
  cmDel: (el) => { const u = cmUser(el.dataset.id); confirmBox(`حذف حساب ${u.name} نهائياً مع رسائلها الواردة؟`, async () => { try { await cmApi('users/' + u.id, { method: 'DELETE' }); CM.users = CM.users.filter((x) => x.id !== u.id); } catch (e) { toast(e.message, 'err'); } render(); }); },
  cmReset: async (el) => {
    const u = cmUser(el.dataset.id), pass = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
    try { await cmApi('users/' + u.id, { method: 'POST', body: JSON.stringify({ pass: await cmPassHash(u.username, pass) }) }); cmInfo('🔑 كلمة مرور مؤقتة', `<p>أرسليها إلى <b>${esc(u.name)}</b>، وتغيّرها من «حسابي» بعد الدخول:</p><div style="font-size:26px;font-weight:800;text-align:center;letter-spacing:3px;padding:10px;background:var(--brand-soft);border-radius:10px" dir="ltr">${pass}</div><p class="muted">اسم المستخدم: <span dir="ltr">${esc(u.username)}</span></p>`); }
    catch (e) { toast(e.message, 'err'); }
  },
  cmTo: (el) => { CM.to = el.dataset.id; render(); },
  cmSend: async (el) => {
    const title = $('#cmTitle').value.trim(), body = $('#cmBody').value.trim();
    if (!body) return toast('اكتبي الرسالة', 'err');
    const to = CM.to === 'pick' ? [...CM.pick] : CM.to;
    if (!cmCount()) return toast('اختاري المستلمات', 'err');
    el.disabled = true;
    try { const r = await cmApi('send', { method: 'POST', body: JSON.stringify({ title, body, to, from: cmFrom() }) }); toast(`📤 أُرسلت إلى ${r.n}`, 'ok'); CM.pick.clear(); await cmLoad(true); }
    catch (e) { toast(e.message, 'err'); el.disabled = false; }
  },
  cmReads: async (el) => {
    try { const r = await cmApi('sent/' + el.dataset.id); cmInfo('👁 الاطلاع على الرسالة', `<div class="list">${r.items.map((x) => `<div class="li"><div class="grow"><b>${esc(x.name)}</b> <span class="muted">${CM_ROLE[x.role] || ''}</span></div>${x.read_at ? `<span class="chip green">اطّلعت ${new Date(x.read_at).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' })}</span>` : '<span class="chip amber">لم تطّلع</span>'}</div>`).join('')}</div>`); }
    catch (e) { toast(e.message, 'err'); }
  },
  cmSentDel: (el) => confirmBox('حذف الرسالة من صناديق المستلمات؟', async () => { try { await cmApi('sent/' + el.dataset.id, { method: 'DELETE' }); await cmLoad(true); } catch (e) { toast(e.message, 'err'); } }),
  cmChatSend: async (el) => {
    const t = $('#cmChatIn').value.trim(); if (!t) return;
    el.disabled = true;
    try { await cmApi('chat', { method: 'POST', body: JSON.stringify({ body: t, from: cmFrom() }) }); $('#cmChatIn').value = ''; await cmLoad(true); } catch (e) { toast(e.message, 'err'); }
    el.disabled = false;
  },
  cmChatDel: (el) => confirmBox('حذف هذه الرسالة من المحادثة عند الجميع؟', async () => { try { await cmApi('chat/' + el.dataset.id, { method: 'DELETE' }); await cmLoad(true); } catch (e) { toast(e.message, 'err'); } }),
  cmCopy: async (el) => { try { await navigator.clipboard.writeText(cmLink(el.dataset.id || 'staff')); toast('نُسخ الرابط ✓', 'ok'); } catch { $('#cmLinkBox')?.select(); toast('حدّدي الرابط وانسخيه'); } },
  cmWa: (el) => api.openUrl('https://wa.me/?text=' + encodeURIComponent(el.dataset.id === 'student'
    ? `السلام عليكم ولية أمر الطالبة الكريمة،\nهذا رابط تطبيق «تواصل الطالبات» من ${db.settings.schoolName || 'المدرسة'}، تصلكِ فيه طلبات المدرسة وتذكيراتها:\n${cmLink('student')}\n\nافتحيه من الجوال، وأضيفيه إلى الشاشة الرئيسية، ثم «تسجيل جديد» باسم الطالبة وفصلها.`
    : `السلام عليكم، هذا رابط تطبيق «تواصل المدرسة» لاستقبال رسائل الإدارة وإشعاراتها:\n${cmLink()}\n\nافتحيه من الجوال، وأضيفيه إلى الشاشة الرئيسية، ثم «تسجيل جديد».`)),
  cmMailT: () => {
    const to = (db.teachers || []).map((t) => t.email).filter(Boolean).join(',');
    api.openUrl(`https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(to)}&su=${encodeURIComponent('تطبيق تواصل المدرسة')}&body=${encodeURIComponent(`السلام عليكم ورحمة الله\n\nنرجو تسجيلكِ في تطبيق «تواصل المدرسة» لتصلكِ رسائل الإدارة وإشعاراتها مباشرة على جوالكِ:\n${cmLink()}\n\n1. افتحي الرابط من الجوال (Safari في الآيفون).\n2. أضيفيه إلى الشاشة الرئيسية.\n3. افتحيه من الأيقونة ← «تسجيل جديد».\n4. بعد القبول: «حسابي» ← «تفعيل الإشعارات».\n\n${cmFrom()}`)}`);
  },
});
Object.assign(CHANGES, {
  cmChat: (el) => { const u = cmUser(el.dataset.id), s = cmStu(u); cmUpdate(u.id, { chat: el.checked }, el.checked ? (s ? `💬 أصبح بإمكان ${u.name} مراسلة الإدارة` : `💬 ${u.name} ترى المحادثة الآن`) : (s ? `أُوقفت المراسلة لـ ${u.name}` : `أُخفيت المحادثة عن ${u.name}`)); },
  cmPick: (el) => { el.checked ? CM.pick.add(el.dataset.id) : CM.pick.delete(el.dataset.id); render(); },
});
// متابعة الطلبات والمحادثة في الخلفية، وهدهد تنبّه
async function cmPoll() {
  if (!db || !cmReady() || document.hidden) return;
  try {
    const s = await cmApi('summary'); CM.sum = s;
    const here = ui.view === 'comms';
    const newChat = s.chatLast > cmSeenChat() && s.chatLast > CM.notified.chat && !(here && CM.grp === 'staff' && CM.tab === 'chat');
    const newDm = s.dmLast > Number(db.settings.commsDmTab || 0) && s.dmLast > CM.notified.dm && !(here && CM.grp === 'student' && CM.sTab === 'dm');
    const stu = (s.pendingStudents || 0) > 0 && (s.pendingStaff || 0) === 0;
    if (s.pending > CM.notified.pending && typeof hudKnock === 'function') hudKnock(`وصل ${s.pending === 1 ? 'طلب عضوية جديد' : s.pending + ' طلبات عضوية'} في تطبيق التواصل 📲`, `<button class="btn sm primary" data-act="cmOpen" data-id="req" data-g="${stu ? 'student' : 'staff'}">افتحيها</button>`);
    else if (newDm && typeof hudSay === 'function') hudSay('رسالة جديدة من طالبة 💬', { pose: 2, acts: '<button class="btn sm primary" data-act="cmOpen" data-id="dm" data-g="student">افتحيها</button>' });
    else if (newChat && typeof hudSay === 'function') hudSay('رسالة جديدة في المحادثة الداخلية 💬', { pose: 2, acts: '<button class="btn sm primary" data-act="cmOpen" data-id="chat">افتحيها</button>' });
    CM.notified = { pending: Math.max(CM.notified.pending, s.pending), chat: Math.max(CM.notified.chat, s.chatLast), dm: Math.max(CM.notified.dm, s.dmLast || 0) };
    if (s.pending < CM.notified.pending) CM.notified.pending = s.pending;
    if (ui.view === 'comms') cmLoad(false); else renderNav();
  } catch { }
}
ACTIONS.cmOpen = (el) => { CM.grp = el.dataset.g || 'staff'; if (CM.grp === 'student') CM.sTab = el.dataset.id; else CM.tab = el.dataset.id; if (typeof hudHideBubble === 'function') hudHideBubble(); go('comms'); if (CM.grp === 'staff' && CM.tab === 'chat') cmMarkChat(); cmLoad(true); };
(function cmStart() { if (!db || typeof RELAY === 'undefined') return setTimeout(cmStart, 600); setTimeout(cmPoll, 25000); setInterval(cmPoll, 60000); })();

// ═════════════ 🎒 الطالبات (1.6.0): المطلوب، والتذكيرات، والمحادثة الخاصة مع الإدارة ═════════════
const cmDate = (d) => (d ? `${dayName(d)} ${fmtG(d)}` : '');
const cmWhen = (ms) => new Date(ms).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
const cmClasses = () => [...new Set(CM.users.filter((u) => cmStu(u) && u.status === 'active' && u.cls).map((u) => u.cls))].sort((a, b) => a.localeCompare(b, 'ar', { numeric: true }));
const cmSActive = () => CM.users.filter((u) => cmStu(u) && u.status === 'active');
function cmSCount() { const a = cmSActive(); return CM.sTo === 'students' ? a.length : CM.sTo === 'cls' ? a.filter((u) => CM.sCls.has(u.cls)).length : a.filter((u) => CM.sPick.has(u.id)).length; }
const cmSTarget = () => (CM.sTo === 'students' ? 'students' : CM.sTo === 'cls' ? { cls: [...CM.sCls] } : [...CM.sPick]);
function cmAudience() {
  const a = cmSActive();
  return `<div class="field full"><label>إلى</label><div class="seg">${[['students', 'كل الطالبات'], ['cls', 'فصول'], ['pick', 'طالبات محددات']].map(([k, l]) => `<button class="${CM.sTo === k ? 'on' : ''}" data-act="cmSTo" data-id="${k}">${l}</button>`).join('')}</div>
    ${CM.sTo === 'cls' ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${cmClasses().map((c) => `<label class="chip ${CM.sCls.has(c) ? 'brand' : ''}" style="cursor:pointer"><input type="checkbox" style="display:none" ${CM.sCls.has(c) ? 'checked' : ''} data-change="cmSCls" data-id="${esc(c)}">${esc(c)}</label>`).join('') || '<span class="muted">لا فصول بعد</span>'}</div>` : ''}
    ${CM.sTo === 'pick' ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;max-height:160px;overflow:auto">${a.map((u) => `<label class="chip ${CM.sPick.has(u.id) ? 'brand' : ''}" style="cursor:pointer"><input type="checkbox" style="display:none" ${CM.sPick.has(u.id) ? 'checked' : ''} data-change="cmSPick" data-id="${u.id}">${esc(u.name)}${u.cls ? ` <span class="muted">${esc(u.cls)}</span>` : ''}</label>`).join('') || '<span class="muted">لا طالبات مفعّلات</span>'}</div>` : ''}
    <span class="hint">${cmSCount()} طالبة</span></div>`;
}
function cmStudentView() {
  const pend = CM.users.filter((u) => cmStu(u) && u.status === 'pending'), list = CM.users.filter((u) => cmStu(u) && u.status !== 'pending');
  const seen = cmSeenDm(), unreadDm = CM.threads.filter((t) => t.lastIn > (seen[t.uid] || 0)).length;
  const reqs = CM.sentS.filter((m) => m.kind === 'req'), notes = CM.sentS.filter((m) => m.kind !== 'req');
  const tabs = [['req', '📥 طلبات العضوية', pend.length], ['list', '🎒 الطالبات', 0], ['reqs', '📋 المطلوب', 0], ['notes', '🔔 التذكيرات والرسائل', 0], ['dm', '💬 المحادثات', unreadDm], ['link', '🔗 رابط التسجيل', 0]];
  let body = CM.err ? `<div class="banner" style="margin-bottom:12px"><span>⚠️</span><div>${esc(CM.err)}</div><span class="spacer"></span><button class="btn sm" data-act="cmReload">إعادة المحاولة</button></div>` : '';
  const t = CM.sTab;
  if (t === 'req') body += pend.length ? `<div class="grid g2">${pend.map((u) => `<div class="card"><div style="display:flex;gap:10px;align-items:center"><span style="font-size:30px">🎒</span><div class="grow"><b>${esc(u.name)}</b><div class="muted">${esc(u.cls || 'بلا فصل')} · <span dir="ltr">${esc(u.username)}</span>${u.phone ? ` · ولي الأمر <span dir="ltr">${esc(u.phone)}</span>` : ''}</div><div class="muted" style="font-size:12px">${cmWhen(u.created)}</div></div></div>
      <label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input type="checkbox" id="cmc_${u.id}"> السماح لها بمراسلة الإدارة</label>
      <div style="display:flex;gap:8px"><button class="btn primary sm" data-act="cmAccept" data-id="${u.id}">✓ قبول</button><button class="btn sm" data-act="cmSEdit" data-id="${u.id}">✏️ تعديل الاسم أو الفصل</button><button class="btn sm danger" data-act="cmReject" data-id="${u.id}">✕ رفض</button></div></div>`).join('')}</div>`
    : emptyState('📥', 'لا طلبات جديدة. أرسلي «رابط التسجيل» لأولياء الأمور.');
  if (t === 'list') body += list.length ? `<div class="card"><div class="table-wrap"><table><thead><tr><th>الطالبة</th><th>الفصل</th><th>جوال ولي الأمر</th><th>آخر دخول</th><th>الحالة</th><th>💬 مراسلة الإدارة</th><th></th></tr></thead><tbody>
      ${list.sort((a, b) => (a.cls || '').localeCompare(b.cls || '', 'ar', { numeric: true }) || a.name.localeCompare(b.name, 'ar')).map((u) => `<tr><td><b>${esc(u.name)}</b><div class="muted" dir="ltr" style="text-align:right">${esc(u.username)}</div></td><td>${esc(u.cls || '—')}</td><td dir="ltr" style="text-align:right">${esc(u.phone || '—')}</td><td class="muted">${u.seen ? new Date(u.seen).toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'short' }) : '—'}</td>
        <td>${u.status === 'active' ? '<span class="chip green">مفعّلة</span>' : '<span class="chip red">موقوفة</span>'}</td>
        <td><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" ${u.chat ? 'checked' : ''} data-change="cmChat" data-id="${u.id}"> ${u.chat ? 'مسموح' : 'غير مسموح'}</label></td>
        <td style="white-space:nowrap"><button class="btn sm" data-act="cmSEdit" data-id="${u.id}" title="تعديل">✏️</button> <button class="btn sm" data-act="cmToggle" data-id="${u.id}">${u.status === 'active' ? '⏸' : '▶'}</button> <button class="btn sm" data-act="cmReset" data-id="${u.id}" title="كلمة مرور مؤقتة">🔑</button> <button class="btn sm danger" data-act="cmDel" data-id="${u.id}" title="حذف">🗑️</button></td></tr>`).join('')}</tbody></table></div></div>
      <div class="muted" style="margin-top:8px;font-size:12.5px">💬 «مراسلة الإدارة»: محادثة خاصة بين الطالبة والإدارة فقط، ولا ترى الطالبات بعضهن. تمنحينها وتسحبينها متى شئتِ.</div>`
    : emptyState('🎒', 'لا طالبات بعد');
  if (t === 'reqs') body += `<div class="grid g2" style="align-items:start"><div class="card"><h3>📋 طلب جديد من الطالبات</h3><div class="form">${cmAudience()}
      <div class="field full"><label>المطلوب</label><input class="input" id="cmRTitle" maxlength="150" placeholder="مثال: صورة بطاقة ولي الأمر" list="cmRList"><datalist id="cmRList">${['صورة بطاقة ولي الأمر', 'صورة شهادة الميلاد', 'صورة كرت التطعيمات', 'صورتان شخصيتان', 'تعبئة نموذج المعلومات', 'توقيع ولي الأمر على النموذج', 'إحضار رسوم النشاط'].map((x) => `<option value="${x}">`).join('')}</datalist></div>
      <div class="field full"><label>التفاصيل (اختياري)</label><textarea class="input" id="cmRBody" rows="3" maxlength="4000"></textarea></div>
      <div class="field"><label>آخر موعد</label><input class="input" type="date" id="cmRDue" min="${todayISO()}"></div>
      <div class="field"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="cmRRem" checked> تذكير صباح يوم الموعد</label></div></div>
      <button class="btn primary" style="margin-top:10px" data-act="cmRSend">📤 إرسال الطلب</button></div>
    <div class="card"><h3>📊 متابعة المطلوب</h3>${reqs.length ? `<div class="list">${reqs.map((m) => { const left = m.n - Math.max(m.dn, m.ok), late = m.due && m.due < todayISO() && left > 0; return `<div class="li" style="cursor:pointer" data-act="cmRView" data-id="${m.id}"><div class="grow"><div class="t">${esc(m.title || m.body)}</div><div class="s">${m.due ? `📅 ${cmDate(m.due)}` : 'بلا موعد'}${late ? ' · <b style="color:var(--red)">تأخر الموعد</b>' : ''}</div>
        <div class="cm-prog"><span style="width:${m.n ? (m.ok / m.n) * 100 : 0}%" class="ok"></span><span style="width:${m.n ? (Math.max(0, m.dn - m.ok) / m.n) * 100 : 0}%" class="dn"></span></div>
        <div class="s">✅ استلمتِ ${m.ok} · ⏳ أبلغت ${Math.max(0, m.dn - m.ok)} · لم تُنجز ${Math.max(0, left)} — من ${m.n}</div></div><button class="icon-btn" data-act="cmSentDel" data-id="${m.id}" title="حذف">🗑️</button></div>`; }).join('')}</div>` : emptyState('📋', 'لا طلبات بعد')}</div></div>`;
  if (t === 'notes') body += `<div class="grid g2" style="align-items:start"><div class="card"><h3>🔔 تذكير أو رسالة للطالبات</h3><div class="form">${cmAudience()}
      <div class="field full"><label>العنوان</label><input class="input" id="cmNTitle" maxlength="150" placeholder="مثال: تذكير بالنموذج"></div>
      <div class="field full"><label>الرسالة</label><textarea class="input" id="cmNBody" rows="4" maxlength="4000"></textarea></div>
      <div class="field"><label>يوم التذكير (اختياري)</label><input class="input" type="date" id="cmNDate" min="${todayISO()}"></div>
      <div class="field"><label>الساعة</label><input class="input" type="time" id="cmNTime" value="07:00"></div>
      <div class="field full"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="cmNNow" checked> إرسالها الآن أيضاً (وإلا تصل في يوم التذكير فقط)</label></div></div>
      <button class="btn primary" style="margin-top:10px" data-act="cmNSend">📤 إرسال</button></div>
    <div class="card"><h3>📤 المرسلة</h3>${notes.length ? `<div class="list">${notes.map((m) => `<div class="li"><div class="grow"><div class="t">${esc(m.title || String(m.body).slice(0, 50))}</div><div class="s">${cmWhen(m.created)}${m.remind_at ? ` · 🔔 ${m.remind_at > Date.now() ? 'سيصل التذكير' : 'وصل التذكير'} ${cmWhen(m.remind_at)}` : ''}</div></div>
      <button class="chip ${m.rd === m.n ? 'green' : 'amber'}" data-act="cmReads" data-id="${m.id}" style="border:0;cursor:pointer">👁 ${m.rd} من ${m.n}</button><button class="icon-btn" data-act="cmSentDel" data-id="${m.id}" title="حذف">🗑️</button></div>`).join('')}</div>` : emptyState('📭', 'لا رسائل بعد')}</div></div>`;
  if (t === 'dm') {
    const allowed = list.filter((u) => u.status === 'active' && u.chat), ids = new Set([...allowed.map((u) => u.id), ...CM.threads.map((x) => x.uid)]);
    const rows = [...ids].map((id) => ({ u: CM.users.find((x) => x.id === id), th: CM.threads.find((x) => x.uid === id) })).filter((r) => r.u).sort((a, b) => (b.th?.last || 0) - (a.th?.last || 0));
    const cur = CM.dmUid && CM.users.find((x) => x.id === CM.dmUid);
    body += `<div class="cm-dm"><div class="card cm-dm-list">${rows.length ? rows.map(({ u, th }) => `<div class="li ${CM.dmUid === u.id ? 'on' : ''}" data-act="cmDmOpen" data-id="${u.id}" style="cursor:pointer"><div class="grow"><div class="t">${th && th.lastIn > (seen[u.id] || 0) ? '🔵 ' : ''}${esc(u.name)}</div><div class="s">${esc(u.cls || '')}${u.chat ? '' : ' · غير مسموح'}</div></div></div>`).join('') : '<div class="muted" style="padding:14px">امنحي الطالبات صلاحية «مراسلة الإدارة» من قائمة الطالبات.</div>'}</div>
      <div class="card">${cur ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b>💬 ${esc(cur.name)}</b><span class="muted">${esc(cur.cls || '')}</span><span class="spacer"></span>${cur.chat ? '' : '<span class="chip amber">المراسلة غير مسموحة لها حالياً</span>'}</div>
        <div class="cm-chat" id="cmChat">${CM.dm.length ? CM.dm.map((m) => `<div class="cm-bub ${m.mine ? 'mine' : ''}">${m.mine ? '' : `<div class="who">${esc(m.sender_name)}</div>`}<div>${esc(m.body).replace(/\n/g, '<br>')}</div><div class="t">${cmWhen(m.created)} <button class="cm-del" data-act="cmChatDel" data-id="${m.id}" title="حذف">🗑️</button></div></div>`).join('') : '<div class="muted" style="text-align:center;padding:30px">لا رسائل بعد</div>'}</div>
        ${cur.chat ? `<div style="display:flex;gap:8px;margin-top:10px"><textarea class="input" id="cmDmIn" rows="2" maxlength="4000" placeholder="اكتبي ردّكِ…"></textarea><button class="btn primary" data-act="cmDmSend">إرسال</button></div>` : ''}` : '<div class="muted" style="text-align:center;padding:40px">اختاري طالبة من القائمة</div>'}</div></div>`;
    setTimeout(() => { const c = $('#cmChat'); if (c) c.scrollTop = c.scrollHeight; }, 0);
  }
  if (t === 'link') {
    const L = cmLink('student');
    body += `<div class="card"><h3>🔗 رابط تسجيل الطالبات</h3><div class="muted" style="margin-bottom:10px">أرسليه لأولياء الأمور، فتسجّل ولية الأمر باسم الطالبة وفصلها من جوالها، ثم يصلكِ الطلب هنا لتقبليه.</div>
      <textarea class="input" readonly rows="3" dir="ltr" id="cmLinkBox" style="font-size:12.5px">${esc(L)}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn primary" data-act="cmCopy" data-id="student">📋 نسخ الرابط</button><button class="btn" data-act="cmWa" data-id="student">🟢 إرسال عبر واتساب</button></div>
      <div class="card" style="margin-top:14px;background:var(--purple-soft);border:0"><b>📱 خطوات ولية الأمر:</b><ol style="margin:6px 0 0;padding-inline-start:20px"><li>تفتح الرابط من Safari (آيفون) أو Chrome (أندرويد).</li><li>تضيفه إلى الشاشة الرئيسية (زر المشاركة ⬆️ ← «إضافة إلى الشاشة الرئيسية»).</li><li>تفتح «تواصل الطالبات» من الأيقونة ← «تسجيل جديد» باسم الطالبة وفصلها.</li><li>بعد قبولكِ: «حسابي» ← «تفعيل الإشعارات».</li></ol></div></div>`;
  }
  return `<div class="seg" style="margin-bottom:14px;flex-wrap:wrap">${tabs.map(([k, l, n]) => `<button class="${t === k ? 'on' : ''}" data-act="cmSTab" data-id="${k}">${l}${n ? ` <span class="badge">${n}</span>` : ''}</button>`).join('')}</div>${body}`;
}
async function cmReqModal(id) {
  try {
    const r = await cmApi('sent/' + id), m = CM.sentS.find((x) => x.id === id);
    const rows = r.items, waiting = rows.filter((x) => x.done_at && !x.ok_at);
    const st = (x) => (x.ok_at ? '<span class="chip green">✅ استُلم</span>' : x.done_at ? `<span class="chip amber">⏳ أبلغت ${new Date(x.done_at).toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'short' })}</span>` : '<span class="chip">لم تُنجز</span>');
    $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal wide"><div class="modal-h"><h2>📋 ${esc(m?.title || 'المطلوب')}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
      <div class="modal-b">${m?.due ? `<p class="muted">📅 آخر موعد: ${cmDate(m.due)}</p>` : ''}${waiting.length ? `<button class="btn sm primary" data-act="cmROkAll" data-id="${id}" style="margin-bottom:10px">✅ تأكيد الاستلام من ${waiting.length} أبلغن</button>` : ''}
      <div class="list">${rows.map((x) => `<div class="li"><div class="grow"><b>${esc(x.name)}</b> <span class="muted">${esc(x.cls || '')}</span></div>${st(x)}<button class="btn sm ${x.ok_at ? '' : 'primary'}" data-act="cmROk" data-id="${id}" data-u="${x.id}" data-ok="${x.ok_at ? 0 : 1}">${x.ok_at ? '↩ إلغاء' : '✓ استلمتُ'}</button></div>`).join('')}</div></div>
      <div class="modal-f"><button class="btn" data-act="cmRPrint" data-id="${id}">🖨 طباعة القائمة</button><button class="btn primary" data-act="modalClose">تم</button></div></div></div>`;
    modalCtx = { cmReq: id, rows, title: m?.title || '' };
  } catch (e) { toast(e.message, 'err'); }
}
Object.assign(ACTIONS, {
  cmGrp: (el) => { CM.grp = el.dataset.id; render(); },
  cmSTab: (el) => { CM.sTab = el.dataset.id; if (CM.sTab === 'dm') { cmMarkDm(); cmLoad(true); } render(); },
  cmSTo: (el) => { CM.sTo = el.dataset.id; render(); },
  cmSEdit: (el) => { const u = cmUser(el.dataset.id); formModal({ title: '✏️ بيانات الطالبة', fields: [{ key: 'name', label: 'اسم الطالبة', required: true, full: true }, { key: 'cls', label: 'الصف والفصل', list: cmClasses(), full: true }], values: { name: u.name, cls: u.cls }, onSave: (v) => cmUpdate(u.id, { name: v.name, cls: v.cls }, '✓ حُفظت البيانات') }); },
  cmRSend: async (el) => {
    const title = $('#cmRTitle').value.trim(), body = $('#cmRBody').value.trim(), due = $('#cmRDue').value;
    if (!title) return toast('اكتبي المطلوب', 'err');
    if (!cmSCount()) return toast('اختاري الطالبات', 'err');
    let remind = null; if (due && $('#cmRRem').checked) { const d = parse(due); d.setHours(7, 0, 0, 0); remind = d.getTime(); }
    el.disabled = true;
    try { const r = await cmApi('send', { method: 'POST', body: JSON.stringify({ kind: 'req', title, body, due: due || null, remind, to: cmSTarget(), grp: 'student', from: cmFrom() }) }); toast(`📤 أُرسل الطلب إلى ${r.n} طالبة`, 'ok'); await cmLoad(true); }
    catch (e) { toast(e.message, 'err'); el.disabled = false; }
  },
  cmNSend: async (el) => {
    const title = $('#cmNTitle').value.trim(), body = $('#cmNBody').value.trim(), d = $('#cmNDate').value, tm = $('#cmNTime').value || '07:00', now = $('#cmNNow').checked;
    if (!body) return toast('اكتبي الرسالة', 'err');
    if (!cmSCount()) return toast('اختاري الطالبات', 'err');
    let remind = null; if (d) { const x = parse(d); const [h, mi] = tm.split(':').map(Number); x.setHours(h || 7, mi || 0, 0, 0); remind = x.getTime(); if (remind <= Date.now()) return toast('وقت التذكير مضى، اختاري وقتاً لاحقاً', 'err'); }
    if (!remind && !now) return toast('اختاري يوم التذكير أو «إرسالها الآن»', 'err');
    el.disabled = true;
    try { const r = await cmApi('send', { method: 'POST', body: JSON.stringify({ kind: 'note', title, body, remind, now, to: cmSTarget(), grp: 'student', from: cmFrom() }) }); toast(remind && !now ? `🔔 سيصل التذكير إلى ${r.n} طالبة في موعده` : `📤 أُرسلت إلى ${r.n} طالبة`, 'ok'); await cmLoad(true); }
    catch (e) { toast(e.message, 'err'); el.disabled = false; }
  },
  cmRView: (el, e) => { if (e.target.closest('[data-act=cmSentDel]')) return; cmReqModal(Number(el.dataset.id)); },
  cmROk: async (el) => { try { await cmApi(`sent/${el.dataset.id}/ok`, { method: 'POST', body: JSON.stringify({ user: el.dataset.u, ok: el.dataset.ok === '1' }) }); await cmReqModal(Number(el.dataset.id)); cmLoad(true); } catch (e) { toast(e.message, 'err'); } },
  cmROkAll: async (el) => { const ids = (modalCtx?.rows || []).filter((x) => x.done_at && !x.ok_at).map((x) => x.id); try { await cmApi(`sent/${el.dataset.id}/ok`, { method: 'POST', body: JSON.stringify({ users: ids, ok: true }) }); await cmReqModal(Number(el.dataset.id)); cmLoad(true); } catch (e) { toast(e.message, 'err'); } },
  cmRPrint: () => { const c = modalCtx; if (!c?.rows) return; printDoc(c.title, `${letterhead()}<h2 style="text-align:center">متابعة: ${esc(c.title)}</h2><table><tbody><tr><td><b>م</b></td><td><b>الطالبة</b></td><td><b>الفصل</b></td><td><b>الحالة</b></td></tr>${c.rows.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${esc(x.cls || '')}</td><td>${x.ok_at ? 'استُلم' : x.done_at ? 'أبلغت ولم يُستلم' : 'لم تُنجز'}</td></tr>`).join('')}</tbody></table>`); },
  cmDmOpen: async (el) => { CM.dmUid = el.dataset.id; CM.dm = []; render(); try { CM.dm = (await cmApi('dm/' + CM.dmUid)).items || []; } catch (e) { toast(e.message, 'err'); } cmMarkDm(); render(); },
  cmDmSend: async (el) => {
    const t = $('#cmDmIn').value.trim(); if (!t || !CM.dmUid) return;
    el.disabled = true;
    try { await cmApi('dm/' + CM.dmUid, { method: 'POST', body: JSON.stringify({ body: t, from: cmFrom() }) }); $('#cmDmIn').value = ''; CM.dm = (await cmApi('dm/' + CM.dmUid)).items || []; render(); } catch (e) { toast(e.message, 'err'); }
    el.disabled = false;
  },
});
Object.assign(CHANGES, {
  cmSCls: (el) => { el.checked ? CM.sCls.add(el.dataset.id) : CM.sCls.delete(el.dataset.id); render(); },
  cmSPick: (el) => { el.checked ? CM.sPick.add(el.dataset.id) : CM.sPick.delete(el.dataset.id); render(); },
});
