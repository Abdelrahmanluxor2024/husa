/**
 * حالة التطبيق — المفضّلة، النمط، مرشّح العرض (مع الحفظ في المتصفح)
 */
import { store, bus } from './util.js';

/* ------------------------------- المفضّلة -------------------------------- */
const favSet = new Set((store.get('favorites', []) || []).map(Number));

export const favorites = {
  all() {
    return Array.from(favSet).sort((a, b) => a - b);
  },
  count() {
    return favSet.size;
  },
  has(n) {
    return favSet.has(Number(n));
  },
  toggle(n) {
    const num = Number(n);
    const added = !favSet.has(num);
    if (added) favSet.add(num);
    else favSet.delete(num);
    store.set('favorites', Array.from(favSet));
    bus.emit('favorites:change', { n: num, added });
    return added;
  },
  clear() {
    favSet.clear();
    store.set('favorites', []);
    bus.emit('favorites:change', { n: null, added: false });
  },
};

/* ------------------------------- النمط ---------------------------------- */
export const theme = {
  current() {
    return document.documentElement.dataset.theme === 'paper' ? 'paper' : 'royal';
  },
  set(mode) {
    const next = mode === 'paper' ? 'paper' : 'royal';
    document.documentElement.dataset.theme = next;
    store.set('theme', next);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'paper' ? '#f3ecdd' : '#0b0e14');
    bus.emit('theme:change', next);
    return next;
  },
  toggle() {
    return this.set(this.current() === 'paper' ? 'royal' : 'paper');
  },
  init() {
    const saved = store.get('theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    this.set(saved || (prefersLight ? 'paper' : 'royal'));
  },
};

/* ---------------------------- مرشّح المفضّلة ------------------------------ */
export const viewFilter = {
  active: false,
  set(on) {
    this.active = Boolean(on);
    bus.emit('filter:change', this.active);
  },
  toggle() {
    this.set(!this.active);
    return this.active;
  },
};

export default { favorites, theme, viewFilter };
