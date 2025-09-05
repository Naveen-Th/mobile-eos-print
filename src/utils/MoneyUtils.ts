/**
 * MoneyUtils - Precise financial calculations to avoid floating-point errors
 * All monetary values are handled as integers (cents/paise) internally
 */

export class MoneyUtils {
  // Number of decimal places for currency (2 for most currencies)
  private static readonly DECIMAL_PLACES = 2;
  private static readonly MULTIPLIER = Math.pow(10, MoneyUtils.DECIMAL_PLACES);

  /**
   * Convert decimal money value to integer (cents/paise)
   */
  static toInteger(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Invalid monetary value');
    }
    return Math.round(value * MoneyUtils.MULTIPLIER);
  }

  /**
   * Convert integer (cents/paise) to decimal money value
   */
  static toDecimal(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Invalid integer value');
    }
    return value / MoneyUtils.MULTIPLIER;
  }

  /**
   * Add two monetary values precisely
   */
  static add(a: number, b: number): number {
    const intA = MoneyUtils.toInteger(a);
    const intB = MoneyUtils.toInteger(b);
    return MoneyUtils.toDecimal(intA + intB);
  }

  /**
   * Subtract two monetary values precisely
   */
  static subtract(a: number, b: number): number {
    const intA = MoneyUtils.toInteger(a);
    const intB = MoneyUtils.toInteger(b);
    return MoneyUtils.toDecimal(intA - intB);
  }

  /**
   * Multiply a monetary value by a factor precisely
   */
  static multiply(value: number, factor: number): number {
    if (typeof factor !== 'number' || isNaN(factor)) {
      throw new Error('Invalid multiplication factor');
    }
    const intValue = MoneyUtils.toInteger(value);
    const result = Math.round(intValue * factor);
    return MoneyUtils.toDecimal(result);
  }

  /**
   * Calculate percentage of a monetary value
   */
  static percentage(value: number, percent: number): number {
    if (typeof percent !== 'number' || isNaN(percent)) {
      throw new Error('Invalid percentage value');
    }
    return MoneyUtils.multiply(value, percent / 100);
  }

  /**
   * Round monetary value to proper decimal places
   */
  static round(value: number): number {
    return MoneyUtils.toDecimal(MoneyUtils.toInteger(value));
  }

  /**
   * Calculate tax amount with precise rounding
   */
  static calculateTax(subtotal: number, taxRate: number): number {
    if (typeof taxRate !== 'number' || isNaN(taxRate) || taxRate < 0) {
      throw new Error('Invalid tax rate');
    }
    return MoneyUtils.percentage(subtotal, taxRate);
  }

  /**
   * Calculate total with tax
   */
  static calculateTotal(subtotal: number, tax: number): number {
    return MoneyUtils.add(subtotal, tax);
  }

  /**
   * Calculate item total (price × quantity)
   */
  static calculateItemTotal(price: number, quantity: number): number {
    if (typeof quantity !== 'number' || isNaN(quantity) || quantity < 0) {
      throw new Error('Invalid quantity');
    }
    return MoneyUtils.multiply(price, quantity);
  }

  /**
   * Calculate discount amount
   */
  static calculateDiscount(value: number, discountRate: number, discountType: 'percentage' | 'fixed' = 'percentage'): number {
    if (discountType === 'percentage') {
      return MoneyUtils.percentage(value, discountRate);
    } else {
      // Fixed discount
      return MoneyUtils.round(discountRate);
    }
  }

  /**
   * Apply discount to a value
   */
  static applyDiscount(value: number, discountAmount: number): number {
    const result = MoneyUtils.subtract(value, discountAmount);
    return Math.max(0, result); // Ensure non-negative result
  }

  /**
   * Validate monetary value
   */
  static isValidMoney(value: any): boolean {
    return typeof value === 'number' && 
           !isNaN(value) && 
           isFinite(value) && 
           value >= 0 &&
           value <= 999999999.99; // Reasonable maximum
  }

  /**
   * Format money for display
   */
  static format(value: number, currency: string = '₹'): string {
    if (!MoneyUtils.isValidMoney(value)) {
      return `${currency}0.00`;
    }

    const rounded = MoneyUtils.round(value);
    
    // Format with proper decimal places
    const formatted = rounded.toFixed(MoneyUtils.DECIMAL_PLACES);
    
    // Add currency symbol
    return `${currency}${formatted}`;
  }

  /**
   * Parse money string to number
   */
  static parse(moneyString: string): number {
    if (typeof moneyString !== 'string') {
      throw new Error('Invalid money string');
    }

    // Remove currency symbols and whitespace
    const cleaned = moneyString.replace(/[₹$€£¥,\s]/g, '');
    const parsed = parseFloat(cleaned);
    
    if (isNaN(parsed)) {
      throw new Error('Cannot parse money string');
    }
    
    return MoneyUtils.round(parsed);
  }

  /**
   * Compare two monetary values for equality (accounting for floating point precision)
   */
  static equals(a: number, b: number): boolean {
    const intA = MoneyUtils.toInteger(a);
    const intB = MoneyUtils.toInteger(b);
    return intA === intB;
  }

  /**
   * Check if first value is greater than second
   */
  static greaterThan(a: number, b: number): boolean {
    const intA = MoneyUtils.toInteger(a);
    const intB = MoneyUtils.toInteger(b);
    return intA > intB;
  }

  /**
   * Check if first value is less than second
   */
  static lessThan(a: number, b: number): boolean {
    const intA = MoneyUtils.toInteger(a);
    const intB = MoneyUtils.toInteger(b);
    return intA < intB;
  }

  /**
   * Get the larger of two monetary values
   */
  static max(a: number, b: number): number {
    return MoneyUtils.greaterThan(a, b) ? a : b;
  }

  /**
   * Get the smaller of two monetary values
   */
  static min(a: number, b: number): number {
    return MoneyUtils.lessThan(a, b) ? a : b;
  }

  /**
   * Calculate cart totals with precise arithmetic
   */
  static calculateCartTotals(
    items: Array<{ price: number; quantity: number; discount?: number }>,
    taxRate: number = 0,
    globalDiscount: number = 0,
    globalDiscountType: 'percentage' | 'fixed' = 'percentage'
  ): { subtotal: number; discount: number; tax: number; total: number } {
    
    // Validate inputs
    if (!Array.isArray(items)) {
      throw new Error('Items must be an array');
    }

    let subtotal = 0;
    let itemDiscounts = 0;

    // Calculate subtotal with item-level calculations
    for (const item of items) {
      if (!MoneyUtils.isValidMoney(item.price)) {
        throw new Error(`Invalid item price: ${item.price}`);
      }
      
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new Error(`Invalid item quantity: ${item.quantity}`);
      }

      const itemTotal = MoneyUtils.calculateItemTotal(item.price, item.quantity);
      subtotal = MoneyUtils.add(subtotal, itemTotal);

      // Apply item-level discount if present
      if (item.discount && item.discount > 0) {
        const itemDiscountAmount = MoneyUtils.percentage(itemTotal, item.discount);
        itemDiscounts = MoneyUtils.add(itemDiscounts, itemDiscountAmount);
      }
    }

    // Apply global discount
    const globalDiscountAmount = MoneyUtils.calculateDiscount(subtotal, globalDiscount, globalDiscountType);
    const totalDiscount = MoneyUtils.add(itemDiscounts, globalDiscountAmount);
    
    // Calculate discounted subtotal
    const discountedSubtotal = MoneyUtils.applyDiscount(subtotal, totalDiscount);
    
    // Calculate tax on discounted amount
    const tax = MoneyUtils.calculateTax(discountedSubtotal, taxRate);
    
    // Calculate final total
    const total = MoneyUtils.calculateTotal(discountedSubtotal, tax);

    return {
      subtotal: MoneyUtils.round(subtotal),
      discount: MoneyUtils.round(totalDiscount),
      tax: MoneyUtils.round(tax),
      total: MoneyUtils.round(total)
    };
  }
}

export default MoneyUtils;
