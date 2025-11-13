import { Receipt } from '../types';
import ReceiptDeliveryService from '../services/features/ReceiptDeliveryService';
import { Alert } from 'react-native';

/**
 * Automatically share receipt via SMS/WhatsApp when receipt is created
 * @param receipt - The receipt to share
 * @param customerPhone - The customer's phone number (optional)
 * @returns Promise with success status
 */
export const autoShareReceipt = async (
  receipt: Receipt,
  customerPhone?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // If no phone number provided, skip auto-share
    if (!customerPhone || !customerPhone.trim()) {
      console.log('No customer phone number provided, skipping auto-share');
      return {
        success: false,
        message: 'No phone number provided'
      };
    }

    // Share the receipt
    const result = await ReceiptDeliveryService.getInstance().sendSMSReceipt({
      to: customerPhone,
      receipt: receipt
    });

    if (result.success) {
      console.log(`Receipt #${receipt.receiptNumber} auto-shared to ${customerPhone}`);
    } else if (result.error !== 'USER_CANCELLED') {
      // Only show error if it's not user cancellation
      Alert.alert('Share Failed', result.message);
    }

    return {
      success: result.success,
      message: result.message
    };
  } catch (error) {
    console.error('Auto-share receipt error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to share receipt'
    };
  }
};

/**
 * Prompt user to share receipt with option to enter phone number
 * @param receipt - The receipt to share
 */
export const promptShareReceipt = (receipt: Receipt, onShare?: () => void) => {
  Alert.alert(
    'Share Receipt',
    `Would you like to share receipt #${receipt.receiptNumber}?`,
    [
      {
        text: 'Not Now',
        style: 'cancel'
      },
      {
        text: 'Share',
        onPress: async () => {
          const result = await ReceiptDeliveryService.getInstance().sendSMSReceipt({
            to: '', // Let user choose from share dialog
            receipt: receipt
          });
          
          if (result.success && onShare) {
            onShare();
          }
        }
      }
    ]
  );
};
