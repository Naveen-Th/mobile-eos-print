import { Alert } from 'react-native';
import ThermalPrinterService from '../services/printing/ThermalPrinterService';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';

/**
 * Utility helper for thermal printing receipts
 * Production-ready with comprehensive error handling and optimization
 */

/**
 * Safely convert various date formats to Date object
 */
export const convertReceiptDate = (date: any): Date => {
  try {
    if (!date) return new Date();
    // Handle Firestore Timestamp format with seconds/nanoseconds
    if (date && typeof date === 'object' && 'seconds' in date && 'nanoseconds' in date) {
      return new Date(date.seconds * 1000 + date.nanoseconds / 1000000);
    }
    if (date && typeof date.toDate === 'function') return date.toDate();
    if (date instanceof Date) return date;
    if (typeof date === 'string' || typeof date === 'number') return new Date(date);
    return new Date();
  } catch {
    return new Date();
  }
};

/**
 * Convert FirebaseReceipt to ThermalPrinterService ReceiptData format
 */
export const convertToThermalReceipt = (receipt: FirebaseReceipt) => {
  return {
    storeInfo: {
      name: receipt.companyName || 'Store',
      address: receipt.companyAddress || '',
      phone: receipt.businessPhone || '',
    },
    customerInfo: {
      name: receipt.customerName || undefined,
      phone: receipt.businessPhone || undefined,
    },
    items: receipt.items.map(item => ({
      name: item.name || 'Item',
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 0,
      total: (Number(item.price) || 0) * (Number(item.quantity) || 0),
    })),
    subtotal: Number(receipt.subtotal) || 0,
    tax: Number(receipt.tax) || 0,
    total: Number(receipt.total) || 0,
    paymentMethod: 'Cash', // Default
    receiptNumber: receipt.receiptNumber || 'N/A',
    timestamp: convertReceiptDate(receipt.date || receipt.createdAt),
    isPaid: receipt.amountPaid ? (receipt.total - receipt.amountPaid) <= 0.01 : false,
  };
};

/**
 * Check if thermal printer is connected and ready
 * Returns true if connected, shows alert and returns false otherwise
 */
export const checkPrinterConnection = async (
  printerService: ThermalPrinterService
): Promise<boolean> => {
  if (!printerService.isConnected()) {
    Alert.alert(
      'Printer Not Connected',
      'Please connect to a thermal printer first.\n\nGo to Settings → Printer Setup',
      [{ text: 'OK', style: 'cancel' }]
    );
    return false;
  }

  // Verify connection is still active
  const isActive = await printerService.verifyConnection();
  if (!isActive) {
    Alert.alert(
      'Connection Lost',
      'Printer connection was lost. Please reconnect.\n\nGo to Settings → Printer Setup',
      [{ text: 'OK', style: 'cancel' }]
    );
    return false;
  }

  return true;
};

/**
 * Print a receipt with comprehensive error handling
 * Returns true if successful, false otherwise
 */
export const printReceiptSafely = async (
  receipt: FirebaseReceipt,
  options?: {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
    showSuccessAlert?: boolean;
  }
): Promise<boolean> => {
  const printerService = ThermalPrinterService.getInstance();

  try {
    // Check connection
    const isConnected = await checkPrinterConnection(printerService);
    if (!isConnected) return false;

    // Convert receipt data
    const receiptData = convertToThermalReceipt(receipt);

    // Print
    await printerService.printReceipt(receiptData);

    // Success callback
    options?.onSuccess?.();

    // Optional success alert
    if (options?.showSuccessAlert !== false) {
      Alert.alert(
        '✓ Printed Successfully',
        `Receipt #${receipt.receiptNumber} was printed.`,
        [{ text: 'OK' }]
      );
    }

    return true;
  } catch (error: any) {
    console.error('Print error:', error);

    // Error callback
    options?.onError?.(error);

    // Show error alert
    Alert.alert(
      'Print Failed',
      error.message || 'Failed to print receipt. Check printer connection.',
      [{ text: 'OK' }]
    );

    return false;
  }
};

/**
 * Batch print multiple receipts
 */
export const printReceiptsBatch = async (
  receipts: FirebaseReceipt[],
  options?: {
    onProgress?: (current: number, total: number) => void;
    onComplete?: (successful: number, failed: number) => void;
    delayBetweenPrints?: number; // milliseconds
  }
): Promise<{ successful: number; failed: number }> => {
  const printerService = ThermalPrinterService.getInstance();
  
  // Check connection once before batch
  const isConnected = await checkPrinterConnection(printerService);
  if (!isConnected) {
    return { successful: 0, failed: receipts.length };
  }

  let successful = 0;
  let failed = 0;
  const delay = options?.delayBetweenPrints || 1000; // Default 1 second between prints

  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    
    // Report progress
    options?.onProgress?.(i + 1, receipts.length);

    try {
      const receiptData = convertToThermalReceipt(receipt);
      await printerService.printReceipt(receiptData);
      successful++;

      // Delay between prints to avoid overwhelming the printer
      if (i < receipts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`Failed to print receipt ${receipt.receiptNumber}:`, error);
      failed++;
    }
  }

  // Report completion
  options?.onComplete?.(successful, failed);

  // Show summary
  if (failed === 0) {
    Alert.alert(
      '✓ Batch Print Complete',
      `Successfully printed ${successful} receipt${successful !== 1 ? 's' : ''}.`,
      [{ text: 'OK' }]
    );
  } else {
    Alert.alert(
      'Batch Print Complete',
      `Successful: ${successful}\nFailed: ${failed}`,
      [{ text: 'OK' }]
    );
  }

  return { successful, failed };
};
