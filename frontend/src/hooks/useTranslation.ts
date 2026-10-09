'use client';

import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../translations/translations';

export function useTranslation() {
  const { language } = useLanguage();

  return translations[language];
}