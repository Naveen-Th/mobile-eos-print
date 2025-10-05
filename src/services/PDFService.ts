import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { FirebaseReceipt } from './ReceiptFirebaseService';
import { formatCurrency } from '../utils';

export interface PDFGenerationOptions {
  fileName?: string;
  saveToFiles?: boolean;
  shareImmediately?: boolean;
}

class PDFService {
  private static instance: PDFService;

  private constructor() {}

  public static getInstance(): PDFService {
    if (!PDFService.instance) {
      PDFService.instance = new PDFService();
    }
    return PDFService.instance;
  }

  /**
   * Format date for display in PDF
   */
  private formatDate(date: any): string {
    try {
      let dateObj: Date;
      
      if (date instanceof Date) {
        dateObj = date;
      } else if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (typeof date === 'number') {
        dateObj = new Date(date);
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
      } else {
        return 'Invalid Date';
      }
      
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting date for PDF:', error);
      return 'Invalid Date';
    }
  }

  /**
   * Generate HTML template for receipt PDF
   */
  private generateReceiptHTML(receipt: FirebaseReceipt): string {
    const itemsHTML = receipt.items.map(item => `
      <tr>
        <td style="padding: 2px; text-align: left;">${item.name}</td>
        <td style="padding: 2px; text-align: center;">${item.quantity}</td>
        <td style="padding: 2px; text-align: right;">${formatCurrency(item.price)}</td>
        <td style="padding: 2px; text-align: right; font-weight: bold;">${formatCurrency(item.price * item.quantity)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt ${receipt.receiptNumber}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              margin: 0;
              padding: 10px;
              color: #000;
              line-height: 1.4;
              font-size: 14px;
            }
            .receipt-container {
              max-width: 320px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border: 1px solid #000;
            }
            .header {
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .company-name {
              font-size: 18px;
              font-weight: bold;
              color: #000;
              margin-bottom: 8px;
              text-transform: uppercase;
            }
            .receipt-number {
              font-size: 14px;
              color: #000;
              margin-bottom: 5px;
              font-weight: bold;
            }
            .receipt-date {
              font-size: 12px;
              color: #000;
            }
            .customer-info {
              margin: 15px 0;
              padding: 0;
              background: none;
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              padding: 8px 0;
            }
            .customer-name {
              font-size: 14px;
              font-weight: bold;
              color: #000;
              text-align: left;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
              font-size: 12px;
            }
            .items-table th {
              background: none;
              padding: 8px 2px;
              text-align: left;
              font-weight: bold;
              border-bottom: 1px dashed #000;
              color: #000;
            }
            .items-table th:nth-child(2),
            .items-table th:nth-child(3),
            .items-table th:nth-child(4) {
              text-align: right;
            }
            .items-table th:nth-child(2) {
              text-align: center;
            }
            .items-table td {
              padding: 4px 2px;
              border-bottom: none;
              font-size: 12px;
            }
            .totals {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px dashed #000;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin: 4px 0;
              font-size: 14px;
              color: #000;
            }
            .total-row.final {
              font-weight: bold;
              font-size: 16px;
              color: #000;
              border-top: 1px dashed #000;
              padding-top: 8px;
              margin-top: 8px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              padding-top: 15px;
              border-top: 1px dashed #000;
              font-size: 11px;
              color: #000;
            }
            .status-badge {
              display: inline-block;
              padding: 2px 8px;
              border: 1px solid #000;
              font-size: 10px;
              font-weight: bold;
              text-transform: uppercase;
              background: white;
              color: #000;
              margin-top: 5px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="company-name">${receipt.companyName || 'Your Business'}</div>
              <div class="receipt-number">Receipt #${receipt.receiptNumber}</div>
              <div class="receipt-date">${this.formatDate(receipt.date)}</div>
              <div style="margin-top: 10px;">
                <span class="status-badge status-${receipt.status}">${receipt.status}</span>
              </div>
            </div>

            <div class="customer-info">
              <div class="customer-name">Customer: ${receipt.customerName || 'Walk-in Customer'}</div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>

            <div class="totals">
              <div class="total-row">
                <span>Subtotal:</span>
                <span>${formatCurrency(receipt.subtotal || 0)}</span>
              </div>
              ${receipt.tax > 0 ? `
                <div class="total-row">
                  <span>Tax:</span>
                  <span>${formatCurrency(receipt.tax)}</span>
                </div>
              ` : ''}
              <div class="total-row final">
                <span>Total:</span>
                <span>${formatCurrency(receipt.total)}</span>
              </div>
            </div>

            <div class="footer">
              <p>Thank you for your business!</p>
              <p>Generated on ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate PDF from receipt data
   */
  public async generateReceiptPDF(
    receipt: FirebaseReceipt,
    options: PDFGenerationOptions = {}
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const fileName = options.fileName || `receipt_${receipt.receiptNumber}_${Date.now()}.pdf`;
      const html = this.generateReceiptHTML(receipt);

      // Generate PDF using expo-print
      const { uri } = await printToFileAsync({
        html,
        base64: false,
      });

      // Create a more user-friendly file name and location
      const documentsDirectory = FileSystem.documentDirectory;
      const finalPath = `${documentsDirectory}${fileName}`;

      // Move the file to documents directory
      await FileSystem.moveAsync({
        from: uri,
        to: finalPath,
      });

      console.log('PDF generated successfully at:', finalPath);

      // Share the PDF if requested
      if (options.shareImmediately !== false) {
        await shareAsync(finalPath, {
          mimeType: 'application/pdf',
          dialogTitle: `Receipt ${receipt.receiptNumber}`,
          UTI: 'com.adobe.pdf'
        });
      }

      return {
        success: true,
        filePath: finalPath
      };
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      let errorMessage = 'Failed to generate PDF';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Generate and save PDF with user feedback
   */
  public async generateAndSaveReceiptPDF(
    receipt: FirebaseReceipt,
    options: PDFGenerationOptions = {}
  ): Promise<void> {
    try {
      const result = await this.generateReceiptPDF(receipt, {
        ...options,
        shareImmediately: true // Always share for mobile
      });

      if (result.success) {
        Alert.alert(
          'PDF Saved',
          `Receipt PDF has been saved and shared successfully.`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error in generateAndSaveReceiptPDF:', error);
      
      Alert.alert(
        'PDF Generation Failed',
        `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  }

  /**
   * Get saved PDF path for a receipt
   */
  public getPDFPath(receiptNumber: string): string {
    const documentsDirectory = FileSystem.documentDirectory;
    return `${documentsDirectory}receipt_${receiptNumber}_*.pdf`;
  }
}

export default PDFService.getInstance();