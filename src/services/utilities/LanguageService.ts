import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from '../locales';

const LANGUAGE_KEY = '@app_language';

class LanguageService {
  /**
   * Save the selected language to AsyncStorage
   */
  async setLanguage(language: Language): Promise<void> {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
      console.error('Error saving language:', error);
      throw error;
    }
  }

  /**
   * Get the selected language from AsyncStorage
   * Returns 'en' as default if no language is set
   */
  async getLanguage(): Promise<Language> {
    try {
      const language = await AsyncStorage.getItem(LANGUAGE_KEY);
      return (language as Language) || 'en';
    } catch (error) {
      console.error('Error loading language:', error);
      return 'en';
    }
  }

  /**
   * Clear the saved language preference
   */
  async clearLanguage(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LANGUAGE_KEY);
    } catch (error) {
      console.error('Error clearing language:', error);
      throw error;
    }
  }
}

export default new LanguageService();
