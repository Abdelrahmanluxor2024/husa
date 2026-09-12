/**
 * بناء الصفحة: الفصول، بطاقات الأبيات، الفهرس السريع، وتفاعلات البيت
 */
import { CHAPTERS, VERSES, verseAt, verseIndex, toArabicDigits, TOTAL_VERSES } from './data/verses.js';
import { qs, qsa, icon, toast, copyText, bus } from './util.js';
import { favorites, viewFilter } from './state.js';
import { verseCardHTML, versePlainText } from './card.js';
import speech from './speech.js';

/* ----------------------- حالة النطق لبيتٍ مفرد ----------------------- */
let speakingVerse = null;
let speakToken = 0;

export function stopVerseSpeech() {
  speakToken += 1;
  speech.stop();
  if (speakingVerse !== null) {
    const card = qs(`#v-${speakingVerse}`);
    card?.classList.remove('is-focus');
    qsa('.verse__sadr, .verse__ajz', card || document).forEach((n) => n.classList.remove('is-reading'));
    qsa('[data-tool="speak"]').forEach((b) => {
      b.classList.remove('is-active');
      b.setAttribute('aria-label', b.getAttribute('aria-label').replace('إيقاف نطق', 'نطق'));
    });
    speakingVerse = null;
  }
}

async function speakVerse(v, btn) {
  const already = speakingVerse === v.n;
  bus.emit('recite:stop-all', { source: 'verse-tool' });
  stopVerseSpeech();
  if (already) return;

  if (!speech.supported) {
    toast('متصفحك لا يدعم النطق الصوتي — جرّب متصفحًا آخر (Chrome / Edge / Safari).', { iconName: 'info' });
    return;
  }

  const card = qs(`#v-${v.n}`);
  const sadrEl = qs('.verse__sadr', card);
  const ajzEl = qs('.verse__ajz', card);
  const token = ++speakToken;
  speakingVerse = v.n;

  btn?.classList.add('is-active');
  card?.classList.add('is-focus');
  card?.scrollIntoView({ block: 'center', behavior: 'smooth' });

  const tune = speech.tuning();
  const opts = { rate: tune.rate, pitch: tune.pitch };
  const stopIfChanged = () => token !== speakToken || speakingVerse !== v.n;

  await speech.speak(
    v.sadr,
    { ...opts, onstart: () => sadrEl?.classList.add('is-reading'), onend: () => sadrEl?.classList.remove('is-reading') }
  );
  if (stopIfChanged()) return;
  await new Promise((r) => setTimeout(r, tune.gap));
  if (stopIfChanged()) return;
  await speech.speak(
    v.ajz,
    { ...opts, onstart: () => ajzEl?.classList.add('is-reading'), onend: () => ajzEl?.classList.remove('is-reading') }
  );
  if (stopIfChanged()) return;

  sadrEl?.classList.remove('is-reading');
  ajzEl?.classList.remove('is-reading');
  card?.classList.remove('is-focus');
  btn?.classList.remove('is-active');
  speakingVerse = null;
}

/* --------------------------- إضاءة بيتٍ معيّن --------------------------- */
export function focusVerse(n, { scroll = true, cls = 'is-focus' } = {}) {
  qsa('.verse.is-focus').forEach((c) => c.classList.remove('is-focus'));
  const card = qs(`#v-${n}`);
  if (!card) return null;
  card.classList.add(cls);
  if (scroll) {
    const r = card.getBoundingClientRect();
    const offScreen = r.top < 90 || r.bottom > window.innerHeight - 90;
    if (offScreen) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  return card;
}

export function goToVerse(n, opts) {
  const card = focusVerse(n, opts);
  if (!card) return;
  history.replaceState(null, '', `#v-${n}`);
  card.focus({ preventScroll: true });
}

/* ---------------------------- بناء الفهرس ---------------------------- */
function buildToc() {
  const wrap = qs('#tocLinks');
  const footer = qs('#footerChapters');
  if (wrap) {
    wrap.innerHTML = CHAPTERS.map(
      (c) => `<a class="toc__link" href="#${c.id}" data-chapter-link="${c.id}">
                <b>${toArabicDigits(c.index)}</b> ${c.title}
              </a>`
    ).join('');
  }
  if (footer) {
    footer.innerHTML = CHAPTERS.map(
      (c) => `<li><a href="#${c.id}">${icon('scroll')} ${c.ordinal}: ${c.title}</a></li>`
    ).join('');
  }
}

/* --------------------------- بناء فصول الأبيات --------------------------- */
function chapterHTML(c) {
  return `
  <section class="chapter" id="${c.id}" data-chapter="${c.id}" aria-labelledby="${c.id}-title">
    <div class="chapter__band">
      <div class="chapter__plate reveal">
        <div class="chapter__ornament" aria-hidden="true">۞</div>
        <p class="chapter__ordinal">${c.ordinal}</p>
        <h2 class="chapter__title gold-text" id="${c.id}-title">${c.title}</h2>
        <p class="chapter__tagline">${c.tagline}</p>
        <div class="chapter__meta">
          <span class="chip">الأبيات ${toArabicDigits(c.first)} – ${toArabicDigits(c.last)}</span>
          <span class="chip">${toArabicDigits(c.count)} بيتًا</span>
          <button class="chip" type="button" data-chapter-play="${c.id}">
            ${icon('headphones')} إلقاء الفصل صوتيًّا
          </button>
        </div>
      </div>
    </div>
    <div class="container">
      <div class="verses" id="${c.id}-verses">${c.verses.map((v) => verseCardHTML(v)).join('')}</div>
    </div>
  </section>`;
}

export function renderChapters() {
  const wrap = qs('#chaptersWrap');
  if (!wrap) return;
  wrap.innerHTML = CHAPTERS.map(chapterHTML).join('');
}

/* --------------------------- قسم المفضّلة --------------------------- */
export function renderFavoritesSection() {
  const wrap = qs('#favWrap');
  const empty = qs('#favEmpty');
  if (!wrap || !empty) return;
  const list = favorites.all();
  empty.hidden = list.length > 0;
  wrap.innerHTML = list
    .map((n) => {
      const v = verseAt(n);
      return v ? verseCardHTML(v, { showChapter: true }) : '';
    })
    .join('');
}

/* ------------------------- تطبيق مرشّح المفضّلة ------------------------- */
export function applyFilter() {
  const on = viewFilter.active;
  qsa('.chapter').forEach((sec) => {
    let visible = 0;
    qsa('.verse', sec).forEach((card) => {
      const show = !on || favorites.has(Number(card.dataset.n));
      card.classList.toggle('is-hidden', !show);
      if (show) visible += 1;
    });
    sec.classList.toggle('is-hidden', on && visible === 0);
  });
}

/* ---------------------------- تفاعلات البطاقة ---------------------------- */
function updateStar(btn, active) {
  btn.classList.toggle('is-active', active);
  btn.setAttribute('aria-pressed', String(active));
  btn.innerHTML = `${icon(active ? 'star-filled' : 'star')}<span class="tip">${
    active ? 'إزالة من المفضّلة' : 'إضافة إلى المفضّلة'
  }</span>`;
}

export function bindCardInteractions(root = document) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-tool]');
    if (!btn) return;
    const card = btn.closest('.verse');
    if (!card) return;
    const v = verseAt(Number(card.dataset.n));
    if (!v) return;
    const tool = btn.dataset.tool;

    if (tool === 'copy') {
      const ok = await copyText(versePlainText(v));
      toast(ok ? `نُسخ البيت ${v.label} جاهزًا للنشر` : 'تعذّر النسخ، انسخ النص يدويًّا', {
        iconName: ok ? 'copy' : 'info',
      });
    } else if (tool === 'image') {
      bus.emit('quote:open', { n: v.n });
    } else if (tool === 'speak') {
      speakVerse(v, btn);
    } else if (tool === 'fav') {
      const added = favorites.toggle(v.n);
      updateStar(btn, added);
      qsa(`#favWrap .verse[data-n="${v.n}"] [data-tool="fav"]`).forEach((b) => updateStar(b, added));
      toast(added ? `أُضيف البيت ${v.label} إلى المفضّلة` : `أُزيل البيت ${v.label} من المفضّلة`, {
        iconName: added ? 'star-filled' : 'star',
      });
    }
  });

  /* استماع فصلٍ كامل يبدأ من أول بيتٍ فيه */
  root.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chapter-play]');
    if (!chip) return;
    const chapter = CHAPTERS.find((c) => c.id === chip.dataset.chapterPlay);
    if (!chapter || !chapter.verses.length) return;
    bus.emit('audio:play-from', { n: chapter.verses[0].n, auto: true });
  });
}

/* ------------------------------ التهيئة ------------------------------ */
export function initRender() {
  buildToc();
  renderChapters();
  renderFavoritesSection();
  bindCardInteractions();

  bus.on('favorites:change', () => {
    renderFavoritesSection();
    if (viewFilter.active) applyFilter();
  });
  bus.on('filter:change', applyFilter);
  bus.on('recite:stop-all', ({ source } = {}) => {
    if (source !== 'verse-tool') stopVerseSpeech();
  });

  // مؤشّر موضع القراءة في الترويسة (نسبة التمرير)
  const bar = qs('#progressBar');
  const onScroll = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = h > 0 ? Math.min(1, window.scrollY / h) : 0;
    if (bar) bar.style.transform = `scaleX(${p})`;
    qs('#toTop')?.classList.toggle('is-visible', window.scrollY > 700);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // إبراز الفصل الحالي في الفهرس
  const links = qsa('[data-chapter-link]');
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach((l) => l.classList.toggle('is-active', l.dataset.chapterLink === id));
      });
    },
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  );
  qsa('.chapter').forEach((s) => spy.observe(s));

  // ظهور العناصر تدريجيًّا
  const reveals = qsa('.reveal');
  if ('IntersectionObserver' in window) {
    const ro = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            ro.unobserve(en.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    reveals.forEach((n) => ro.observe(n));
  } else {
    reveals.forEach((n) => n.classList.add('is-in'));
  }

  // غبار ذهبي في الواجهة
  const dust = qs('#heroDust');
  if (dust && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 26; i += 1) {
      const s = document.createElement('i');
      const size = (Math.random() * 5 + 2).toFixed(1);
      s.style.setProperty('--s', `${size}px`);
      s.style.setProperty('--dur', `${(Math.random() * 16 + 14).toFixed(1)}s`);
      s.style.setProperty('--delay', `${(Math.random() * 18).toFixed(1)}s`);
      s.style.setProperty('--dx', `${(Math.random() * 120 - 60).toFixed(0)}px`);
      s.style.left = `${(Math.random() * 100).toFixed(2)}%`;
      frag.appendChild(s);
    }
    dust.appendChild(frag);
  }
}

export { TOTAL_VERSES, VERSES, CHAPTERS, verseIndex };
