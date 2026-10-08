import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { mergeLocales } from './merge';

export type UiLanguage = 'en' | 'ta';
const KEY = 'ui_language'; // a display preference, not health data

function initial(): UiLanguage {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'ta') return saved;
  } catch {
    // storage blocked: fall through
  }
  return navigator.language?.toLowerCase().startsWith('ta') ? 'ta' : 'en';
}

// Core strings live in locales/en.json + ta.json; feature areas add theirs in locales/extra/<area>.<lang>.json.
const extras = import.meta.glob<Record<string, unknown>>('../../locales/extra/*.json', { eager: true, import: 'default' });
const { en, ta } = mergeLocales(extras);

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ta: { translation: ta } },
  lng: initial(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function syncHtmlLang(lng: string) {
  document.documentElement.lang = lng;
}
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export async function setUiLanguage(lang: UiLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // ignore
  }
}

export function dateLocale(): string {
  return i18n.language === 'ta' ? 'ta-IN' : 'en-IN';
}

export default i18n;
