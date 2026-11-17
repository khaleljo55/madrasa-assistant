// إرسال النسخة الاحتياطية بالبريد من العملية الرئيسية (1.1.0)
// - التجهيز: تُضغط النسخة (gzip) في «المستندات/المساعد الإداري/نسخ للإرسال» ويُحتفظ بآخر 7.
// - الإرسال التلقائي (اختياري): عبر Gmail بكلمة مرور التطبيقات، محفوظة مشفّرة بـ safeStorage في هذا الجهاز فقط
//   (لا تدخل المزامنة ولا النسخ الاحتياطية ولا GitHub، ولا تصل إلى الواجهة أبداً).
// - بدون إرسال تلقائي: يُظهر البرنامج الملف في مجلده ويفتح رسالة Gmail جاهزة لإرفاقه.
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const net = require('net');
const zlib = require('zlib');

const SEND_RE = /^نسخة-\d{4}-\d{2}-\d{2}(-بيانات)?\.json\.gz$/;

// ───── عميل SMTP صغير (Gmail: smtp.gmail.com:465 عبر TLS) ─────
function smtpSession({ host, port, secure, user, pass }, steps) {
  return new Promise((resolve, reject) => {
    const sock = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    let buf = '', waiter = null, done = false;
    const finish = (err, val) => { if (done) return; done = true; clearTimeout(timer); try { sock.end(); } catch { } err ? reject(err) : resolve(val); };
    const timer = setTimeout(() => finish(new Error('انتهت مهلة الاتصال بخادم البريد')), 120000);
    sock.setEncoding('utf8');
    sock.on('error', (e) => finish(new Error(/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT/.test(e.code || '') ? 'لا يوجد اتصال بخادم البريد' : e.message)));
    sock.on('data', (d) => {
      buf += d;
      const lines = buf.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) { const reply = lines.slice(0, i + 1).join('\n'); buf = lines.slice(i + 1).join('\r\n'); const w = waiter; waiter = null; w && w(reply); return; }
      }
    });
    const read = () => new Promise((r) => { waiter = r; });
    const cmd = async (line, expect) => {
      if (line != null) sock.write(line + '\r\n');
      const reply = await read();
      if (!String(reply).startsWith(String(expect))) {
        const code = reply.slice(0, 3);
        throw new Error(code === '535' || code === '534' ? 'البريد أو كلمة مرور التطبيقات غير صحيحة' : 'رفض خادم البريد: ' + reply.split('\n').pop().slice(0, 160));
      }
      return reply;
    };
    (async () => {
      await cmd(null, 220);
      await cmd('EHLO madrasa-assistant', 250);
      await cmd('AUTH PLAIN ' + Buffer.from(`\0${user}\0${pass}`).toString('base64'), 235);
      const r = await steps(cmd, sock);
      try { sock.write('QUIT\r\n'); } catch { }
      finish(null, r);
    })().catch((e) => finish(e));
  });
}
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const encWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n');
function buildMessage({ from, fromName, to, subject, text, attachment }) {
  const boundary = 'mb_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const head = [
    `From: ${encWord(fromName || 'المساعد الإداري')} <${from}>`,
    `To: <${to}>`,
    `Subject: ${encWord(subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@madrasa-assistant>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].join('\r\n');
  const parts = [
    `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(text))}`,
  ];
  if (attachment) {
    const n = attachment.name;
    parts.push(`--${boundary}\r\nContent-Type: application/gzip; name="${encWord(n)}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(n)}\r\n\r\n${wrap76(attachment.data.toString('base64'))}`);
  }
  return `${head}\r\n\r\n${parts.join('\r\n')}\r\n--${boundary}--\r\n`;
}

module.exports = function setupMail({ app, ipcMain, safeStorage, shell }) {
  const file = () => path.join(app.getPath('userData'), 'mail-settings.json');
  const enc = (s) => (safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(String(s)).toString('base64') : 'raw:' + Buffer.from(String(s)).toString('base64'));
  const dec = (s) => { if (!s) return ''; const [k, v] = [s.slice(0, 4), s.slice(4)]; return k === 'enc:' ? safeStorage.decryptString(Buffer.from(v, 'base64')) : Buffer.from(v, 'base64').toString(); };
  const load = () => { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return {}; } };
  const save = (c) => { fs.writeFileSync(file() + '.tmp', JSON.stringify(c)); fs.renameSync(file() + '.tmp', file()); };
  const pub = (c) => ({ user: c.user || '', hasPass: !!c.pass });
  const sendDir = () => path.join(app.getPath('documents'), 'المساعد الإداري', 'نسخ للإرسال');
  // للاختبار فقط: خادم بريد محلي بلا TLS
  const server = () => { const t = process.env.MADRASA_SMTP_TEST; if (t) { const [h, p] = t.split(':'); return { host: h, port: Number(p), secure: false }; } return { host: 'smtp.gmail.com', port: 465, secure: true }; };
  const creds = () => { const c = load(); let pass = ''; try { pass = dec(c.pass).replace(/\s+/g, ''); } catch { } return { user: c.user || '', pass }; };
  const fail = (e) => ({ ok: false, error: String(e?.message || e).slice(0, 220) });

  ipcMain.handle('bkmail:get', () => pub(load()));
  ipcMain.handle('bkmail:set', (_e, patch = {}) => {
    const c = load();
    if (patch.user !== undefined) { const u = String(patch.user || '').trim().toLowerCase(); if (u && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) throw new Error('البريد غير صحيح'); c.user = u; }
    if (patch.pass === null) delete c.pass; else if (patch.pass) c.pass = enc(String(patch.pass));
    save(c); return pub(c);
  });
  ipcMain.handle('bkmail:test', async () => {
    const { user, pass } = creds();
    if (!user || !pass) return { ok: false, error: 'أدخلي بريد Gmail وكلمة مرور التطبيقات' };
    try { await smtpSession({ ...server(), user, pass }, async () => true); return { ok: true }; } catch (e) { return fail(e); }
  });
  // تجهيز ملف النسخة المضغوط للإرسال
  ipcMain.handle('bkmail:prepare', (_e, day, text, dataOnly) => {
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) throw new Error('تاريخ غير صحيح');
      const dir = sendDir(); fs.mkdirSync(dir, { recursive: true });
      const name = `نسخة-${day}${dataOnly ? '-بيانات' : ''}.json.gz`, f = path.join(dir, name);
      fs.writeFileSync(f + '.tmp', zlib.gzipSync(Buffer.from(String(text), 'utf8'), { level: 9 })); fs.renameSync(f + '.tmp', f);
      fs.readdirSync(dir).filter((n) => SEND_RE.test(n)).sort().reverse().slice(7).forEach((n) => { try { fs.unlinkSync(path.join(dir, n)); } catch { } });
      return { ok: true, path: f, name, size: fs.statSync(f).size };
    } catch (e) { return fail(e); }
  });
  const inSendDir = (p) => { const r = path.resolve(String(p)); return r.startsWith(sendDir() + path.sep) && SEND_RE.test(path.basename(r)) && fs.existsSync(r); };
  ipcMain.handle('bkmail:reveal', (_e, p) => { if (!inSendDir(p)) return false; shell.showItemInFolder(path.resolve(p)); return true; });
  ipcMain.handle('bkmail:send', async (_e, { to, subject, text, path: p, fromName } = {}) => {
    const { user, pass } = creds();
    if (!user || !pass) return { ok: false, error: 'الإرسال التلقائي غير مُعدّ' };
    const rcpt = String(to || user).trim();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(rcpt)) return { ok: false, error: 'بريد المستلم غير صحيح' };
    if (!inSendDir(p)) return { ok: false, error: 'ملف النسخة غير موجود' };
    const data = fs.readFileSync(path.resolve(p));
    if (data.length > 18 * 1024 * 1024) return { ok: false, error: 'حجم النسخة أكبر من حد Gmail (25 ميجابايت)' };
    const msg = buildMessage({ from: user, fromName, to: rcpt, subject: String(subject || 'نسخة احتياطية'), text: String(text || ''), attachment: { name: path.basename(p), data } });
    try {
      await smtpSession({ ...server(), user, pass }, async (cmd, sock) => {
        await cmd(`MAIL FROM:<${user}>`, 250);
        await cmd(`RCPT TO:<${rcpt}>`, 250);
        await cmd('DATA', 354);
        sock.write(msg.replace(/\r\n\./g, '\r\n..'));
        await cmd('\r\n.', 250);
      });
      return { ok: true, to: rcpt };
    } catch (e) { return fail(e); }
  });
};
module.exports.buildMessage = buildMessage;
module.exports.smtpSession = smtpSession;
