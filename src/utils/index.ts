import {ReceiptItem, ValidationError} from '../types';
import { MoneyUtils } from './MoneyUtils';

/**
 * Format currency amount with proper locale and currency symbol
 * Updated to use MoneyUtils for precise formatting
 */
export const formatCurrency = (
  amount: number,
  currency = 'INR',
  locale = 'en-IN',
): string => {
  // Use MoneyUtils for precise formatting
  if (!MoneyUtils.isValidMoney(amount)) {
    return currency === 'INR' ? '₹0.00' : '$0.00';
  }
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(MoneyUtils.round(amount));
  } catch (error) {
    console.error('Error formatting currency:', error);
    const symbol = currency === 'INR' ? '₹' : '$';
    return MoneyUtils.format(amount, symbol);
  }
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
 * Calculate cart totals with precise monetary arithmetic
 * Updated to use MoneyUtils for floating-point safe calculations
 */
export const calculateTotals = (
  items: ReceiptItem[],
  taxRate = 8, // Store as percentage (8% instead of 0.08)
  globalDiscount = 0,
  globalDiscountType: 'percentage' | 'fixed' = 'percentage'
): {subtotal: number; tax: number; total: number; discount: number} => {
  try {
    // Validate inputs
    if (!Array.isArray(items)) {
      throw new Error('Items must be an array');
    }
    
    if (items.length === 0) {
      return {
        subtotal: 0,
        tax: 0,
        total: 0,
        discount: 0
      };
    }

    // Convert items to format expected by MoneyUtils
    const itemsForCalculation = items.map(item => ({
      price: item.price || 0,
      quantity: item.quantity || 0,
      discount: item.discount || 0
    }));

    // Use MoneyUtils for precise calculations
    const result = MoneyUtils.calculateCartTotals(
      itemsForCalculation,
      taxRate,
      globalDiscount,
      globalDiscountType
    );

    return result;
  } catch (error) {
    console.error('Error calculating totals:', error);
    // Return safe defaults
    return {
      subtotal: 0,
      tax: 0,
      total: 0,
      discount: 0
    };
  }
};

/**
 * Validate receipt item with enhanced business rules
 * Updated to use MoneyUtils for price validation
 */
export const validateReceiptItem = (
  item: Partial<ReceiptItem>,
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Validate item name
  if (!item.name || item.name.trim() === '') {
    errors.push({field: 'name', message: 'Item name is required'});
  } else if (item.name.length > 100) {
    errors.push({field: 'name', message: 'Item name must be 100 characters or less'});
  } else if (item.name.trim().length < 2) {
    errors.push({field: 'name', message: 'Item name must be at least 2 characters'});
  }

  // Validate price using MoneyUtils
  if (item.price === undefined || item.price === null) {
    errors.push({field: 'price', message: 'Price is required'});
  } else if (!MoneyUtils.isValidMoney(item.price)) {
    if (item.price < 0) {
      errors.push({field: 'price', message: 'Price must be positive'});
    } else if (item.price > 999999.99) {
      errors.push({field: 'price', message: 'Price is too large (maximum ₹999,999.99)'});
    } else {
      errors.push({field: 'price', message: 'Invalid price format'});
    }
  } else if (item.price < 0.01) {
    errors.push({field: 'price', message: 'Price must be at least ₹0.01'});
  }

  // Validate quantity
  if (item.quantity === undefined || item.quantity === null) {
    errors.push({field: 'quantity', message: 'Quantity is required'});
  } else if (typeof item.quantity !== 'number' || isNaN(item.quantity)) {
    errors.push({field: 'quantity', message: 'Quantity must be a valid number'});
  } else if (item.quantity <= 0) {
    errors.push({field: 'quantity', message: 'Quantity must be greater than 0'});
  } else if (item.quantity > 9999) {
    errors.push({field: 'quantity', message: 'Quantity is too large (maximum 9,999)'});
  } else if (!Number.isInteger(item.quantity)) {
    errors.push({field: 'quantity', message: 'Quantity must be a whole number'});
  }

  // Validate optional discount
  if (item.discount !== undefined && item.discount !== null) {
    if (typeof item.discount !== 'number' || isNaN(item.discount)) {
      errors.push({field: 'discount', message: 'Discount must be a valid number'});
    } else if (item.discount < 0) {
      errors.push({field: 'discount', message: 'Discount cannot be negative'});
    } else if (item.discount > 100) {
      errors.push({field: 'discount', message: 'Discount cannot exceed 100%'});
    }
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
    // Expect tax rate as percentage (0-100) instead of decimal (0-1)
    if (typeof settings.taxRate !== 'number' || isNaN(settings.taxRate)) {
      errors.push({
        field: 'taxRate',
        message: 'Tax rate must be a valid number',
      });
    } else if (settings.taxRate < 0 || settings.taxRate > 100) {
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
 * Updated to use MoneyUtils for price formatting
 */
export const formatReceiptItemLine = (
  name: string,
  price: number | string,
  width = 48,
): string => {
  const sanitizedName = sanitizeForPrint(name);
  
  // Format price using MoneyUtils if it's a number
  const formattedPrice = typeof price === 'number' 
    ? MoneyUtils.format(price, '₹')
    : price;
  
  const maxNameLength = width - formattedPrice.length - 1; // -1 for space
  
  const truncatedName = sanitizedName.length > maxNameLength 
    ? sanitizedName.substring(0, maxNameLength - 3) + '...'
    : sanitizedName;
    
  const padding = width - truncatedName.length - formattedPrice.length;
  return truncatedName + ' '.repeat(Math.max(1, padding)) + formattedPrice;
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

/**
 * Calculate item total (price × quantity) with precise arithmetic
 */
export const calculateItemTotal = (
  price: number,
  quantity: number,
  discount = 0
): number => {
  const itemTotal = MoneyUtils.multiply(price, quantity);
  return discount > 0 ? MoneyUtils.applyDiscount(itemTotal, discount) : itemTotal;
};

/**
 * Apply discount to an amount
 */
export const applyDiscount = (
  amount: number,
  discountPercent: number
): number => {
  return MoneyUtils.applyDiscount(amount, discountPercent);
};

/**
 * Calculate tax on an amount
 */
export const calculateTax = (
  amount: number,
  taxRatePercent: number
): number => {
  return MoneyUtils.multiply(amount, taxRatePercent / 100);
};

/**
 * Round monetary value to 2 decimal places
 */
export const roundMoney = (amount: number): number => {
  return MoneyUtils.round(amount);
};

/**
 * Validate if a value is a valid monetary amount
 */
export const isValidMoneyAmount = (amount: any): boolean => {
  return MoneyUtils.isValidMoney(amount);
};

/**
 * Add multiple monetary amounts safely
 */
export const addMoneyAmounts = (...amounts: number[]): number => {
  return amounts.reduce((sum, amount) => MoneyUtils.add(sum, amount), 0);
};

/**
 * Subtract monetary amounts safely
 */
export const subtractMoneyAmounts = (
  minuend: number,
  subtrahend: number
): number => {
  return MoneyUtils.subtract(minuend, subtrahend);
};
