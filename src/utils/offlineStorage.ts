// Cross-platform offline storage helpers for caching Firebase query results
// - On native: uses AsyncStorage
// - On web: uses localStorage

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const prefix = 'offline:cache:';

function getKey(key: string) {
  return `${prefix}${key}`;
}

export async function setCache<T>(key: string, value: T): Promise<void> {
  const payload = JSON.stringify({ v: 1, data: value, ts: Date.now() });
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(getKey(key), payload);
    } catch (e) {
      // ignore storage errors
    }
  } else {
    try {
      await AsyncStorage.setItem(getKey(key), payload);
    } catch (e) {
      // ignore storage errors
    }
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  const k = getKey(key);
  try {
    if (Platform.OS === 'web') {
      const raw = window.localStorage.getItem(k);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.data ?? null;
    } else {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.data ?? null;
    }
  } catch {
    return null;
  }
}

export async function removeCache(key: string): Promise<void> {
  const k = getKey(key);
  try {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(k);
    } else {
      await AsyncStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}