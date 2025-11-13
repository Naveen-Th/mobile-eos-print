import { Receipt } from '../../types';
import { Share } from 'react-native';

export interface EmailReceiptData {
  to: string;
  subject: string;
  receipt: Receipt;
  pdfAttachment?: string; // base64 or URL
}

export interface SMSReceiptData {
  to: string;
  receipt: Receipt;
  shortUrl?: string;
}

export interface DeliveryResult {
  success: boolean;
  message: string;
  error?: string;
}

class ReceiptDeliveryService {
  private static instance: ReceiptDeliveryService;
  private firebaseService: typeof FirebaseService;

  private constructor() {
    this.firebaseService = FirebaseService;
  }

  public static getInstance(): ReceiptDeliveryService {
    if (!ReceiptDeliveryService.instance) {
      ReceiptDeliveryService.instance = new ReceiptDeliveryService();
    }
    return ReceiptDeliveryService.instance;
  }

  /**
   * Share receipt via native Share API for email
   * User can choose their preferred email app
   */
  async sendEmailReceipt(data: EmailReceiptData): Promise<DeliveryResult> {
    try {
      // Validate email
      if (!this.isValidEmail(data.to)) {
        return {
          success: false,
          message: 'Invalid email address',
          error: 'INVALID_EMAIL',
        };
      }

      // Format plain text version of receipt
      const message = this.formatReceiptForEmail(data.receipt);

      // Use native Share API
      const result = await Share.share(
        {
          message: message,
          title: data.subject || `Receipt #${data.receipt.receiptNumber}`,
        },
        {
          subject: data.subject || `Receipt #${data.receipt.receiptNumber}`,
        }
      );

      if (result.action === Share.sharedAction) {
        return {
          success: true,
          message: `Receipt shared to ${data.to}`,
        };
      } else if (result.action === Share.dismissedAction) {
        return {
          success: false,
          message: 'Share cancelled',
          error: 'USER_CANCELLED',
        };
      }

      return {
        success: true,
        message: 'Receipt shared',
      };
    } catch (error) {
      console.error('Error sharing receipt:', error);
      return {
        success: false,
        message: 'Failed to share receipt',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Share receipt via native Share API (SMS, WhatsApp, Email, etc.)
   * This is completely free and lets users choose their preferred method
   */
  async sendSMSReceipt(data: SMSReceiptData): Promise<DeliveryResult> {
    try {
      // Validate phone number (optional - user can still share to other apps)
      const hasValidPhone = this.isValidPhoneNumber(data.to);

      // Format message content
      const message = this.formatReceiptSMS(data.receipt, data.shortUrl);

      // Use native Share API
      const result = await Share.share(
        {
          message: message,
          title: `Receipt #${data.receipt.receiptNumber}`,
        },
        {
          // Optional: Pre-select SMS if available (iOS only)
          subject: `Receipt #${data.receipt.receiptNumber}`,
        }
      );

      if (result.action === Share.sharedAction) {
        return {
          success: true,
          message: hasValidPhone 
            ? `Receipt shared to ${data.to}` 
            : 'Receipt shared successfully',
        };
      } else if (result.action === Share.dismissedAction) {
        return {
          success: false,
          message: 'Share cancelled',
          error: 'USER_CANCELLED',
        };
      }

      return {
        success: true,
        message: 'Receipt shared',
      };
    } catch (error) {
      console.error('Error sharing receipt:', error);
      return {
        success: false,
        message: 'Failed to share receipt',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Format receipt for email (plain text version)
   */
  private formatReceiptForEmail(receipt: Receipt): string {
    const items = receipt.items
      .map(item => `${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`)
      .join('\n');

    return `
📧 ${receipt.companyName}
${receipt.companyAddress || ''}

🧾 Receipt #${receipt.receiptNumber}
📅 ${new Date(receipt.date).toLocaleDateString()}
${receipt.customerName ? `👤 Customer: ${receipt.customerName}\n` : ''}
━━━━━━━━━━━━━━━━━━━━

ITEMS:
${items}

━━━━━━━━━━━━━━━━━━━━
Subtotal: $${receipt.subtotal.toFixed(2)}
Tax: $${receipt.tax.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
TOTAL: $${receipt.total.toFixed(2)}

${receipt.footerMessage || 'Thank you for your business!'}
    `.trim();
  }

  /**
   * Format receipt for email (HTML version - kept for reference)
   */
  private formatReceiptEmail(receipt: Receipt): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .receipt-info { margin-bottom: 20px; }
            .items { margin: 20px 0; }
            .item { padding: 10px; border-bottom: 1px solid #e5e7eb; }
            .totals { margin-top: 20px; padding-top: 20px; border-top: 2px solid #2563eb; }
            .total-row { display: flex; justify-content: space-between; margin: 5px 0; }
            .total-amount { font-size: 1.5em; font-weight: bold; color: #2563eb; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Receipt #${receipt.receiptNumber}</h1>
              <p>${new Date(receipt.date).toLocaleDateString()}</p>
            </div>
            
            <div class="content">
              <div class="receipt-info">
                <p><strong>${receipt.companyName}</strong></p>
                ${receipt.companyAddress ? `<p>${receipt.companyAddress}</p>` : ''}
                ${receipt.customerName ? `<p>Customer: ${receipt.customerName}</p>` : ''}
              </div>
              
              <div class="items">
                <h3>Items</h3>
                ${receipt.items.map(item => `
                  <div class="item">
                    <div style="display: flex; justify-content: space-between;">
                      <span>${item.name} x ${item.quantity}</span>
                      <span>$${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    <div style="color: #6b7280; font-size: 0.9em;">
                      $${item.price.toFixed(2)} each
                    </div>
                  </div>
                `).join('')}
              </div>
              
              <div class="totals">
                <div class="total-row">
                  <span>Subtotal:</span>
                  <span>$${receipt.subtotal.toFixed(2)}</span>
                </div>
                <div class="total-row">
                  <span>Tax:</span>
                  <span>$${receipt.tax.toFixed(2)}</span>
                </div>
                <div class="total-row total-amount">
                  <span>Total:</span>
                  <span>$${receipt.total.toFixed(2)}</span>
                </div>
              </div>
              
              ${receipt.footerMessage ? `
                <div style="text-align: center; margin-top: 20px; font-style: italic;">
                  ${receipt.footerMessage}
                </div>
              ` : ''}
            </div>
            
            <div class="footer">
              <p>Thank you for your business!</p>
              <p>This is an automated receipt. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Format receipt for SMS/WhatsApp (concise version)
   */
  private formatReceiptSMS(receipt: Receipt, shortUrl?: string): string {
    // Create a concise, readable receipt
    const itemsList = receipt.items
      .map(item => `${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`)
      .join('\n');
    
    let message = `🧾 Receipt #${receipt.receiptNumber}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `${receipt.companyName}\n`;
    if (receipt.customerName) {
      message += `Customer: ${receipt.customerName}\n`;
    }
    message += `Date: ${new Date(receipt.date).toLocaleDateString()}\n\n`;
    
    message += `ITEMS:\n${itemsList}\n\n`;
    
    message += `Subtotal: $${receipt.subtotal.toFixed(2)}\n`;
    message += `Tax: $${receipt.tax.toFixed(2)}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `TOTAL: $${receipt.total.toFixed(2)}\n\n`;
    
    if (shortUrl) {
      message += `View full receipt: ${shortUrl}\n\n`;
    }
    
    message += receipt.footerMessage || 'Thank you for your business!';
    
    return message;
  }

  /**
   * Validate email address
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number (basic validation)
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Remove spaces, dashes, parentheses
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    // Check if it's a valid phone number (10-15 digits)
    const phoneRegex = /^\+?[\d]{10,15}$/;
    return phoneRegex.test(cleanPhone);
  }

  /**
   * Create a short URL for receipt (requires URL shortening service)
   */
  async createShortUrl(receiptId: string): Promise<string> {
    // In a real implementation, integrate with a URL shortening service
    // For now, return a placeholder
    return `https://rcpt.co/${receiptId}`;
  }
}

export default ReceiptDeliveryService;

/**
 * FIREBASE CLOUD FUNCTION EXAMPLES:
 * 
 * You'll need to create these functions in your Firebase Functions directory:
 * 
 * // functions/src/index.ts
 * 
 * import * as functions from 'firebase-functions';
 * import * as nodemailer from 'nodemailer';
 * import * as twilio from 'twilio';
 * 
 * // Email function
 * export const sendReceiptEmail = functions.https.onCall(async (data, context) => {
 *   const { to, subject, html, pdfAttachment } = data;
 *   
 *   const transporter = nodemailer.createTransport({
 *     service: 'gmail',
 *     auth: {
 *       user: functions.config().email.user,
 *       pass: functions.config().email.password,
 *     },
 *   });
 *   
 *   const mailOptions = {
 *     from: functions.config().email.user,
 *     to,
 *     subject,
 *     html,
 *     attachments: pdfAttachment ? [{
 *       filename: 'receipt.pdf',
 *       content: pdfAttachment,
 *       encoding: 'base64'
 *     }] : [],
 *   };
 *   
 *   await transporter.sendMail(mailOptions);
 *   return { success: true };
 * });
 * 
 * // SMS function
 * export const sendReceiptSMS = functions.https.onCall(async (data, context) => {
 *   const { to, message } = data;
 *   
 *   const client = twilio(
 *     functions.config().twilio.sid,
 *     functions.config().twilio.token
 *   );
 *   
 *   await client.messages.create({
 *     body: message,
 *     from: functions.config().twilio.phone,
 *     to,
 *   });
 *   
 *   return { success: true };
 * });
 * 
 * // Set config:
 * // firebase functions:config:set email.user="your@email.com" email.password="yourpassword"
 * // firebase functions:config:set twilio.sid="YOUR_SID" twilio.token="YOUR_TOKEN" twilio.phone="+1234567890"
 */
