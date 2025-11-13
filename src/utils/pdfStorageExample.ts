/**
 * Example utility showing how to use the enhanced PDF storage features
 * This demonstrates the organized folder structure and file management capabilities
 */

import { StorageService } from '../services/storage/StorageService';
import { PrintService } from '../services/printing/PrintService';
import { Receipt, CompanySettings } from '../types';

export class PDFStorageManager {
  /**
   * Example: Save a receipt PDF to organized folder structure
   */
  static async saveReceiptPDF(
    receipt: Receipt,
    companySettings: CompanySettings
  ): Promise<{success: boolean; filePath?: string; error?: string}> {
    try {
      // Generate PDF and save to organized folder (year/month structure)
      const result = await PrintService.generatePDF(receipt, companySettings, true);
      
      if (result.success && result.filePath) {
        console.log(`PDF saved to: ${result.filePath}`);
        
        // Example of folder structure created:
        // Documents/Receipts/2024/01/Receipt_R001_2024-01-15_14-30-45.pdf
        
        return result;
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save PDF',
      };
    }
  }

  /**
   * Example: Get information about current file storage
   */
  static async getStorageInfo(): Promise<void> {
    try {
      const info = await StorageService.getFileSystemInfo();
      
      if (info.success && info.info) {
        console.log('=== PDF Storage Information ===');
        console.log(`Receipts folder: ${info.info.receiptsFolderPath}`);
        console.log(`Total files: ${info.info.totalFiles}`);
        console.log(`Total size: ${info.info.totalSizeMB} MB`);
        
        if (info.info.oldestFile) {
          console.log(`Oldest file: ${info.info.oldestFile.toLocaleDateString()}`);
        }
        
        if (info.info.newestFile) {
          console.log(`Newest file: ${info.info.newestFile.toLocaleDateString()}`);
        }
      } else {
        console.error('Failed to get storage info:', info.error);
      }
    } catch (error) {
      console.error('Error getting storage info:', error);
    }
  }

  /**
   * Example: List all PDF files in the organized structure
   */
  static async listAllPDFs(): Promise<void> {
    try {
      const result = await StorageService.getAllReceiptPDFs();
      
      if (result.success && result.files) {
        console.log('=== All Receipt PDFs ===');
        result.files.forEach((file, index) => {
          console.log(`${index + 1}. ${file.name}`);
          console.log(`   Path: ${file.path}`);
          console.log(`   Date: ${file.date.toLocaleDateString()}`);
          console.log(`   Size: ${(file.size / 1024).toFixed(2)} KB`);
          console.log('---');
        });
      } else {
        console.error('Failed to list PDFs:', result.error);
      }
    } catch (error) {
      console.error('Error listing PDFs:', error);
    }
  }

  /**
   * Example: Clean up old PDF files (older than 90 days)
   */
  static async cleanupOldFiles(daysOld: number = 90): Promise<void> {
    try {
      const result = await StorageService.cleanupOldPDFs(daysOld);
      
      if (result.success) {
        console.log(`Successfully cleaned up ${result.deletedCount || 0} old PDF files (older than ${daysOld} days)`);
      } else {
        console.error('Failed to cleanup old files:', result.error);
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Example: Manually create folder structure for a specific date
   */
  static async createFolderForDate(date: Date): Promise<void> {
    try {
      const folderPath = await StorageService.createReceiptFolderStructure(date);
      console.log(`Created folder structure: ${folderPath}`);
    } catch (error) {
      console.error('Failed to create folder structure:', error);
    }
  }

  /**
   * Example: Save PDF to a custom folder path
   */
  static async savePDFToCustomFolder(
    receipt: Receipt,
    companySettings: CompanySettings,
    customFolderPath: string
  ): Promise<{success: boolean; filePath?: string; error?: string}> {
    try {
      // First generate a temporary PDF
      const tempResult = await PrintService.generatePDF(receipt, companySettings, false);
      
      if (!tempResult.success || !tempResult.filePath) {
        return tempResult;
      }
      
      // Then move it to the custom folder
      const saveResult = await StorageService.savePDFToOrganizedFolder(
        tempResult.filePath,
        receipt,
        customFolderPath
      );
      
      return saveResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save to custom folder',
      };
    }
  }

  /**
   * Example: Demo function showing all capabilities
   */
  static async demonstrateCapabilities(): Promise<void> {
    console.log('=== PDF Storage Manager Demo ===\\n');
    
    // Show current storage info
    await this.getStorageInfo();
    console.log('');
    
    // List all existing PDFs
    await this.listAllPDFs();
    console.log('');
    
    // Show how folder structure is organized
    console.log('=== Folder Structure Examples ===');
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    
    console.log('PDF files are organized as:');
    console.log(`📁 Documents/Receipts/`);
    console.log(`  └── 📁 ${year}/`);
    console.log(`      └── 📁 ${month}/`);
    console.log(`          ├── 📄 Receipt_R001_2024-01-15_09-30-15.pdf`);
    console.log(`          ├── 📄 Receipt_R002_2024-01-15_14-45-22.pdf`);
    console.log(`          └── 📄 Receipt_R003_2024-01-16_16-20-30.pdf`);
    console.log('');
    
    // Show platform differences
    console.log('=== Platform Differences ===');
    const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI;
    if (isDesktop) {
      console.log('✅ Desktop (Electron): Uses system Documents folder');
      console.log('   - Files saved to: ~/Documents/Receipts/YEAR/MONTH/');
      console.log('   - Uses native file operations');
    } else {
      console.log('📱 Mobile (React Native/Expo): Uses app document directory');
      console.log('   - Files saved to: [App Documents]/Receipts/YEAR/MONTH/');
      console.log('   - Uses Expo FileSystem');
    }
    
    console.log('\\n=== Demo Complete ===');
  }
}

/**
 * Usage examples:
 * 
 * // Save a receipt PDF with organized folder structure
 * const receipt: Receipt = { ... };
 * const companySettings: CompanySettings = { ... };
 * const result = await PDFStorageManager.saveReceiptPDF(receipt, companySettings);
 * 
 * // Get storage information
 * await PDFStorageManager.getStorageInfo();
 * 
 * // List all PDF files
 * await PDFStorageManager.listAllPDFs();
 * 
 * // Clean up files older than 90 days
 * await PDFStorageManager.cleanupOldFiles(90);
 * 
 * // Run full demonstration
 * await PDFStorageManager.demonstrateCapabilities();
 */
