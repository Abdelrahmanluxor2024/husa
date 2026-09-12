/**
 * مشغّل الاستماع — إلقاء الأبيات صوتيًّا
 * ================================================================
 * لا ملفات صوتية ولا موسيقى في الموقع إطلاقًا؛ الإلقاء يعتمد على
 * محرّك النطق المدمج في المتصفّح (Web Speech API):
 *
 *   - يقرأ الأبيات الـ٧٧ بيتًا بيتًا، شطرًا شطرًا
 *   - يُضيء البيت المقروء والشطر الجاري ويتابع التمرير إليه
 *   - تنقّل يدوي بين الأبيات، وشريط موضع قابل للسحب
 *   - قائمة الفصول للبدء من أوّل أيّ فصل
 */
import { VERSES, verseIndex, toArabicDigits, TOTAL_VERSES, CHAPTERS } from './data/verses.js';
import { qs, qsa, toast, formatTime, clamp, store, bus, isTyping } from './util.js';
import { focusVerse } from './render.js';
import speech from './speech.js';

const state = {
  playing: false,
  open: false,
  follow: store.get('player:follow', true),
  idx: 0,
  token: 0,
};

let els = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --------------------------- تقدير زمن الإلقاء --------------------------- */
const charsPerSecond = 12.5;

function estimateVerse(v) {
  const tune = speech.tuning();
  return (v.sadr.length + v.ajz.length) / charsPerSecond + (tune.gap / 1000) * 2;
}

export function totalEstimate() {
  return VERSES.reduce((acc, v) => acc + estimateVerse(v), 0);
}

function elapsedBefore(i) {
  let t = 0;
  for (let k = 0; k < i && k < VERSES.length; k += 1) t += estimateVerse(VERSES[k]);
  return t;
}

/* ------------------------------ واجهة المشغّل ------------------------------ */
function setPlayingUI() {
  els.player?.classList.toggle('is-playing', state.playing);
  if (els.btnPlay) {
    els.btnPlay.setAttribute('aria-label', state.playing ? 'إيقاف الإلقاء' : 'بدء الإلقاء');
    els.btnPlay.title = state.playing ? 'إيقاف الإلقاء' : 'بدء الإلقاء';
  }
}

function setProgress(fraction, curLabel, durLabel) {
  const pct = clamp(fraction, 0, 1) * 100;
  if (els.seekFill) els.seekFill.style.width = `${pct}%`;
  if (els.seekDot) els.seekDot.style.insetInlineStart = `${pct}%`;
  if (els.seek) els.seek.setAttribute('aria-valuenow', String(Math.round(pct)));
  if (curLabel !== undefined && els.timeCur) els.timeCur.textContent = curLabel;
  if (durLabel !== undefined && els.timeDur) els.timeDur.textContent = durLabel;
}

function setSub(html) {
  if (els.sub) els.sub.innerHTML = html;
}

/** إضاءة الشطر الجاري داخل البيت */
function markReading(n, half) {
  const card = qs(`#v-${n}`);
  if (!card) return;
  qsa('.verse__sadr, .verse__ajz', card).forEach((node) => node.classList.remove('is-reading'));
  if (half) qs(`.verse__${half}`, card)?.classList.add('is-reading');
}

function clearReading() {
  qsa('.is-reading').forEach((n) => n.classList.remove('is-reading'));
  qsa('.verse.is-focus').forEach((n) => n.classList.remove('is-focus'));
}

/* -------------------------------- الإلقاء -------------------------------- */
function stopRecitation() {
  state.token += 1;
  speech.stop();
  clearReading();
}

async function runRecitation(startIndex) {
  const token = ++state.token;
  const tune = speech.tuning();
  const alive = () => state.playing && token === state.token;
  const total = totalEstimate();
  let i = clamp(startIndex, 0, TOTAL_VERSES - 1);

  while (alive() && i < TOTAL_VERSES) {
    const v = VERSES[i];
    state.idx = i;

    setSub(`<b>البيت ${v.label}</b> · ${v.chapterOrdinal}`);
    setProgress(
      (i + 0.5) / TOTAL_VERSES,
      formatTime(elapsedBefore(i)),
      `≈ ${formatTime(total)}`
    );
    if (state.follow) focusVerse(v.n, { scroll: true });

    markReading(v.n, 'sadr');
    await speech.speak(v.sadr, { rate: tune.rate, pitch: tune.pitch });
    if (!alive()) break;
    markReading(v.n, null);
    await sleep(tune.gap);
    if (!alive()) break;

    markReading(v.n, 'ajz');
    await speech.speak(v.ajz, { rate: tune.rate, pitch: tune.pitch });
    if (!alive()) break;
    markReading(v.n, null);
    await sleep(tune.gap);
    i += 1;
  }

  if (token === state.token && state.playing && i >= TOTAL_VERSES) {
    state.playing = false;
    setPlayingUI();
    clearReading();
    setProgress(1, formatTime(total), `≈ ${formatTime(total)}`);
    setSub('تمّت قراءة المنظومة كاملة — <b>بارك الله فيك</b>');
    toast('تمّت قراءة المنظومة كاملة ✦', { iconName: 'check' });
  }
}

/* ------------------------------ أوامر التحكّم ------------------------------ */
export function play(fromVerse = null) {
  if (!speech.supported) {
    toast('متصفحك لا يدعم النطق الصوتي — جرّب متصفحًا آخر (Chrome / Edge / Safari).', {
      iconName: 'info',
      duration: 5200,
    });
    return;
  }
  bus.emit('recite:stop-all', { source: 'player' });
  if (!speech.hasArabic) {
    toast('لا يوجد صوت عربي مثبّت على جهازك؛ سيكون الإلقاء بأقرب صوتٍ متاح.', {
      iconName: 'info',
      duration: 5200,
    });
  }
  const idx = fromVerse ? verseIndex(fromVerse) : state.idx;
  state.playing = true;
  setPlayingUI();
  speech.stop();
  runRecitation(idx);
}

export function pause() {
  state.playing = false;
  setPlayingUI();
  stopRecitation();
  const v = VERSES[state.idx];
  setSub(v ? `المنظومة متوقّفة عند <b>البيت ${v.label}</b>` : 'الإلقاء متوقّف');
}

export function toggle(fromVerse = null) {
  if (state.playing) pause();
  else play(fromVerse);
}

export function open({ autoplay = false, fromVerse = null } = {}) {
  state.open = true;
  els.player?.classList.add('is-open');
  document.body.classList.add('has-player');
  setProgress((state.idx + 0.5) / TOTAL_VERSES, formatTime(elapsedBefore(state.idx)), `≈ ${formatTime(totalEstimate())}`);
  if (autoplay) play(fromVerse);
  else if (!state.playing) {
    const v = VERSES[state.idx];
    setSub(v ? `جاهز للإلقاء — يبدأ من <b>البيت ${v.label}</b>` : 'جاهز للإلقاء من أوّل المنظومة');
  }
}

export function close() {
  pause();
  state.open = false;
  els.player?.classList.remove('is-open');
  document.body.classList.remove('has-player');
}

export function step(delta) {
  const next = clamp(state.idx + delta, 0, TOTAL_VERSES - 1);
  const v = VERSES[next];
  if (!v) return;
  state.idx = next;
  if (state.playing) play(v.n);
  else {
    focusVerse(v.n, { scroll: true });
    setSub(`جاهز للإلقاء — يبدأ من <b>البيت ${v.label}</b>`);
    setProgress((next + 0.5) / TOTAL_VERSES);
  }
}

export function seekToFraction(fraction) {
  const idx = clamp(Math.round(fraction * TOTAL_VERSES - 0.5), 0, TOTAL_VERSES - 1);
  const v = VERSES[idx];
  state.idx = idx;
  if (state.playing) play(v.n);
  else {
    focusVerse(v.n, { scroll: true });
    setSub(`جاهز للإلقاء — يبدأ من <b>البيت ${v.label}</b>`);
  }
  setProgress((idx + 0.5) / TOTAL_VERSES, formatTime(elapsedBefore(idx)), `≈ ${formatTime(totalEstimate())}`);
}

export function seekToVerse(n) {
  const v = VERSES.find((x) => x.n === Number(n));
  if (v) seekToFraction((verseIndex(v.n) + 0.5) / TOTAL_VERSES);
}

export function isPlaying() {
  return state.playing;
}

/* ------------------------------- قائمة الفصول ------------------------------- */
function renderPlaylist() {
  const list = els.playlistList;
  if (!list) return;
  const items = [
    { id: 'all', label: 'المنظومة كاملة', desc: `من البيت ${VERSES[0].label} إلى ${VERSES[TOTAL_VERSES - 1].label}`, n: VERSES[0].n },
    ...CHAPTERS.map((c) => ({
      id: c.id,
      label: `${c.ordinal} — ${c.title}`,
      desc: `الأبيات ${toArabicDigits(c.first)} – ${toArabicDigits(c.last)} · ${toArabicDigits(c.count)} بيتًا`,
      n: c.verses[0]?.n ?? VERSES[0].n,
    })),
  ];
  const currentIdx = state.idx;
  list.innerHTML = items
    .map((it, i) => {
      const active = VERSES[currentIdx] && String(it.n) === String(VERSES[currentIdx].n);
      return `<li>
        <button class="track-item ${active ? 'is-active' : ''}" type="button" data-goto="${it.n}">
          <span class="track-item__idx">${toArabicDigits(i + 1)}</span>
          <span>
            <span class="track-item__name">${it.label}</span>
            <span class="track-item__desc" style="display:block">${it.desc}</span>
          </span>
          <span class="track-item__dur">${i === 0 ? '◈' : '❖'}</span>
        </button>
      </li>`;
    })
    .join('');
}

/* -------------------------------- التهيئة -------------------------------- */
export function initPlayer() {
  els = {
    player: qs('#player'),
    btnPlay: qs('#btnPlay'),
    sub: qs('#playerSub'),
    seek: qs('#seek'),
    seekFill: qs('#seekFill'),
    seekDot: qs('#seekDot'),
    timeCur: qs('#timeCur'),
    timeDur: qs('#timeDur'),
    playlistList: qs('#playlistList'),
  };
  if (!els.player) return;

  setPlayingUI();
  renderPlaylist();
  setProgress(0.5 / TOTAL_VERSES, '٠:٠٠', `≈ ${formatTime(totalEstimate())}`);
  if (!speech.supported) {
    if (els.btnPlay) {
      els.btnPlay.setAttribute('disabled', '');
      els.btnPlay.title = 'النطق الصوتي غير مدعوم في هذا المتصفح';
    }
    setSub('النطق الصوتي غير مدعوم في هذا المتصفح');
  }

  els.btnPlay?.addEventListener('click', () => toggle());
  qs('#btnPlayerClose')?.addEventListener('click', close);
  qs('#btnPrev')?.addEventListener('click', () => step(-1));
  qs('#btnNext')?.addEventListener('click', () => step(1));

  els.playlistList?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto]');
    if (!b) return;
    const n = Number(b.dataset.goto);
    state.idx = verseIndex(n);
    play(n);
  });

  qs('#btnPlaylist')?.addEventListener('click', (e) => {
    const expanded = els.player.classList.toggle('is-expanded');
    e.currentTarget.setAttribute('aria-expanded', String(expanded));
  });

  // متابعة البيت المقروء
  const followBtn = qs('#btnFollow');
  const syncFollow = () => {
    followBtn?.classList.toggle('is-active', state.follow);
    followBtn?.setAttribute('aria-pressed', String(state.follow));
  };
  followBtn?.addEventListener('click', () => {
    state.follow = !state.follow;
    store.set('player:follow', state.follow);
    syncFollow();
    toast(state.follow ? 'تتبّع البيت المقروء مُفعّل' : 'تتبّع البيت المقروء مُوقف', { iconName: 'scroll' });
  });
  syncFollow();

  // شريط الموضع: نقر وسحب ولوحة مفاتيح
  const seek = els.seek;
  if (seek) {
    const fractionFromEvent = (clientX) => {
      const rect = seek.getBoundingClientRect();
      if (!rect.width) return 0;
      return clamp((rect.right - clientX) / rect.width, 0, 1); // من اليمين إلى اليسار
    };
    let dragging = false;
    seek.addEventListener('pointerdown', (e) => {
      dragging = true;
      seek.classList.add('is-dragging');
      seek.setPointerCapture?.(e.pointerId);
      setProgress(fractionFromEvent(e.clientX));
    });
    seek.addEventListener('pointermove', (e) => {
      if (dragging) setProgress(fractionFromEvent(e.clientX));
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      seek.classList.remove('is-dragging');
      seekToFraction(fractionFromEvent(e.clientX));
    };
    seek.addEventListener('pointerup', end);
    seek.addEventListener('pointercancel', end);
    seek.addEventListener('keydown', (e) => {
      const cur = (state.idx + 0.5) / TOTAL_VERSES;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekToFraction(clamp(cur + 0.02, 0, 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekToFraction(clamp(cur - 0.02, 0, 1));
      } else if (e.key === 'Home') {
        seekToFraction(0);
      } else if (e.key === 'End') {
        seekToFraction(0.999);
      }
    });
  }

  // أحداث خارجية (أزرار «استماع الفصل» وأدوات المفضّلة)
  bus.on('audio:play-from', ({ n, auto = true } = {}) => {
    open({ autoplay: false });
    if (auto) play(n);
    else {
      state.idx = verseIndex(n);
      focusVerse(n, { scroll: true });
      setSub(`جاهز للإلقاء — يبدأ من <b>البيت ${VERSES[state.idx].label}</b>`);
      setProgress((state.idx + 0.5) / TOTAL_VERSES);
    }
  });
  bus.on('recite:stop-all', ({ source } = {}) => {
    if (source === 'player') return;
    if (state.playing) {
      state.playing = false;
      setPlayingUI();
      stopRecitation();
    }
  });

  // المسافة: تشغيل / إيقاف
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTyping() || qs('.overlay.is-open')) return;
    if (!state.open) return;
    e.preventDefault();
    toggle();
  });

  // J / K: البيت التالي / السابق
  document.addEventListener('keydown', (e) => {
    if (!state.open || isTyping() || qs('.overlay.is-open')) return;
    if (e.key === 'j') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'k') {
      e.preventDefault();
      step(-1);
    }
  });
}

export const player = {
  initPlayer,
  play,
  pause,
  toggle,
  open,
  close,
  step,
  seekToFraction,
  seekToVerse,
  isPlaying,
  totalEstimate,
};

export default player;
