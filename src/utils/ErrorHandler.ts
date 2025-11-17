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
 * Circuit Breaker State
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number;
  nextRetry: number;
}

/**
 * Circuit Breaker for preventing cascading failures
 */
class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private nextRetryTime = 0;

  constructor(
    private name: string,
    private failureThreshold = 5,
    private successThreshold = 2,
    private timeout = 60000 // 1 minute
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => T
  ): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextRetryTime) {
        Logger.warn(`Circuit breaker [${this.name}] is OPEN - request rejected`);
        
        if (fallback) {
          return fallback();
        }
        
        throw new AppError(
          `Circuit breaker ${this.name} is open`,
          ErrorCodes.NETWORK_ERROR,
          'Service temporarily unavailable. Please try again later.',
          true
        );
      }
      
      // Transition to HALF_OPEN to test recovery
      this.state = 'HALF_OPEN';
      Logger.info(`Circuit breaker [${this.name}] transitioning to HALF_OPEN`);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      
      if (fallback) {
        return fallback();
      }
      
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      
      if (this.successes >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
        Logger.success(`Circuit breaker [${this.name}] recovered - CLOSED`);
      }
    }
  }

  private onFailure(error: any): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    Logger.warn(
      `Circuit breaker [${this.name}] failure ${this.failures}/${this.failureThreshold}`,
      error
    );

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.successes = 0;
      this.nextRetryTime = Date.now() + this.timeout;
      Logger.error(`Circuit breaker [${this.name}] failed recovery - OPEN`);
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextRetryTime = Date.now() + this.timeout;
      Logger.error(`Circuit breaker [${this.name}] threshold reached - OPEN`);
    }
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailureTime,
      nextRetry: this.nextRetryTime,
    };
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.nextRetryTime = 0;
    Logger.info(`Circuit breaker [${this.name}] manually reset`);
  }
}

// Circuit breaker instances
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name));
  }
  return circuitBreakers.get(name)!;
}

export function getAllCircuitBreakers(): Map<string, CircuitBreakerStats> {
  const stats = new Map<string, CircuitBreakerStats>();
  circuitBreakers.forEach((breaker, name) => {
    stats.set(name, breaker.getStats());
  });
  return stats;
}

export function resetAllCircuitBreakers(): void {
  circuitBreakers.forEach(breaker => breaker.reset());
  Logger.success('All circuit breakers reset');
}

/**
 * Retry helper with exponential backoff
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
        // Exponential backoff
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
