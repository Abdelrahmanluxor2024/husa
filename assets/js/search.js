/**
 * البحث الفوري في الأبيات (Instant Search)
 * — تطبيع عربي كامل، تظليل النتائج، تنقّل بلوحة المفاتيح
 */
import { VERSES, CHAPTERS, normalizeArabic, findInOriginal, toArabicDigits } from './data/verses.js';
import { qs, qsa, toast, createFocusTrap, debounce } from './util.js';
import { goToVerse } from './render.js';

const state = {
  query: '',
  chapterId: 'all',
  results: [],
  activeIndex: 0,
  lastFocus: null,
  releaseTrap: null,
};

let overlay;
let input;
let resultsEl;
let filtersEl;
let countEl;

/* ------------------------------ تظليل النتائج ------------------------------ */
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function highlight(original, needle) {
  if (!needle) return escapeHTML(original);
  const hits = findInOriginal(original, needle);
  if (!hits.length) return escapeHTML(original);
  let out = '';
  let cursor = 0;
  hits.forEach((h) => {
    out += escapeHTML(original.slice(cursor, h.start));
    out += `<mark>${escapeHTML(h.text)}</mark>`;
    cursor = h.end;
  });
  out += escapeHTML(original.slice(cursor));
  return out;
}

/* -------------------------------- المحرّك -------------------------------- */
function scoreVerse(v, needle) {
  const hay = v.search;
  if (!hay.includes(needle)) return 0;
  let score = 0;
  // عدد مرّات الظهور
  let idx = hay.indexOf(needle);
  let count = 0;
  while (idx !== -1) {
    count += 1;
    idx = hay.indexOf(needle, idx + needle.length);
  }
  score += count * 10;
  // بداية الشطر أو الكلمة مكتملة
  const words = hay.split(' ');
  words.forEach((w) => {
    if (w === needle) score += 24;
    else if (w.startsWith(needle)) score += 12;
  });
  if (hay.startsWith(needle)) score += 18;
  // تفضيل الكلمة المطابقة في الصدر
  if (normalizeArabic(v.sadr).text.includes(needle)) score += 4;
  // تفضيل الأبيات الأقصر قليلًا (أكثر إحكامًا)
  score += Math.max(0, 6 - Math.floor(v.weight / 24));
  return score;
}

export function searchVerses(rawQuery, chapterId = 'all') {
  const needle = normalizeArabic(rawQuery.trim()).text;
  const pool = chapterId === 'all' ? VERSES : VERSES.filter((v) => v.chapterId === chapterId);
  if (!needle) return pool.slice(0, 20).map((v) => ({ v, score: 0, plain: false }));
  return pool
    .map((v) => ({ v, score: scoreVerse(v, needle) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.v.n - b.v.n)
    .map((r) => ({ ...r, plain: true }));
}

/* --------------------------------- العرض --------------------------------- */
function renderFilters() {
  if (!filtersEl) return;
  const items = [{ id: 'all', label: 'كل الفصول' }, ...CHAPTERS.map((c) => ({ id: c.id, label: c.title }))];
  filtersEl.innerHTML = items
    .map(
      (it) =>
        `<button class="chip ${it.id === state.chapterId ? 'is-active' : ''}" type="button"
           data-filter="${it.id}" aria-pressed="${it.id === state.chapterId}">${it.label}</button>`
    )
    .join('');
}

function renderResults() {
  if (!resultsEl) return;
  const { results, query, activeIndex } = state;

  if (!results.length) {
    resultsEl.innerHTML = `<div class="search__empty">
        <span class="orn">✦</span>
        لا يوجد بيتٌ يحمل «${escapeHTML(query)}»… جرّب كلمةً أخرى مثل: <b>القرآن</b> أو <b>حجتي</b>.
      </div>`;
    if (countEl) countEl.textContent = 'لا نتائج';
    return;
  }

  resultsEl.innerHTML = results
    .map((r, i) => {
      const v = r.v;
      return `<button class="sres ${i === activeIndex ? 'is-active' : ''}" type="button" data-n="${v.n}" role="option"
                aria-selected="${i === activeIndex}">
          <span class="sres__num">${v.label}</span>
          <span>
            <span class="sres__text">${highlight(v.sadr, query)} <span style="color:var(--gold);opacity:.7">...</span> ${highlight(v.ajz, query)}</span>
            <span class="sres__chap">${v.chapterOrdinal} — ${v.chapterTitle}</span>
          </span>
        </button>`;
    })
    .join('');

  if (countEl) {
    countEl.textContent = `${toArabicDigits(results.length)} ${
      results.length === 1 ? 'نتيجة' : results.length === 2 ? 'نتيجتان' : 'نتيجة'
    }`;
  }
}

const runSearch = debounce(() => {
  state.results = searchVerses(state.query, state.chapterId);
  state.activeIndex = 0;
  renderResults();
}, 90);

function setActive(i, { scroll = true } = {}) {
  if (!state.results.length) return;
  const max = state.results.length - 1;
  state.activeIndex = i < 0 ? max : i > max ? 0 : i;
  const nodes = qsa('.sres', resultsEl);
  nodes.forEach((n, idx) => {
    const on = idx === state.activeIndex;
    n.classList.toggle('is-active', on);
    n.setAttribute('aria-selected', String(on));
    if (on && scroll) n.scrollIntoView({ block: 'nearest' });
  });
}

function jumpTo(n) {
  const verseN = Number(n);
  close();
  const card = qs(`#v-${verseN}`);
  if (card && card.classList.contains('is-hidden')) {
    toast(`البيت ${toArabicDigits(verseN)} مخفيٌّ بسبب مرشّح المفضّلة`, { iconName: 'info' });
  }
  setTimeout(() => goToVerse(verseN), 120);
  const stamp = qs(`#v-${verseN}`);
  if (stamp) {
    stamp.animate(
      [
        { boxShadow: '0 0 0 0 rgba(212,175,55,0)' },
        { boxShadow: '0 0 0 4px rgba(212,175,55,.55)' },
        { boxShadow: '0 0 0 0 rgba(212,175,55,0)' },
      ],
      { duration: 1600, easing: 'ease-out' }
    );
  }
}

/* ------------------------------ الفتح والإغلاق ------------------------------ */
export function openSearch(preset = '') {
  if (!overlay) return;
  state.lastFocus = document.activeElement;
  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  if (preset !== undefined && preset !== null) {
    state.query = preset;
    input.value = preset;
  }
  state.results = searchVerses(state.query, state.chapterId);
  state.activeIndex = 0;
  renderResults();
  requestAnimationFrame(() => input.focus());
  if (!state.releaseTrap) state.releaseTrap = createFocusTrap(overlay);
}

export function close() {
  if (!overlay) return;
  overlay.classList.remove('is-open');
  document.body.style.overflow = '';
  state.releaseTrap?.();
  state.releaseTrap = null;
  state.lastFocus?.focus?.();
}

export function initSearch() {
  overlay = qs('#searchOverlay');
  input = qs('#searchInput');
  resultsEl = qs('#searchResults');
  filtersEl = qs('#searchFilters');
  countEl = document.createElement('span');
  countEl.setAttribute('aria-live', 'polite');
  qs('#searchOverlay .panel__foot')?.prepend(countEl);
  if (!overlay) return;

  renderFilters();

  input.addEventListener('input', () => {
    state.query = input.value;
    runSearch();
  });

  filtersEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    state.chapterId = chip.dataset.filter;
    renderFilters();
    state.results = searchVerses(state.query, state.chapterId);
    state.activeIndex = 0;
    renderResults();
  });

  resultsEl.addEventListener('click', (e) => {
    const item = e.target.closest('.sres');
    if (item) jumpTo(item.dataset.n);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
    if (e.target.closest('[data-close="search"]')) close();
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(state.activeIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(state.activeIndex - 1);
    } else if (e.key === 'Enter') {
      const item = state.results[state.activeIndex];
      if (item) jumpTo(item.v.n);
    }
  });

  document.addEventListener('keydown', (e) => {
    const open = overlay.classList.contains('is-open');
    if (e.key === '/' && !open) {
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      openSearch('');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      open ? close() : openSearch('');
    }
  });
}

export default { initSearch, openSearch, close, searchVerses, highlight };
