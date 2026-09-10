/**
 * Shibadoku i18n (Internationalization) Engine
 * Supports 7 Languages:
 *   - 日本語 (ja)
 *   - English (en)
 *   - 简体中文 (zh)
 *   - Français (fr)
 *   - Español (es)
 *   - Deutsch (de)
 *   - Русский (ru)
 * Automatically detects user environment while allowing manual override.
 */

import { ja } from './locales/ja';
import { en } from './locales/en';
import { zh } from './locales/zh';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { de } from './locales/de';
import { ru } from './locales/ru';
import { uk } from './locales/uk';
import { pl } from './locales/pl';
import { it } from './locales/it';

export type SupportedLang = 'ja' | 'en' | 'zh' | 'fr' | 'es' | 'de' | 'ru' | 'uk' | 'pl' | 'it';
export type LangSetting = 'auto' | SupportedLang;

export const DICTIONARY: Record<SupportedLang, Record<string, string>> = {
  ja,
  en,
  zh,
  fr,
  es,
  de,
  ru,
  uk,
  pl,
  it,
};

class I18nManager {
  private currentSetting: LangSetting = 'auto';
  private resolvedLang: SupportedLang = 'en';

  constructor() {
    this.resolvedLang = this.detectSystemLanguage();
  }

  /**
   * Detect language from browser environment:
   * Checks navigator.languages against supported prefixes.
   */
  public detectSystemLanguage(): SupportedLang {
    if (typeof navigator !== 'undefined') {
      const languages = navigator.languages || [navigator.language];
      for (const lang of languages) {
        if (!lang) continue;
        const l = lang.toLowerCase();
        if (l.startsWith('ja')) return 'ja';
        if (l.startsWith('zh')) return 'zh';
        if (l.startsWith('fr')) return 'fr';
        if (l.startsWith('es')) return 'es';
        if (l.startsWith('de')) return 'de';
        if (l.startsWith('ru')) return 'ru';
        if (l.startsWith('uk')) return 'uk';
        if (l.startsWith('pl')) return 'pl';
        if (l.startsWith('it')) return 'it';
        if (l.startsWith('en')) return 'en';
      }
    }
    return 'en';
  }

  public setSetting(setting: LangSetting): void {
    this.currentSetting = setting;
    if (setting === 'auto') {
      this.resolvedLang = this.detectSystemLanguage();
    } else {
      this.resolvedLang = setting;
    }
  }

  public getSetting(): LangSetting {
    return this.currentSetting;
  }

  public getResolvedLang(): SupportedLang {
    return this.resolvedLang;
  }

  /**
   * Translate key with optional parameter interpolation {param}
   */
  public t(key: string, params?: Record<string, string | number>): string {
    const dict = DICTIONARY[this.resolvedLang] || DICTIONARY.en;
    let text = dict[key] || DICTIONARY.en[key] || DICTIONARY.ja[key] || key;

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }

    return text;
  }

  /**
   * Batch-apply translations to DOM elements with data-i18n attributes
   */
  public applyTranslations(root: HTMLElement | Document = document): void {
    // Update HTML lang attribute
    if (document.documentElement) {
      document.documentElement.lang = this.resolvedLang;
    }

    // Page title
    const metaTitle = this.t('app.title');
    if (metaTitle) {
      document.title = metaTitle;
    }

    // Elements with data-i18n (text content)
    root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (key) {
        el.textContent = this.t(key);
      }
    });

    // Elements with data-i18n-html (HTML content)
    root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
      const key = el.dataset.i18nHtml;
      if (key) {
        el.innerHTML = this.t(key);
      }
    });

    // Elements with data-i18n-title (title tooltip & aria-label)
    root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
      const key = el.dataset.i18nTitle;
      if (key) {
        const text = this.t(key);
        el.title = text;
        if (el.hasAttribute('aria-label')) {
          el.setAttribute('aria-label', text);
        }
      }
    });

    // Elements with data-i18n-placeholder (input placeholder)
    root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      if (key) {
        el.placeholder = this.t(key);
      }
    });
  }
}

export const i18n = new I18nManager();
export const t = (key: string, params?: Record<string, string | number>) => i18n.t(key, params);
