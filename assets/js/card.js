/**
 * بناء بطاقة البيت (Verses Card) — قالب HTML موحّد
 */
import { icon } from './util.js';
import { favorites } from './state.js';

export function verseCardHTML(v, { showChapter = true } = {}) {
  const fav = favorites.has(v.n);
  return `
  <article class="verse" id="v-${v.n}" data-n="${v.n}" data-chapter="${v.chapterId}" tabindex="-1">
    <div class="verse__num" aria-hidden="true"><span>${v.label}</span></div>

    <div class="verse__content">
      ${
        showChapter
          ? `<div class="verse__meta">
               <span>${v.chapterOrdinal}</span>
               <span class="dot" aria-hidden="true"></span>
               <span>${v.chapterTitle}</span>
             </div>`
          : ''
      }

      <p class="verse__text">
        <span class="verse__sadr" data-half="sadr">${v.sadr}</span>
        <span class="verse__sep" aria-hidden="true"><i>✦</i></span>
        <span class="verse__ajz" data-half="ajz">${v.ajz}</span>
      </p>

      <div class="verse__footer">
        <div class="verse__tools" role="toolbar" aria-label="أدوات البيت ${v.label}">
          <button class="icon-btn icon-btn--sm" type="button" data-tool="copy" aria-label="نسخ البيت ${v.label}" title="نسخ البيت">
            ${icon('copy')}<span class="tip">نسخ البيت</span>
          </button>
          <button class="icon-btn icon-btn--sm" type="button" data-tool="image" aria-label="تصدير البيت ${v.label} كصورة" title="تصدير كصورة">
            ${icon('image')}<span class="tip">تصدير كصورة</span>
          </button>
          <button class="icon-btn icon-btn--sm" type="button" data-tool="speak" aria-label="نطق البيت ${v.label}" title="نطق صوتي">
            ${icon('volume')}<span class="tip">نطق صوتي</span>
          </button>
          <button class="icon-btn icon-btn--sm ${fav ? 'is-active' : ''}" type="button" data-tool="fav"
                  aria-pressed="${fav}" aria-label="إضافة البيت ${v.label} إلى المفضّلة" title="المفضّلة">
            ${icon(fav ? 'star-filled' : 'star')}<span class="tip">${fav ? 'إزالة من المفضّلة' : 'إضافة إلى المفضّلة'}</span>
          </button>
        </div>
        ${
          showChapter
            ? `<a class="verse__chapter-link" href="#${v.chapterId}">${v.chapterOrdinal} ↗</a>`
            : `<span class="verse__chapter-link">البيت ${v.label} · ${v.chapterOrdinal}</span>`
        }
      </div>
    </div>
  </article>`;
}

/** نصّ جاهز للنشر (نسخ / مشاركة) */
export function versePlainText(v) {
  return `« ${v.sadr}\n${v.ajz} »\n\n— ${'الشيخ حسين الشعار'} | المنظومة (البيت ${v.label})\n#الشيخ_حسين_الشعار #قاهر_أهل_البدع #صولة_الحق`;
}
