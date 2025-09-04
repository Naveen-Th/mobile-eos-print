import {Receipt} from '../types';

export class QRCodeService {
  /**
   * Generate QR code data for receipt
   */
  static generateReceiptQRData(receipt: Receipt): string {
    // Create a simplified receipt data object for QR code
    const qrData = {
      receiptNumber: receipt.receiptNumber,
      date: receipt.date.toISOString(),
      total: receipt.total,
      companyName: receipt.companyName,
      items: receipt.items.length,
    };

    return JSON.stringify(qrData);
  }

  /**
   * Generate QR code data URL (for web/testing purposes)
   * In a real app, you'd use react-native-qr-svg or similar
   */
  static generateQRCodeDataURL(data: string, size = 128): string {
    // For demo purposes, return a placeholder
    // In production, use a proper QR code library
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
  }

  /**
   * Generate receipt verification URL
   */
  static generateReceiptVerificationURL(receipt: Receipt, baseURL = 'https://mystore.com'): string {
    return `${baseURL}/verify/${receipt.receiptNumber}?date=${receipt.date.toISOString().split('T')[0]}&total=${receipt.total}`;
  }

  /**
   * Generate payment QR code for mobile payments
   */
  static generatePaymentQRData(
    amount: number,
    merchantId: string,
    description?: string
  ): string {
    // Simplified payment QR format (real implementations would follow standards like EMV QR)
    return JSON.stringify({
      type: 'payment',
      amount,
      merchantId,
      description,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Validate QR code data
   */
  static validateQRData(data: string): {isValid: boolean; error?: string} {
    try {
      const parsed = JSON.parse(data);
      
      // Basic validation
      if (!parsed.receiptNumber || !parsed.date || !parsed.total) {
        return {
          isValid: false,
          error: 'Missing required receipt data',
        };
      }

      // Check if date is valid
      if (isNaN(new Date(parsed.date).getTime())) {
        return {
          isValid: false,
          error: 'Invalid date format',
        };
      }

      // Check if total is a valid number
      if (typeof parsed.total !== 'number' || parsed.total < 0) {
        return {
          isValid: false,
          error: 'Invalid total amount',
        };
      }

      return {isValid: true};
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid QR code format',
      };
    }
  }

  /**
   * Parse receipt QR code data
   */
  static parseReceiptQRData(data: string): {
    receiptNumber: string;
    date: Date;
    total: number;
    companyName: string;
    items: number;
  } | null {
    try {
      const parsed = JSON.parse(data);
      return {
        receiptNumber: parsed.receiptNumber,
        date: new Date(parsed.date),
        total: parsed.total,
        companyName: parsed.companyName,
        items: parsed.items,
      };
    } catch {
      return null;
    }
  }
}
