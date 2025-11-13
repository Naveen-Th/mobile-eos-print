/**
 * Safe performance timing utility for React Native
 * console.time/timeEnd are not available in RN production builds
 * 
 * This utility is optimized for minimal logging to prevent performance degradation
 */

const timers: Record<string, number> = {};
const ENABLE_DETAILED_LOGGING = false; // Set to true only when debugging performance

export const performanceTime = (label: string): void => {
  if (__DEV__ && ENABLE_DETAILED_LOGGING) {
    // Use console.time in dev mode if available
    if (typeof console.time === 'function') {
      console.time(label);
    } else {
      timers[label] = Date.now();
    }
  }
};

export const performanceTimeEnd = (label: string): void => {
  if (__DEV__ && ENABLE_DETAILED_LOGGING) {
    // Use console.timeEnd in dev mode if available
    if (typeof console.timeEnd === 'function') {
      console.timeEnd(label);
    } else if (timers[label]) {
      const duration = Date.now() - timers[label];
      console.log(`${label}: ${duration}ms`);
      delete timers[label];
    }
  }
};

export const performanceLog = (message: string): void => {
  // Only log in dev mode when detailed logging is enabled
  if (__DEV__ && ENABLE_DETAILED_LOGGING) {
    console.log(message);
  }
};
