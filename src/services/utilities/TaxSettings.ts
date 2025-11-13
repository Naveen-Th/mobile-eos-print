import AsyncStorage from '@react-native-async-storage/async-storage';

const TAX_RATE_KEY = 'app_tax_rate';
const DEFAULT_TAX_RATE = 8; // percent

export async function getTaxRate(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(TAX_RATE_KEY);
    if (!stored) return DEFAULT_TAX_RATE;
    const parsed = parseFloat(stored);
    return isNaN(parsed) ? DEFAULT_TAX_RATE : parsed;
  } catch {
    return DEFAULT_TAX_RATE;
  }
}

export async function setTaxRate(rate: number): Promise<void> {
  if (typeof rate !== 'number' || isNaN(rate)) throw new Error('Invalid tax rate');
  if (rate < 0) rate = 0;
  if (rate > 100) rate = 100;
  await AsyncStorage.setItem(TAX_RATE_KEY, String(rate));
}

export { DEFAULT_TAX_RATE, TAX_RATE_KEY };