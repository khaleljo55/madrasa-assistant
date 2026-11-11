// ═════════════ 📈 الجداول والإحصائيات (1.0.5) ═════════════
// جدول مدمج يشبه Excel (معادلات، لصق من Excel، ترتيب) + استيراد ملفات Excel/CSV
// + منشئ رسوم بيانية ومؤشرات احترافية مرسومة SVG داخل البرنامج دون إنترنت.

(function addNavStats() {
  const org = NAV_TREE.find((x) => x.group === 'org');
  const i = org.items.findIndex((x) => x.id === 'report');
  org.items.splice(i >= 0 ? i + 1 : org.items.length, 0, { id: 'stats', ic: '📈', label: 'الجداول والإحصائيات' });
  NAV.length = 0; NAV.push(...NAV_TREE.flatMap((n) => (n.items ? n.items : [n])));
})();
addHook('beforeStart', () => { if (!Array.isArray(db.sheets)) db.sheets = []; });

const ST = { focus: null };
const ST_MAX_ROWS = 3000, ST_MAX_COLS = 60, ST_SHOW_ROWS = 400;
const curSheet = () => db.sheets.find((s) => s.id === ui.stId) || null;
const curChart = (s = curSheet()) => s && (s.charts.find((c) => c.id === ui.stChart) || s.charts[0]) || null;

// ───── الأرقام والمعادلات ─────
const stDigits = (v) => String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g, '.').replace(/٬/g, ',');
function stNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = stDigits(v).replace(/[,\s%]/g, '');
  if (!s || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  return Number(s);
}
const stFmt = (n) => (n == null || !Number.isFinite(n) ? '' : Math.abs(n) >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 1 }) : String(Math.round(n * 100) / 100));
const colIndex = (letters) => { let n = 0; for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const ST_FN = {
  SUM: (a) => a.reduce((s, x) => s + x, 0), AVERAGE: (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0), MIN: (a) => (a.length ? Math.min(...a) : 0), MAX: (a) => (a.length ? Math.max(...a) : 0),
  COUNT: (a) => a.length, ROUND: (a) => { const p = 10 ** (a[1] || 0); return Math.round(a[0] * p) / p; }, ABS: (a) => Math.abs(a[0]),
};
const ST_ALIAS = { AVG: 'AVERAGE', 'مجموع': 'SUM', 'المجموع': 'SUM', 'متوسط': 'AVERAGE', 'المتوسط': 'AVERAGE', 'أعلى': 'MAX', 'اعلى': 'MAX', 'أدنى': 'MIN', 'ادنى': 'MIN', 'عدد': 'COUNT', 'تقريب': 'ROUND' };
// يحسب قيمة خلية (رقم أو نص) مع دعم المعادلات وتفادي الحلقات
function stValue(sheet, r, c, seen = new Set()) {
  const raw = sheet.rows[r]?.[c] ?? '';
  if (typeof raw !== 'string' || raw[0] !== '=') return stNum(raw) ?? raw;
  const key = r + ':' + c; if (seen.has(key)) return '#دائري'; seen.add(key);
  try { const v = stEval(sheet, raw.slice(1), seen); seen.delete(key); return Number.isFinite(v) ? Math.round(v * 1e9) / 1e9 : '#خطأ'; } catch { seen.delete(key); return '#خطأ'; }
}
function stEval(sheet, src, seen) {
  const toks = stDigits(src).match(/\s*([A-Za-z]+\d+:[A-Za-z]+\d+|[A-Za-z]+\d+|\d+\.?\d*|\.\d+|[\p{L}_]+|[-+*/^(),%;:])\s*/gu)?.map((t) => t.trim()) || [];
  let i = 0;
  const peek = () => toks[i], next = () => toks[i++];
  const cellNum = (ref) => { const m = /^([A-Za-z]+)(\d+)$/.exec(ref); const v = stValue(sheet, +m[2] - 1, colIndex(m[1]), seen); if (typeof v === 'string' && v[0] === '#') throw new Error(v); return typeof v === 'number' ? v : 0; };
  const range = (ref) => {
    const [a, b] = ref.split(':'); const m1 = /^([A-Za-z]+)(\d+)$/.exec(a), m2 = /^([A-Za-z]+)(\d+)$/.exec(b);
    const r1 = Math.min(+m1[2], +m2[2]) - 1, r2 = Math.max(+m1[2], +m2[2]) - 1, c1 = Math.min(colIndex(m1[1]), colIndex(m2[1])), c2 = Math.max(colIndex(m1[1]), colIndex(m2[1]));
    const out = []; for (let r = r1; r <= Math.min(r2, sheet.rows.length - 1); r++) for (let c = c1; c <= c2; c++) { const v = stValue(sheet, r, c, seen); if (typeof v === 'number') out.push(v); else if (typeof v === 'string' && v[0] === '#') throw new Error(v); }
    return out;
  };
  const primary = () => {
    const t = next();
    if (t === undefined) throw new Error('end');
    if (t === '(') { const v = expr(); if (next() !== ')') throw new Error(')'); return v; }
    if (t === '-') return -primary();
    if (t === '+') return primary();
    if (/^\d|^\./.test(t)) return Number(t);
    if (/^[A-Za-z]+\d+$/.test(t) && peek() !== '(') return cellNum(t);
    const fn = ST_FN[ST_ALIAS[t] || ST_ALIAS[t.toUpperCase()] || t.toUpperCase()];
    if (fn && peek() === '(') {
      next(); const args = [];
      while (peek() !== ')') {
        if (peek() === undefined) throw new Error(')');
        if (/:/.test(peek() || '')) args.push(...range(next())); else args.push(expr());
        if (peek() === ',' || peek() === ';') next();
      }
      next(); return fn(args);
    }
    throw new Error('token ' + t);
  };
  const postfix = () => { let v = primary(); while (peek() === '%') { next(); v /= 100; } return v; };
  const power = () => { let v = postfix(); while (peek() === '^') { next(); v = v ** postfix(); } return v; };
  const term = () => { let v = power(); while (peek() === '*' || peek() === '/') { const op = next(), b = power(); if (op === '/' && b === 0) throw new Error('div0'); v = op === '*' ? v * b : v / b; } return v; };
  const expr = () => { let v = term(); while (peek() === '+' || peek() === '-') { const op = next(), b = term(); v = op === '+' ? v + b : v - b; } return v; };
  const v = expr(); if (i < toks.length) throw new Error('extra'); return v;
}
const stShown = (sheet, r, c) => { const v = stValue(sheet, r, c); return typeof v === 'number' ? stFmt(v) : String(v ?? ''); };
const stIsNumCol = (sheet, c) => { let n = 0, t = 0; for (let r = 1; r < sheet.rows.length; r++) { const v = stValue(sheet, r, c); if (v === '' || v == null) continue; t++; if (typeof v === 'number') n++; } return t > 0 && n / t >= 0.6; };
const stColsCount = (sheet) => Math.max(1, ...sheet.rows.map((r) => r.length));
const stNormalize = (sheet) => { const n = stColsCount(sheet); sheet.rows.forEach((r) => { while (r.length < n) r.push(''); }); };

// ───── قراءة Excel (كل الأوراق) ─────
async function readWorkbook(file) {
  if (/\.csv$/i.test(file.name)) return [{ name: file.name.replace(/\.[^.]+$/, ''), rows: await readSheetRows(file) }];
  if (/\.xls$/i.test(file.name)) throw new Error('صيغة xls القديمة غير مدعومة؛ احفظي الملف من Excel بصيغة xlsx ثم أعيدي الاستيراد');
  const Z = await loadZip(); const z = await Z.loadAsync(await file.arrayBuffer());
  const P = (x) => new DOMParser().parseFromString(x, 'application/xml');
  const txt = async (p) => (z.file(p) ? z.file(p).async('string') : null);
  const sharedXml = await txt('xl/sharedStrings.xml');
  const shared = sharedXml ? [...P(sharedXml).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join('')) : [];
  // تنسيقات النسبة المئوية لتحويل 0.24 إلى 24%
  const pctStyles = new Set();
  try {
    const st = P(await txt('xl/styles.xml')); const custom = {};
    [...st.getElementsByTagName('numFmt')].forEach((f) => (custom[f.getAttribute('numFmtId')] = f.getAttribute('formatCode')));
    const xfs = st.getElementsByTagName('cellXfs')[0]?.getElementsByTagName('xf') || [];
    [...xfs].forEach((xf, i) => { const id = xf.getAttribute('numFmtId'); if (id === '9' || id === '10' || /%/.test(custom[id] || '')) pctStyles.add(String(i)); });
  } catch { }
  const wb = P(await txt('xl/workbook.xml'));
  const rels = P(await txt('xl/_rels/workbook.xml.rels'));
  const target = (rid) => [...rels.getElementsByTagName('Relationship')].find((r) => r.getAttribute('Id') === rid)?.getAttribute('Target');
  const out = [];
  for (const s of [...wb.getElementsByTagName('sheet')]) {
    const t = target(s.getAttribute('r:id')); if (!t) continue;
    const xml = await txt(t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^xl\//, '')); if (!xml) continue;
    const sh = P(xml);
    const rows = [];
    [...sh.getElementsByTagName('row')].forEach((row) => {
      const ri = (+row.getAttribute('r') || rows.length + 1) - 1; if (ri >= ST_MAX_ROWS + 50) return;
      const line = [];
      [...row.getElementsByTagName('c')].forEach((c, k) => {
        const ref = c.getAttribute('r'); const ci = ref ? colIndex(ref.replace(/\d+/g, '')) : k; if (ci >= ST_MAX_COLS) return;
        const ty = c.getAttribute('t'); const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
        let val = ty === 's' ? shared[+v] : ty === 'inlineStr' ? [...c.getElementsByTagName('t')].map((x) => x.textContent).join('') : ty === 'b' ? (v === '1' ? 'نعم' : 'لا') : v;
        const isNum = !ty || ty === 'n', f = c.getElementsByTagName('f')[0]?.textContent;
        if (f && v === '' && !c.getElementsByTagName('f')[0].getAttribute('t')) val = '=' + f;
        else if (isNum && v !== '' && pctStyles.has(c.getAttribute('s') || '')) val = stFmt(Number(v) * 100) + '%';
        else if (isNum && v !== '' && /e|\.\d{6,}/i.test(v) && Number.isFinite(+v)) val = stFmt(+v);
        line[ci] = String(val ?? '').trim();
      });
      rows[ri] = Array.from(line, (x) => x ?? '');
    });
    const clean = Array.from(rows, (r) => r || []).filter((r) => r.some((x) => x));
    if (clean.length) out.push({ name: s.getAttribute('name') || 'ورقة', rows: clean });
  }
  return out;
}

// ───── إنشاء جدول ورسم افتراضي ─────
function stDefaultChart(sheet, type) {
  stNormalize(sheet);
  const n = stColsCount(sheet);
  const nums = [...Array(n).keys()].filter((c) => stIsNumCol(sheet, c));
  const label = [...Array(n).keys()].find((c) => !nums.includes(c)) ?? 0;
  let series = nums.filter((c) => c !== label).slice(0, 4);
  if (!series.length) series = [...Array(n).keys()].filter((c) => c !== label).slice(0, 4); // جدول جديد لم تُعبّأ أرقامه بعد
  return { id: uid(), title: sheet.title, subtitle: '', type: type || 'column', labelCol: label, series: series.length ? series : [Math.min(1, n - 1)], rows: null, sort: 'none', palette: 'school', values: true, legend: true };
}
function stAddSheet(title, rows, chartType, source = 'manual') {
  const s = { id: uid(), title, rows: rows.map((r) => r.map((x) => String(x ?? ''))), charts: [], source, updatedAt: new Date().toISOString() };
  if (s.rows.length > ST_MAX_ROWS + 1) s.rows.length = ST_MAX_ROWS + 1;
  if (s.rows[0] && s.rows[0].every((h) => stNum(h) != null)) s.rows.unshift(s.rows[0].map((_, i) => 'عمود ' + colName(i)));
  stNormalize(s);
  s.rows[0] = s.rows[0].map((h, i) => h || 'عمود ' + colName(i));
  s.charts.push(stDefaultChart(s, chartType));
  db.sheets.push(s); ui.stId = s.id; ui.stChart = s.charts[0].id;
  return s;
}
const ST_GRADES = ['الصف الأول', 'الصف الثاني', 'الصف الثالث', 'الصف الرابع', 'الصف الخامس', 'الصف السادس'];
function stFromApp(kind) {
  const [ys, ye] = typeof yearRange === 'function' ? yearRange() : ['0000-00-00', '9999-12-31'];
  const absYear = db.absences.filter((a) => a.date >= ys && a.date <= ye);
  if (kind === 'absType') {
    const m = {}; absYear.forEach((a) => { m[a.type] = (m[a.type] || 0) + (/تأخر|خروج/.test(a.type) ? 1 : workDays(a.date, a.dateTo)); });
    return ['الغياب حسب النوع (هذا العام)', [['النوع', 'العدد'], ...Object.entries(m).sort((a, b) => b[1] - a[1])], 'doughnut'];
  }
  if (kind === 'absTeacher') {
    const m = {}; absYear.filter((a) => !/تأخر|خروج/.test(a.type)).forEach((a) => { m[a.teacherId] = (m[a.teacherId] || 0) + workDays(a.date, a.dateTo); });
    return ['أيام غياب المعلمات (هذا العام)', [['المعلمة', 'أيام الغياب'], ...Object.entries(m).sort((a, b) => b[1] - a[1]).map(([id, n]) => [tName(id), n])], 'bar'];
  }
  if (kind === 'absMonth') {
    const m = {}; absYear.filter((a) => !/تأخر|خروج/.test(a.type)).forEach((a) => { const k = a.date.slice(0, 7); m[k] = (m[k] || 0) + workDays(a.date, a.dateTo); });
    return ['أيام الغياب حسب الشهر', [['الشهر', 'أيام الغياب'], ...Object.keys(m).sort().map((k) => [MONTHS[+k.slice(5) - 1] + ' ' + k.slice(0, 4), m[k]])], 'line'];
  }
  if (kind === 'tasks') {
    const lab = { todo: 'لم تبدأ', doing: 'قيد التنفيذ', done: 'منجزة' }; const m = {};
    db.tasks.forEach((t) => { const k = lab[t.status] || t.status || 'أخرى'; m[k] = (m[k] || 0) + 1; });
    return ['المهام حسب الحالة', [['الحالة', 'عدد المهام'], ...Object.entries(m)], 'pie'];
  }
}
const ST_TEMPLATES = [
  ['blank', '📄 جدول فارغ', () => ['جدول جديد', [['البند', 'القيمة'], ['', ''], ['', ''], ['', ''], ['', '']], 'column']],
  ['grades', '🏫 الطالبات حسب الصف', () => ['أعداد الطالبات والمتفوقات حسب الصف', [['الصف', 'عدد الطالبات', 'عدد المتفوقات'], ...ST_GRADES.map((g) => [g, '', ''])], 'column']],
  ['levels', '🎯 نتائج اختبار حسب المستوى', () => ['توزيع الطالبات حسب مستوى الأداء', [['المستوى', 'عدد الطالبات'], ['ممتاز', ''], ['جيد جداً', ''], ['جيد', ''], ['مقبول', ''], ['يحتاج إلى دعم', '']], 'doughnut']],
  ['attend', '📅 نسبة الحضور الشهرية', () => ['نسبة حضور الطالبات الشهرية', [['الشهر', 'نسبة الحضور %'], ...[7, 8, 9, 10, 11, 0, 1, 2, 3, 4].map((m) => [MONTHS[m], ''])], 'line']],
  ['hifz', '📖 الحفظ حسب الحلقة', () => ['إنجاز الحفظ حسب الحلقة', [['الحلقة', 'المستهدف (صفحات)', 'المنجز (صفحات)'], ['', '', ''], ['', '', ''], ['', '', '']], 'column']],
  ['kpi', '🔢 مؤشرات أداء', () => ['مؤشرات الأداء', [['المؤشر', 'القيمة'], ['عدد الطالبات', ''], ['عدد المتفوقات', ''], ['نسبة الحضور %', '']], 'kpi']],
];
const ST_APP = [['absType', '📋 الغياب حسب النوع'], ['absTeacher', '👩‍🏫 غياب كل معلمة'], ['absMonth', '🗓️ الغياب حسب الشهر'], ['tasks', '✅ المهام حسب الحالة']];

// ───── الرسم البياني (SVG) ─────
const ST_PALETTES = {
  school: ['#0f6b5c', '#e0a43a', '#3f7cc9', '#c2557a', '#7a5cc7', '#2fa38c', '#d9733b', '#5b6b78'],
  calm: ['#1b6ca8', '#2fa38c', '#7fb8d6', '#0f6b5c', '#9ec9a0', '#55759b', '#a8c5d6', '#3c8d93'],
  warm: ['#c2410c', '#e0a43a', '#b91c5c', '#d97757', '#8a5a44', '#f2c14e', '#a0414b', '#e98a5c'],
  mono: ['#0b4f44', '#0f6b5c', '#2e8a78', '#56a896', '#86c4b5', '#b4ddd3', '#174f46', '#3d9a87'],
};
const ST_TYPES = [['column', '📊', 'أعمدة'], ['bar', '📶', 'أشرطة أفقية'], ['stacked', '🧱', 'أعمدة مكدّسة'], ['line', '📈', 'خطي'], ['area', '⛰️', 'مساحي'], ['pie', '🥧', 'دائري'], ['doughnut', '🍩', 'حلقي'], ['kpi', '🔢', 'بطاقات مؤشرات']];
const SVG_FONT = `font-family="Segoe UI, Tahoma, Arial, sans-serif"`;
const RTL = 'direction="rtl" text-anchor="start"'; // نص عربي محاذى لليمين عند x
const sx = (s) => esc(s);
const cut = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
function stChartData(sheet, ch) {
  const rows = [];
  for (let r = 1; r < sheet.rows.length; r++) {
    if (ch.rows && !ch.rows.includes(r)) continue;
    const label = stShown(sheet, r, ch.labelCol);
    const vals = ch.series.map((c) => { const v = stValue(sheet, r, c); return typeof v === 'number' ? v : null; });
    if (!label && vals.every((v) => v == null)) continue;
    rows.push({ label: label || '—', vals });
  }
  if (ch.sort !== 'none') rows.sort((a, b) => (ch.sort === 'desc' ? 1 : -1) * ((b.vals[0] ?? 0) - (a.vals[0] ?? 0)));
  return { labels: rows.map((x) => x.label), series: ch.series.map((c, i) => ({ name: String(sheet.rows[0][c] || colName(c)), values: rows.map((x) => x.vals[i]) })) };
}
function niceScale(min, max, ticks = 5) {
  if (min === max) { max = max === 0 ? 1 : max * 1.2; min = Math.min(0, min); }
  const span = max - min, raw = span / ticks, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  return { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step };
}
function chartSVG(sheet, ch, W = 860, H = 500) {
  const D = stChartData(sheet, ch), pal = ST_PALETTES[ch.palette] || ST_PALETTES.school;
  const col = (i) => pal[i % pal.length];
  const sub = ch.subtitle || [db.settings.schoolName, fmtH(todayISO())].filter(Boolean).join(' · ');
  let g = '';
  const head = `<rect width="${W}" height="${H}" fill="#ffffff"/>
    <text x="${W / 2}" y="38" text-anchor="middle" direction="rtl" font-size="22" font-weight="700" fill="#1d2b28">${sx(cut(ch.title || sheet.title, 70))}</text>
    <text x="${W / 2}" y="62" text-anchor="middle" direction="rtl" font-size="13" fill="#6b7c78">${sx(cut(sub, 90))}</text>`;
  const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" direction="ltr" style="direction:ltr" ${SVG_FONT}>${head}${body}</svg>`;
  const nonEmpty = D.labels.length && D.series.some((s) => s.values.some((v) => v != null));
  if (!nonEmpty) return wrap(`<text x="${W / 2}" y="${H / 2}" text-anchor="middle" direction="rtl" font-size="16" fill="#9aa8a4">أدخلي أرقاماً في الجدول أو اختاري أعمدة القيم ليظهر الرسم</text>`);
  const multi = D.series.length > 1;
  const legendItems = (items) => {
    // وسيلة إيضاح من اليمين إلى اليسار في أسفل الرسم
    let x = W - 30, y = H - 22, out = '';
    items.forEach(([name, c]) => {
      const w = Math.min(200, 26 + String(name).length * 7.2);
      if (x - w < 20) { x = W - 30; y -= 22; }
      out += `<rect x="${x - 12}" y="${y - 10}" width="12" height="12" rx="3" fill="${c}"/><text x="${x - 18}" y="${y}" ${RTL} font-size="13" fill="#44524f">${sx(cut(name, 26))}</text>`;
      x -= w;
    });
    return out;
  };
  const valTxt = (v, x, y, anchor = 'middle', fill = '#1d2b28', size = 12) => (ch.values && v != null ? `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="600" fill="${fill}">${stFmt(v)}</text>` : '');

  // ── مؤشرات ──
  if (ch.type === 'kpi') {
    const tiles = [];
    D.series.forEach((s, i) => {
      if (D.labels.length === 1 || ch.series.length > 1) tiles.push({ label: ch.series.length > 1 ? 'إجمالي ' + s.name : D.labels[0], value: stFmt(s.values.reduce((a, v) => a + (v || 0), 0)), c: col(i) });
    });
    if (ch.series.length === 1 && D.labels.length > 1) D.labels.forEach((l, i) => tiles.push({ label: l, value: stFmt(D.series[0].values[i]), c: col(i) }));
    if (ch.series.length > 1) {
      const base = D.series[0].values.reduce((a, v) => a + (v || 0), 0);
      D.series.slice(1).forEach((s, i) => { const t = s.values.reduce((a, v) => a + (v || 0), 0); if (base) tiles.push({ label: `نسبة ${s.name}`, value: Math.round((t / base) * 1000) / 10 + '%', c: col(i + 1), pct: t / base }); });
    }
    const n = Math.min(tiles.length, 12), cols = n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4, rowsN = Math.ceil(n / cols);
    const gap = 18, tw = (W - 60 - gap * (cols - 1)) / cols, th = Math.min(150, (H - 110 - gap * (rowsN - 1)) / rowsN);
    tiles.slice(0, n).forEach((t, i) => {
      const cx = W - 30 - (i % cols) * (tw + gap) - tw, cy = 90 + Math.floor(i / cols) * (th + gap);
      g += `<rect x="${cx}" y="${cy}" width="${tw}" height="${th}" rx="14" fill="#f7faf9" stroke="#e2e9e7"/><rect x="${cx + tw - 6}" y="${cy + 14}" width="6" height="${th - 28}" rx="3" fill="${t.c}"/>
        <text x="${cx + tw - 22}" y="${cy + th * 0.36}" ${RTL} font-size="14" fill="#6b7c78">${sx(cut(t.label, Math.floor(tw / 8)))}</text>
        <text x="${cx + tw - 22}" y="${cy + th * 0.75}" text-anchor="end" font-size="${Math.min(40, th * 0.32)}" font-weight="800" fill="${t.c}" direction="ltr">${sx(t.value)}</text>`;
      if (t.pct != null) g += `<rect x="${cx + 18}" y="${cy + th - 22}" width="${tw * 0.4}" height="8" rx="4" fill="#e6eeec"/><rect x="${cx + 18 + tw * 0.4 * (1 - Math.min(1, t.pct))}" y="${cy + th - 22}" width="${tw * 0.4 * Math.min(1, t.pct)}" height="8" rx="4" fill="${t.c}"/>`;
    });
    return wrap(g);
  }

  // ── دائري وحلقي ──
  if (ch.type === 'pie' || ch.type === 'doughnut') {
    const vals = D.series[0].values.map((v) => Math.max(0, v || 0)), total = vals.reduce((a, b) => a + b, 0);
    if (!total) return wrap(`<text x="${W / 2}" y="${H / 2}" text-anchor="middle" direction="rtl" font-size="16" fill="#9aa8a4">القيم كلها صفر</text>`);
    const R = Math.min(170, (H - 120) / 2), cx = 40 + R + 30, cy = 80 + (H - 100) / 2, r0 = ch.type === 'doughnut' ? R * 0.58 : 0;
    let a = -Math.PI / 2;
    vals.forEach((v, i) => {
      if (!v) return;
      const da = (v / total) * Math.PI * 2, a2 = a + da, large = da > Math.PI ? 1 : 0;
      const p = (rad, ang) => `${(cx + rad * Math.cos(ang)).toFixed(2)} ${(cy + rad * Math.sin(ang)).toFixed(2)}`;
      const path = da >= Math.PI * 2 - 1e-6
        ? `M ${p(R, 0)} A ${R} ${R} 0 1 1 ${p(R, Math.PI)} A ${R} ${R} 0 1 1 ${p(R, 0)} Z${r0 ? ` M ${p(r0, 0)} A ${r0} ${r0} 0 1 0 ${p(r0, Math.PI)} A ${r0} ${r0} 0 1 0 ${p(r0, 0)} Z` : ''}`
        : r0 ? `M ${p(R, a)} A ${R} ${R} 0 ${large} 1 ${p(R, a2)} L ${p(r0, a2)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a)} Z` : `M ${cx} ${cy} L ${p(R, a)} A ${R} ${R} 0 ${large} 1 ${p(R, a2)} Z`;
      g += `<path d="${path}" fill="${col(i)}" stroke="#fff" stroke-width="2" fill-rule="evenodd"/>`;
      const mid = a + da / 2, lr = r0 ? (R + r0) / 2 : R * 0.64, pct = (v / total) * 100;
      if (pct >= 4) g += `<text x="${(cx + lr * Math.cos(mid)).toFixed(1)}" y="${(cy + lr * Math.sin(mid) + 5).toFixed(1)}" text-anchor="middle" font-size="${pct >= 9 ? 15 : 12}" font-weight="700" fill="#fff">${Math.round(pct)}%</text>`;
      a = a2;
    });
    if (r0) g += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="30" font-weight="800" fill="#1d2b28">${stFmt(total)}</text><text x="${cx}" y="${cy + 22}" text-anchor="middle" direction="rtl" font-size="13" fill="#6b7c78">الإجمالي</text>`;
    // جدول الإيضاح على اليمين
    const lx = W - 40, n = D.labels.length, lh = Math.min(30, (H - 120) / n), ly0 = cy - (lh * n) / 2 + lh / 2;
    D.labels.forEach((l, i) => {
      const y = ly0 + i * lh, pct = total ? (vals[i] / total) * 100 : 0;
      g += `<rect x="${lx - 14}" y="${y - 11}" width="14" height="14" rx="4" fill="${col(i)}"/><text x="${lx - 24}" y="${y + 1}" ${RTL} font-size="14" fill="#1d2b28">${sx(cut(l, 30))}</text>
        <text x="${cx + R + 60}" y="${y + 1}" text-anchor="start" font-size="13" fill="#6b7c78" direction="ltr">${stFmt(vals[i])}${ch.values ? ` (${Math.round(pct)}%)` : ''}</text>`;
    });
    return wrap(g);
  }

  // ── محاور (أعمدة، أشرطة، خطي، مساحي، مكدّس) ──
  const stacked = ch.type === 'stacked', horiz = ch.type === 'bar';
  const n = D.labels.length;
  let lo = 0, hi = 0;
  if (stacked) D.labels.forEach((_, i) => { let p = 0, q = 0; D.series.forEach((s) => { const v = s.values[i] || 0; if (v >= 0) p += v; else q += v; }); hi = Math.max(hi, p); lo = Math.min(lo, q); });
  else D.series.forEach((s) => s.values.forEach((v) => { if (v != null) { hi = Math.max(hi, v); lo = Math.min(lo, v); } }));
  if (ch.type === 'line' || ch.type === 'area') { const all = D.series.flatMap((s) => s.values).filter((v) => v != null); const mn = Math.min(...all); if (mn > 0 && mn > (hi - mn) * 1.5) lo = mn - (hi - mn) * 0.4; }
  const S = niceScale(lo, hi * (ch.values ? 1.08 : 1));
  const legendH = multi && ch.legend ? 34 + (D.series.length > 5 ? 22 : 0) : 8;
  const longest = Math.max(...D.labels.map((l) => String(l).length));
  if (horiz) {
    const labW = Math.min(200, 20 + longest * 7.5), top = 84, bottom = H - 34 - legendH, right = W - 20 - labW, left = 50;
    const band = (bottom - top) / n, X = (v) => right - ((v - S.lo) / (S.hi - S.lo)) * (right - left);
    for (let t = S.lo; t <= S.hi + 1e-9; t += S.step) g += `<line x1="${X(t)}" y1="${top}" x2="${X(t)}" y2="${bottom}" stroke="#edf1f0"/><text x="${X(t)}" y="${bottom + 18}" text-anchor="middle" font-size="12" fill="#8a9895">${stFmt(t)}</text>`;
    const bw = (band * 0.72) / D.series.length;
    D.labels.forEach((l, i) => {
      const y0 = top + i * band + band * 0.14;
      g += `<text x="${W - 20}" y="${top + i * band + band / 2 + 5}" ${RTL} font-size="13" fill="#44524f">${sx(cut(l, Math.floor(labW / 7.5)))}</text>`;
      D.series.forEach((s, k) => {
        const v = s.values[i]; if (v == null) return;
        const x1 = X(Math.max(0, S.lo)), x2 = X(v), y = y0 + k * bw;
        g += `<rect x="${Math.min(x1, x2)}" y="${y}" width="${Math.max(1, Math.abs(x2 - x1))}" height="${Math.max(2, bw - 2)}" rx="4" fill="${col(multi ? k : i)}"/>`;
        if (bw >= 12) g += valTxt(v, Math.min(x1, x2) - 6, y + bw / 2 + 4, 'end', '#1d2b28', 12);
      });
    });
    g += `<line x1="${right}" y1="${top}" x2="${right}" y2="${bottom}" stroke="#b8c4c1"/>`;
  } else {
    const yLabW = Math.max(36, 12 + Math.max(...[S.lo, S.hi].map((v) => stFmt(v).length)) * 7.5);
    const top = 84, right = W - 18 - yLabW, left = 28;
    const band = (right - left) / n, rotate = band < Math.min(140, longest * 7.2) ;
    const labH = rotate ? Math.min(110, 18 + longest * 5.2) : 30;
    const bottom = H - legendH - labH - 6;
    const Y = (v) => bottom - ((v - S.lo) / (S.hi - S.lo)) * (bottom - top);
    const cxOf = (i) => right - (i + 0.5) * band; // من اليمين إلى اليسار
    for (let t = S.lo; t <= S.hi + 1e-9; t += S.step) g += `<line x1="${left}" y1="${Y(t)}" x2="${right}" y2="${Y(t)}" stroke="${Math.abs(t) < 1e-9 ? '#b8c4c1' : '#edf1f0'}"/><text x="${right + 10}" y="${Y(t) + 4}" text-anchor="start" font-size="12" fill="#8a9895">${stFmt(t)}</text>`;
    D.labels.forEach((l, i) => {
      const x = cxOf(i), y = bottom + 20, lab = sx(cut(l, rotate ? 22 : Math.max(4, Math.floor(band / 7))));
      g += rotate ? `<text x="${x}" y="${y - 6}" ${RTL} font-size="12" fill="#44524f" transform="rotate(-38 ${x} ${y - 6})">${lab}</text>` : `<text x="${x}" y="${y}" text-anchor="middle" direction="rtl" font-size="13" fill="#44524f">${lab}</text>`;
    });
    const z = Y(Math.max(0, S.lo));
    if (ch.type === 'column') {
      const bw = Math.min(64, (band * 0.7) / D.series.length);
      D.labels.forEach((_, i) => D.series.forEach((s, k) => {
        const v = s.values[i]; if (v == null) return;
        const x = cxOf(i) + (D.series.length * bw) / 2 - (k + 1) * bw, y = Y(v);
        g += `<rect x="${x + 1}" y="${Math.min(y, z)}" width="${bw - 2}" height="${Math.max(1, Math.abs(z - y))}" rx="${Math.min(6, bw / 4)}" fill="${col(multi ? k : i)}"/>`;
        if (bw >= 16 || n <= 12) g += valTxt(v, x + bw / 2, v >= 0 ? y - 6 : y + 15, 'middle', '#1d2b28', bw < 22 ? 10 : 12);
      }));
    } else if (stacked) {
      const bw = Math.min(70, band * 0.6);
      D.labels.forEach((_, i) => {
        let pos = 0, neg = 0;
        D.series.forEach((s, k) => {
          const v = s.values[i] || 0; if (!v) return;
          const from = v >= 0 ? pos : neg, to = from + v; if (v >= 0) pos = to; else neg = to;
          const y1 = Y(from), y2 = Y(to);
          g += `<rect x="${cxOf(i) - bw / 2}" y="${Math.min(y1, y2)}" width="${bw}" height="${Math.max(1, Math.abs(y2 - y1))}" fill="${col(k)}" stroke="#fff" stroke-width="1"/>`;
          if (ch.values && Math.abs(y2 - y1) > 16) g += `<text x="${cxOf(i)}" y="${(y1 + y2) / 2 + 4}" text-anchor="middle" font-size="11" font-weight="600" fill="#fff">${stFmt(v)}</text>`;
        });
        g += valTxt(pos, cxOf(i), Y(pos) - 6, 'middle', '#1d2b28', 12);
      });
    } else {
      D.series.forEach((s, k) => {
        const pts = s.values.map((v, i) => (v == null ? null : [cxOf(i), Y(v)])).filter(Boolean);
        if (!pts.length) return;
        const c = col(k), d = pts.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
        if (ch.type === 'area') {
          g += `<defs><linearGradient id="ga${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="${multi ? 0.28 : 0.35}"/><stop offset="1" stop-color="${c}" stop-opacity="0.03"/></linearGradient></defs>`;
          g += `<path d="${d} L${pts[pts.length - 1][0].toFixed(1)} ${z} L${pts[0][0].toFixed(1)} ${z} Z" fill="url(#ga${k})"/>`;
        }
        g += `<path d="${d}" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
        s.values.forEach((v, i) => { if (v == null) return; g += `<circle cx="${cxOf(i)}" cy="${Y(v)}" r="4.5" fill="#fff" stroke="${c}" stroke-width="2.5"/>`; if (n <= 16) g += valTxt(v, cxOf(i), Y(v) - 11, 'middle', c, 12); });
      });
    }
    g += `<line x1="${right}" y1="${top}" x2="${right}" y2="${bottom}" stroke="#b8c4c1"/>`;
  }
  if (multi && ch.legend) g += legendItems(D.series.map((s, k) => [s.name, col(k)]));
  return wrap(g);
}

// ───── التصدير ─────
function svgToPng(svg, scale = 2) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = img.width * scale; cv.height = img.height * scale;
      const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); cv.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('تعذّر رسم الصورة')); };
    img.src = url;
  });
}
const blobToDataURL = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
const stSafeName = (s) => String(s || 'رسم بياني').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
function stTableHtml(sheet, ch) {
  const D = stChartData(sheet, ch);
  return `<table style="width:100%;border-collapse:collapse" border="1"><tbody><tr><td style="background:#e3f1ee"><b>${esc(sheet.rows[0][ch.labelCol] || '')}</b></td>${D.series.map((s) => `<td style="background:#e3f1ee"><b>${esc(s.name)}</b></td>`).join('')}</tr>
    ${D.labels.map((l, i) => `<tr><td>${esc(l)}</td>${D.series.map((s) => `<td>${stFmt(s.values[i])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
async function stChartDocHtml(sheet, ch) {
  const png = await blobToDataURL(await svgToPng(chartSVG(sheet, ch), 1.5));
  return `<h1 style="text-align:center">${esc(ch.title || sheet.title)}</h1><p style="text-align:center"><img src="${png}" width="620" height="360" alt="رسم بياني"></p><p><br></p>${ch.type === 'kpi' ? '' : stTableHtml(sheet, ch)}`;
}

// ───── الواجهة ─────
const stCellRef = (r, c) => colName(c) + (r + 1);
function stGrid(s) {
  const n = stColsCount(s), shown = s.rows.slice(0, ST_SHOW_ROWS + 1);
  const numCols = [...Array(n).keys()].filter((c) => stIsNumCol(s, c));
  const agg = (c, f) => { const a = []; for (let r = 1; r < s.rows.length; r++) { const v = stValue(s, r, c); if (typeof v === 'number') a.push(v); } return a.length ? stFmt(ST_FN[f](a)) : ''; };
  return `<div class="st-wrap"><table class="st-grid"><thead><tr><th class="st-corner"></th>${[...Array(n).keys()].map((c) => `<th class="${ST.focus?.c === c ? 'on' : ''}">${colName(c)}</th>`).join('')}</tr></thead><tbody>
    ${shown.map((row, r) => `<tr class="${r === 0 ? 'st-head' : ''}"><th class="${ST.focus?.r === r ? 'on' : ''}">${r + 1}</th>${[...Array(n).keys()].map((c) => {
      const raw = row[c] ?? '', isF = typeof raw === 'string' && raw[0] === '=';
      return `<td><input class="st-cell ${isF ? 'f' : ''} ${r > 0 && numCols.includes(c) ? 'num' : ''}" data-r="${r}" data-c="${c}" value="${esc(r === 0 ? raw : isF ? stShown(s, r, c) : raw)}" data-raw="${esc(raw)}" title="${stCellRef(r, c)}${isF ? ' ' + esc(raw) : ''}"></td>`;
    }).join('')}</tr>`).join('')}
    </tbody>${numCols.length ? `<tfoot>${[['SUM', 'المجموع'], ['AVERAGE', 'المتوسط'], ['MAX', 'الأعلى'], ['MIN', 'الأدنى']].map(([f, l]) => `<tr><th>${l}</th>${[...Array(n).keys()].map((c) => `<td>${numCols.includes(c) ? agg(c, f) : ''}</td>`).join('')}</tr>`).join('')}</tfoot>` : ''}</table></div>
    ${s.rows.length > ST_SHOW_ROWS + 1 ? `<div class="muted" style="margin-top:6px">يُعرض أول ${ST_SHOW_ROWS} صف للتحرير، والرسوم والمجاميع تشمل كل الصفوف (${s.rows.length - 1}).</div>` : ''}`;
}
function stChartPanel(s) {
  const ch = curChart(s); if (!ch) return '';
  const n = stColsCount(s), heads = s.rows[0];
  const labs = s.rows.slice(1).map((r, i) => [i + 1, stShown(s, i + 1, ch.labelCol) || `صف ${i + 2}`]);
  const pie = ch.type === 'pie' || ch.type === 'doughnut';
  return `<div class="st-studio">
    <div class="st-ctrl">
      <div class="field"><label>عنوان الرسم</label><input class="input" data-change="stCh" data-k="title" value="${esc(ch.title)}"></div>
      <div class="field"><label>عنوان فرعي (اختياري)</label><input class="input" data-change="stCh" data-k="subtitle" value="${esc(ch.subtitle)}" placeholder="${esc(db.settings.schoolName || '')}"></div>
      <div class="field"><label>نوع الرسم</label><div class="st-types">${ST_TYPES.map(([k, ic, l]) => `<button class="${ch.type === k ? 'on' : ''}" data-act="stType" data-id="${k}"><span>${ic}</span>${l}</button>`).join('')}</div></div>
      <div class="field"><label>عمود التسميات (المحور)</label><select class="input" data-change="stCh" data-k="labelCol">${heads.map((h, c) => `<option value="${c}" ${ch.labelCol === c ? 'selected' : ''}>${colName(c)} — ${esc(cut(h, 30))}</option>`).join('')}</select></div>
      <div class="field"><label>أعمدة القيم${pie ? ' (الدائري يستخدم الأول)' : ''}</label><div class="st-chips">${[...Array(n).keys()].filter((c) => c !== ch.labelCol).map((c) => `<label class="st-chip ${ch.series.includes(c) ? 'on' : ''}"><input type="checkbox" data-change="stSeries" data-id="${c}" ${ch.series.includes(c) ? 'checked' : ''}>${esc(cut(heads[c] || colName(c), 24))}${stIsNumCol(s, c) ? '' : ' <span class="muted">(نص)</span>'}</label>`).join('')}</div></div>
      <div class="field"><label>الصفوف المشمولة <button class="icon-btn" data-act="stRowsAll">الكل</button><button class="icon-btn" data-act="stRowsNone">لا شيء</button></label><div class="st-chips st-rows">${labs.map(([r, l]) => `<label class="st-chip ${!ch.rows || ch.rows.includes(r) ? 'on' : ''}"><input type="checkbox" data-change="stRow" data-id="${r}" ${!ch.rows || ch.rows.includes(r) ? 'checked' : ''}>${esc(cut(l, 22))}</label>`).join('')}</div></div>
      <div class="st-row2">
        <div class="field"><label>الترتيب</label><select class="input" data-change="stCh" data-k="sort">${[['none', 'كما في الجدول'], ['desc', 'من الأكبر'], ['asc', 'من الأصغر']].map(([k, l]) => `<option value="${k}" ${ch.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>الألوان</label><div class="st-pals">${Object.entries(ST_PALETTES).map(([k, p]) => `<button class="${ch.palette === k ? 'on' : ''}" data-act="stPal" data-id="${k}" title="${k}">${p.slice(0, 4).map((c) => `<i style="background:${c}"></i>`).join('')}</button>`).join('')}</div></div>
      </div>
      <label class="st-opt"><input type="checkbox" data-change="stChB" data-k="values" ${ch.values ? 'checked' : ''}> إظهار القيم على الرسم</label>
      <label class="st-opt"><input type="checkbox" data-change="stChB" data-k="legend" ${ch.legend ? 'checked' : ''}> إظهار وسيلة الإيضاح</label>
    </div>
    <div class="st-preview">
      <div class="st-canvas" id="stCanvas">${chartSVG(s, ch)}</div>
      <div class="st-exp">
        <button class="btn primary sm" data-act="stPng">⬇ حفظ صورة</button>
        <button class="btn sm" data-act="stCopy">📋 نسخ الصورة</button>
        <button class="btn sm" data-act="stWord">⬇ Word</button>
        <button class="btn sm" data-act="stPrint">🖨 طباعة / PDF</button>
        <button class="btn sm" data-act="stToDoc">📝 إرسال إلى محرر المستندات</button>
      </div>
    </div>
  </div>`;
}
VIEWS.stats = {
  actions: () => `<button class="btn" data-act="stImport">⬆ استيراد Excel</button><button class="btn primary" data-act="stNewMenu">＋ جدول جديد</button>`,
  render() {
    const list = db.sheets.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const s = curSheet();
    if (!s && list.length && ui.stId !== '') { ui.stId = list[0].id; return this.render(); }
    const side = `<div class="card d-side">
      <div class="section-title" style="margin-top:0">جداولي (${list.length})</div>
      ${list.length ? `<div class="list" style="max-height:60vh;overflow:auto">${list.map((x) => `<div class="li ${x.id === ui.stId ? 'sel-row' : ''}"><div class="grow" style="cursor:pointer" data-act="stOpen" data-id="${x.id}"><div class="t">${esc(x.title)}</div><div class="s">${x.rows.length - 1} صف · ${x.charts.length} رسم${x.source === 'excel' ? ' · من Excel' : x.source === 'app' ? ' · من البرنامج' : ''}</div></div><button class="icon-btn" data-act="stDel" data-id="${x.id}" title="حذف">🗑️</button></div>`).join('')}</div>` : '<div class="muted">لا توجد جداول بعد</div>'}
      <div class="section-title">إنشاء سريع</div>
      <div class="tpl-list">${ST_TEMPLATES.map(([k, l]) => `<button class="btn sm" data-act="stTpl" data-id="${k}">${l}</button>`).join('')}</div>
      <div class="section-title">من بيانات البرنامج</div>
      <div class="tpl-list">${ST_APP.map(([k, l]) => `<button class="btn sm" data-act="stApp" data-id="${k}">${l}</button>`).join('')}</div>
    </div>`;
    if (!s) return `<div class="designer">${side}<div class="d-main"><div class="card">${emptyState('📈', 'أنشئي جدولاً من «إنشاء سريع» وعبّئي الأرقام يدوياً، أو استوردي ملف Excel،<br>ثم اختاري الأعمدة والصفوف ونوع الرسم، ويظهر الرسم البياني فوراً.')}
      <div style="display:flex;gap:10px;justify-content:center;margin-top:14px"><button class="btn primary" data-act="stTpl" data-id="grades">🏫 مثال: الطالبات حسب الصف</button><button class="btn" data-act="stImport">⬆ استيراد Excel</button></div></div></div></div>`;
    const ch = curChart(s);
    return `<div class="designer">${side}<div class="d-main">
      <div class="card">
        <div class="st-titlebar"><input class="input st-title" data-change="stTitle" value="${esc(s.title)}"><span class="spacer" style="flex:1"></span>
          <span class="muted st-ref" id="stRef">${ST.focus ? stCellRef(ST.focus.r, ST.focus.c) : ''}</span></div>
        <div class="toolbar st-tools">
          <button class="btn sm" data-act="stRowAdd">＋ صف</button><button class="btn sm" data-act="stColAdd">＋ عمود</button>
          <button class="btn sm" data-act="stRowDel" ${ST.focus?.r > 0 ? '' : 'disabled'}>حذف الصف</button><button class="btn sm" data-act="stColDel" ${ST.focus && stColsCount(s) > 1 ? '' : 'disabled'}>حذف العمود</button>
          <button class="btn sm" data-act="stSort" data-id="desc" ${ST.focus ? '' : 'disabled'}>ترتيب ↓</button><button class="btn sm" data-act="stSort" data-id="asc" ${ST.focus ? '' : 'disabled'}>ترتيب ↑</button>
          <span class="spacer" style="flex:1"></span>
          <button class="btn sm" data-act="stXlsx">⬇ Excel</button><button class="btn sm" data-act="stDup">نسخ الجدول</button>
        </div>
        <div class="muted st-hint">الصف الأول عناوين الأعمدة. الصقي من Excel مباشرة (Ctrl+V)، وتعمل المعادلات مثل <b dir="ltr">=SUM(B2:B7)</b> و<b dir="ltr">=C2/B2*100</b> و<b dir="ltr">=AVERAGE(B2:B7)</b>.</div>
        ${stGrid(s)}
      </div>
      <div class="card" id="stChartCard">
        <div class="st-titlebar"><h3 style="margin:0">📊 الرسوم البيانية</h3><span class="spacer" style="flex:1"></span>
          <div class="seg st-charts">${s.charts.map((c, i) => `<button class="${c.id === ch?.id ? 'on' : ''}" data-act="stChartPick" data-id="${c.id}">${esc(cut(c.title || 'رسم ' + (i + 1), 18))}</button>`).join('')}</div>
          <button class="btn sm" data-act="stChartAdd">＋ رسم</button>${s.charts.length > 1 ? '<button class="btn sm danger" data-act="stChartDel">حذف الرسم</button>' : ''}
        </div>
        ${stChartPanel(s)}
      </div>
    </div></div>`;
  },
};

function stTouch(s = curSheet(), full = false) {
  s.updatedAt = new Date().toISOString();
  if (full) return commit();
  commit(false);
  // تحديث المعاينة والمجاميع دون إعادة رسم الصفحة كي لا تضيع الكتابة
  const ch = curChart(s), cv = $('#stCanvas'); if (cv && ch) cv.innerHTML = chartSVG(s, ch);
  const foot = $('.st-grid tfoot'); if (foot) { const tmp = document.createElement('div'); tmp.innerHTML = stGrid(s); const nf = tmp.querySelector('tfoot'); if (nf) foot.replaceWith(nf); }
  $$('.st-cell.f').forEach((el) => { if (el !== document.activeElement) el.value = stShown(s, +el.dataset.r, +el.dataset.c); });
}
function stSetCell(s, r, c, v) {
  while (s.rows.length <= r) s.rows.push(Array(stColsCount(s)).fill(''));
  if (c >= ST_MAX_COLS) return;
  while (s.rows[r].length <= c) s.rows.forEach((row) => row.push(''));
  s.rows[r][c] = v;
}
function stMenu(title, items) {
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal" style="width:520px"><div class="modal-h"><h2>${esc(title)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div>
    <div class="modal-b">${items}</div></div></div>`;
  modalCtx = {};
}
function stApplyChart(ch, k, v) { ch[k] = v; }
Object.assign(ACTIONS, {
  stNewMenu: () => stMenu('جدول جديد', `<div class="section-title" style="margin-top:0">إدخال يدوي</div><div class="tpl-list">${ST_TEMPLATES.map(([k, l]) => `<button class="btn" data-act="stTpl" data-id="${k}">${l}</button>`).join('')}</div>
    <div class="section-title">من بيانات البرنامج</div><div class="tpl-list">${ST_APP.map(([k, l]) => `<button class="btn" data-act="stApp" data-id="${k}">${l}</button>`).join('')}</div>
    <div class="section-title">من ملف</div><button class="btn primary" data-act="stImport">⬆ استيراد Excel أو CSV</button>`),
  stTpl: (el) => { if (modalCtx) closeModal(); const [t, rows, type] = ST_TEMPLATES.find((x) => x[0] === el.dataset.id)[2](); stAddSheet(t, rows, type); ST.focus = { r: 1, c: 1 }; commit(); setTimeout(() => $('.st-cell[data-r="1"][data-c="1"]')?.focus(), 60); },
  stApp: (el) => {
    if (modalCtx) closeModal();
    const [t, rows, type] = stFromApp(el.dataset.id);
    if (rows.length < 2) return toast('لا توجد بيانات كافية في البرنامج لهذا الجدول بعد');
    stAddSheet(t, rows, type, 'app'); commit(); toast('أُنشئ الجدول من بيانات البرنامج (لقطة بتاريخ اليوم)', 'ok');
  },
  stImport: async () => {
    if (modalCtx) closeModal();
    const [f] = await pickFiles('.xlsx,.csv,.xls'); if (!f) return;
    try {
      const sheets = await readWorkbook(f);
      if (!sheets.length) return toast('الملف لا يحتوي على بيانات', 'err');
      const base = f.name.replace(/\.[^.]+$/, '');
      let cut0 = false, first = null;
      sheets.forEach((w) => { if (w.rows.length > ST_MAX_ROWS + 1) cut0 = true; const s = stAddSheet(sheets.length > 1 ? `${base} — ${w.name}` : base, w.rows, null, 'excel'); first = first || s; });
      ui.stId = first.id; ui.stChart = first.charts[0].id; ST.focus = null; commit();
      toast(`استُورد ${sheets.length > 1 ? sheets.length + ' أوراق' : 'الملف'}${cut0 ? ` (أول ${ST_MAX_ROWS} صف من كل ورقة)` : ''}، واختيرت أعمدة الرسم تلقائياً`, 'ok');
    } catch (e) { toast('تعذّرت قراءة الملف: ' + e.message, 'err'); }
  },
  stOpen: (el) => { ui.stId = el.dataset.id; ui.stChart = null; ST.focus = null; render(); },
  stDel: (el) => { const s = db.sheets.find((x) => x.id === el.dataset.id); confirmBox(`حذف الجدول «${s.title}» ورسومه؟`, () => { db.sheets = db.sheets.filter((x) => x !== s); if (ui.stId === s.id) ui.stId = null; commit(); }); },
  stDup: () => { const s = curSheet(); const c = JSON.parse(JSON.stringify(s)); c.id = uid(); c.title = s.title + ' (نسخة)'; c.charts.forEach((x) => (x.id = uid())); c.updatedAt = new Date().toISOString(); db.sheets.push(c); ui.stId = c.id; ui.stChart = null; commit(); },
  stRowAdd: () => { const s = curSheet(); const at = ST.focus && ST.focus.r > 0 ? ST.focus.r + 1 : s.rows.length; s.rows.splice(at, 0, Array(stColsCount(s)).fill('')); s.charts.forEach((c) => c.rows && (c.rows = c.rows.map((r) => (r >= at ? r + 1 : r)).concat(at))); ST.focus = { r: at, c: ST.focus?.c ?? 0 }; stTouch(s, true); setTimeout(() => $(`.st-cell[data-r="${at}"][data-c="${ST.focus.c}"]`)?.focus(), 50); },
  stColAdd: () => { const s = curSheet(); if (stColsCount(s) >= ST_MAX_COLS) return toast('الحد الأقصى ' + ST_MAX_COLS + ' عموداً'); const n = stColsCount(s); s.rows.forEach((r, i) => r.push(i === 0 ? 'عمود ' + colName(n) : '')); ST.focus = { r: 0, c: n }; stTouch(s, true); setTimeout(() => { const el = $(`.st-cell[data-r="0"][data-c="${n}"]`); el?.focus(); el?.select(); }, 50); },
  stRowDel: () => { const s = curSheet(); const r = ST.focus?.r; if (!(r > 0)) return; s.rows.splice(r, 1); s.charts.forEach((c) => c.rows && (c.rows = c.rows.filter((x) => x !== r).map((x) => (x > r ? x - 1 : x)))); if (s.rows.length < 2) s.rows.push(Array(stColsCount(s)).fill('')); ST.focus = null; stTouch(s, true); },
  stColDel: () => {
    const s = curSheet(), c = ST.focus?.c; if (c == null || stColsCount(s) < 2) return;
    s.rows.forEach((r) => r.splice(c, 1));
    s.charts.forEach((ch) => { ch.series = ch.series.filter((x) => x !== c).map((x) => (x > c ? x - 1 : x)); if (ch.labelCol === c) ch.labelCol = 0; else if (ch.labelCol > c) ch.labelCol--; if (!ch.series.length) ch.series = [ch.labelCol === 0 ? 1 : 0].filter((x) => x < stColsCount(s)); });
    ST.focus = null; stTouch(s, true);
  },
  stSort: (el) => {
    const s = curSheet(), c = ST.focus?.c; if (c == null) return;
    const dir = el.dataset.id === 'desc' ? -1 : 1, body = s.rows.slice(1);
    if (body.some((r) => r.some((x) => typeof x === 'string' && x[0] === '='))) return toast('لا يمكن الترتيب والجدول يحتوي معادلات تشير إلى خلايا؛ انسخي القيم أولاً', 'err');
    body.sort((a, b) => { const x = stNum(a[c]), y = stNum(b[c]); if (x != null && y != null) return dir * (x - y); return dir * String(a[c]).localeCompare(String(b[c]), 'ar'); });
    s.rows = [s.rows[0], ...body]; s.charts.forEach((ch) => (ch.rows = null)); stTouch(s, true);
  },
  stXlsx: async () => { const s = curSheet(); const rows = s.rows.map((r, ri) => r.map((v, ci) => { if (ri === 0) return v; const x = stValue(s, ri, ci); return typeof x === 'number' ? x : String(x ?? ''); })); openBlob(await buildXlsx(rows, rows[0].map((_, i) => Math.min(40, Math.max(10, ...rows.map((r) => String(r[i] ?? '').length + 2)))), s.title), stSafeName(s.title) + '.xlsx', true); toast('حُفظ ملف Excel في «التنزيلات»', 'ok'); },
  stChartPick: (el) => { ui.stChart = el.dataset.id; render(); },
  stChartAdd: () => { const s = curSheet(); const c = stDefaultChart(s, curChart(s)?.type === 'column' ? 'doughnut' : 'column'); c.title = s.title; s.charts.push(c); ui.stChart = c.id; stTouch(s, true); },
  stChartDel: () => { const s = curSheet(); if (s.charts.length < 2) return; s.charts = s.charts.filter((c) => c.id !== curChart(s).id); ui.stChart = s.charts[0].id; stTouch(s, true); },
  stType: (el) => { const s = curSheet(); curChart(s).type = el.dataset.id; stTouch(s, true); },
  stPal: (el) => { const s = curSheet(); curChart(s).palette = el.dataset.id; stTouch(s, true); },
  stRowsAll: () => { const s = curSheet(); curChart(s).rows = null; stTouch(s, true); },
  stRowsNone: () => { const s = curSheet(); curChart(s).rows = []; stTouch(s, true); },
  stPng: async () => { const s = curSheet(), ch = curChart(s); try { openBlob(await svgToPng(chartSVG(s, ch), 2), stSafeName(ch.title || s.title) + '.png', true); toast('حُفظت الصورة في «التنزيلات»', 'ok'); } catch (e) { toast(e.message, 'err'); } },
  stCopy: async () => {
    const s = curSheet(), ch = curChart(s);
    try { const b = await svgToPng(chartSVG(s, ch), 2); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toast('نُسخ الرسم؛ الصقيه في Word أو PowerPoint أو واتساب بـ Ctrl+V', 'ok'); } catch { toast('تعذّر النسخ؛ استخدمي «حفظ صورة»', 'err'); }
  },
  stWord: async () => { const s = curSheet(), ch = curChart(s); try { const box = document.createElement('div'); box.innerHTML = await stChartDocHtml(s, ch); openBlob(await htmlToDocx(box), stSafeName(ch.title || s.title) + '.docx', true); toast('حُفظ ملف Word في «التنزيلات»', 'ok'); } catch (e) { toast('تعذّر التصدير: ' + e.message, 'err'); } },
  stPrint: () => { const s = curSheet(), ch = curChart(s); $('#print').innerHTML = `<div class="doc-print st-print">${chartSVG(s, ch)}${ch.type === 'kpi' ? '' : '<p><br></p>' + stTableHtml(s, ch)}</div>`; setTimeout(() => window.print(), 50); },
  stToDoc: async () => { const s = curSheet(), ch = curChart(s); db.documents = db.documents || []; const d = { id: uid(), title: ch.title || s.title, html: await stChartDocHtml(s, ch), updatedAt: todayISO() }; db.documents.push(d); DOCS.id = d.id; ui.tool = 'docs'; ui.view = 'tools'; commit(); toast('فُتح الرسم في محرر المستندات؛ أضيفي عليه ما تشائين', 'ok'); },
});
Object.assign(CHANGES, {
  stTitle: (el) => { const s = curSheet(); const old = s.title; s.title = el.value.trim() || old; s.charts.forEach((c) => { if (c.title === old) c.title = s.title; }); stTouch(s, true); },
  stCell: (el) => {
    const s = curSheet(), r = +el.dataset.r, c = +el.dataset.c;
    const v = el.value.trim(); stSetCell(s, r, c, v); el.dataset.raw = v; el.classList.toggle('f', v[0] === '=');
    if (r === 0 || (v[0] === '=' ? false : stNum(v) != null) !== el.classList.contains('num')) { stTouch(s, true); return; }
    stTouch(s);
  },
  stCh: (el) => { const s = curSheet(), ch = curChart(s), k = el.dataset.k; ch[k] = k === 'labelCol' ? +el.value : el.value; if (k === 'labelCol') ch.series = ch.series.filter((x) => x !== ch.labelCol); stTouch(s, k !== 'title' && k !== 'subtitle'); if (k === 'title') $$('.st-charts .on').forEach((b) => (b.textContent = cut(el.value, 18))); },
  stChB: (el) => { const s = curSheet(); curChart(s)[el.dataset.k] = el.checked; el.closest('.st-opt'); stTouch(s); },
  stSeries: (el) => { const s = curSheet(), ch = curChart(s), c = +el.dataset.id; ch.series = el.checked ? [...new Set([...ch.series, c])].sort((a, b) => a - b) : ch.series.filter((x) => x !== c); el.parentElement.classList.toggle('on', el.checked); stTouch(s); },
  stRow: (el) => { const s = curSheet(), ch = curChart(s), r = +el.dataset.id; const all = s.rows.slice(1).map((_, i) => i + 1); let set = new Set(ch.rows || all); el.checked ? set.add(r) : set.delete(r); ch.rows = set.size === all.length ? null : [...set]; el.parentElement.classList.toggle('on', el.checked); stTouch(s); },
});
// تحرير الخلايا: إظهار المعادلة عند التحرير، والتنقل بالأسهم وEnter، واللصق من Excel
document.addEventListener('focusin', (e) => {
  const el = e.target.closest?.('.st-cell'); if (!el) return;
  if (el.dataset.raw && el.dataset.raw[0] === '=') el.value = el.dataset.raw;
  ST.focus = { r: +el.dataset.r, c: +el.dataset.c };
  const ref = $('#stRef'); if (ref) ref.textContent = stCellRef(ST.focus.r, ST.focus.c) + (el.dataset.raw?.[0] === '=' ? '  ' + el.dataset.raw : '');
  $$('.st-grid th.on').forEach((x) => x.classList.remove('on'));
  $(`.st-grid thead th:nth-child(${ST.focus.c + 2})`)?.classList.add('on'); el.closest('tr')?.firstElementChild?.classList.add('on');
  $$('.st-tools [disabled]').forEach((b) => { if (b.dataset.act !== 'stRowDel' || ST.focus.r > 0) b.disabled = false; });
});
document.addEventListener('focusout', (e) => {
  const el = e.target.closest?.('.st-cell'); if (!el) return;
  const s = curSheet(); if (s && el.dataset.raw?.[0] === '=' && el.value === el.dataset.raw) el.value = stShown(s, +el.dataset.r, +el.dataset.c);
});
document.addEventListener('keydown', (e) => {
  const el = e.target.closest?.('.st-cell'); if (!el) return;
  const r = +el.dataset.r, c = +el.dataset.c;
  const mv = { Enter: [e.shiftKey ? -1 : 1, 0], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key];
  const side = e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : 0;
  if (!mv && !side) return;
  e.preventDefault();
  if (el.value.trim() !== (el.dataset.raw || '')) CHANGES.stCell(el);
  let nr = r + (mv ? mv[0] : 0), nc = c + side;
  const s = curSheet();
  if (nr >= s.rows.length && e.key === 'Enter' && nr <= ST_SHOW_ROWS) { s.rows.push(Array(stColsCount(s)).fill('')); stTouch(s, true); }
  setTimeout(() => { const t = $(`.st-cell[data-r="${Math.max(0, nr)}"][data-c="${Math.max(0, nc)}"]`); if (t) { t.focus(); t.select(); } }, 30);
}, true);
document.addEventListener('paste', (e) => {
  const el = e.target.closest?.('.st-cell'); if (!el) return;
  const txt = e.clipboardData?.getData('text/plain') || '';
  if (!/[\t\n]/.test(txt.replace(/\r?\n$/, ''))) return; // لصق عادي داخل خلية
  e.preventDefault();
  const s = curSheet(), r0 = +el.dataset.r, c0 = +el.dataset.c;
  const lines = txt.replace(/\r/g, '').replace(/\n$/, '').split('\n').slice(0, ST_MAX_ROWS);
  lines.forEach((ln, i) => ln.split('\t').forEach((v, j) => stSetCell(s, r0 + i, c0 + j, v.trim())));
  stNormalize(s); stTouch(s, true); toast(`لُصقت ${lines.length} صفوف`, 'ok');
});
