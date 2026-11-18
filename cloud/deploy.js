// تجهيز خادم المزامنة المشفّرة على Cloudflare (مجاني) — يُشغَّل من Setup-Cloud-Sync.bat
// الخطوات: تسجيل الدخول إلى Cloudflare في المتصفح ← إنشاء مخزن KV ← نشر الخادم ← حفظ رابطه في school.config.json
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const DIR = __dirname, ROOT = path.join(__dirname, '..');
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const WR = ['--yes', 'wrangler@4'];

function run(args, { capture = false, quiet = false } = {}) {
  return new Promise((resolve) => {
    const p = spawn(NPX, [...WR, ...args], { cwd: DIR, shell: process.platform === 'win32', stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
    let out = '';
    if (capture) {
      p.stdout.on('data', (d) => { out += d; if (!quiet) process.stdout.write(d); });
      p.stderr.on('data', (d) => { out += d; if (!quiet) process.stderr.write(d); });
    }
    p.on('close', (code) => resolve({ code, out }));
  });
}
const step = (n, t) => console.log(`\n[${n}/4] ${t}`);
const fail = (t) => { console.log('\n  ✗ ' + t + '\n'); process.exit(1); };

(async () => {
  step(1, 'تسجيل الدخول إلى Cloudflare (ستُفتح صفحة في المتصفح: اضغط Allow)');
  let who = await run(['whoami'], { capture: true, quiet: true });
  const authed = (o) => o.code === 0 && /associated with the email|You are logged in/i.test(o.out);
  if (!authed(who)) {
    const r = await run(['login']);
    if (r.code !== 0) fail('لم يكتمل تسجيل الدخول. أعد تشغيل الأداة.');
    who = await run(['whoami'], { capture: true, quiet: true });
    if (!authed(who)) fail('لم يكتمل تسجيل الدخول. أعد تشغيل الأداة.');
  }
  console.log('  ✓ تم تسجيل الدخول');

  step(2, 'تجهيز مخزن البيانات المشفّرة (KV)');
  const idFile = path.join(DIR, 'kv-id.txt');
  let kvId = fs.existsSync(idFile) ? fs.readFileSync(idFile, 'utf8').trim() : '';
  if (!/^[0-9a-f]{32}$/.test(kvId)) {
    const c = await run(['kv', 'namespace', 'create', 'madrasa_sync'], { capture: true, quiet: true });
    kvId = (c.out.match(/"?id"?\s*[:=]\s*"([0-9a-f]{32})"/) || [])[1] || '';
    if (!kvId) {
      const l = await run(['kv', 'namespace', 'list'], { capture: true, quiet: true });
      try { const arr = JSON.parse(l.out.slice(l.out.indexOf('['), l.out.lastIndexOf(']') + 1)); kvId = (arr.find((n) => /madrasa_sync/.test(n.title)) || {}).id || ''; } catch { }
    }
    if (!kvId) { console.log(c.out); fail('تعذّر إنشاء مخزن KV.'); }
    fs.writeFileSync(idFile, kvId);
  }
  fs.writeFileSync(path.join(DIR, 'wrangler.toml'), `name = "madrasa-sync"
main = "worker.js"
compatibility_date = "2025-06-01"
workers_dev = true

[[kv_namespaces]]
binding = "DATA"
id = "${kvId}"

[vars]
MAX_CHANNELS = "5"
`);
  console.log('  ✓ المخزن جاهز');

  step(3, 'نشر الخادم (إن سُئلت عن اسم نطاق workers.dev فاكتب اسماً بالإنجليزية واضغط Enter)');
  let d, url;
  for (let i = 0; i < 3 && !url; i++) { // أول نشر في حساب جديد قد يفشل مؤقتاً عند Cloudflare
    if (i) { console.log('  … إعادة المحاولة بعد 20 ثانية'); await new Promise((r) => setTimeout(r, 20000)); }
    d = await run(['deploy'], { capture: true });
    url = d.code === 0 && (d.out.match(/https:\/\/madrasa-sync\.[a-z0-9-]+\.workers\.dev/i) || [])[0];
    if (/register a workers\.dev subdomain/i.test(d.out)) fail('يلزم اختيار اسم workers.dev مرة واحدة: افتح https://dash.cloudflare.com ← Compute ← Workers & Pages ← Create application ← Hello World ← Deploy، ثم أعد تشغيل الأداة.');
  }
  if (!url) fail('لم يكتمل النشر. صوّر هذه النافذة وأرسلها.');

  step(4, 'التحقق من الخادم وحفظ رابطه');
  let ok = false;
  for (let i = 0; i < 10 && !ok; i++) {
    try { const r = await fetch(url + '/'); ok = r.ok && (await r.json()).app === 'madrasa-sync'; } catch { }
    if (!ok) await new Promise((r) => setTimeout(r, 3000));
  }
  const cfgFile = path.join(ROOT, 'school.config.json');
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch { }
  cfg.syncRelay = url;
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
  fs.writeFileSync(path.join(DIR, 'relay-url.txt'), url);
  console.log(`  ${ok ? '✓ الخادم يعمل' : '⚠ لم يستجب الخادم بعد (قد يحتاج دقيقة)'}: ${url}`);
  console.log('  ✓ حُفظ الرابط في school.config.json، وسيُضاف تلقائياً إلى ملف التثبيت القادم.');
})();
