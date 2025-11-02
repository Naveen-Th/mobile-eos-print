import { Alert } from 'react-native';
import Logger from './Logger';

/**
 * Custom application error with user-friendly messages
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public isRetryable: boolean = false,
    public metadata?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  BALANCE_ERROR: 'BALANCE_ERROR',
  STOCK_ERROR: 'STOCK_ERROR',
  FIREBASE_ERROR: 'FIREBASE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

/**
 * Standard service response
 */
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  canRetry?: boolean;
}

/**
 * Handle errors from services and show appropriate user feedback
 */
export function handleServiceError(
  error: any,
  context: string,
  showAlert: boolean = true
): ServiceResponse {
  Logger.error(`Error in ${context}`, error);

  // Handle AppError
  if (error instanceof AppError) {
    if (showAlert) {
      Alert.alert(
        'Error',
        error.userMessage,
        error.isRetryable
          ? [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: () => {/* Handled by caller */} },
            ]
          : [{ text: 'OK' }]
      );
    }

    return {
      success: false,
      error: error.userMessage,
      errorCode: error.code,
      canRetry: error.isRetryable,
    };
  }

  // Handle Firebase errors
  if (error?.code) {
    const firebaseError = handleFirebaseError(error);
    if (showAlert) {
      Alert.alert('Error', firebaseError.userMessage);
    }
    return {
      success: false,
      error: firebaseError.userMessage,
      errorCode: firebaseError.code,
      canRetry: firebaseError.isRetryable,
    };
  }

  // Handle standard Error
  if (error instanceof Error) {
    const message = error.message || 'An unexpected error occurred';
    if (showAlert) {
      Alert.alert('Error', message);
    }
    return {
      success: false,
      error: message,
      errorCode: ErrorCodes.UNKNOWN_ERROR,
    };
  }

  // Unknown error type
  const fallbackMessage = 'Something went wrong. Please try again.';
  if (showAlert) {
    Alert.alert('Error', fallbackMessage);
  }

  return {
    success: false,
    error: fallbackMessage,
    errorCode: ErrorCodes.UNKNOWN_ERROR,
  };
}

/**
 * Handle Firebase-specific errors
 */
function handleFirebaseError(error: any): AppError {
  const errorCode = error.code || '';

  switch (errorCode) {
    case 'permission-denied':
      return new AppError(
        error.message,
        ErrorCodes.PERMISSION_ERROR,
        'You don\'t have permission to perform this action.',
        false
      );

    case 'unavailable':
    case 'deadline-exceeded':
      return new AppError(
        error.message,
        ErrorCodes.NETWORK_ERROR,
        'Service temporarily unavailable. Please check your connection and try again.',
        true
      );

    case 'not-found':
      return new AppError(
        error.message,
        ErrorCodes.NOT_FOUND,
        'The requested data was not found.',
        false
      );

    case 'already-exists':
      return new AppError(
        error.message,
        ErrorCodes.ALREADY_EXISTS,
        'This record already exists.',
        false
      );

    case 'unauthenticated':
      return new AppError(
        error.message,
        ErrorCodes.AUTH_ERROR,
        'Please sign in to continue.',
        false
      );

    default:
      return new AppError(
        error.message,
        ErrorCodes.FIREBASE_ERROR,
        error.message || 'A Firebase error occurred.',
        false
      );
  }
}

/**
 * Create a validation error
 */
export function createValidationError(
  field: string,
  message: string
): AppError {
  return new AppError(
    `Validation error: ${field} - ${message}`,
    ErrorCodes.VALIDATION_ERROR,
    message,
    false,
    { field }
  );
}

/**
 * Create a payment error
 */
export function createPaymentError(message: string, metadata?: any): AppError {
  return new AppError(
    `Payment error: ${message}`,
    ErrorCodes.PAYMENT_ERROR,
    message,
    false,
    metadata
  );
}

/**
 * Create a balance error
 */
export function createBalanceError(message: string, metadata?: any): AppError {
  return new AppError(
    `Balance error: ${message}`,
    ErrorCodes.BALANCE_ERROR,
    message,
    false,
    metadata
  );
}

/**
 * Retry helper for async operations
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      Logger.warn(`Attempt ${attempt}/${maxAttempts} failed`, error);

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError;
}
