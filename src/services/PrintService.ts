import {Receipt, CompanySettings} from '../types';
import {
  formatCurrency,
  formatReceiptDate,
  centerText,
  createSeparatorLine,
  formatReceiptItemLine,
} from '../utils';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { StorageService } from './StorageService';
import { DirectFileSystemService } from './DirectFileSystemService';

export interface PrintOptions {
  method: 'pdf' | 'thermal';
  device?: any;
  copies?: number;
}

export class PrintService {
  /**
   * Generate HTML content for receipt
   */
  private static generateReceiptHTML(
    receipt: Receipt,
    companySettings: CompanySettings,
  ): string {
    const {items, subtotal, tax, total, date, receiptNumber} = receipt;
    
    let itemsHTML = '';
    items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      itemsHTML += `
        <tr>
          <td class="item-name">${item.name}</td>
          <td class="item-qty">${item.quantity}</td>
          <td class="item-price">${formatCurrency(item.price)}</td>
          <td class="item-total">${formatCurrency(itemTotal)}</td>
        </tr>
      `;
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt ${receiptNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: #fff;
            width: 80mm;
            max-width: 300px;
            margin: 0 auto;
            padding: 10px;
          }
          
          .receipt {
            width: 100%;
          }
          
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          
          .company-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .company-info {
            font-size: 10px;
            margin-bottom: 2px;
          }
          
          .separator {
            border-bottom: 1px dashed #000;
            margin: 10px 0;
          }
          
          .receipt-info {
            margin-bottom: 15px;
          }
          
          .receipt-info div {
            margin-bottom: 2px;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          
          .items-table th,
          .items-table td {
            text-align: left;
            padding: 2px 0;
            font-size: 11px;
          }
          
          .items-table th {
            border-bottom: 1px solid #000;
            font-weight: bold;
          }
          
          .item-name {
            width: 50%;
          }
          
          .item-qty {
            width: 15%;
            text-align: center;
          }
          
          .item-price,
          .item-total {
            width: 17.5%;
            text-align: right;
          }
          
          .totals {
            margin-top: 10px;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          
          .total-row.grand-total {
            font-weight: bold;
            font-size: 13px;
            border-top: 1px solid #000;
            padding-top: 5px;
            margin-top: 5px;
          }
          
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 10px;
          }
          
          @media print {
            body {
              width: 80mm;
              margin: 0;
              padding: 5mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <!-- Header -->
          <div class="header">
            <div class="company-name">${companySettings.name}</div>
            ${companySettings.address ? `<div class="company-info">${companySettings.address}</div>` : ''}
            ${companySettings.phone ? `<div class="company-info">${companySettings.phone}</div>` : ''}
            ${companySettings.email ? `<div class="company-info">${companySettings.email}</div>` : ''}
          </div>
          
          <div class="separator"></div>
          
          <!-- Receipt Info -->
          <div class="receipt-info">
            <div><strong>Receipt #:</strong> ${receiptNumber}</div>
            <div><strong>Date:</strong> ${formatReceiptDate(date)}</div>
            ${receipt.customerName ? `<div><strong>Customer:</strong> ${receipt.customerName}</div>` : ''}
          </div>
          
          <div class="separator"></div>
          
          <!-- Items -->
          <table class="items-table">
            <thead>
              <tr>
                <th class="item-name">Item</th>
                <th class="item-qty">Qty</th>
                <th class="item-price">Price</th>
                <th class="item-total">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
          
          <div class="separator"></div>
          
          <!-- Totals -->
          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${formatCurrency(subtotal)}</span>
            </div>
            <div class="total-row">
              <span>Tax:</span>
              <span>${formatCurrency(tax)}</span>
            </div>
            <div class="total-row grand-total">
              <span>TOTAL:</span>
              <span>${formatCurrency(total)}</span>
            </div>
          </div>
          
          ${receipt.footerMessage ? `
          <div class="separator"></div>
          <div class="footer">${receipt.footerMessage}</div>
          ` : ''}
          
          <div class="footer">
            <div style="margin-top: 15px;">Thank you for your business!</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text receipt for thermal printing
   */
  private static generateReceiptText(
    receipt: Receipt,
    companySettings: CompanySettings,
  ): string {
    const {items, subtotal, tax, total, date, receiptNumber} = receipt;
    const width = 48;
    
    let text = '';
    
    // Header
    text += centerText(companySettings.name, width) + '\n';
    if (companySettings.address) {
      text += centerText(companySettings.address, width) + '\n';
    }
    if (companySettings.phone) {
      text += centerText(companySettings.phone, width) + '\n';
    }
    if (companySettings.email) {
      text += centerText(companySettings.email, width) + '\n';
    }
    text += '\n';
    
    text += createSeparatorLine(width) + '\n';
    
    // Receipt info
    text += `Receipt #: ${receiptNumber}\n`;
    text += `Date: ${formatReceiptDate(date)}\n`;
    if (receipt.customerName) {
      text += `Customer: ${receipt.customerName}\n`;
    }
    text += createSeparatorLine(width) + '\n';
    
    // Items
    items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      const qtyPrice = `${item.quantity}x ${formatCurrency(item.price)}`;
      text += formatReceiptItemLine(item.name, formatCurrency(itemTotal), width) + '\n';
      if (item.quantity > 1) {
        text += `  ${qtyPrice}\n`;
      }
    });
    
    text += createSeparatorLine(width) + '\n';
    
    // Totals
    text += formatReceiptItemLine('Subtotal:', formatCurrency(subtotal), width) + '\n';
    text += formatReceiptItemLine('Tax:', formatCurrency(tax), width) + '\n';
    text += createSeparatorLine(width) + '\n';
    text += formatReceiptItemLine('TOTAL:', formatCurrency(total), width) + '\n';
    text += createSeparatorLine(width) + '\n';
    
    if (receipt.footerMessage) {
      text += '\n' + centerText(receipt.footerMessage, width) + '\n';
    }
    
    text += '\n' + centerText('Thank you for your business!', width) + '\n';
    text += '\n\n\n'; // Extra space for cutting
    
    return text;
  }

  /**
   * Generate and save PDF to organized folder structure
   */
  static async generatePDF(
    receipt: Receipt,
    companySettings: CompanySettings,
    saveToOrganizedFolder: boolean = true
  ): Promise<{success: boolean; filePath?: string; error?: string}> {
    try {
      const html = this.generateReceiptHTML(receipt, companySettings);
      
      // Generate PDF using expo-print
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      
      if (saveToOrganizedFolder) {
        // Save to organized folder structure (year/month)
        const saveResult = await StorageService.savePDFToOrganizedFolder(uri, receipt);
        if (saveResult.success && saveResult.filePath) {
          return {
            success: true,
            filePath: saveResult.filePath,
          };
        } else {
          // Fallback to simple save if organized save fails
          console.warn('Organized folder save failed, falling back to simple save:', saveResult.error);
        }
      }
      
      // Fallback: Save with basic filename structure
      const fileName = StorageService.generateReceiptFileName(receipt);
      const documentsDir = FileSystem.documentDirectory;
      const newPath = `${documentsDir}${fileName}`;
      
      // Move the file to documents directory
      await FileSystem.moveAsync({
        from: uri,
        to: newPath,
      });
      
      return {
        success: true,
        filePath: newPath,
      };
    } catch (error) {
      console.error('PDF generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF generation failed',
      };
    }
  }

  /**
   * Share existing PDF file
   */
  static async sharePDF(filePath: string): Promise<{success: boolean; error?: string}> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Receipt PDF',
          UTI: 'com.adobe.pdf',
        });
        return { success: true };
      } else {
        return { success: false, error: 'Sharing not available on this device' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sharing failed',
      };
    }
  }

  /**
   * Print PDF directly to system printer
   */
  static async printPDFDirect(filePath: string): Promise<{success: boolean; error?: string}> {
    try {
      await Print.printAsync({
        uri: filePath,
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Print failed',
      };
    }
  }

  /**
   * Print receipt as PDF using React Native/Expo print functionality
   */
  static async printPDF(
    receipt: Receipt,
    companySettings: CompanySettings,
    options: Partial<PrintOptions> = {},
  ): Promise<{success: boolean; filePath?: string; error?: string}> {
    try {
      // First generate the PDF
      const result = await this.generatePDF(receipt, companySettings);
      if (!result.success || !result.filePath) {
        return result;
      }

      // Then share it
      const shareResult = await this.sharePDF(result.filePath);
      if (!shareResult.success) {
        // If sharing fails, still return success since PDF was generated
        console.warn('PDF sharing failed:', shareResult.error);
      }
      
      return {
        success: true,
        filePath: result.filePath,
      };
    } catch (error) {
      console.error('PDF printing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF generation failed',
      };
    }
  }

  /**
   * Print receipt to thermal printer
   */
  static async printThermal(
    receipt: Receipt,
    companySettings: CompanySettings,
    options: PrintOptions,
  ): Promise<{success: boolean; error?: string}> {
    try {
      // Generate plain text version
      const receiptText = this.generateReceiptText(receipt, companySettings);
      
      // Check if we're in an Electron/desktop environment
      const isDesktop = typeof window !== 'undefined' && 
                       (window as any)?.electronAPI?.printReceipt;
      
      if (isDesktop) {
        const result = await (window as any).electronAPI.printReceipt({
          content: receiptText,
          printer: options.device?.name,
          copies: options.copies || 1,
        });
        
        if (result.success) {
          return {success: true};
        } else {
          return {
            success: false,
            error: result.error || 'Thermal printing failed',
          };
        }
      } else {
        // Mobile/development environment - simulate thermal printing
        console.log('Thermal Print Output (simulated):');
        console.log(receiptText);
        
        // Simulate printing delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // In a real mobile app, you could integrate with actual thermal printer SDKs here
        // For now, we'll just return success for demo purposes
        return {success: true};
      }
    } catch (error) {
      console.error('Thermal printing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Thermal printing failed',
      };
    }
  }

  /**
   * Generate PDF and save directly to public storage (accessible via file manager)
   */
  static async generatePDFToPublicStorage(
    receipt: Receipt,
    companySettings: CompanySettings,
    options: {
      directory?: string;
      showDirectoryDialog?: boolean;
      includeCompanyInFilename?: boolean;
      createYearMonthFolders?: boolean;
    } = {}
  ): Promise<{success: boolean; filePath?: string; publicPath?: string; error?: string; needsPermission?: boolean}> {
    try {
      // First generate the PDF
      const html = this.generateReceiptHTML(receipt, companySettings);
      
      // Generate PDF using expo-print
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      
      // Save to public storage using DirectFileSystemService
      const result = await DirectFileSystemService.saveToPublicStorage(uri, receipt, options);
      
      if (result.success) {
        return {
          success: true,
          filePath: result.filePath,
          publicPath: result.publicPath,
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('PDF generation to public storage failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF generation failed',
      };
    }
  }

  /**
   * Print PDF with direct file system access option
   */
  static async printPDFWithDirectAccess(
    receipt: Receipt,
    companySettings: CompanySettings,
    options: {
      useDirectFileAccess?: boolean;
      showDirectoryDialog?: boolean;
      includeCompanyInFilename?: boolean;
      createYearMonthFolders?: boolean;
      directory?: string;
      shareAfterSave?: boolean;
    } = {}
  ): Promise<{success: boolean; filePath?: string; publicPath?: string; error?: string; needsPermission?: boolean}> {
    try {
      if (options.useDirectFileAccess) {
        // Use direct file system access
        const result = await this.generatePDFToPublicStorage(receipt, companySettings, {
          directory: options.directory,
          showDirectoryDialog: options.showDirectoryDialog,
          includeCompanyInFilename: options.includeCompanyInFilename,
          createYearMonthFolders: options.createYearMonthFolders,
        });
        
        // Optionally share after saving to public storage
        if (result.success && options.shareAfterSave && result.publicPath) {
          const shareResult = await this.sharePDF(result.publicPath);
          if (!shareResult.success) {
            console.warn('Share after save failed:', shareResult.error);
          }
        }
        
        return result;
      } else {
        // Use regular app storage with sharing
        return await this.printPDF(receipt, companySettings);
      }
    } catch (error) {
      console.error('PDF printing with direct access failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF printing failed',
      };
    }
  }

  /**
   * Main print method that handles both PDF and thermal printing
   */
  static async print(
    receipt: Receipt,
    companySettings: CompanySettings,
    options: PrintOptions,
  ): Promise<{success: boolean; filePath?: string; error?: string}> {
    try {
      switch (options.method) {
        case 'pdf':
          return await this.printPDF(receipt, companySettings, options);
          
        case 'thermal':
          return await this.printThermal(receipt, companySettings, options);
          
        default:
          return {success: false, error: 'Invalid print method'};
      }
    } catch (error) {
      console.error('Print failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Print failed',
      };
    }
  }
}
