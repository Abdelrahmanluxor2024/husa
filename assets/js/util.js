/**
 * أدوات مساعدة عامّة — DOM، تخزين، تنبيهات، نسخ، أرقام عربية
 */
import { toArabicDigits } from './data/verses.js';

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** بناء عنصر من نص HTML */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function icon(name, cls = '') {
  return `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}" /></svg>`;
}

export function debounce(fn, wait = 120) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), wait);
  };
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------ التخزين المحلي ------------------------------ */
const NS = 'husa:';

export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
    } catch {
      /* التخزين غير متاح (وضع التصفح الخاص) */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(NS + key);
    } catch {
      /* تجاهل */
    }
  },
};

/* ------------------------------- التنبيهات -------------------------------- */
export function toast(message, { iconName = 'check', duration = 3200 } = {}) {
  const stack = qs('#toastStack');
  if (!stack) return;
  const node = el(`<div class="toast" role="status">${icon(iconName)}<span></span></div>`);
  node.querySelector('span').textContent = message;
  stack.appendChild(node);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 340);
  }, duration);
}

/* --------------------------------- النسخ --------------------------------- */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ------------------------------ تنسيق ومقاييس ----------------------------- */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '٠:٠٠';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${toArabicDigits(m)}:${toArabicDigits(String(s).padStart(2, '0'))}`;
}

export function formatCount(n) {
  return toArabicDigits(n);
}

/** تمرير سلس إلى عنصر مع مراعاة الحركة المُخفّفة */
export function scrollToEl(node, offset = 90) {
  if (!node) return;
  const top = node.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** تركيز محصور داخل نافذة (focus trap) */
export function createFocusTrap(container) {
  const selector =
    'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  function onKeydown(e) {
    if (e.key !== 'Tab') return;
    const items = qsa(selector, container).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}

export const isTyping = () => {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
};

/* ------------------------------ ناقل الأحداث ------------------------------ */
const handlers = new Map();

export const bus = {
  on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return () => bus.off(event, fn);
  },
  off(event, fn) {
    handlers.get(event)?.delete(fn);
  },
  emit(event, detail) {
    handlers.get(event)?.forEach((fn) => {
      try {
        fn(detail);
      } catch (err) {
        console.error(err);
      }
    });
  },
};
