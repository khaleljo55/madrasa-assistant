// إرسال الرسائل النصية من العملية الرئيسية (1.0.9)
// - الإعدادات في ملف خاص بالجهاز داخل userData، والمفاتيح السرية مشفّرة بـ safeStorage (حماية ويندوز DPAPI).
// - الواجهة لا تستلم المفاتيح أبداً؛ تعرف فقط إن كانت محفوظة.
// - لا تدخل الإعدادات في المزامنة ولا في النسخ الاحتياطية ولا في GitHub.
const fs = require('fs');
const path = require('path');

const SECRET_KEYS = ['token', 'appSid', 'password', 'apiKey', 'apiSecret', 'customAuth'];
const PROVIDERS = ['none', 'taqnyat', 'unifonic', 'jawaly', 'smsgate', 'custom', 'manual'];

module.exports = function setupSms({ app, ipcMain, net, safeStorage }) {
  const file = () => path.join(app.getPath('userData'), 'sms-settings.json');
  const enc = (s) => (safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(String(s)).toString('base64') : 'raw:' + Buffer.from(String(s)).toString('base64'));
  const dec = (s) => { if (!s) return ''; const [k, v] = [s.slice(0, 4), s.slice(4)]; return k === 'enc:' ? safeStorage.decryptString(Buffer.from(v, 'base64')) : Buffer.from(v, 'base64').toString(); };
  const load = () => { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return { provider: 'none' }; } };
  const save = (c) => { fs.writeFileSync(file() + '.tmp', JSON.stringify(c)); fs.renameSync(file() + '.tmp', file()); };
  const pub = (c) => { const o = { ...c }; SECRET_KEYS.forEach((k) => { o['has_' + k] = !!c[k]; delete o[k]; }); return o; };
  const secret = (c, k) => { try { return dec(c[k]); } catch { return ''; } };

  ipcMain.handle('sms:get', () => pub(load()));
  ipcMain.handle('sms:set', (_e, patch) => {
    const c = load();
    if (patch.provider && !PROVIDERS.includes(patch.provider)) throw new Error('مزوّد غير معروف');
    Object.entries(patch || {}).forEach(([k, v]) => {
      if (SECRET_KEYS.includes(k)) { if (v === null) delete c[k]; else if (v) c[k] = enc(v); } // قيمة فارغة = إبقاء المحفوظ
      else c[k] = v;
    });
    save(c); return pub(c);
  });

  const asJson = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; } };
  const fail = (e) => ({ ok: false, error: String(e?.message || e).slice(0, 200) });
  const basic = (u, p) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
  const smsGateBase = (c) => (c.gateMode === 'local' ? `http://${String(c.gateHost || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')}` : 'https://api.sms-gate.app');

  // إرسال رسالة واحدة (نص واحد لمستلم أو أكثر). الأرقام بصيغة دولية بلا + (9665xxxxxxxx)
  async function sendOne(c, numbers, text) {
    const p = c.provider;
    try {
      if (p === 'taqnyat') {
        const r = await net.fetch('https://api.taqnyat.sa/v1/messages', { method: 'POST', headers: { Authorization: 'Bearer ' + secret(c, 'token'), 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: c.sender, recipients: numbers, body: text }) });
        const j = await asJson(r);
        return r.ok && (j.statusCode === 201 || j.statusCode === 200 || /success/i.test(j.status || '') || j.messageId) ? { ok: true, id: String(j.messageId || j.message?.id || ''), cost: j.cost } : { ok: false, error: j.message || j.raw || 'HTTP ' + r.status };
      }
      if (p === 'unifonic') {
        const out = [];
        for (const n of numbers) {
          const q = new URLSearchParams({ AppSid: secret(c, 'appSid'), SenderID: c.sender, Body: text, Recipient: n, responseType: 'JSON' });
          const r = await net.fetch('https://el.cloud.unifonic.com/rest/SMS/messages', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: q.toString() });
          const j = await asJson(r);
          out.push(r.ok && (j.success === true || j.success === 'true') ? { ok: true, id: String(j.data?.MessageID || '') } : { ok: false, error: j.message || j.errorCode || j.raw || 'HTTP ' + r.status });
        }
        return out.every((x) => x.ok) ? out[0] : out.find((x) => !x.ok);
      }
      if (p === 'jawaly') {
        const r = await net.fetch(c.jawalyUrl || 'https://api-sms.4jawaly.com/api/v1/account/area/sms/send', { method: 'POST', headers: { Authorization: basic(secret(c, 'apiKey'), secret(c, 'apiSecret')), 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ messages: [{ text, numbers, sender: c.sender }] }) });
        const j = await asJson(r);
        return r.ok && (j.code === 200 || j.job_id || j.messages) ? { ok: true, id: String(j.job_id || '') } : { ok: false, error: j.message || j.raw || 'HTTP ' + r.status };
      }
      if (p === 'smsgate') {
        const r = await net.fetch(smsGateBase(c) + '/3rdparty/v1/messages', { method: 'POST', headers: { Authorization: basic(c.gateUser || '', secret(c, 'password')), 'Content-Type': 'application/json' }, body: JSON.stringify({ textMessage: { text }, phoneNumbers: numbers.map((n) => '+' + n), ...(c.gateSim ? { simNumber: +c.gateSim } : {}) }) });
        const j = await asJson(r);
        return r.ok ? { ok: true, id: String(j.id || '') } : { ok: false, error: j.message || j.error || j.raw || 'HTTP ' + r.status };
      }
      if (p === 'custom') {
        if (!/^https:\/\//i.test(c.customUrl || '')) return { ok: false, error: 'رابط المزوّد يجب أن يبدأ بـ https://' };
        const fill = (s) => String(s || '').replace(/\{to\}/g, numbers.join(',')).replace(/\{to_json\}/g, JSON.stringify(numbers)).replace(/\{text\}/g, JSON.stringify(text).slice(1, -1)).replace(/\{sender\}/g, c.sender || '').replace(/\{key\}/g, secret(c, 'customAuth'));
        const headers = { 'Content-Type': c.customType || 'application/json' };
        if (c.customHeader) headers[c.customHeader] = fill(c.customHeaderValue || '{key}');
        const r = await net.fetch(fill(c.customUrl), { method: 'POST', headers, body: fill(c.customBody) });
        const j = await asJson(r);
        return r.ok ? { ok: true, id: '' } : { ok: false, error: j.message || j.raw || 'HTTP ' + r.status };
      }
      return { ok: false, error: 'لم تُضبط خدمة الرسائل' };
    } catch (e) { return fail(e); }
  }

  ipcMain.handle('sms:send', async (_e, list) => {
    const c = load(); const results = [];
    if (!Array.isArray(list) || !list.length) return results;
    if (list.length > 2000) throw new Error('الحد 2000 رسالة في المرة');
    // تجميع الرسائل المتطابقة النص لتقليل الطلبات
    const groups = new Map();
    list.forEach((m, i) => { const k = m.text; if (!groups.has(k)) groups.set(k, []); groups.get(k).push({ ...m, i }); });
    for (const [text, items] of groups) {
      for (let s = 0; s < items.length; s += 50) {
        const chunk = items.slice(s, s + 50);
        const r = await sendOne(c, chunk.map((x) => x.to), text);
        chunk.forEach((x) => (results[x.i] = { to: x.to, ...r }));
        await new Promise((res) => setTimeout(res, c.provider === 'smsgate' ? 400 : 150));
      }
    }
    return results;
  });

  ipcMain.handle('sms:balance', async () => {
    const c = load();
    try {
      if (c.provider === 'taqnyat') { const r = await net.fetch('https://api.taqnyat.sa/account/balance', { headers: { Authorization: 'Bearer ' + secret(c, 'token') } }); const j = await asJson(r); return r.ok ? { ok: true, text: `${j.balance ?? j.points ?? '—'} ${j.currency || ''}`.trim() } : { ok: false, error: j.message || 'HTTP ' + r.status }; }
      if (c.provider === 'smsgate') { const r = await net.fetch(smsGateBase(c) + '/3rdparty/v1/devices', { headers: { Authorization: basic(c.gateUser || '', secret(c, 'password')) } }); const j = await asJson(r); return r.ok ? { ok: true, text: Array.isArray(j) ? `متصل · ${j.length} جهاز` : 'متصل' } : { ok: false, error: j.message || 'HTTP ' + r.status }; }
      return { ok: true, text: 'راجعي الرصيد من لوحة المزوّد' };
    } catch (e) { return fail(e); }
  });
};
// للاختبار
module.exports.SECRET_KEYS = SECRET_KEYS;
