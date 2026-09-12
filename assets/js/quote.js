/**
 * صانع بطاقة الاقتباس (Quote Maker)
 * يرسم البيت على Canvas بهوية المنصة: إطار ذهبي، زخارف، اسم الشيخ، وتذييل الموقع.
 */
import { verseAt, verseIndex, VERSES, SHEIKH, toArabicDigits } from './data/verses.js';
import { qs, qsa, toast, copyText, downloadBlob, store, createFocusTrap } from './util.js';
import { versePlainText } from './card.js';

const RATIOS = {
  '1x1': { w: 1080, h: 1080 },
  '16x9': { w: 1600, h: 900 },
  '9x16': { w: 1080, h: 1920 },
};

const THEMES = {
  royal: {
    bgTop: '#151d31',
    bgMid: '#0b0e14',
    bgBot: '#080a0f',
    glowGold: 'rgba(212,175,55,0.22)',
    glowCrimson: 'rgba(139,0,0,0.30)',
    ink: '#f8f9fa',
    gold: '#d4af37',
    goldLight: '#f5dd8b',
    goldDeep: '#aa7c11',
    muted: 'rgba(248,249,250,0.5)',
    frame: 'rgba(212,175,55,0.45)',
    bandAlpha: 0.22,
    bandBlend: 'screen',
  },
  glass: {
    bgTop: '#22305a',
    bgMid: '#141d33',
    bgBot: '#0d1220',
    glowGold: 'rgba(212,175,55,0.34)',
    glowCrimson: 'rgba(70,40,120,0.35)',
    ink: '#f8f9fa',
    gold: '#e6c664',
    goldLight: '#fff3c4',
    goldDeep: '#aa7c11',
    muted: 'rgba(248,249,250,0.55)',
    frame: 'rgba(230,198,100,0.5)',
    bandAlpha: 0.28,
    bandBlend: 'screen',
  },
  paper: {
    bgTop: '#fffdf6',
    bgMid: '#f7f0de',
    bgBot: '#efe4cc',
    glowGold: 'rgba(212,175,55,0.30)',
    glowCrimson: 'rgba(160,120,60,0.18)',
    ink: '#241d12',
    gold: '#8a6210',
    goldLight: '#b98f22',
    goldDeep: '#6d4d09',
    muted: 'rgba(36,29,18,0.55)',
    frame: 'rgba(138,98,16,0.5)',
    bandAlpha: 0.16,
    bandBlend: 'multiply',
  },
};

const SIZE_SCALE = { s: 0.86, m: 1, l: 1.16 };

const state = {
  n: 587,
  ratio: store.get('quote:ratio', '1x1'),
  cardTheme: store.get('quote:theme', 'royal'),
  size: store.get('quote:size', 'm'),
  canvas: null,
  ctx: null,
  arabesque: null,
  seal: null,
  lastFocus: null,
  releaseTrap: null,
};

/* ------------------------------ تحميل الأصول ------------------------------ */
function loadImage(src, timeout = 4000) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    // لا نُعطّل الرسم إن تأخّر تحميل الأصول أو فشل
    setTimeout(() => finish(null), timeout);
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = src;
  });
}

async function ensureAssets() {
  if (!state.arabesque) state.arabesque = await loadImage('assets/img/divider-arabesque.jpg');
  if (!state.seal) state.seal = await loadImage('assets/img/falcon-power.jpg');
}

async function ensureFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load('700 60px "Aref Ruqaa"', SHEIKH.name),
      document.fonts.load('500 56px "Noto Naskh Arabic"', 'والصلاة والسلام'),
      document.fonts.load('600 24px "Reem Kufi"', 'المنظومة'),
      document.fonts.load('400 30px "Amiri"', 'قاهر أهل البدع'),
    ]);
    await document.fonts.ready;
  } catch {
    /* نكمل بأي خطٍّ متاح */
  }
}

/* ------------------------------ أدوات الرسم ------------------------------ */
function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** نصّ بعرضٍ محدّد مع كسر الأسطر */
function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawStar8(ctx, cx, cy, r, stroke, lineWidth = 2) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  for (let pass = 0; pass < 2; pass += 1) {
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const a = (Math.PI / 2) * i + (pass ? Math.PI / 4 : 0);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawDiamonds(ctx, x, y, count, gap, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const cx = x + i * gap;
    ctx.beginPath();
    ctx.moveTo(cx, y - size);
    ctx.lineTo(cx + size, y);
    ctx.lineTo(cx, y + size);
    ctx.lineTo(cx - size, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function buildBand(width, height, img, alpha, blend) {
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.floor(width));
  off.height = Math.max(1, Math.floor(height));
  const c = off.getContext('2d');
  if (img) {
    const scale = Math.max(off.width / img.width, off.height / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    c.drawImage(img, (off.width - dw) / 2, (off.height - dh) / 2, dw, dh);
  }
  c.globalCompositeOperation = 'destination-in';
  const g = c.createLinearGradient(0, 0, 0, off.height);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.35, 'rgba(0,0,0,1)');
  g.addColorStop(0.65, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, off.width, off.height);
  return { canvas: off, alpha, blend };
}

/* -------------------------------- الرسم -------------------------------- */
export function drawCard() {
  const canvas = state.canvas;
  if (!canvas) return;
  const v = verseAt(state.n) || VERSES[0];
  const { w, h } = RATIOS[state.ratio] || RATIOS['1x1'];
  const T = THEMES[state.cardTheme] || THEMES.royal;
  const scale = SIZE_SCALE[state.size] || 1;
  const long = state.ratio === '9x16';
  const wide = state.ratio === '16x9';

  // ضبط مقاس اللوحة أولًا حتى تبقى المعاينة صحيحة في كل الأحوال
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext('2d');
  state.ctx = ctx;
  if (!ctx) return;

  const pad = wide ? 60 : 72;
  const bodyW = w - pad * 2;

  ctx.clearRect(0, 0, w, h);
  ctx.direction = 'rtl';
  ctx.textBaseline = 'alphabetic';

  /* ---------- الخلفية ---------- */
  const bg = ctx.createLinearGradient(0, 0, w * 0.4, h);
  bg.addColorStop(0, T.bgTop);
  bg.addColorStop(0.55, T.bgMid);
  bg.addColorStop(1, T.bgBot);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow1 = ctx.createRadialGradient(w * 0.86, h * 0.06, 0, w * 0.86, h * 0.06, w * 0.72);
  glow1.addColorStop(0, T.glowGold);
  glow1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, w, h);

  const glow2 = ctx.createRadialGradient(w * 0.1, h * 0.98, 0, w * 0.1, h * 0.98, w * 0.7);
  glow2.addColorStop(0, T.glowCrimson);
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, w, h);

  /* ---------- زخرفة عربية علوية وسفلية ---------- */
  if (state.arabesque) {
    const bandH = Math.round(h * (long ? 0.07 : wide ? 0.17 : 0.11));
    const top = buildBand(w, bandH, state.arabesque, T.bandAlpha, T.bandBlend);
    const bottom = buildBand(w, Math.round(bandH * 0.85), state.arabesque, T.bandAlpha * 0.55, T.bandBlend);
    ctx.save();
    ctx.globalCompositeOperation = top.blend;
    ctx.globalAlpha = top.alpha;
    ctx.drawImage(top.canvas, 0, 0);
    ctx.globalAlpha = bottom.alpha;
    ctx.save();
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.drawImage(bottom.canvas, 0, 0);
    ctx.restore();
    ctx.restore();

    // ستارة تظليل ناعمة أسفل الصفحة لضمان قراءة التذييل
    ctx.save();
    const scrim = ctx.createLinearGradient(0, h - bandH * 2.1, 0, h);
    const dark = state.cardTheme !== 'paper';
    scrim.addColorStop(0, dark ? 'rgba(8,10,15,0)' : 'rgba(255,253,246,0)');
    scrim.addColorStop(1, dark ? 'rgba(8,10,15,0.82)' : 'rgba(255,253,246,0.86)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, h - bandH * 2.1, w, bandH * 2.1);
    ctx.restore();
  }

  /* ---------- الإطار الذهبي ---------- */
  const inset = wide ? 26 : 30;
  roundRect(ctx, inset, inset, w - inset * 2, h - inset * 2, 22);
  ctx.strokeStyle = T.frame;
  ctx.lineWidth = 2;
  ctx.stroke();

  const corner = Math.round(wide ? 54 : 64);
  ctx.lineWidth = 3;
  ctx.strokeStyle = T.gold;
  const corners = [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ];
  corners.forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x + sx * (corner + 26), y);
    ctx.lineTo(x + sx * 26, y);
    ctx.quadraticCurveTo(x, y, x, y + sy * 26);
    ctx.lineTo(x, y + sy * (corner + 26));
    ctx.stroke();
  });

  /* ---------- الترويسة ---------- */
  const headY = inset + (wide ? 58 : 74);
  const sealR = wide ? 30 : 34;

  // الخاتم الذهبي
  ctx.save();
  ctx.fillStyle = 'rgba(212,175,55,0.10)';
  ctx.beginPath();
  ctx.arc(w - pad - sealR, headY, sealR, 0, Math.PI * 2);
  ctx.fill();
  drawStar8(ctx, w - pad - sealR, headY, sealR * 0.72, T.gold, 1.6);
  // سيف صغير داخل الخاتم
  ctx.strokeStyle = T.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w - pad - sealR, headY - sealR * 0.42);
  ctx.lineTo(w - pad - sealR, headY + sealR * 0.28);
  ctx.moveTo(w - pad - sealR - sealR * 0.3, headY + sealR * 0.06);
  ctx.lineTo(w - pad - sealR + sealR * 0.3, headY + sealR * 0.06);
  ctx.stroke();
  ctx.restore();

  // اسم الشيخ
  const nameSize = wide ? 40 : 46;
  ctx.textAlign = 'right';
  ctx.font = `700 ${nameSize}px "Aref Ruqaa", "Amiri", serif`;
  const nameGrad = ctx.createLinearGradient(0, headY - nameSize, 0, headY + nameSize * 0.6);
  nameGrad.addColorStop(0, T.goldLight);
  nameGrad.addColorStop(0.5, T.gold);
  nameGrad.addColorStop(1, T.goldDeep);
  ctx.fillStyle = nameGrad;
  ctx.direction = 'ltr';
  ctx.fillText(SHEIKH.name, w - pad - sealR * 2 - 22, headY + nameSize * 0.32);
  ctx.direction = 'rtl';

  // شارة صغيرة على اليسار
  const badgeText = 'المنظومة الكاملة';
  ctx.font = `600 ${wide ? 20 : 22}px "Reem Kufi", "Cairo", sans-serif`;
  const bw = ctx.measureText(badgeText).width + 46;
  const bh = wide ? 44 : 50;
  roundRect(ctx, pad, headY - bh / 2, bw, bh, bh / 2);
  ctx.strokeStyle = T.frame;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = T.gold;
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, pad + bw / 2, headY + (wide ? 7 : 8));

  // خط فاصل تحت الترويسة
  const ruleY = headY + (wide ? 46 : 62);
  const rule = ctx.createLinearGradient(pad, 0, w - pad, 0);
  rule.addColorStop(0, 'rgba(0,0,0,0)');
  rule.addColorStop(0.5, T.gold);
  rule.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rule;
  ctx.fillRect(pad, ruleY, bodyW, 2);

  /* ---------- متن البيت (مع ضبطٍ تلقائي لحجم الخطّ) ---------- */
  const chapSize = wide ? 22 : 26;
  const innerW = bodyW - (wide ? 130 : 46);
  const footH = wide ? 150 : 168;
  const bodyTop = ruleY + (wide ? 56 : 82);
  const bodyBottom = h - inset - footH;
  const avail = Math.max(120, bodyBottom - bodyTop);

  const baseSize = Math.round((long ? 80 : wide ? 62 : 68) * scale);

  function layout(size) {
    ctx.font = `500 ${size}px "Noto Naskh Arabic", "Amiri", serif`;
    const sadr = wrapText(ctx, v.sadr, innerW);
    const ajz = wrapText(ctx, v.ajz, innerW);
    const sepH = size * 1.15;
    const lineH = size * 2.05;
    const total = (sadr.length + ajz.length) * lineH + sepH + chapSize * 1.9;
    return { sadr, ajz, sepH, lineH, total };
  }

  let verseSize = baseSize;
  let L = layout(verseSize);
  while (L.total > avail && verseSize > 30) {
    verseSize -= 2;
    L = layout(verseSize);
  }
  const { sadr: sadrLines, ajz: ajzLines, sepH, lineH } = L;

  ctx.textAlign = 'center';
  ctx.font = `500 ${verseSize}px "Noto Naskh Arabic", "Amiri", serif`;
  let y = bodyTop + Math.max(0, (avail - L.total) / 2) + verseSize;

  // تسمية الفصل
  ctx.font = `600 ${chapSize}px "Reem Kufi", "Cairo", sans-serif`;
  ctx.fillStyle = T.gold;
  ctx.globalAlpha = 0.9;
  ctx.fillText(`${v.chapterOrdinal} — ${v.chapterTitle}`, w / 2, y);
  ctx.globalAlpha = 1;
  y += chapSize * 1.9;

  // الصدر
  ctx.font = `500 ${verseSize}px "Noto Naskh Arabic", "Amiri", serif`;
  ctx.fillStyle = T.ink;
  sadrLines.forEach((line) => {
    ctx.fillText(line, w / 2, y);
    y += lineH;
  });

  // الفاصل الزخرفي
  ctx.save();
  const half = bodyW * 0.3;
  ctx.strokeStyle = T.frame;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(w / 2 - half, y - sepH * 0.42);
  ctx.lineTo(w / 2 - 34, y - sepH * 0.42);
  ctx.moveTo(w / 2 + 34, y - sepH * 0.42);
  ctx.lineTo(w / 2 + half, y - sepH * 0.42);
  ctx.stroke();
  drawDiamonds(ctx, w / 2, y - sepH * 0.42, 3, 22, 7, T.gold);
  ctx.restore();
  y += sepH * 0.9;

  // العجز
  ctx.fillStyle = T.ink;
  ajzLines.forEach((line) => {
    ctx.fillText(line, w / 2, y);
    y += lineH;
  });

  /* ---------- التذييل ---------- */
  const footBase = h - inset;
  const rowY = footBase - (wide ? 26 : 30);          // السطر السفلي: الوسوم + اسم الموقع
  const hr2 = footBase - (wide ? 52 : 58);           // خطّ فاصل
  const numY = footBase - (wide ? 84 : 92);          // رقم البيت
  const mottoY = footBase - (wide ? 126 : 136);      // شعار المنظومة

  // شعار المنظومة
  ctx.textAlign = 'center';
  ctx.font = `400 ${wide ? 22 : 26}px "Amiri", "Noto Naskh Arabic", serif`;
  ctx.fillStyle = T.gold;
  ctx.globalAlpha = 0.92;
  ctx.fillText(`« ${SHEIKH.motto.split(' — ')[0]} »`, w / 2, mottoY);
  ctx.globalAlpha = 1;

  // رقم البيت
  ctx.font = `700 ${wide ? 22 : 27}px "Aref Ruqaa", "Amiri", serif`;
  ctx.fillStyle = T.gold;
  ctx.fillText(`البيت ${v.label} من المنظومة`, w / 2, numY);

  // خطّ فاصل رقيق
  const hrGrad = ctx.createLinearGradient(pad, 0, w - pad, 0);
  hrGrad.addColorStop(0, 'rgba(0,0,0,0)');
  hrGrad.addColorStop(0.5, T.frame);
  hrGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hrGrad;
  ctx.fillRect(pad, hr2, bodyW, 1);

  // السطر السفلي: الوسوم (يمين) واسم الموقع (يسار)
  ctx.font = `600 ${wide ? 18 : 20}px "Reem Kufi", "Cairo", sans-serif`;
  ctx.fillStyle = T.muted;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillText(SHEIKH.hashtags.map((t) => `#${t}`).join('  '), w - pad, rowY);
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.fillText('منظومة الشيخ حسين الشعار', pad, rowY);

  // ماسات زخرفية تحت رقم البيت
  drawDiamonds(ctx, w / 2, numY + (wide ? 22 : 26), 3, 26, 6, T.gold);
}

/* ------------------------------ المعاينة والقياس ------------------------------ */
/**
 * ضبط مقاس المعاينة: نُغيّر مقاس اللوحة في CSS (لا transform)
 * حتى يبقى المقاس المرئي مطابقًا للمقاس الفعلي في التخطيط، فلا يتجاوز
 * الإطار ولا يُحدث تمريرًا أفقيًّا داخل النافذة.
 */
function fitPreview() {
  const stage = qs('#qmStage');
  const canvas = state.canvas;
  if (!stage || !canvas || !canvas.width) return;

  const stageW = stage.clientWidth || stage.getBoundingClientRect().width || 320;
  const avail = Math.max(160, stageW - 34);
  const availH = Math.max(220, Math.min((window.innerHeight || 800) * 0.66, 640));
  const k = Math.min(avail / canvas.width, availH / canvas.height, 1);

  const w = Math.max(1, Math.round(canvas.width * k));
  const h = Math.max(1, Math.round(canvas.height * k));

  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.style.maxWidth = '100%';
  stage.style.minHeight = `${h + 34}px`;
}

function syncControls() {
  qsa('#qmRatio [data-ratio]').forEach((b) => b.classList.toggle('is-active', b.dataset.ratio === state.ratio));
  qsa('#qmTheme [data-cardtheme]').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.cardtheme === state.cardTheme)
  );
  qsa('#qmSize [data-size]').forEach((b) => b.classList.toggle('is-active', b.dataset.size === state.size));
  const label = qs('#qmVerseLabel');
  const v = verseAt(state.n);
  if (label && v) label.textContent = `البيت ${v.label} · ${v.chapterOrdinal}`;
}

export function refresh() {
  drawCard();
  syncControls();
  fitPreview();
}

/**
 * واجهة برمجية نقيّة: رسم بطاقة اقتباس على أيّ لوحة Canvas معطاة
 * (تُستخدم للمعاينة، والتصدير، والاختبار خارج المتصفّح).
 * @param {HTMLCanvasElement} canvas لوحة الرسم الهدف
 * @param {{n?:number, ratio?:string, theme?:string, size?:string}} [options]
 */
export async function renderCard(canvas, options = {}) {
  if (!canvas) return null;
  state.canvas = canvas;
  state.ctx = null;
  if (options.n) {
    const v = verseAt(Number(options.n));
    if (v) state.n = v.n;
  }
  if (RATIOS[options.ratio]) state.ratio = options.ratio;
  if (THEMES[options.theme]) state.cardTheme = options.theme;
  if (SIZE_SCALE[options.size]) state.size = options.size;
  if (!options.assetsOnly && !options.skipAssets) {
    await ensureFonts();
    await ensureAssets();
  }
  drawCard();
  return canvas;
}

/* ------------------------------ تصدير الصورة ------------------------------ */
function toBlob() {
  return new Promise((resolve) => state.canvas.toBlob((b) => resolve(b), 'image/png', 0.98));
}

function fileName() {
  return `الشيخ-حسين-الشعار-البيت-${state.n}.png`;
}

/* ------------------------------ الفتح والإغلاق ------------------------------ */
export async function openQuote(n) {
  const overlay = qs('#quoteOverlay');
  if (!overlay) return;
  if (n) {
    const v = verseAt(Number(n));
    if (v) state.n = v.n;
  } else {
    state.n = VERSES[Math.floor(Math.random() * VERSES.length)].n;
  }

  state.lastFocus = document.activeElement;
  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  if (!state.canvas) {
    state.canvas = qs('#qmCanvas');
    state.ctx = state.canvas?.getContext('2d');
  }
  if (!state.releaseTrap) state.releaseTrap = createFocusTrap(overlay);

  syncControls();
  await ensureFonts();
  await ensureAssets();
  refresh();
}

export function closeQuote() {
  const overlay = qs('#quoteOverlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  document.body.style.overflow = '';
  state.releaseTrap?.();
  state.releaseTrap = null;
  state.lastFocus?.focus?.();
}

function isOpen() {
  return qs('#quoteOverlay')?.classList.contains('is-open');
}

/* -------------------------------- التهيئة -------------------------------- */
export function initQuote() {
  const overlay = qs('#quoteOverlay');
  if (!overlay) return;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close="quote"]')) closeQuote();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeQuote();
    }
  });

  qs('#qmRatio')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ratio]');
    if (!b) return;
    state.ratio = b.dataset.ratio;
    store.set('quote:ratio', state.ratio);
    refresh();
  });
  qs('#qmTheme')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cardtheme]');
    if (!b) return;
    state.cardTheme = b.dataset.cardtheme;
    store.set('quote:theme', state.cardTheme);
    refresh();
  });
  qs('#qmSize')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-size]');
    if (!b) return;
    state.size = b.dataset.size;
    store.set('quote:size', state.size);
    refresh();
  });

  const step = (dir) => {
    const i = verseIndex(state.n);
    const next = VERSES[(i + dir + VERSES.length) % VERSES.length];
    state.n = next.n;
    refresh();
  };
  qs('#qmPrev')?.addEventListener('click', () => step(-1));
  qs('#qmNext')?.addEventListener('click', () => step(1));

  qs('#qmDownload')?.addEventListener('click', async () => {
    const blob = await toBlob();
    if (!blob) {
      toast('تعذّر تصدير الصورة', { iconName: 'info' });
      return;
    }
    downloadBlob(blob, fileName());
    toast('تمّ تصدير البطاقة بنجاح — بالتوفيق في النشر', { iconName: 'download' });
  });

  qs('#qmShare')?.addEventListener('click', async () => {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], fileName(), { type: 'image/png' });
    const v = verseAt(state.n);
    const text = `« ${v.sadr} ... ${v.ajz} » — ${SHEIKH.name}`;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `البيت ${v.label}`, text });
        return;
      }
      if (navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('نُسخت البطاقة إلى الحافظة — الصقها في أي تطبيق', { iconName: 'copy' });
        return;
      }
      throw new Error('unsupported');
    } catch {
      downloadBlob(blob, fileName());
      toast('تمّ تنزيل البطاقة لمشاركتها', { iconName: 'download' });
    }
  });

  qs('#qmCopyText')?.addEventListener('click', async () => {
    const v = verseAt(state.n);
    const ok = await copyText(versePlainText(v));
    toast(ok ? 'نُسخ نصّ البيت' : 'تعذّر النسخ', { iconName: ok ? 'copy' : 'info' });
  });

  window.addEventListener('resize', () => {
    if (isOpen()) fitPreview();
  });

  // اختصارات داخل النافذة
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(1);
    if (e.key === 'ArrowRight') step(-1);
  });
}

export default { initQuote, openQuote, closeQuote, refresh };
