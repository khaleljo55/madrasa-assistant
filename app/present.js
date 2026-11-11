// ═════════════ 🎞️ مركز العروض والملفات التعريفية (1.0.5) ═════════════
// مولّد عروض: دورة تدريبية، ورشة عمل، مبادرة، ملف تعريفي.
// نموذج بيانات ← شرائح جاهزة بتصميم موحّد ← تعديل كل شريحة ← تصدير PowerPoint قابل للتحرير أو PDF.
// محرك تخطيط واحد يرسم الشريحة للمعاينة (SVG) وللباوربوينت (PptxGenJS) وللـ PDF، فتتطابق المخرجات.

(function addNavPresent() {
  const org = NAV_TREE.find((x) => x.group === 'org');
  const i = org.items.findIndex((x) => x.id === 'letters');
  org.items.splice(i >= 0 ? i + 1 : org.items.length, 0, { id: 'present', ic: '🎞️', label: 'مركز العروض' });
  NAV.length = 0; NAV.push(...NAV_TREE.flatMap((n) => (n.items ? n.items : [n])));
})();
addHook('beforeStart', () => { if (!Array.isArray(db.presentations)) db.presentations = []; });
DSIZES.slide = [1280, 720, 'شريحة عرض 16:9'];

const PR = { ret: null, timer: null };
const PW = 1280, PH = 720, PM = 80;
const PR_FONT = '"Segoe UI", Tahoma, Arial, sans-serif', PR_FACE = 'Segoe UI';
const PR_THEMES = {
  emerald: { name: 'زمردي', p: '#0f6b5c', a: '#d4a23a', dark: '#0b3d35', soft: '#e8f3f0', ink: '#1d2b28', muted: '#5f726d', light: '#cfe7e1' },
  navy: { name: 'كحلي', p: '#1e3a5f', a: '#3fa7d6', dark: '#0f2238', soft: '#eaf1f8', ink: '#1b2533', muted: '#5a6b80', light: '#c9dcef' },
  plum: { name: 'بنفسجي', p: '#5b2a86', a: '#e0a43a', dark: '#341a4f', soft: '#f3edf9', ink: '#261c30', muted: '#6c5f78', light: '#dccbee' },
  rose: { name: 'وردي', p: '#a63d5e', a: '#e8b04a', dark: '#5e1f33', soft: '#fbeef2', ink: '#2e1a21', muted: '#7d5d68', light: '#f3cfdb' },
  slate: { name: 'رمادي', p: '#334155', a: '#0ea5a4', dark: '#0f172a', soft: '#f1f5f9', ink: '#111827', muted: '#64748b', light: '#cbd5e1' },
  sand: { name: 'رملي', p: '#8a5a2b', a: '#2f7d6d', dark: '#4a2f17', soft: '#f8f1e7', ink: '#2b1d10', muted: '#7a6650', light: '#ead8c0' },
};
const PR_LAYOUTS = [
  ['cover', '🎬', 'الغلاف', 'بيانات الغلاف: سطر في كل سطر (مقدّمة العرض، التاريخ، المكان)'],
  ['section', '🔖', 'فاصل قسم', 'وصف قصير للقسم (اختياري)'],
  ['bullets', '•', 'نقاط', 'نقطة في كل سطر'],
  ['bulletsImage', '🖼️', 'نقاط وصورة', 'نقطة في كل سطر، وأضيفي صورة'],
  ['cards', '🗂️', 'بطاقات', 'بطاقة في كل سطر بالشكل: العنوان: الوصف'],
  ['agenda', '🔢', 'خطوات مرقّمة', 'خطوة في كل سطر، ويمكن كتابة: الوقت — النشاط'],
  ['stats', '📊', 'أرقام', 'في كل سطر: الرقم: الوصف (مثال 120: طالبة مستفيدة)'],
  ['text', '📝', 'فقرة', 'اكتبي الفقرة'],
  ['quote', '❝', 'اقتباس / آية', 'النص، والسطر الأخير للمصدر'],
  ['image', '🏞️', 'صورة كاملة', 'تعليق تحت الصورة (اختياري)'],
  ['chart', '📈', 'رسم بياني', 'تعليق تحت الرسم (اختياري)'],
  ['closing', '🙏', 'الختام', 'سطر في كل سطر: كلمة ختام وبيانات التواصل'],
];
const prLayout = (k) => PR_LAYOUTS.find((x) => x[0] === k) || PR_LAYOUTS[2];

// ───── أدوات النص ─────
const prLines = (t) => String(t || '').split('\n').map((s) => s.trim()).filter(Boolean);
const prSplit = (s) => { const m = /^(.+?)\s*(?:[:：]|—|–|\s-\s)\s*(.+)$/.exec(s); return m ? [m[1].trim(), m[2].trim()] : [s.trim(), '']; };
const _prCtx = document.createElement('canvas').getContext('2d');
const prPx = (pt) => (pt * 96) / 72;
function prMeasure(t, px, bold) { _prCtx.font = `${bold ? 'bold ' : ''}${px}px ${PR_FONT}`; return _prCtx.measureText(t).width; }
function prWrap(text, px, bold, w) {
  const out = [];
  String(text).split('\n').forEach((par) => {
    const words = par.split(/\s+/).filter(Boolean); if (!words.length) { out.push(''); return; }
    let line = '';
    words.forEach((wd) => { const t = line ? line + ' ' + wd : wd; if (!line || prMeasure(t, px, bold) <= w) line = t; else { out.push(line); line = wd; } });
    out.push(line);
  });
  return out;
}
// تصغير الخط تلقائياً حتى يتسع النص لمساحته (يُستخدم الحجم نفسه في PowerPoint)
function prFit(el) {
  for (let pt = el.pt; ; pt--) {
    const px = prPx(pt), lh = px * el.lh, gap = px * el.gap, indent = el.bullet ? px * 1.15 : 0;
    const lines = []; el.paras.forEach((p, pi) => prWrap(p, px, el.bold, Math.max(20, el.w - indent)).forEach((l, li) => lines.push({ t: l, first: li === 0, pi })));
    const H = lines.length * lh + gap * Math.max(0, el.paras.length - 1);
    if (H <= el.h || pt <= el.min) return { pt, px, lh, gap, indent, lines, H };
  }
}

// ───── عناصر الرسم ─────
const pR = (x, y, w, h, fill, o = {}) => ({ t: 'rect', x, y, w, h, fill, r: o.r || 0, alpha: o.alpha ?? 1, line: o.line || null, lw: o.lw || 0 });
const pE = (x, y, w, h, fill, o = {}) => ({ t: 'ellipse', x, y, w, h, fill, alpha: o.alpha ?? 1, line: o.line || null, lw: o.lw || 0 });
const pT = (x, y, w, h, paras, o = {}) => ({ t: 'text', x, y, w, h, paras: (Array.isArray(paras) ? paras : [paras]).map(String).filter((s) => s !== ''), pt: o.pt || 20, min: o.min || Math.max(10, Math.round((o.pt || 20) * 0.55)), color: o.color || '#1d2b28', bold: !!o.bold, align: o.align || 'right', valign: o.valign || 'top', bullet: !!o.bullet, mark: o.mark || null, lh: o.lh || 1.3, gap: o.gap ?? 0.45 });
const pI = (x, y, w, h, img, o = {}) => ({ t: 'img', x, y, w, h, img, fit: o.fit || 'cover', r: o.r || 0 });

function prElements(pres, s, idx, total, mode) {
  const th = PR_THEMES[pres.theme] || PR_THEMES.emerald, E = [];
  const kind = PR_KINDS[pres.kind] || PR_KINDS.blank;
  const items = prLines(s.body);
  const img = s.layout === 'chart' ? (s.chart ? { chart: s.chart } : null) : s.image;
  const hole = (x, y, w, h, label) => { if (mode === 'preview') E.push(pR(x, y, w, h, th.soft, { r: 18, line: th.light, lw: 2 }), pT(x, y, w, h, label, { pt: 16, color: th.muted, align: 'center', valign: 'middle' })); };
  const dark = (deco = true) => {
    E.push(pR(0, 0, PW, PH, th.p));
    if (deco) E.push(pE(-220, -200, 660, 660, '#ffffff', { alpha: 0.06 }), pE(-90, 420, 420, 420, th.a, { alpha: 0.2 }), pE(170, 130, 170, 170, '#ffffff', { alpha: 0.07 }), pE(PW - 170, PH - 150, 300, 300, '#ffffff', { line: '#ffffff', lw: 2, alpha: 0.12 }));
  };
  const chrome = () => {
    E.push(pR(0, 0, PW, PH, '#ffffff'), pR(PW - 14, 0, 14, PH, th.p), pR(PW - 14, 0, 14, 120, th.a));
    const tw = PW - 2 * PM - (pres.logo ? 110 : 0);
    E.push(pT(PW - PM - tw, 38, tw, 70, s.title || '', { pt: 30, min: 18, bold: true, color: th.dark, valign: 'middle', lh: 1.15 }));
    E.push(pR(PW - PM - 84, 114, 84, 6, th.a, { r: 3 }));
    if (pres.logo) E.push(pI(PM, 36, 96, 70, pres.logo, { fit: 'contain' }));
    E.push(pR(PM, PH - 46, 46, 26, th.soft, { r: 13 }), pT(PM, PH - 46, 46, 26, String(idx + 1), { pt: 11, bold: true, color: th.p, align: 'center', valign: 'middle', min: 8 }));
    E.push(pT(PM + 70, PH - 46, PW - 2 * PM - 70, 26, [pres.school, pres.title].filter(Boolean).join(' · '), { pt: 11, color: th.muted, valign: 'middle', min: 8 }));
  };
  const CX = PM, CY = 146, CW = PW - 2 * PM, CH = PH - 146 - 72;
  const bullets = (x, y, w, h, pts, pt = 26) => {
    if (pts.length > 7 && w > 700) {
      const half = Math.ceil(pts.length / 2), cw = (w - 40) / 2;
      E.push(pT(x + cw + 40, y, cw, h, pts.slice(0, half), { pt: pt - 2, bullet: true, mark: th.a, color: th.ink, lh: 1.3 }));
      E.push(pT(x, y, cw, h, pts.slice(half), { pt: pt - 2, bullet: true, mark: th.a, color: th.ink, lh: 1.3 }));
    } else E.push(pT(x, y, w, h, pts, { pt, bullet: true, mark: th.a, color: th.ink, lh: 1.3 }));
  };
  const grid = (n, maxH = 240) => {
    const cols = n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols), gap = 22;
    const cw = (CW - gap * (cols - 1)) / cols, ch = Math.min(maxH, (CH - 10 - gap * (rows - 1)) / rows);
    const y0 = CY + 10 + (CH - 10 - (rows * ch + gap * (rows - 1))) / 2;
    return [...Array(n).keys()].map((i) => { const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols), off = ((cols - inRow) * (cw + gap)) / 2; return [CX + CW - (c + 1) * cw - c * gap - off, y0 + r * (ch + gap), cw, ch]; });
  };

  switch (s.layout) {
    case 'cover': {
      dark(!s.image);
      let x0 = PM, w0 = PW - 2 * PM;
      if (s.image) { E.push(pI(0, 0, PW * 0.42, PH, s.image), pR(PW * 0.42 - 3, 0, 8, PH, th.a)); x0 = PW * 0.42 + 64; w0 = PW - PM - x0; }
      const right = x0 + w0;
      if (pres.logo) E.push(pI(right - 120, 46, 120, 84, pres.logo, { fit: 'contain' }));
      const tag = kind.label, tw = prMeasure(tag, prPx(15), true) + 44;
      E.push(pR(right - tw, 150, tw, 40, th.a, { r: 20 }), pT(right - tw, 150, tw, 40, tag, { pt: 15, bold: true, color: '#ffffff', align: 'center', valign: 'middle', min: 10 }));
      E.push(pT(x0, 210, w0, 196, s.title || pres.title, { pt: 46, min: 24, bold: true, color: '#ffffff', valign: 'bottom', lh: 1.2 }));
      E.push(pT(x0, 420, w0, 84, s.sub || '', { pt: 22, min: 14, color: th.light, lh: 1.3 }));
      E.push(pR(right - 120, 516, 120, 5, th.a, { r: 2.5 }));
      E.push(pT(x0, 540, w0, 104, items, { pt: 17, min: 11, color: '#ffffff', lh: 1.35, gap: 0.2 }));
      if (pres.school) E.push(pT(x0, PH - 64, w0, 34, pres.school, { pt: 14, min: 9, color: th.light, valign: 'middle' }));
      break;
    }
    case 'section': {
      dark(true);
      const n = pres.slides.slice(0, idx + 1).filter((x) => x.layout === 'section').length;
      E.push(pT(PM, 150, PW - 2 * PM, 210, String(n).padStart(2, '0'), { pt: 120, min: 60, bold: true, color: th.a, valign: 'bottom', lh: 1 }));
      E.push(pR(PW - PM - 120, 376, 120, 6, '#ffffff', { r: 3, alpha: 0.85 }));
      E.push(pT(PM, 396, PW - 2 * PM, 120, s.title || '', { pt: 42, min: 22, bold: true, color: '#ffffff', lh: 1.2 }));
      E.push(pT(PM, 520, PW - 2 * PM, 110, items, { pt: 20, min: 12, color: th.light, lh: 1.35 }));
      break;
    }
    case 'bullets': chrome(); bullets(CX, CY + 14, CW, CH - 14, items); break;
    case 'bulletsImage': {
      chrome();
      if (s.image) { E.push(pI(CX, CY + 10, CW * 0.43, CH - 16, s.image, { r: 20 })); bullets(CX + CW * 0.47, CY + 14, CW * 0.53, CH - 14, items, 22); }
      else if (mode === 'preview') { hole(CX, CY + 10, CW * 0.43, CH - 16, '🖼️ أضيفي صورة'); bullets(CX + CW * 0.47, CY + 14, CW * 0.53, CH - 14, items, 22); }
      else bullets(CX, CY + 14, CW, CH - 14, items);
      break;
    }
    case 'cards': {
      chrome();
      const list = items.slice(0, 8).map(prSplit), cells = grid(list.length);
      list.forEach(([h, d], i) => {
        const [x, y, w, hh] = cells[i], c = i % 2 ? th.a : th.p;
        E.push(pR(x, y, w, hh, th.soft, { r: 18 }), pR(x + w - 7, y + 20, 7, hh - 40, c, { r: 3.5 }));
        E.push(pE(x + w - 64, y + 20, 40, 40, c), pT(x + w - 64, y + 20, 40, 40, String(i + 1), { pt: 15, bold: true, color: '#ffffff', align: 'center', valign: 'middle', min: 9 }));
        if (d) { E.push(pT(x + 20, y + 20, w - 96, 40, h, { pt: 20, min: 12, bold: true, color: th.dark, valign: 'middle', lh: 1.15 })); E.push(pT(x + 24, y + 76, w - 48, hh - 96, d, { pt: 19, min: 10, color: th.ink, lh: 1.4, valign: 'middle' })); }
        else E.push(pT(x + 20, y + 66, w - 40, hh - 86, h, { pt: 21, min: 12, bold: true, color: th.dark, align: 'center', valign: 'middle', lh: 1.25 }));
      });
      break;
    }
    case 'agenda': {
      chrome();
      const list = items.slice(0, 12), two = list.length > 6, per = two ? Math.ceil(list.length / 2) : list.length;
      const colW = two ? (CW - 50) / 2 : CW, rh = Math.min(98, (CH - 10) / per);
      list.forEach((it, i) => {
        const col = two && i >= per ? 1 : 0, r = col ? i - per : i;
        const right = CX + CW - col * (colW + 50), y = CY + 14 + r * rh, [h, d] = prSplit(it);
        if (r < (col ? list.length - per : per) - 1) E.push(pR(right - 25, y + rh / 2, 3, rh, th.light));
        E.push(pE(right - 48, y + (rh - 46) / 2, 46, 46, i % 2 ? th.a : th.p), pT(right - 48, y + (rh - 46) / 2, 46, 46, String(i + 1), { pt: 16, bold: true, color: '#ffffff', align: 'center', valign: 'middle', min: 9 }));
        if (d) { E.push(pT(right - colW, y + 4, colW - 70, rh / 2 - 2, h, { pt: 19, min: 11, bold: true, color: th.dark, valign: 'bottom', lh: 1.1 })); E.push(pT(right - colW, y + rh / 2 + 2, colW - 70, rh / 2 - 6, d, { pt: 15, min: 9, color: th.muted, lh: 1.15 })); }
        else E.push(pT(right - colW, y, colW - 70, rh, h, { pt: 22, min: 11, color: th.ink, valign: 'middle', lh: 1.15 }));
      });
      break;
    }
    case 'stats': {
      chrome();
      const list = items.slice(0, 8).map(prSplit), cells = grid(list.length, 250);
      list.forEach(([num, lab], i) => {
        const [x, y, w, hh] = cells[i];
        E.push(pR(x, y, w, hh, th.soft, { r: 22 }));
        E.push(pT(x + 14, y + hh * 0.1, w - 28, hh * 0.5, num, { pt: 46, min: 18, bold: true, color: i % 2 ? th.a : th.p, align: 'center', valign: 'middle', lh: 1 }));
        E.push(pT(x + 18, y + hh * 0.6, w - 36, hh * 0.3, lab, { pt: 17, min: 10, color: th.ink, align: 'center', lh: 1.25 }));
        E.push(pR(x + w / 2 - 24, y + hh - 16, 48, 5, th.a, { r: 2.5 }));
      });
      break;
    }
    case 'text': chrome(); E.push(pR(CX + CW - 6, CY + 16, 6, CH - 30, th.a, { r: 3 }), pT(CX, CY + 12, CW - 34, CH - 20, items, { pt: 23, min: 12, color: th.ink, lh: 1.6, gap: 0.6 })); break;
    case 'quote': {
      E.push(pR(0, 0, PW, PH, th.soft), pR(PW - 14, 0, 14, PH, th.p));
      if (s.title) E.push(pT(PM, 50, PW - 2 * PM, 44, s.title, { pt: 18, bold: true, color: th.p, align: 'center', valign: 'middle' }));
      E.push(pT(PW / 2 - 60, 96, 120, 120, '❝', { pt: 96, color: th.a, align: 'center', valign: 'middle', min: 40, lh: 1 }));
      const src = items.length > 1 ? items[items.length - 1] : '', q = items.length > 1 ? items.slice(0, -1) : items;
      E.push(pT(150, 220, PW - 300, 290, q, { pt: 32, min: 16, bold: true, color: th.dark, align: 'center', valign: 'middle', lh: 1.55 }));
      if (src) E.push(pR(PW / 2 - 40, 536, 80, 4, th.a, { r: 2 }), pT(150, 556, PW - 300, 50, src, { pt: 18, color: th.p, align: 'center', valign: 'middle' }));
      break;
    }
    case 'image': case 'chart': {
      chrome();
      const cap = items.join(' '), h = CH - (cap ? 56 : 6);
      if (img) E.push(pI(CX, CY + 6, CW, h, img, { fit: 'contain', r: s.layout === 'image' ? 16 : 0 }));
      else hole(CX, CY + 6, CW, h, s.layout === 'chart' ? '📈 اختاري رسماً بيانياً من «الجداول والإحصائيات»' : '🖼️ أضيفي صورة');
      if (cap) E.push(pT(CX, CY + h + 14, CW, 40, cap, { pt: 16, color: th.muted, align: 'center', valign: 'middle' }));
      break;
    }
    case 'closing': {
      dark(true);
      if (pres.logo) E.push(pI(PW / 2 - 60, 70, 120, 84, pres.logo, { fit: 'contain' }));
      E.push(pT(PM, 190, PW - 2 * PM, 140, s.title || 'شكراً لكم', { pt: 58, min: 28, bold: true, color: '#ffffff', align: 'center', valign: 'middle', lh: 1.15 }));
      E.push(pR(PW / 2 - 60, 350, 120, 5, th.a, { r: 2.5 }));
      E.push(pT(PM + 80, 380, PW - 2 * PM - 160, 200, items, { pt: 21, min: 12, color: th.light, align: 'center', lh: 1.45, gap: 0.25 }));
      if (pres.school) E.push(pT(PM, PH - 80, PW - 2 * PM, 36, pres.school, { pt: 15, color: '#ffffff', align: 'center', valign: 'middle' }));
      break;
    }
  }
  return E;
}

// ───── المعاينة (SVG) ─────
let _prClip = 0;
function prImgHref(img) { if (!img) return ''; if (img.chart) { const sh = db.sheets?.find((x) => x.id === img.chart.sheet); const ch = sh?.charts.find((c) => c.id === img.chart.chart); return sh && ch ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(chartSVG(sh, ch)) : ''; } return img.src || ''; }
function prSVG(els) {
  let o = '';
  els.forEach((e) => {
    const op = e.alpha != null && e.alpha < 1 ? ` fill-opacity="${e.alpha}"` : '';
    if (e.t === 'rect') o += `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${e.r}" fill="${e.fill || 'none'}"${op}${e.line ? ` stroke="${e.line}" stroke-width="${e.lw}"` : ''}/>`;
    else if (e.t === 'ellipse') o += `<ellipse cx="${e.x + e.w / 2}" cy="${e.y + e.h / 2}" rx="${e.w / 2}" ry="${e.h / 2}" fill="${e.line ? 'none' : e.fill}"${e.line ? ` stroke="${e.line}" stroke-width="${e.lw}" stroke-opacity="${e.alpha}"` : op}/>`;
    else if (e.t === 'img') {
      const href = prImgHref(e.img); if (!href) return;
      const id = 'prc' + ++_prClip, par = e.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
      o += `<clipPath id="${id}"><rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${e.r}"/></clipPath><image x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" preserveAspectRatio="${par}" clip-path="url(#${id})" href="${esc(href)}"/>`;
    } else if (e.t === 'text' && e.paras.length) {
      const L = prFit(e);
      let y = e.valign === 'middle' ? e.y + (e.h - L.H) / 2 : e.valign === 'bottom' ? e.y + e.h - L.H : e.y, prev = 0;
      const x = e.align === 'center' ? e.x + (e.w - L.indent) / 2 : e.align === 'left' ? e.x : e.x + e.w - L.indent;
      const anchor = e.align === 'center' ? 'middle' : e.align === 'left' ? 'end' : 'start';
      L.lines.forEach((ln, i) => {
        if (i && ln.pi !== prev) y += L.gap; prev = ln.pi;
        const base = y + L.lh / 2 + L.px * 0.36;
        if (e.bullet && ln.first) o += `<circle cx="${e.x + e.w - L.px * 0.38}" cy="${base - L.px * 0.33}" r="${L.px * 0.17}" fill="${e.mark || e.color}"/>`;
        o += `<text x="${x}" y="${base}" direction="rtl" text-anchor="${anchor}" font-size="${L.px}" ${e.bold ? 'font-weight="700" ' : ''}fill="${e.color}">${esc(ln.t)}</text>`;
        y += L.lh;
      });
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}" width="${PW}" height="${PH}" direction="ltr" style="direction:ltr" font-family='${PR_FONT}'>${o}</svg>`;
}
const prSlideSVG = (pres, i, mode = 'preview') => prSVG(prElements(pres, pres.slides[i], i, pres.slides.length, mode));

// ───── الصور ─────
const prLoadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('تعذّر فتح الصورة')); im.src = src; });
async function prNormalize(blobOrUrl, max = 1600) {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  try {
    const im = await prLoadImg(url), k = Math.min(1, max / Math.max(im.width, im.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
    const x = cv.getContext('2d'); x.drawImage(im, 0, 0, cv.width, cv.height);
    const png = cv.toDataURL('image/png'), small = png.length < 700000 ? png : cv.toDataURL('image/jpeg', 0.86);
    return { src: small, w: cv.width, h: cv.height };
  } finally { if (typeof blobOrUrl !== 'string') URL.revokeObjectURL(url); }
}
async function designToDataUrl(d) {
  const [w, h] = DSIZES[d.data.size] || DSIZES.landscape;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d');
  ctx.fillStyle = d.data.bg || '#fff'; ctx.fillRect(0, 0, w, h);
  const objs = JSON.parse(JSON.stringify(d.data.objs));
  for (const o of objs) if (o.t === 'img') o._el = await prLoadImg(o.src).catch(() => null);
  objs.forEach((o) => dPaint(ctx, o));
  return cv.toDataURL('image/png');
}
// تجهيز صورة للتصدير: قصّ «cover» إلى نسبة الإطار، وحساب موضع «contain»
async function prPrepImg(e, scale = 1.5) {
  let href = prImgHref(e.img); if (!href) return null;
  if (e.img.chart) { const b = await svgToPng(decodeURIComponent(href.split(',').slice(1).join(',')), 2); href = await blobToDataURL(b); }
  const im = await prLoadImg(href);
  if (e.fit === 'contain') { const k = Math.min(e.w / im.width, e.h / im.height), w = im.width * k, h = im.height * k; return { data: href, x: e.x + (e.w - w) / 2, y: e.y + (e.h - h) / 2, w, h }; }
  const cv = document.createElement('canvas'); cv.width = Math.round(e.w * scale); cv.height = Math.round(e.h * scale);
  const k = Math.max(cv.width / im.width, cv.height / im.height), sw = cv.width / k, sh = cv.height / k;
  cv.getContext('2d').drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
  return { data: /^data:image\/png/.test(href) ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9), x: e.x, y: e.y, w: e.w, h: e.h };
}

// ───── التصدير ─────
const loadPptx = () => loadScript('lib/pptxgen.bundle.js').then(() => window.PptxGenJS);
const pin = (px) => Math.round((px / 96) * 1000) / 1000;
const hex = (c) => String(c || '#000000').replace('#', '').toUpperCase();
async function prExportPptx(pres) {
  const P = new (await loadPptx())();
  P.layout = 'LAYOUT_WIDE'; P.rtlMode = true; P.title = pres.title; P.company = pres.school || ''; P.author = pres.fields?.presenter || db.settings.employeeName || '';
  P.theme = { headFontFace: PR_FACE, bodyFontFace: PR_FACE, lang: 'ar-SA' };
  for (let i = 0; i < pres.slides.length; i++) {
    const s = pres.slides[i], sl = P.addSlide();
    for (const e of prElements(pres, s, i, pres.slides.length, 'export')) {
      const box = { x: pin(e.x), y: pin(e.y), w: pin(e.w), h: pin(e.h) };
      if (e.t === 'rect' || e.t === 'ellipse') {
        const fill = e.line ? { type: 'none' } : { color: hex(e.fill), transparency: Math.round((1 - (e.alpha ?? 1)) * 100) };
        const line = e.line ? { color: hex(e.line), width: (e.lw * 72) / 96, transparency: Math.round((1 - (e.alpha ?? 1)) * 100) } : { type: 'none' };
        const shape = e.t === 'ellipse' ? P.ShapeType.ellipse : e.r ? P.ShapeType.roundRect : P.ShapeType.rect;
        sl.addShape(shape, { ...box, fill, line, ...(e.r && e.t === 'rect' ? { rectRadius: pin(e.r) } : {}) });
      } else if (e.t === 'img') {
        const p = await prPrepImg(e); if (!p) continue;
        sl.addImage({ data: p.data.replace(/^data:/, ''), x: pin(p.x), y: pin(p.y), w: pin(p.w), h: pin(p.h) });
      } else if (e.t === 'text' && e.paras.length) {
        const L = prFit(e), n = e.paras.length;
        sl.addText(e.paras.map((t, k) => ({ text: t, options: { rtlMode: true, lang: 'ar-SA', align: e.align, bullet: e.bullet ? { indent: Math.round(L.indent * 0.75) } : false, breakLine: k < n - 1, paraSpaceAfter: k < n - 1 ? Math.round(L.pt * e.gap) : 0 } })),
          { ...box, fontFace: PR_FACE, fontSize: L.pt, color: hex(e.color), bold: e.bold, align: e.align, valign: e.valign, rtlMode: true, lang: 'ar-SA', margin: 0, lineSpacingMultiple: Math.round((e.lh / 1.2) * 100) / 100, fit: 'none', wrap: true });
      }
    }
    if (s.notes) sl.addNotes(s.notes);
  }
  return P.write({ outputType: 'blob' });
}
async function prSlideJpeg(pres, i, scale = 1.5) {
  const els = prElements(pres, pres.slides[i], i, pres.slides.length, 'export');
  for (const e of els) if (e.t === 'img' && e.img?.chart) { const p = await prPrepImg({ ...e, fit: 'contain' }); e.img = p ? { src: p.data } : null; }
  const url = URL.createObjectURL(new Blob([prSVG(els)], { type: 'image/svg+xml' }));
  try {
    const im = await prLoadImg(url); const cv = document.createElement('canvas'); cv.width = PW * scale; cv.height = PH * scale;
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height);
    return await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.92));
  } finally { URL.revokeObjectURL(url); }
}
async function prExportPdf(pres) {
  const L = await loadPdfLib(); const doc = await L.PDFDocument.create();
  doc.setTitle(pres.title); doc.setCreator('المساعد الإداري');
  for (let i = 0; i < pres.slides.length; i++) {
    const jpg = await doc.embedJpg(await (await prSlideJpeg(pres, i)).arrayBuffer());
    doc.addPage([960, 540]).drawImage(jpg, { x: 0, y: 0, width: 960, height: 540 });
  }
  return new Blob([await doc.save()], { type: 'application/pdf' });
}

// ───── أنواع العروض ومولّداتها ─────
const S_ = (layout, title, body = '', extra = {}) => ({ id: uid(), layout, title, body: Array.isArray(body) ? body.filter(Boolean).join('\n') : body || '', image: null, chart: null, notes: '', ...extra });
const metaLines = (f, pl) => [f.presenter && `${pl}: ${f.presenter}`, [f.date, f.place].filter(Boolean).join(' · ')];
const infoCards = (pairs) => pairs.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
const cover = (f, pl) => S_('cover', f.title, metaLines(f, pl), { sub: f.subtitle || '' });
const closing = (f, extra) => S_('closing', f.thanks || 'شكراً لكم', [f.closingNote, ...(extra || [])]);
const axisSlides = (t) => prLines(t).filter((l) => /[:：]/.test(l)).map((l) => { const [h, d] = prSplit(l); return S_('bullets', h, d.split(/[،,؛;]\s*/).map((x) => x.trim()).filter(Boolean)); });
const axisNames = (t) => prLines(t).map((l) => prSplit(l)[0]);
const COMMON = (pl) => [
  { key: 'title', label: 'العنوان', type: 'text', required: true, full: true },
  { key: 'subtitle', label: 'العنوان الفرعي (اختياري)', type: 'text', full: true },
  { key: 'presenter', label: pl, type: 'text' },
  { key: 'date', label: 'التاريخ', type: 'text' },
];
const TA = (key, label, hint, rows = 3) => ({ key, label, type: 'textarea', full: true, hint, rows });
const PR_KINDS = {
  course: {
    label: 'دورة تدريبية', ic: '🎓', pl: 'المدربة', desc: 'أهداف ومحاور وأنشطة وتقييم',
    fields: () => [...COMMON('المدربة'), { key: 'target', label: 'الفئة المستهدفة', type: 'text' }, { key: 'duration', label: 'المدة / عدد الساعات', type: 'text' }, { key: 'place', label: 'المكان', type: 'text' },
      TA('goals', 'أهداف الدورة', 'هدف في كل سطر'), TA('axes', 'محاور الدورة', 'محور في كل سطر. لتفصيل محور في شريحة خاصة اكتبي: اسم المحور: نقطة، نقطة، نقطة', 4), TA('activities', 'الأنشطة التدريبية', 'نشاط في كل سطر'), TA('evaluation', 'أساليب التقييم', 'سطر لكل أسلوب', 2)],
    gen: (f) => [cover(f, 'المدربة'), S_('cards', 'معلومات الدورة', infoCards([['الفئة المستهدفة', f.target], ['المدة', f.duration], ['المكان', f.place], ['التاريخ', f.date], ['المدربة', f.presenter]])),
      S_('bullets', 'أهداف الدورة', prLines(f.goals)), S_('agenda', 'محاور الدورة', axisNames(f.axes)), ...axisSlides(f.axes),
      S_('bullets', 'الأنشطة التدريبية', prLines(f.activities)), S_('cards', 'أساليب التقييم', prLines(f.evaluation)), closing(f)],
  },
  workshop: {
    label: 'ورشة عمل', ic: '🛠️', pl: 'مقدّمة الورشة', desc: 'أهداف وبرنامج زمني ومخرجات',
    fields: () => [...COMMON('مقدّمة الورشة'), { key: 'target', label: 'الفئة المستهدفة', type: 'text' }, { key: 'duration', label: 'المدة', type: 'text' }, { key: 'place', label: 'المكان', type: 'text' },
      TA('goals', 'أهداف الورشة', 'هدف في كل سطر'), TA('schedule', 'برنامج الورشة', 'في كل سطر: الوقت — النشاط', 4), TA('materials', 'المواد والأدوات', 'سطر لكل أداة', 2), TA('outcomes', 'المخرجات المتوقعة', 'سطر لكل مخرج')],
    gen: (f) => [cover(f, 'مقدّمة الورشة'), S_('cards', 'معلومات الورشة', infoCards([['الفئة المستهدفة', f.target], ['المدة', f.duration], ['المكان', f.place], ['التاريخ', f.date]])),
      S_('bullets', 'أهداف الورشة', prLines(f.goals)), S_('agenda', 'برنامج الورشة', prLines(f.schedule)), S_('bullets', 'المواد والأدوات', prLines(f.materials)), S_('cards', 'المخرجات المتوقعة', prLines(f.outcomes)), closing(f)],
  },
  initiative: {
    label: 'مبادرة', ic: '🌱', pl: 'صاحبة المبادرة', desc: 'الفكرة والأهداف ومراحل التنفيذ ومؤشرات النجاح',
    fields: () => [...COMMON('صاحبة المبادرة'), TA('idea', 'فكرة المبادرة', 'فقرة قصيرة تعرّف بالمبادرة'), TA('goals', 'الأهداف', 'هدف في كل سطر'),
      { key: 'target', label: 'الفئة المستهدفة', type: 'text' }, { key: 'duration', label: 'مدة التنفيذ', type: 'text' }, { key: 'partners', label: 'الشركاء', type: 'text' },
      TA('phases', 'مراحل التنفيذ', 'في كل سطر: المرحلة — وصفها'), TA('indicators', 'مؤشرات النجاح', 'في كل سطر: الرقم: الوصف (مثال 90%: نسبة المشاركة)'), TA('team', 'فريق العمل والمسؤوليات', 'في كل سطر: الاسم: المسؤولية', 2)],
    gen: (f) => [cover(f, 'صاحبة المبادرة'), S_('text', 'فكرة المبادرة', f.idea), S_('bullets', 'أهداف المبادرة', prLines(f.goals)),
      S_('cards', 'نطاق المبادرة', infoCards([['الفئة المستهدفة', f.target], ['مدة التنفيذ', f.duration], ['الشركاء', f.partners]])), S_('agenda', 'مراحل التنفيذ', prLines(f.phases)),
      S_('stats', 'مؤشرات النجاح', prLines(f.indicators)), S_('cards', 'فريق العمل', prLines(f.team)), closing(f)],
  },
  profile: {
    label: 'ملف تعريفي', ic: '🏫', pl: 'إعداد', desc: 'نبذة ورؤية ورسالة وقيم وأرقام وإنجازات',
    fields: () => [...COMMON('إعداد'), TA('about', 'نبذة تعريفية', 'فقرة عن المدرسة أو البرنامج'), { key: 'vision', label: 'الرؤية', type: 'text', full: true }, { key: 'mission', label: 'الرسالة', type: 'text', full: true },
      TA('values', 'القيم', 'قيمة في كل سطر، ويمكن: القيمة: شرحها', 2), TA('numbers', 'بالأرقام', 'في كل سطر: الرقم: الوصف (مثال 350: طالبة)'), TA('programs', 'البرامج', 'برنامج في كل سطر'), TA('achievements', 'الإنجازات', 'إنجاز في كل سطر'), TA('contact', 'التواصل', 'سطر لكل وسيلة تواصل', 2)],
    gen: (f) => [cover(f, 'إعداد'), S_('text', 'نبذة تعريفية', f.about), S_('cards', 'الرؤية والرسالة', infoCards([['الرؤية', f.vision], ['الرسالة', f.mission]])), S_('cards', 'قيمنا', prLines(f.values)),
      S_('stats', 'بالأرقام', prLines(f.numbers)), S_('bulletsImage', 'برامجنا', prLines(f.programs)), S_('bullets', 'إنجازاتنا', prLines(f.achievements)), closing({ ...f, closingNote: '' }, prLines(f.contact))],
  },
  blank: { label: 'عرض تقديمي', ic: '📄', pl: 'مقدّمة العرض', desc: 'غلاف وختام، وتضيفين الشرائح بنفسك', fields: () => COMMON('مقدّمة العرض'), gen: (f) => [cover(f, 'مقدّمة العرض'), S_('bullets', 'عنوان الشريحة', ['النقطة الأولى', 'النقطة الثانية']), closing(f)] },
};
const PR_EXTRA = [{ key: 'closingNote', label: 'كلمة الختام (اختياري)', type: 'text', full: true }, { key: 'theme', label: 'ألوان العرض', type: 'select', options: Object.entries(PR_THEMES).map(([k, t]) => [k, t.name]) }];
const prKeep = (slides) => slides.filter((s) => ['cover', 'closing', 'section', 'bulletsImage', 'image', 'chart'].includes(s.layout) || prLines(s.body).length);
function prForm(kind, pres) {
  const K = PR_KINDS[kind];
  formModal({
    title: `${K.ic} ${pres ? 'تعديل بيانات' : 'إنشاء'} ${K.label}`, wide: true, fields: [...K.fields(), ...PR_EXTRA],
    values: pres ? { ...pres.fields, theme: pres.theme } : { presenter: db.settings.employeeName || '', date: fmtH(todayISO()), theme: 'emerald' },
    onSave: (v) => {
      const go = () => {
        const p = pres || { id: uid(), kind, logo: db.settings.presLogo || null, createdAt: new Date().toISOString() };
        Object.assign(p, { title: v.title, theme: v.theme, fields: v, school: db.settings.schoolName || '', slides: prKeep(K.gen(v)), updatedAt: new Date().toISOString() });
        if (!pres) db.presentations.push(p);
        ui.prId = p.id; ui.prSlide = 0; commit(); toast(`أُنشئ العرض: ${p.slides.length} شرائح، يمكنكِ تعديل أي شريحة`, 'ok');
      };
      if (pres) confirmBox('سيُعاد إنشاء الشرائح من البيانات الجديدة وتُستبدل تعديلات الشرائح الحالية. متابعة؟', go, 'نعم، أعيدي الإنشاء'); else go();
    },
  });
}

// ───── الواجهة ─────
const curPres = () => db.presentations.find((p) => p.id === ui.prId) || null;
const curSlide = (p = curPres()) => p && p.slides[Math.min(ui.prSlide || 0, p.slides.length - 1)];
const prName = (p) => String(p.title || 'عرض').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
function prPanel(p, s) {
  const L = prLayout(s.layout), needImg = ['cover', 'bulletsImage', 'image'].includes(s.layout);
  const charts = (db.sheets || []).flatMap((sh) => sh.charts.map((c) => [sh.id + '|' + c.id, `${cut(sh.title, 26)} — ${cut(c.title || '', 20)}`]));
  return `<div class="card pr-panel">
    <div class="section-title" style="margin-top:0">تخطيط الشريحة</div>
    <div class="pr-layouts">${PR_LAYOUTS.map(([k, ic, l]) => `<button class="${s.layout === k ? 'on' : ''}" data-act="prLayout" data-id="${k}" title="${l}"><span>${ic}</span>${l}</button>`).join('')}</div>
    <div class="field"><label>${s.layout === 'closing' ? 'العبارة الرئيسية' : 'العنوان'}</label><input class="input" data-change="prSl" data-k="title" data-live value="${esc(s.title || '')}"></div>
    ${s.layout === 'cover' ? `<div class="field"><label>العنوان الفرعي</label><input class="input" data-change="prSl" data-k="sub" data-live value="${esc(s.sub || '')}"></div>` : ''}
    <div class="field"><label>المحتوى</label><textarea class="input" rows="${['text', 'quote'].includes(s.layout) ? 7 : 6}" data-change="prSl" data-k="body" data-live>${esc(s.body || '')}</textarea><span class="hint">${L[3]}</span></div>
    ${needImg ? `<div class="field"><label>الصورة</label><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm primary" data-act="prImgMenu">${s.image ? '🔄 تغيير الصورة' : '🖼️ إضافة صورة'}</button>${s.image ? '<button class="btn sm danger" data-act="prImgDel">إزالة</button>' : ''}</div></div>` : ''}
    ${s.layout === 'chart' ? `<div class="field"><label>الرسم البياني</label>${charts.length ? `<select class="input" data-change="prChart"><option value="">— اختاري —</option>${charts.map(([v, l]) => `<option value="${v}" ${s.chart && v === s.chart.sheet + '|' + s.chart.chart ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><span class="hint">الرسم مرتبط بجدوله؛ أي تعديل في الأرقام يظهر في العرض.</span>` : '<div class="muted">لا توجد رسوم بعد. أنشئيها من «الجداول والإحصائيات».</div><button class="btn sm" data-act="nav" data-id="stats" style="margin-top:6px">📈 فتح الجداول والإحصائيات</button>'}</div>` : ''}
    <div class="field"><label>ملاحظات المتحدثة (تظهر في PowerPoint فقط)</label><textarea class="input" rows="2" data-change="prSl" data-k="notes">${esc(s.notes || '')}</textarea></div>
    <div class="pr-sacts"><button class="btn sm" data-act="prMove" data-id="-1" title="تقديم">▲</button><button class="btn sm" data-act="prMove" data-id="1" title="تأخير">▼</button><button class="btn sm" data-act="prDupSlide">⧉ تكرار</button><button class="btn sm danger" data-act="prDelSlide">🗑️ حذف</button></div>
  </div>`;
}
VIEWS.present = {
  actions: () => `<button class="btn primary" data-act="prNewMenu">＋ عرض جديد</button>`,
  render() {
    const list = db.presentations.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    let p = curPres(); if (!p && list.length && ui.prId !== '') { ui.prId = list[0].id; ui.prSlide = 0; p = list[0]; }
    const side = `<div class="card d-side">
      <div class="section-title" style="margin-top:0">إنشاء جديد</div>
      <div class="tpl-list">${Object.entries(PR_KINDS).map(([k, K]) => `<button class="btn sm" data-act="prNew" data-id="${k}" title="${esc(K.desc)}">${K.ic} ${K.label}</button>`).join('')}</div>
      <div class="section-title">عروضي (${list.length})</div>
      ${list.length ? `<div class="list" style="max-height:52vh;overflow:auto">${list.map((x) => `<div class="li ${x.id === ui.prId ? 'sel-row' : ''}"><div class="grow" style="cursor:pointer" data-act="prOpen" data-id="${x.id}"><div class="t">${esc(x.title)}</div><div class="s">${(PR_KINDS[x.kind] || PR_KINDS.blank).label} · ${x.slides.length} شرائح</div></div><button class="icon-btn" data-act="prDel" data-id="${x.id}" title="حذف">🗑️</button></div>`).join('')}</div>` : '<div class="muted">لا توجد عروض بعد</div>'}
    </div>`;
    if (!p) return `<div class="designer">${side}<div class="d-main"><div class="card">${emptyState('🎞️', 'اختاري نوع العرض وعبّئي بياناته، ويُنشئ البرنامج الشرائح بتصميم موحّد.<br>بعدها عدّلي أي شريحة، وأضيفي صوراً من جهازكِ أو من المصمم أو رسوماً بيانية، ثم صدّري PowerPoint أو PDF.')}
      <div class="pr-kinds">${Object.entries(PR_KINDS).filter(([k]) => k !== 'blank').map(([k, K]) => `<button class="pr-kind" data-act="prNew" data-id="${k}"><span>${K.ic}</span><b>${K.label}</b><small>${K.desc}</small></button>`).join('')}</div></div></div></div>`;
    ui.prSlide = Math.min(ui.prSlide || 0, p.slides.length - 1);
    const s = curSlide(p);
    return `<div class="pr-full">
      <div class="card pr-top">
        <select class="input pr-switch" data-change="prSwitch" title="عروضي">${list.map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(cut(x.title, 34))}</option>`).join('')}</select>
        <button class="icon-btn" data-act="prDel" data-id="${p.id}" title="حذف العرض">🗑️</button>
        <input class="input pr-title" data-change="prTitle" value="${esc(p.title)}" title="عنوان العرض">
        <div class="pr-themes">${Object.entries(PR_THEMES).map(([k, t]) => `<button class="${p.theme === k ? 'on' : ''}" data-act="prTheme" data-id="${k}" title="${t.name}"><i style="background:${t.p}"></i><i style="background:${t.a}"></i></button>`).join('')}</div>
        <button class="btn sm" data-act="prLogo">${p.logo ? '🏷️ تغيير الشعار' : '🏷️ إضافة شعار'}</button>
        <button class="btn sm" data-act="prRegen">✏️ بيانات العرض</button>
        <span class="spacer" style="flex:1"></span>
        <button class="btn sm" data-act="prPng" title="صورة الشريحة الحالية">🖼️ صورة الشريحة</button>
        <button class="btn sm" data-act="prPdf">⬇ PDF</button>
        <button class="btn primary sm" data-act="prPptx">⬇ PowerPoint</button>
      </div>
      <div class="pr-edit">
        <div class="pr-thumbs">${p.slides.map((x, i) => `<div class="pr-thumb ${i === ui.prSlide ? 'on' : ''}" data-act="prPick" data-id="${i}"><span>${i + 1}</span>${prSlideSVG(p, i)}</div>`).join('')}
          <button class="btn sm pr-add" data-act="prAddMenu">＋ شريحة</button></div>
        <div class="pr-stage"><div class="pr-canvas" id="prCanvas">${prSlideSVG(p, ui.prSlide)}</div>
          <div class="muted" style="margin-top:6px;font-size:12.5px">الشريحة ${ui.prSlide + 1} من ${p.slides.length} · ملف PowerPoint يُفتح للتعديل الكامل (النصوص والألوان والصور).</div></div>
        ${prPanel(p, s)}
      </div>
    </div>`;
  },
};

function prTouch(p = curPres(), full = true) { p.updatedAt = new Date().toISOString(); commit(full); }
function prRefreshPreview() {
  const p = curPres(); if (!p) return;
  const cv = $('#prCanvas'); if (cv) cv.innerHTML = prSlideSVG(p, ui.prSlide);
  const th = $$('.pr-thumb')[ui.prSlide]; if (th) th.innerHTML = `<span>${ui.prSlide + 1}</span>${prSlideSVG(p, ui.prSlide)}`;
}
async function prSetImage(img) {
  const p = curPres(), s = curSlide(p); if (!p || !s) return;
  if (PR.target === 'logo') { p.logo = img; db.settings.presLogo = img; } else s.image = img;
  PR.target = null; prTouch(p); toast('أُضيفت الصورة', 'ok');
}
function prMenu(title, html) {
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal" style="width:620px"><div class="modal-h"><h2>${esc(title)}</h2><button class="icon-btn" data-act="modalClose">✕</button></div><div class="modal-b">${html}</div></div></div>`;
  modalCtx = {};
}
async function prImgSources(title) {
  const designs = db.designs || [];
  const libImgs = (db.library || []).filter((x) => x.file?.stored && /png|jpe?g|gif|webp|bmp/i.test(x.file.ext || x.file.name || ''));
  prMenu(title, `<div class="pr-src">
      <button class="btn primary" data-act="prImgFile">💻 صورة من جهازي</button>
      <button class="btn" data-act="prImgDesign">✏️ تصميم صورة جديدة في المصمم</button>
    </div>
    <div class="section-title">🎨 من تصاميمي المحفوظة (${designs.length})</div>
    ${designs.length ? `<div class="pr-pick" id="prDesigns">${designs.map((d) => `<button data-act="prImgFromDesign" data-id="${d.id}"><span class="muted">جارٍ التحميل…</span><b>${esc(cut(d.name, 22))}</b></button>`).join('')}</div>` : '<div class="muted">لا توجد تصاميم محفوظة. صمّمي صورة من «المصمم» واحفظيها، أو اختاري «تصميم صورة جديدة».</div>'}
    ${libImgs.length ? `<div class="section-title">🗃️ من مكتبة المعرفة</div><div class="pr-pick">${libImgs.map((x) => `<button data-act="prImgFromLib" data-id="${x.id}"><span>🖼️</span><b>${esc(cut(x.title || x.file.name, 22))}</b></button>`).join('')}</div>` : ''}`);
  // صور مصغّرة للتصاميم
  for (const d of designs) { try { const u = await designToDataUrl(d); const b = $(`#prDesigns [data-id="${d.id}"] span`); if (b) b.outerHTML = `<img src="${u}" alt="">`; } catch { } }
}
Object.assign(ACTIONS, {
  prNewMenu: () => prMenu('عرض جديد', `<div class="pr-kinds">${Object.entries(PR_KINDS).map(([k, K]) => `<button class="pr-kind" data-act="prNew" data-id="${k}"><span>${K.ic}</span><b>${K.label}</b><small>${K.desc}</small></button>`).join('')}</div>`),
  prNew: (el) => { if (modalCtx) closeModal(); prForm(el.dataset.id); },
  prOpen: (el) => { ui.prId = el.dataset.id; ui.prSlide = 0; render(); },
  prDel: (el) => { const p = db.presentations.find((x) => x.id === el.dataset.id); confirmBox(`حذف العرض «${p.title}»؟`, () => { db.presentations = db.presentations.filter((x) => x !== p); if (ui.prId === p.id) ui.prId = null; commit(); }); },
  prRegen: () => { const p = curPres(); prForm(p.kind, p); },
  prPick: (el) => { ui.prSlide = +el.dataset.id; render(); },
  prTheme: (el) => { const p = curPres(); p.theme = el.dataset.id; prTouch(p); },
  prLayout: (el) => { const s = curSlide(); s.layout = el.dataset.id; if (s.layout === 'closing' && !s.title) s.title = 'شكراً لكم'; prTouch(); },
  prAddMenu: () => prMenu('إضافة شريحة', `<div class="pr-layouts big">${PR_LAYOUTS.map(([k, ic, l]) => `<button data-act="prAdd" data-id="${k}"><span>${ic}</span>${l}</button>`).join('')}</div>`),
  prAdd: (el) => {
    closeModal(); const p = curPres(), k = el.dataset.id;
    const sample = { bullets: 'النقطة الأولى\nالنقطة الثانية\nالنقطة الثالثة', bulletsImage: 'النقطة الأولى\nالنقطة الثانية', cards: 'العنوان الأول: وصف قصير\nالعنوان الثاني: وصف قصير\nالعنوان الثالث: وصف قصير', agenda: 'الخطوة الأولى\nالخطوة الثانية\nالخطوة الثالثة', stats: '120: طالبة مستفيدة\n95%: نسبة الرضا\n12: معلمة مشاركة', text: 'اكتبي الفقرة هنا.', quote: 'اكتبي النص هنا\nالمصدر', closing: 'نسعد بتواصلكم' }[k] || '';
    const s = S_(k, k === 'closing' ? 'شكراً لكم' : k === 'section' ? 'عنوان القسم' : k === 'chart' ? '' : 'عنوان الشريحة', sample);
    p.slides.splice((ui.prSlide || 0) + 1, 0, s); ui.prSlide = (ui.prSlide || 0) + 1; prTouch(p);
    setTimeout(() => { const t = $('.pr-panel [data-k="title"]'); t?.focus(); t?.select(); }, 60);
  },
  prMove: (el) => { const p = curPres(), i = ui.prSlide, j = i + +el.dataset.id; if (j < 0 || j >= p.slides.length) return; [p.slides[i], p.slides[j]] = [p.slides[j], p.slides[i]]; ui.prSlide = j; prTouch(p); },
  prDupSlide: () => { const p = curPres(), s = curSlide(p); p.slides.splice(ui.prSlide + 1, 0, { ...JSON.parse(JSON.stringify(s)), id: uid() }); ui.prSlide++; prTouch(p); },
  prDelSlide: () => { const p = curPres(); if (p.slides.length < 2) return toast('العرض يحتاج شريحة واحدة على الأقل'); confirmBox('حذف هذه الشريحة؟', () => { p.slides.splice(ui.prSlide, 1); ui.prSlide = Math.max(0, ui.prSlide - 1); prTouch(p); }); },
  prImgMenu: () => { PR.target = 'slide'; prImgSources('صورة الشريحة'); },
  prLogo: () => { PR.target = 'logo'; const p = curPres(); prImgSources('شعار العرض').then(() => { if (p.logo) $('.modal-b')?.insertAdjacentHTML('beforeend', '<div style="margin-top:12px"><button class="btn sm danger" data-act="prLogoDel">إزالة الشعار</button></div>'); }); },
  prLogoDel: () => { closeModal(); const p = curPres(); p.logo = null; db.settings.presLogo = null; prTouch(p); },
  prImgDel: () => { const s = curSlide(); s.image = null; prTouch(); },
  prImgFile: async () => { const tgt = PR.target; closeModal(); PR.target = tgt; const [f] = await pickFiles('image/*'); if (!f) return; try { await prSetImage(await prNormalize(f, tgt === 'logo' ? 600 : 1600)); } catch (e) { toast(e.message, 'err'); } },
  prImgFromDesign: async (el) => { const tgt = PR.target; closeModal(); PR.target = tgt; const d = db.designs.find((x) => x.id === el.dataset.id); try { await prSetImage(await prNormalize(await designToDataUrl(d), tgt === 'logo' ? 600 : 1600)); } catch (e) { toast(e.message, 'err'); } },
  prImgFromLib: async (el) => { const tgt = PR.target; closeModal(); PR.target = tgt; const x = db.library.find((i) => i.id === el.dataset.id); const b = await IDB.get('files', x.file.stored).catch(() => null); if (!b) return toast('تعذّر فتح الملف', 'err'); try { await prSetImage(await prNormalize(b, tgt === 'logo' ? 600 : 1600)); } catch (e) { toast(e.message, 'err'); } },
  prImgDesign: () => {
    closeModal(); const p = curPres();
    PR.ret = { pres: p.id, slide: curSlide(p).id, target: PR.target };
    Object.assign(DS, { size: PR.target === 'logo' ? 'square' : 'slide', bg: '#ffffff', objs: [], sel: null, id: null, name: '', undo: [], redo: [], tool: 'select' });
    ui.tool = 'designer'; ui.view = 'tools'; render(); toast('صمّمي الصورة ثم اضغطي «⤶ إدراج في العرض» في الأعلى', 'ok');
  },
  prBackToPres: async () => {
    const r = PR.ret; if (!r) return;
    const url = dExportCanvas().toDataURL('image/png'); dDraw();
    const p = db.presentations.find((x) => x.id === r.pres); PR.ret = null;
    if (!p) return toast('العرض لم يعد موجوداً', 'err');
    const i = p.slides.findIndex((x) => x.id === r.slide);
    ui.prId = p.id; ui.prSlide = Math.max(0, i); ui.view = 'present'; ui.tool = null; PR.target = r.target;
    if (r.target !== 'logo' && i >= 0 && !['cover', 'bulletsImage', 'image'].includes(p.slides[i].layout)) p.slides[i].layout = 'image';
    await prSetImage(await prNormalize(url, r.target === 'logo' ? 600 : 1600));
  },
  prPptx: async (el) => { const p = curPres(); el.disabled = true; toast('جارٍ إنشاء ملف PowerPoint…'); try { openBlob(await prExportPptx(p), prName(p) + '.pptx', true); toast('حُفظ ملف PowerPoint في «التنزيلات»', 'ok'); } catch (e) { toast('تعذّر التصدير: ' + e.message, 'err'); } finally { el.disabled = false; } },
  prPdf: async (el) => { const p = curPres(); el.disabled = true; toast('جارٍ إنشاء ملف PDF…'); try { openBlob(await prExportPdf(p), prName(p) + '.pdf', true); toast('حُفظ ملف PDF في «التنزيلات»', 'ok'); } catch (e) { toast('تعذّر التصدير: ' + e.message, 'err'); } finally { el.disabled = false; } },
  prPng: async () => { const p = curPres(); try { const b = await prSlideJpeg(p, ui.prSlide, 1.5); openBlob(b, `${prName(p)} - شريحة ${ui.prSlide + 1}.jpg`, true); toast('حُفظت صورة الشريحة في «التنزيلات»', 'ok'); } catch (e) { toast(e.message, 'err'); } },
});
Object.assign(CHANGES, {
  prSwitch: (el) => { ui.prId = el.value; ui.prSlide = 0; render(); },
  prTitle: (el) => { const p = curPres(); const old = p.title; p.title = el.value.trim() || old; const c = p.slides.find((s) => s.layout === 'cover'); if (c && c.title === old) c.title = p.title; prTouch(p); },
  prSl: (el) => { const s = curSlide(); s[el.dataset.k] = el.value; prTouch(curPres(), false); prRefreshPreview(); },
  prChart: (el) => { const s = curSlide(); const [sheet, chart] = el.value.split('|'); s.chart = el.value ? { sheet, chart } : null; if (s.chart && (!s.title || s.title === 'عنوان الشريحة')) s.title = db.sheets.find((x) => x.id === sheet)?.charts.find((c) => c.id === chart)?.title || ''; prTouch(); },
});
// معاينة فورية أثناء الكتابة
document.addEventListener('input', (e) => {
  const el = e.target.closest?.('.pr-panel [data-live]'); if (!el) return;
  clearTimeout(PR.timer); PR.timer = setTimeout(() => { const s = curSlide(); if (!s) return; s[el.dataset.k] = el.value; prRefreshPreview(); }, 220);
});
// زر الرجوع من المصمم إلى العرض
const _dActions = TOOL_VIEWS.designer.actions;
TOOL_VIEWS.designer.actions = () => (PR.ret ? '<button class="btn primary" data-act="prBackToPres">⤶ إدراج في العرض</button>' : '') + _dActions();
