// ═════════════ 📲 تطبيق التواصل: إدارة المعلمات والإداريات من البرنامج الرئيسي (1.5.0) ═════════════
// تطبيق مستقل للمنسوبات (…/staff/) يستقبل الرسائل والإشعارات، وفيه محادثة داخلية بصلاحية تمنحها الأستاذة وتسحبها.
// يعتمد على خادم المزامنة المشفّرة (قاعدة D1)، وكلمة عبور القناة هي صلاحية الإدارة.
// المحتوى هنا (الرسائل والأسماء) يُحفظ في قاعدة الخادم غير مشفّر من الطرفين، فلا تُرسل عبره بيانات طالبات حساسة.
const CM = { tab: 'req', users: [], sent: [], chat: [], loading: false, at: 0, err: '', sum: { pending: 0, chatLast: 0 }, notified: { pending: 0, chat: 0 }, to: 'all', pick: new Set() };
const STAFF_BASE = 'https://khaleljo55.github.io/madrasa-assistant/staff/';
const CM_ROLE = { teacher: 'معلمة', admin: 'إدارية' };
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
const cmLink = () => {
  let base = STAFF_BASE;
  if (IS_WEBAPP && /^https?:/.test(location.protocol)) base = new URL('staff/', location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '')).href;
  return `${base}#s=${RELAY.id}&r=${encodeURIComponent(RELAY.cfg.url)}&n=${encodeURIComponent(db.settings.schoolName || '')}`;
};
async function cmLoad(force) {
  if (!cmReady() || CM.loading || (!force && Date.now() - CM.at < 15000)) return;
  CM.loading = true;
  try {
    const [u, s, c, sum] = await Promise.all([cmApi('users'), cmApi('sent'), cmApi('chat'), cmApi('summary')]);
    CM.users = u.users || []; CM.sent = s.items || []; CM.chat = c.items || []; CM.sum = sum; CM.err = ''; CM.at = Date.now();
    if (CM.tab === 'chat') cmMarkChat();
  } catch (e) { CM.err = e.message; CM.at = Date.now(); }
  CM.loading = false;
  if (ui.view === 'comms') { const ta = $('#cmChatIn')?.value; render(); if (ta) { const t = $('#cmChatIn'); if (t) t.value = ta; } }
  else renderNav();
}
function cmMarkChat() { const last = CM.chat.filter((m) => !m.mine).reduce((a, m) => Math.max(a, m.id), 0); if (last > cmSeenChat()) { db.settings.commsSeenChat = last; commit(false); } }
const cmBadge = () => (cmReady() ? (CM.sum.pending || 0) + (CM.sum.chatLast > cmSeenChat() ? 1 : 0) : 0);

NAV.push({ id: 'comms', ic: '📲', label: 'تطبيق التواصل', badge: cmBadge });
VIEWS.comms = {
  render() {
    if (!cmReady()) return `<div class="card"><h3>📲 تطبيق التواصل للمعلمات والإداريات</h3><div class="muted" style="margin-bottom:12px">تطبيق بسيط على جوال كل معلمة وإدارية، تصلهن فيه رسائلكِ وإشعاراتكِ مباشرة بدل البريد والرسائل النصية، مع محادثة داخلية لمن تختارين.</div>
      <div class="banner"><span class="big">🔐</span><div>يعمل بعد تفعيل «المزامنة المشفّرة» من الإعدادات.</div><span class="spacer"></span><button class="btn primary" data-act="setGo" data-id="sync">فتح الإعدادات</button></div></div>`;
    setTimeout(() => cmLoad(false), 0);
    const pend = CM.users.filter((u) => u.status === 'pending'), act = CM.users.filter((u) => u.status !== 'pending');
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
      const active = CM.users.filter((u) => u.status === 'active');
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
    return `<div class="seg" style="margin-bottom:14px;flex-wrap:wrap">${tabs.map(([k, l, n]) => `<button class="${CM.tab === k ? 'on' : ''}" data-act="cmTab" data-id="${k}">${l}${n ? ` <span class="badge">${n}</span>` : ''}</button>`).join('')}</div>${body}`;
  },
  actions: () => (cmReady() ? `<button class="btn" data-act="cmReload">🔄 تحديث</button>` : ''),
};
function cmCount() { const a = CM.users.filter((u) => u.status === 'active'); return CM.to === 'all' ? a.length : CM.to === 'pick' ? a.filter((u) => CM.pick.has(u.id)).length : a.filter((u) => u.role === CM.to).length; }
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
  cmCopy: async () => { try { await navigator.clipboard.writeText(cmLink()); toast('نُسخ الرابط ✓', 'ok'); } catch { $('#cmLinkBox')?.select(); toast('حدّدي الرابط وانسخيه'); } },
  cmWa: () => api.openUrl('https://wa.me/?text=' + encodeURIComponent(`السلام عليكم، هذا رابط تطبيق «تواصل المدرسة» لاستقبال رسائل الإدارة وإشعاراتها:\n${cmLink()}\n\nافتحيه من الجوال، وأضيفيه إلى الشاشة الرئيسية، ثم «تسجيل جديد».`)),
  cmMailT: () => {
    const to = (db.teachers || []).map((t) => t.email).filter(Boolean).join(',');
    api.openUrl(`https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(to)}&su=${encodeURIComponent('تطبيق تواصل المدرسة')}&body=${encodeURIComponent(`السلام عليكم ورحمة الله\n\nنرجو تسجيلكِ في تطبيق «تواصل المدرسة» لتصلكِ رسائل الإدارة وإشعاراتها مباشرة على جوالكِ:\n${cmLink()}\n\n1. افتحي الرابط من الجوال (Safari في الآيفون).\n2. أضيفيه إلى الشاشة الرئيسية.\n3. افتحيه من الأيقونة ← «تسجيل جديد».\n4. بعد القبول: «حسابي» ← «تفعيل الإشعارات».\n\n${cmFrom()}`)}`);
  },
});
Object.assign(CHANGES, {
  cmChat: (el) => { const u = cmUser(el.dataset.id); cmUpdate(u.id, { chat: el.checked }, el.checked ? `💬 ${u.name} ترى المحادثة الآن` : `أُخفيت المحادثة عن ${u.name}`); },
  cmPick: (el) => { el.checked ? CM.pick.add(el.dataset.id) : CM.pick.delete(el.dataset.id); render(); },
});
// متابعة الطلبات والمحادثة في الخلفية، وهدهد تنبّه
async function cmPoll() {
  if (!db || !cmReady() || document.hidden) return;
  try {
    const s = await cmApi('summary'); CM.sum = s;
    const newChat = s.chatLast > cmSeenChat() && s.chatLast > CM.notified.chat && !(ui.view === 'comms' && CM.tab === 'chat');
    if (s.pending > CM.notified.pending && typeof hudKnock === 'function') hudKnock(`وصل ${s.pending === 1 ? 'طلب عضوية جديد' : s.pending + ' طلبات عضوية'} في تطبيق التواصل 📲`, '<button class="btn sm primary" data-act="cmOpen" data-id="req">افتحيها</button>');
    else if (newChat && typeof hudSay === 'function') hudSay('رسالة جديدة في المحادثة الداخلية 💬', { pose: 2, acts: '<button class="btn sm primary" data-act="cmOpen" data-id="chat">افتحيها</button>' });
    CM.notified = { pending: Math.max(CM.notified.pending, s.pending), chat: Math.max(CM.notified.chat, s.chatLast) };
    if (s.pending < CM.notified.pending) CM.notified.pending = s.pending;
    if (ui.view === 'comms') cmLoad(false); else renderNav();
  } catch { }
}
ACTIONS.cmOpen = (el) => { CM.tab = el.dataset.id; hudHideBubble?.(); go('comms'); if (CM.tab === 'chat') cmMarkChat(); cmLoad(true); };
(function cmStart() { if (!db || typeof RELAY === 'undefined') return setTimeout(cmStart, 600); setTimeout(cmPoll, 25000); setInterval(cmPoll, 60000); })();
