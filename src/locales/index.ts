import en from './en';
import hi from './hi';
import kn from './kn';

export type Language = 'en' | 'hi' | 'kn';

export const languages = {
  en,
  hi,
  kn,
};

export const languageNames: Record<Language, string> = {
  en: 'English',
  hi: 'हिंदी',
  kn: 'ಕನ್ನಡ',
};

export default languages;
