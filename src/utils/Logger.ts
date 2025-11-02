/**
 * Centralized logging utility
 * - Only logs debug messages in development mode
 * - Provides consistent log formatting
 * - Can be extended to integrate with error tracking services
 */

class Logger {
  private static isDev = __DEV__;

  /**
   * Debug logs - only in development
   */
  static debug(message: string, ...args: any[]) {
    if (this.isDev) {
      console.log(`🔍 [DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Info logs - always logged
   */
  static info(message: string, ...args: any[]) {
    console.log(`ℹ️ [INFO] ${message}`, ...args);
  }

  /**
   * Warning logs - always logged
   */
  static warn(message: string, ...args: any[]) {
    console.warn(`⚠️ [WARN] ${message}`, ...args);
  }

  /**
   * Error logs - always logged
   */
  static error(message: string, error?: any) {
    console.error(`❌ [ERROR] ${message}`, error);
    // TODO: Could integrate with error tracking (Sentry, Crashlytics, etc.)
  }

  /**
   * Success logs - only in development
   */
  static success(message: string, ...args: any[]) {
    if (this.isDev) {
      console.log(`✅ [SUCCESS] ${message}`, ...args);
    }
  }

  /**
   * Performance logs - only in development
   */
  static perf(label: string, startTime: number) {
    if (this.isDev) {
      const duration = Date.now() - startTime;
      console.log(`⏱️ [PERF] ${label}: ${duration}ms`);
    }
  }
}

export default Logger;
