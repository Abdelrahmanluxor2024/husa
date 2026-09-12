/**
 * نقطة الدخول — ربط وحدات الموقع وتهيئة الواجهة
 */
import { VERSES, verseAt, toArabicDigits, SHEIKH } from './data/verses.js';
import { qs, toast, store, bus, scrollToEl, copyText } from './util.js';
import { theme, favorites, viewFilter } from './state.js';
import { initRender, focusVerse, goToVerse } from './render.js';
import { initSearch, openSearch } from './search.js';
import { initQuote, openQuote } from './quote.js';

/* ------------------------------ سنوات التذييل ------------------------------ */
function setYear() {
  const y = qs('#year');
  if (y) y.textContent = toArabicDigits(new Date().getFullYear());
}

/* ------------------------------ المفضّلة والمرشّح ------------------------------ */
function syncFavBadge() {
  const badge = qs('#favCount');
  const btn = qs('#btnFavFilter');
  const count = favorites.count();
  if (badge) {
    badge.hidden = count === 0;
    badge.textContent = toArabicDigits(count);
  }
  if (btn) {
    btn.classList.toggle('is-active', viewFilter.active);
    btn.setAttribute('aria-pressed', String(viewFilter.active));
    btn.querySelector('.tip').textContent = viewFilter.active
      ? 'إظهار كل الأبيات'
      : 'عرض الأبيات المفضّلة فقط';
  }
}

function wireFavorites() {
  qs('#btnFavFilter')?.addEventListener('click', () => {
    if (!favorites.count() && !viewFilter.active) {
      toast('لم تختر أيّ بيتٍ بعد — اضغط النجمة في أي بيت.', { iconName: 'star' });
      return;
    }
    const on = viewFilter.toggle();
    syncFavBadge();
    toast(on ? 'يُعرض الآن أبياتك المفضّلة فقط' : 'رُفع المرشّح: كل الأبيات ظاهرة', {
      iconName: on ? 'star-filled' : 'list',
    });
    if (on) scrollToEl(qs('#ch1'), 140);
  });

  qs('#btnClearFavs')?.addEventListener('click', () => {
    if (!favorites.count()) return;
    favorites.clear();
    toast('أُفرغت قائمة المفضّلة', { iconName: 'check' });
  });
}

/* ------------------------------ الترويسة والنمط ------------------------------ */
function wireHeader() {
  qs('#btnSearch')?.addEventListener('click', () => openSearch(''));
  qs('#btnSearchToc')?.addEventListener('click', () => openSearch(''));

  qs('#btnTheme')?.addEventListener('click', (e) => {
    const mode = theme.toggle();
    const btn = e.currentTarget;
    btn.querySelector('use')?.setAttribute('href', mode === 'paper' ? '#i-sun' : '#i-moon');
    btn.setAttribute('aria-pressed', String(mode === 'paper'));
    toast(mode === 'paper' ? 'النمط الورقي العاجي' : 'النمط الملكي الداكن', { iconName: mode === 'paper' ? 'sun' : 'moon' });
  });

  const doPrint = () => {
    toast('جارٍ تحضير نسخة الطباعة…', { iconName: 'print', duration: 1600 });
    setTimeout(() => window.print(), 300);
  };
  qs('#btnPrint')?.addEventListener('click', doPrint);
  qs('#btnBannerPrint')?.addEventListener('click', doPrint);

  qs('#btnQuoteFromToc')?.addEventListener('click', () => openQuote());
  qs('#btnHeroRandom')?.addEventListener('click', () => {
    const v = VERSES[Math.floor(Math.random() * VERSES.length)];
    goToVerse(v.n);
    toast(`بيتٌ عشوائي: ${v.label} — ${v.chapterOrdinal}`, { iconName: 'feather' });
  });

  qs('#btnBannerShare')?.addEventListener('click', async () => {
    const shareData = {
      title: `الشيخ حسين الشعار — ${SHEIKH.title}`,
      text: 'منظومة الشيخ حسين الشعار: ٧٧ بيتًا في الصدع بالحق ونقض مقالات أهل الكلام.',
      url: location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        const ok = await copyText(`${shareData.text}\n${shareData.url}`);
        toast(ok ? 'نُسخ رابط الموقع' : 'تعذّرت المشاركة', { iconName: ok ? 'copy' : 'info' });
      }
    } catch {
      /* أُلغيت المشاركة */
    }
  });

  qs('#toTop')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ------------------------------ روابط التذييل ------------------------------ */
function wireFooter() {
  qs('.footer__links')?.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    e.preventDefault();
    const action = a.dataset.action;
    if (action === 'search') openSearch('');
    else if (action === 'quote') openQuote();
    else if (action === 'print') window.print();
    else if (action === 'theme') qs('#btnTheme')?.click();
  });
}

/* ---------------------------- ربط النوافذ والأحداث ---------------------------- */
function wireEvents() {
  bus.on('quote:open', ({ n } = {}) => openQuote(n));
}

/* ------------------------------ رسالة أول زيارة ------------------------------ */
function firstVisitHint() {
  if (store.get('visited')) return;
  store.set('visited', true);
  setTimeout(() => {
    toast('مرحبًا بك — اضغط / للبحث الفوري في الأبيات الـ٧٧، أو انسخ أيّ بيتٍ وصدّره صورةً.', {
      iconName: 'info',
      duration: 6000,
    });
  }, 1800);
}

/* ------------------------------ الرابط المباشر ------------------------------ */
function handleHash() {
  const hash = decodeURIComponent(location.hash || '');
  const m = hash.match(/^#v-(\d+)$/);
  if (m) {
    const v = verseAt(Number(m[1]));
    if (v) {
      setTimeout(() => focusVerse(v.n, { scroll: true }), 400);
      return;
    }
  }
  if (/^#ch\d$/.test(hash)) {
    const node = qs(hash);
    if (node) setTimeout(() => scrollToEl(node, 120), 300);
  }
}

/* -------------------------------- التهيئة -------------------------------- */
let started = false;

function init() {
  if (started) return;
  started = true;

  theme.init();
  const tgl = qs('#btnTheme use');
  tgl?.setAttribute('href', theme.current() === 'paper' ? '#i-sun' : '#i-moon');
  qs('#btnTheme')?.setAttribute('aria-pressed', String(theme.current() === 'paper'));

  setYear();
  initRender();
  initSearch();
  initQuote();
  wireHeader();
  wireFavorites();
  wireFooter();
  wireEvents();
  syncFavBadge();

  bus.on('favorites:change', syncFavBadge);
  bus.on('filter:change', syncFavBadge);
  bus.on('theme:change', (mode) => {
    qs('#btnTheme use')?.setAttribute('href', mode === 'paper' ? '#i-sun' : '#i-moon');
  });

  handleHash();
  firstVisitHint();

  // إظهار زر الإيقاف إن كان المسار يعمل قبل التهيئة
  document.body.dataset.ready = 'true';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { init };
