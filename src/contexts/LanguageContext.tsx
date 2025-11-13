import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, languages, languageNames } from '../locales';
import LanguageService from '../services/utilities/LanguageService';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  availableLanguages: typeof languageNames;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    // Load saved language on mount
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await LanguageService.getLanguage();
      setLanguageState(savedLanguage);
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await LanguageService.setLanguage(lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('Error setting language:', error);
      throw error;
    }
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = languages[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        value = languages.en;
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key; // Return key if not found in fallback
          }
        }
        break;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Replace parameters in the string (e.g., {{rate}} -> actual rate)
    if (params) {
      Object.keys(params).forEach((paramKey) => {
        value = value.replace(`{{${paramKey}}}`, String(params[paramKey]));
      });
    }

    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, availableLanguages: languageNames }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
