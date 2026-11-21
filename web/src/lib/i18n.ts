import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { setLanguageHeader } from './api';
import sw from '../locales/sw';
import luo from '../locales/luo';

/**
 * Interface languages (Section 3.1.5). The English text is the key, so wording is identical everywhere and a missing
 * translation falls back to English. English, Kiswahili and Dholuo are the launch languages; the other 17 are added in
 * Phase 2 and load on demand from /locales/<code>.json.
 */
export const RTL = ['ar'];
const loaded = new Set(['en', 'sw', 'luo']);

void i18n.use(initReactI18next).init({
  resources: { en: { translation: {} }, sw: { translation: sw }, luo: { translation: luo } },
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
    try { const r = await fetch(`/locales/${code}.json`); if (r.ok) i18n.addResourceBundle(code, 'translation', await r.json(), true, true); } catch { /* falls back to English */ }
    loaded.add(code);
  }
  await i18n.changeLanguage(code);
  localStorage.setItem('lang', code);
  setLanguageHeader(code);
  document.documentElement.lang = code;
  document.documentElement.dir = RTL.includes(code) ? 'rtl' : 'ltr';
}
export default i18n;
