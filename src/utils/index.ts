import {ReceiptItem, ValidationError} from '../types';

/**
 * Format currency amount with proper locale and currency symbol
 */
export const formatCurrency = (
  amount: number,
  currency = 'USD',
  locale = 'en-US',
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format date for receipt display
 */
export const formatReceiptDate = (date: any): string => {
  try {
    let dateObj: Date;
    
    if (!date) {
      return 'No Date';
    }
    
    // If it's already a Date object
    if (date instanceof Date) {
      dateObj = date;
    }
    // If it's a Firebase Timestamp with toDate method
    else if (typeof date.toDate === 'function') {
      dateObj = date.toDate();
    }
    // If it's a timestamp number
    else if (typeof date === 'number') {
      dateObj = new Date(date);
    }
    // If it's a string
    else if (typeof date === 'string') {
      dateObj = new Date(date);
    }
    else {
      console.warn('Unknown date format:', date);
      return 'Invalid Date';
    }
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error formatting date:', error, date);
    return 'Invalid Date';
  }
};

/**
 * Format date for compact display (MM/DD/YYYY)
 */
export const formatCompactDate = (date: any): string => {
  try {
    let dateObj: Date;
    
    if (!date) {
      return 'No Date';
    }
    
    // If it's already a Date object
    if (date instanceof Date) {
      dateObj = date;
    }
    // If it's a Firebase Timestamp with toDate method
    else if (typeof date.toDate === 'function') {
      dateObj = date.toDate();
    }
    // If it's a timestamp number
    else if (typeof date === 'number') {
      dateObj = new Date(date);
    }
    // If it's a string
    else if (typeof date === 'string') {
      dateObj = new Date(date);
    }
    else {
      console.warn('Unknown date format:', date);
      return 'Invalid Date';
    }
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (error) {
    console.error('Error formatting date:', error, date);
    return 'Invalid Date';
  }
};

/**
 * Generate unique ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Generate receipt number with format: REC-YYYYMMDD-XXXX
 */
export const generateReceiptNumber = (): string => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `REC-${dateStr}-${randomSuffix}`;
};

/**
 * Calculate cart totals
 */
export const calculateTotals = (
  items: ReceiptItem[],
  taxRate = 0.08,
): {subtotal: number; tax: number; total: number} => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
};

/**
 * Validate receipt item
 */
export const validateReceiptItem = (
  item: Partial<ReceiptItem>,
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!item.name || item.name.trim() === '') {
    errors.push({field: 'name', message: 'Item name is required'});
  } else if (item.name.length > 50) {
    errors.push({field: 'name', message: 'Item name must be 50 characters or less'});
  }

  if (item.price === undefined || item.price === null) {
    errors.push({field: 'price', message: 'Price is required'});
  } else if (item.price < 0) {
    errors.push({field: 'price', message: 'Price must be positive'});
  } else if (item.price > 999999.99) {
    errors.push({field: 'price', message: 'Price is too large'});
  }

  if (item.quantity === undefined || item.quantity === null) {
    errors.push({field: 'quantity', message: 'Quantity is required'});
  } else if (item.quantity <= 0) {
    errors.push({field: 'quantity', message: 'Quantity must be greater than 0'});
  } else if (item.quantity > 9999) {
    errors.push({field: 'quantity', message: 'Quantity is too large'});
  } else if (!Number.isInteger(item.quantity)) {
    errors.push({field: 'quantity', message: 'Quantity must be a whole number'});
  }

  return errors;
};

/**
 * Validate customer information
 */
export const validateCustomerInfo = (customerInfo: {
  customerName?: string;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!customerInfo.customerName || customerInfo.customerName.trim() === '') {
    errors.push({field: 'customerName', message: 'Customer name is required'});
  } else if (customerInfo.customerName.length > 100) {
    errors.push({
      field: 'customerName',
      message: 'Customer name must be 100 characters or less',
    });
  }

  return errors;
};

/**
 * Validate company settings
 */
export const validateCompanySettings = (settings: {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxRate?: number;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!settings.name || settings.name.trim() === '') {
    errors.push({field: 'name', message: 'Company name is required'});
  } else if (settings.name.length > 100) {
    errors.push({
      field: 'name',
      message: 'Company name must be 100 characters or less',
    });
  }

  if (!settings.address || settings.address.trim() === '') {
    errors.push({field: 'address', message: 'Company address is required'});
  }

  if (settings.email && settings.email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(settings.email)) {
      errors.push({field: 'email', message: 'Invalid email format'});
    }
  }

  if (settings.phone && settings.phone.trim() !== '') {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(settings.phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.push({field: 'phone', message: 'Invalid phone number format'});
    }
  }

  if (settings.taxRate !== undefined) {
    if (settings.taxRate < 0 || settings.taxRate > 1) {
      errors.push({
        field: 'taxRate',
        message: 'Tax rate must be between 0% and 100%',
      });
    }
  }

  return errors;
};

/**
 * Debounce function for search/input
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number,
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Sanitize string for printing (remove special characters that might cause issues)
 */
export const sanitizeForPrint = (str: string): string => {
  return str
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
};

/**
 * Center text for receipt printing (80mm paper = ~48 characters)
 */
export const centerText = (text: string, width = 48): string => {
  const sanitized = sanitizeForPrint(text);
  if (sanitized.length >= width) return sanitized;
  
  const padding = Math.floor((width - sanitized.length) / 2);
  return ' '.repeat(padding) + sanitized;
};

/**
 * Right align text for receipt printing
 */
export const rightAlignText = (text: string, width = 48): string => {
  const sanitized = sanitizeForPrint(text);
  if (sanitized.length >= width) return sanitized;
  
  const padding = width - sanitized.length;
  return ' '.repeat(padding) + sanitized;
};

/**
 * Create a line separator for receipts
 */
export const createSeparatorLine = (width = 48, char = '-'): string => {
  return char.repeat(width);
};

/**
 * Format item line for receipt (name on left, price on right)
 */
export const formatReceiptItemLine = (
  name: string,
  price: string,
  width = 48,
): string => {
  const sanitizedName = sanitizeForPrint(name);
  const maxNameLength = width - price.length - 1; // -1 for space
  
  const truncatedName = sanitizedName.length > maxNameLength 
    ? sanitizedName.substring(0, maxNameLength - 3) + '...'
    : sanitizedName;
    
  const padding = width - truncatedName.length - price.length;
  return truncatedName + ' '.repeat(Math.max(1, padding)) + price;
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Check if device is connected to network
 */
export const isNetworkConnected = async (): Promise<boolean> => {
  try {
    return navigator.onLine;
  } catch {
    return false;
  }
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i === maxRetries - 1) throw lastError;
      
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};
