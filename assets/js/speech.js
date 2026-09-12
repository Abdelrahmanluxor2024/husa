/**
 * محرّك النطق الصوتي (Web Speech API)
 * يُستخدم لإلقاء الأبيات صوتيًّا بيتًا بيتًا مع إضاءة البيت المقروء.
 */
import { store } from './util.js';

/**
 * نبرة الإلقاء الافتراضية (ترتيلٌ هادئ واضح)
 * الوحدة: rate سرعة القراءة، pitch طبقة الصوت، gap مهلة بين الشطرين (مللي ثانية)
 */
const TUNING = { rate: 0.86, pitch: 0.88, gap: 430 };

const PREFERRED_VOICES = [
  'maged',
  'majed',
  'naayf',
  'nayef',
  'tarik',
  'hoda',
  'salma',
  'zariyah',
  'layla',
  'amine',
];

export const speech = {
  get supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },

  voices: [],

  loadVoices() {
    if (!this.supported) return [];
    this.voices = window.speechSynthesis.getVoices() || [];
    return this.voices;
  },

  /** اختيار أفضل صوت عربي متاح */
  pickVoice() {
    const saved = store.get('voiceURI');
    const voices = this.voices.length ? this.voices : this.loadVoices();
    if (saved) {
      const exact = voices.find((v) => v.voiceURI === saved);
      if (exact) return exact;
    }
    const arabic = voices.filter((v) => /^ar\b/i.test(v.lang) || /arabic|عربي/i.test(v.name));
    if (!arabic.length) return null;
    const saudi = arabic.find((v) => /^ar[-_]SA/i.test(v.lang));
    if (saudi) return saudi;
    const preferred = arabic.find((v) =>
      PREFERRED_VOICES.some((name) => v.name.toLowerCase().includes(name))
    );
    return preferred || arabic[0];
  },

  get hasArabic() {
    const voices = this.voices.length ? this.voices : this.loadVoices();
    return voices.some((v) => /^ar\b/i.test(v.lang) || /arabic|عربي/i.test(v.name));
  },

  /**
   * إلقاء نصٍّ واحد
   * @returns {Promise<void>}
   */
  speak(text, { rate = 0.85, pitch = 0.9, voice = null, onstart, onend, onerror } = {}) {
    return new Promise((resolve) => {
      if (!this.supported) {
        onerror?.('unsupported');
        resolve();
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      const v = voice || this.pickVoice();
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else {
        u.lang = 'ar-SA';
      }
      u.rate = rate;
      u.pitch = pitch;
      u.volume = 1;
      u.onstart = () => onstart?.();
      u.onend = () => {
        onend?.();
        resolve();
      };
      u.onerror = (e) => {
        onerror?.(e?.error || 'error');
        resolve();
      };
      window.speechSynthesis.speak(u);
    });
  },

  stop() {
    if (!this.supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* تجاهل */
    }
  },

  tuning() {
    return TUNING;
  },
};

if (speech.supported) {
  speech.loadVoices();
  window.speechSynthesis.onvoiceschanged = () => speech.loadVoices();
}

export default speech;
