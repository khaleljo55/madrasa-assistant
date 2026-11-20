// ═════════════ 🏷️ عناوين المنظومة (1.12.0) ═════════════
// كل الروابط العامة باسم البرنامج «Madrasa Assistant» دون أسماء أشخاص:
// - صفحات الجوال والتواصل والاستبيانات: https://madrasa-assistant.github.io/app/
// - خادم المزامنة: https://madrasa-sync.madrasa-assistant.workers.dev
// الانتقال من العناوين القديمة تلقائي: يُجرَّب الجديد أولاً، ويُستخدم القديم ما دام الجديد لم يعمل بعد،
// فلا يتوقف شيء أثناء النقل، ولا تحتاج البيانات أو الحساب إلى أي تغيير.
const BRAND = {
  pages: 'https://madrasa-assistant.github.io/app/',
  relayFrom: /\.khaleljo55-519\.workers\.dev$/i, // العنوان القديم
  relayTo: '.madrasa-assistant.workers.dev',
};
const RL_BEST = new Map();
async function rlBestUrl(u) {
  u = String(u || '').replace(/\/+$/, ''); if (!u) return u;
  let alt = '';
  try { const x = new URL(u); if (BRAND.relayFrom.test(x.hostname)) { x.hostname = x.hostname.replace(BRAND.relayFrom, BRAND.relayTo); alt = x.origin; } } catch { }
  if (!alt) return u;
  if (RL_BEST.has(u)) return RL_BEST.get(u);
  const ok = async (c) => { try { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000); const r = await fetch(c + '/', { cache: 'no-store', signal: ctl.signal }); clearTimeout(t); return r.ok && (await r.json()).app === 'madrasa-sync'; } catch { return false; } };
  if (await ok(alt)) { RL_BEST.set(u, alt); return alt; }
  if (await ok(u)) RL_BEST.set(u, u); // الجديد لم يعمل بعد: نبقى على القديم في هذه الجلسة
  return u;
}
// رابط عام لصفحة من صفحات المنظومة (في الاختبار المحلي: من العنوان الحالي)
const brandLink = (dir) => (IS_LOCALHOST() ? new URL(dir + '/', location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '')).href : BRAND.pages + dir + '/');
function IS_LOCALHOST() { return /^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); }
