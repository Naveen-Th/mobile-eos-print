/**
 * Business constants and configuration values
 */

// Money and Currency
export const MONEY_PRECISION = 0.01; // 1 paisa - smallest currency unit
export const BALANCE_ROUNDING_TOLERANCE = 0.01; // Tolerance for floating-point comparison
export const MAX_RECEIPT_AMOUNT = 999999.99; // Maximum amount per receipt
export const MIN_RECEIPT_AMOUNT = 0.01; // Minimum amount per receipt

// Caching
export const CACHE_DURATION_MS = 30000; // 30 seconds
export const BALANCE_CACHE_TTL = 300000; // 5 minutes for balance cache (increased for better performance)
export const CUSTOMER_CACHE_TTL = 60000; // 1 minute for customer data

// Receipt Configuration
export const RECEIPT_NUMBER_PREFIX = 'REC';
export const MAX_RECEIPT_ITEMS = 100; // Maximum items per receipt

// Validation
export const MIN_CUSTOMER_NAME_LENGTH = 2;
export const MAX_CUSTOMER_NAME_LENGTH = 100;
export const MIN_ITEM_NAME_LENGTH = 2;
export const MAX_ITEM_NAME_LENGTH = 100;

// Query Limits
export const DEFAULT_QUERY_LIMIT = 100;
export const MAX_QUERY_LIMIT = 500;

// Sync Configuration
export const SYNC_RETRY_ATTEMPTS = 3;
export const SYNC_RETRY_DELAY_MS = 1000;

// Firebase Batch Limits
export const FIRESTORE_BATCH_LIMIT = 500; // Firestore allows 500 operations per batch

export default {
  MONEY_PRECISION,
  BALANCE_ROUNDING_TOLERANCE,
  MAX_RECEIPT_AMOUNT,
  MIN_RECEIPT_AMOUNT,
  CACHE_DURATION_MS,
  BALANCE_CACHE_TTL,
  CUSTOMER_CACHE_TTL,
  RECEIPT_NUMBER_PREFIX,
  MAX_RECEIPT_ITEMS,
  MIN_CUSTOMER_NAME_LENGTH,
  MAX_CUSTOMER_NAME_LENGTH,
  MIN_ITEM_NAME_LENGTH,
  MAX_ITEM_NAME_LENGTH,
  DEFAULT_QUERY_LIMIT,
  MAX_QUERY_LIMIT,
  SYNC_RETRY_ATTEMPTS,
  SYNC_RETRY_DELAY_MS,
  FIRESTORE_BATCH_LIMIT,
};
