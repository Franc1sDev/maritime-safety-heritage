import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { setLanguageHeader } from './api';

/**
 * Interface languages (Section 3.1.5). The English text is the key, so wording is identical everywhere and a missing
 * translation falls back to English. English, Kiswahili and Dholuo are the launch languages; the other 17 are added in
 * Phase 2 and load on demand from /locales/<code>.json.
 * Only the language in use is downloaded: an English reader never fetches the Kiswahili text, and the reverse.
 */
const bundled: Record<string, () => Promise<{ default: Record<string, string> }>> = { sw: () => import('../locales/sw'), luo: () => import('../locales/luo') };
export const RTL = ['ar'];
const loaded = new Set(['en']);

void i18n.use(initReactI18next).init({
  resources: { en: { translation: {} } },
  lng: 'en', fallbackLng: 'en', keySeparator: false, nsSeparator: false, returnEmptyString: false,
  interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
});

export function detectLanguage(supported: string[]): string {
  const saved = localStorage.getItem('lang');
  if (saved && supported.includes(saved)) return saved;
  for (const l of navigator.languages ?? [navigator.language]) { const c = l.toLowerCase().split('-')[0]; if (supported.includes(c)) return c; }
  return 'en';
}
export async function setLanguage(code: string) {
  if (!loaded.has(code)) {
    try {
      if (bundled[code]) i18n.addResourceBundle(code, 'translation', (await bundled[code]()).default, true, true);
      else { const r = await fetch(`/locales/${code}.json`); if (r.ok) i18n.addResourceBundle(code, 'translation', await r.json(), true, true); }
      loaded.add(code);
    } catch { /* falls back to English now, and tries again next time */ }
  }
  await i18n.changeLanguage(code);
  localStorage.setItem('lang', code);
  setLanguageHeader(code);
  document.documentElement.lang = code;
  document.documentElement.dir = RTL.includes(code) ? 'rtl' : 'ltr';
}
export default i18n;
