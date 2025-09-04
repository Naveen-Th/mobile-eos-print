import {Receipt, StoredReceipt} from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

export class StorageService {
  private static STORAGE_KEYS = {
    RECEIPTS: 'stored_receipts',
    RECEIPT_COUNTER: 'receipt_counter',
  };

  /**
   * Store a receipt locally using localStorage (or Electron's store)
   */
  static async storeReceipt(receipt: Receipt, pdfPath?: string): Promise<StoredReceipt> {
    try {
      const storedReceipt: StoredReceipt = {
        ...receipt,
        printed: false,
        pdfPath,
      };

      const existingReceipts = await this.getAllReceipts();
      const updatedReceipts = [storedReceipt, ...existingReceipts];

      // Use Electron's store if available, otherwise fallback to AsyncStorage
      const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI?.setStore;
      if (isDesktop) {
        await (window as any).electronAPI.setStore(this.STORAGE_KEYS.RECEIPTS, updatedReceipts);
      } else {
        await AsyncStorage.setItem(this.STORAGE_KEYS.RECEIPTS, JSON.stringify(updatedReceipts));
      }

      return storedReceipt;
    } catch (error) {
      console.error('Failed to store receipt:', error);
      throw new Error('Failed to save receipt');
    }
  }

  /**
   * Get all stored receipts
   */
  static async getAllReceipts(): Promise<StoredReceipt[]> {
    try {
      let stored: string | null = null;

      let receipts: StoredReceipt[] = [];

      // Use Electron's store if available, otherwise fallback to AsyncStorage
      const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI?.getStore;
      if (isDesktop) {
        const data = await (window as any).electronAPI.getStore(this.STORAGE_KEYS.RECEIPTS);
        if (data) {
          receipts = Array.isArray(data) ? data : [];
        }
      } else {
        stored = await AsyncStorage.getItem(this.STORAGE_KEYS.RECEIPTS);
        if (stored) {
          receipts = JSON.parse(stored);
        }
      }

      if (!Array.isArray(receipts)) return [];
      
      // Convert date strings back to Date objects
      return receipts.map(receipt => ({
        ...receipt,
        date: new Date(receipt.date),
        printedAt: receipt.printedAt ? new Date(receipt.printedAt) : undefined,
      }));
    } catch (error) {
      console.error('Failed to get receipts:', error);
      return [];
    }
  }

  /**
   * Get a specific receipt by ID
   */
  static async getReceiptById(id: string): Promise<StoredReceipt | null> {
    try {
      const receipts = await this.getAllReceipts();
      return receipts.find(receipt => receipt.id === id) || null;
    } catch (error) {
      console.error('Failed to get receipt:', error);
      return null;
    }
  }

  /**
   * Mark a receipt as printed
   */
  static async markReceiptAsPrinted(id: string): Promise<void> {
    try {
      const receipts = await this.getAllReceipts();
      const updatedReceipts = receipts.map(receipt =>
        receipt.id === id
          ? {...receipt, printed: true, printedAt: new Date()}
          : receipt
      );

      // Use Electron's store if available, otherwise fallback to AsyncStorage
      const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI?.setStore;
      if (isDesktop) {
        await (window as any).electronAPI.setStore(this.STORAGE_KEYS.RECEIPTS, updatedReceipts);
      } else {
        await AsyncStorage.setItem(this.STORAGE_KEYS.RECEIPTS, JSON.stringify(updatedReceipts));
      }
    } catch (error) {
      console.error('Failed to mark receipt as printed:', error);
      throw new Error('Failed to update receipt status');
    }
  }

  /**
   * Delete a receipt
   */
  static async deleteReceipt(id: string): Promise<void> {
    try {
      const receipts = await this.getAllReceipts();
      const filteredReceipts = receipts.filter(receipt => receipt.id !== id);

      // Use Electron's store if available, otherwise fallback to AsyncStorage
      const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI?.setStore;
      if (isDesktop) {
        await (window as any).electronAPI.setStore(this.STORAGE_KEYS.RECEIPTS, filteredReceipts);
      } else {
        await AsyncStorage.setItem(this.STORAGE_KEYS.RECEIPTS, JSON.stringify(filteredReceipts));
      }
    } catch (error) {
      console.error('Failed to delete receipt:', error);
      throw new Error('Failed to delete receipt');
    }
  }

  /**
   * Get receipts by date range
   */
  static async getReceiptsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<StoredReceipt[]> {
    try {
      const receipts = await this.getAllReceipts();
      
      return receipts.filter(receipt => {
        const receiptDate = new Date(receipt.date);
        return receiptDate >= startDate && receiptDate <= endDate;
      });
    } catch (error) {
      console.error('Failed to get receipts by date range:', error);
      return [];
    }
  }

  /**
   * Get today's receipts
   */
  static async getTodaysReceipts(): Promise<StoredReceipt[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    return await this.getReceiptsByDateRange(startOfDay, endOfDay);
  }

  /**
   * Get receipts statistics
   */
  static async getReceiptStats(): Promise<{
    totalReceipts: number;
    totalAmount: number;
    todayReceipts: number;
    todayAmount: number;
    printedReceipts: number;
    unprintedReceipts: number;
  }> {
    try {
      const allReceipts = await this.getAllReceipts();
      const todayReceipts = await this.getTodaysReceipts();

      const totalAmount = allReceipts.reduce((sum, receipt) => sum + receipt.total, 0);
      const todayAmount = todayReceipts.reduce((sum, receipt) => sum + receipt.total, 0);
      const printedReceipts = allReceipts.filter(r => r.printed).length;

      return {
        totalReceipts: allReceipts.length,
        totalAmount,
        todayReceipts: todayReceipts.length,
        todayAmount,
        printedReceipts,
        unprintedReceipts: allReceipts.length - printedReceipts,
      };
    } catch (error) {
      console.error('Failed to get receipt stats:', error);
      return {
        totalReceipts: 0,
        totalAmount: 0,
        todayReceipts: 0,
        todayAmount: 0,
        printedReceipts: 0,
        unprintedReceipts: 0,
      };
    }
  }

  /**
   * Search receipts by receipt number or item name
   */
  static async searchReceipts(query: string): Promise<StoredReceipt[]> {
    try {
      if (!query.trim()) return [];

      const receipts = await this.getAllReceipts();
      const lowerQuery = query.toLowerCase();

      return receipts.filter(receipt => {
        // Search by receipt number
        if (receipt.receiptNumber.toLowerCase().includes(lowerQuery)) {
          return true;
        }

        // Search by company name
        if (receipt.companyName.toLowerCase().includes(lowerQuery)) {
          return true;
        }

        // Search by customer name
        if (receipt.customerName && receipt.customerName.toLowerCase().includes(lowerQuery)) {
          return true;
        }

        // Search by item names
        return receipt.items.some(item =>
          item.name.toLowerCase().includes(lowerQuery)
        );
      });
    } catch (error) {
      console.error('Failed to search receipts:', error);
      return [];
    }
  }

  /**
   * Clear all receipts (for testing purposes)
   */
  static async clearAllReceipts(): Promise<void> {
    try {
      // Use Electron's store if available, otherwise fallback to AsyncStorage
      const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI?.deleteStore;
      if (isDesktop) {
        await (window as any).electronAPI.deleteStore(this.STORAGE_KEYS.RECEIPTS);
        await (window as any).electronAPI.deleteStore(this.STORAGE_KEYS.RECEIPT_COUNTER);
      } else {
        await AsyncStorage.removeItem(this.STORAGE_KEYS.RECEIPTS);
        await AsyncStorage.removeItem(this.STORAGE_KEYS.RECEIPT_COUNTER);
      }
    } catch (error) {
      console.error('Failed to clear receipts:', error);
      throw new Error('Failed to clear receipts');
    }
  }

  /**
   * Export receipts data (for backup or sync)
   */
  static async exportReceipts(): Promise<string> {
    try {
      const receipts = await this.getAllReceipts();
      return JSON.stringify(receipts, null, 2);
    } catch (error) {
      console.error('Failed to export receipts:', error);
      throw new Error('Failed to export receipts');
    }
  }

  /**
   * Import receipts data (for restore or sync)
   */
  static async importReceipts(jsonData: string, merge = false): Promise<void> {
    try {
      const importedReceipts: StoredReceipt[] = JSON.parse(jsonData);
      
      // Validate imported data
      if (!Array.isArray(importedReceipts)) {
        throw new Error('Invalid import data format');
      }

      let finalReceipts = importedReceipts;

      if (merge) {
        const existingReceipts = await this.getAllReceipts();
        const existingIds = new Set(existingReceipts.map(r => r.id));
        
        // Only add receipts that don't already exist
        const newReceipts = importedReceipts.filter(r => !existingIds.has(r.id));
        finalReceipts = [...existingReceipts, ...newReceipts];
      }

      // Use Electron's store if available, otherwise fallback to AsyncStorage
      const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI?.setStore;
      if (isDesktop) {
        await (window as any).electronAPI.setStore(this.STORAGE_KEYS.RECEIPTS, finalReceipts);
      } else {
        await AsyncStorage.setItem(this.STORAGE_KEYS.RECEIPTS, JSON.stringify(finalReceipts));
      }
    } catch (error) {
      console.error('Failed to import receipts:', error);
      throw new Error('Failed to import receipts');
    }
  }

  /**
   * Get storage usage info
   */
  static async getStorageInfo(): Promise<{
    receiptsCount: number;
    estimatedSize: string;
    lastModified?: Date;
  }> {
    try {
      const receipts = await this.getAllReceipts();
      const receiptsData = JSON.stringify(receipts);
      const sizeInBytes = new Blob([receiptsData]).size;
      const sizeInKB = (sizeInBytes / 1024).toFixed(2);
      
      const lastModified = receipts.length > 0 
        ? new Date(Math.max(...receipts.map(r => new Date(r.date).getTime())))
        : undefined;

      return {
        receiptsCount: receipts.length,
        estimatedSize: `${sizeInKB} KB`,
        lastModified,
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return {
        receiptsCount: 0,
        estimatedSize: '0 KB',
      };
    }
  }

  // ==================== FILE SYSTEM MANAGEMENT ====================

  /**
   * Create organized folder structure for receipts
   * Creates folders like: Documents/Receipts/2024/01/
   */
  static async createReceiptFolderStructure(date: Date = new Date()): Promise<string> {
    try {
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      
      // Check if we're in desktop or mobile environment
      const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI?.ensureDirectory;
      
      if (isDesktop) {
        // Desktop (Electron) - use system Documents folder
        const folderPath = await (window as any).electronAPI.ensureDirectory(`Receipts/${year}/${month}`);
        return folderPath;
      } else {
        // Mobile (React Native/Expo) - use app's document directory
        const baseDir = FileSystem.documentDirectory;
        const folderPath = `${baseDir}Receipts/${year}/${month}/`;
        
        // Ensure the directory exists
        const dirInfo = await FileSystem.getInfoAsync(folderPath);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
        }
        
        return folderPath;
      }
    } catch (error) {
      console.error('Failed to create receipt folder structure:', error);
      // Fallback to base documents directory
      const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI;
      if (isDesktop) {
        return await (window as any).electronAPI.getDocumentsPath() || '';
      } else {
        return FileSystem.documentDirectory || '';
      }
    }
  }

  /**
   * Generate a unique filename for a receipt PDF
   */
  static generateReceiptFileName(receipt: Receipt): string {
    const date = new Date(receipt.date);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    
    // Clean receipt number for filename
    const cleanReceiptNumber = receipt.receiptNumber.replace(/[^a-zA-Z0-9]/g, '_');
    
    return `Receipt_${cleanReceiptNumber}_${dateStr}_${timeStr}.pdf`;
  }

  /**
   * Save PDF file to organized folder structure
   * Also attempts to save to external/public storage for better accessibility
   */
  static async savePDFToOrganizedFolder(
    pdfUri: string,
    receipt: Receipt,
    customFolderPath?: string,
    saveToPublicStorage: boolean = true
  ): Promise<{success: boolean; filePath?: string; publicPath?: string; error?: string}> {
    try {
      // Create folder structure
      const folderPath = customFolderPath || await this.createReceiptFolderStructure(receipt.date);
      
      // Generate filename
      const fileName = this.generateReceiptFileName(receipt);
      const finalPath = `${folderPath}${fileName}`;
      
      const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI?.copyFile;
      
      if (isDesktop) {
        // Desktop: Use Electron's file operations
        const success = await (window as any).electronAPI.copyFile(pdfUri, finalPath);
        if (success) {
          return { success: true, filePath: finalPath };
        } else {
          return { success: false, error: 'Failed to copy file on desktop' };
        }
      } else {
        // Mobile: Use Expo FileSystem
        await FileSystem.moveAsync({
          from: pdfUri,
          to: finalPath,
        });
        
        return { success: true, filePath: finalPath };
      }
    } catch (error) {
      console.error('Failed to save PDF to organized folder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save PDF file',
      };
    }
  }

  /**
   * Get all PDF files in the receipts folder structure
   */
  static async getAllReceiptPDFs(): Promise<{
    success: boolean;
    files?: Array<{path: string; name: string; date: Date; size: number}>;
    error?: string;
  }> {
    try {
      const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI?.listReceiptFiles;
      
      if (isDesktop) {
        // Desktop: Use Electron's file listing
        const files = await (window as any).electronAPI.listReceiptFiles();
        return { success: true, files };
      } else {
        // Mobile: Use Expo FileSystem to scan directories
        const baseDir = `${FileSystem.documentDirectory}Receipts/`;
        const files: Array<{path: string; name: string; date: Date; size: number}> = [];
        
        try {
          const baseDirInfo = await FileSystem.getInfoAsync(baseDir);
          if (!baseDirInfo.exists) {
            return { success: true, files: [] };
          }
          
          // Recursively scan directories
          const scanDirectory = async (dirPath: string) => {
            const items = await FileSystem.readDirectoryAsync(dirPath);
            
            for (const item of items) {
              const itemPath = `${dirPath}${item}`;
              const itemInfo = await FileSystem.getInfoAsync(itemPath);
              
              if (itemInfo.isDirectory) {
                await scanDirectory(`${itemPath}/`);
              } else if (item.toLowerCase().endsWith('.pdf')) {
                files.push({
                  path: itemPath,
                  name: item,
                  date: new Date(itemInfo.modificationTime || 0),
                  size: itemInfo.size || 0,
                });
              }
            }
          };
          
          await scanDirectory(baseDir);
        } catch (scanError) {
          // If scanning fails, return empty array instead of error
          console.warn('Could not scan receipt directories:', scanError);
        }
        
        return { success: true, files };
      }
    } catch (error) {
      console.error('Failed to get receipt PDFs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list PDF files',
      };
    }
  }

  /**
   * Delete a PDF file
   */
  static async deletePDFFile(filePath: string): Promise<{success: boolean; error?: string}> {
    try {
      const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI?.deleteFile;
      
      if (isDesktop) {
        const success = await (window as any).electronAPI.deleteFile(filePath);
        if (success) {
          return { success: true };
        } else {
          return { success: false, error: 'Failed to delete file on desktop' };
        }
      } else {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        return { success: true };
      }
    } catch (error) {
      console.error('Failed to delete PDF file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete PDF file',
      };
    }
  }

  /**
   * Clean up old PDF files (older than specified days)
   */
  static async cleanupOldPDFs(daysOld = 90): Promise<{
    success: boolean;
    deletedCount?: number;
    error?: string;
  }> {
    try {
      const pdfFiles = await this.getAllReceiptPDFs();
      if (!pdfFiles.success || !pdfFiles.files) {
        return { success: false, error: pdfFiles.error };
      }
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      let deletedCount = 0;
      
      for (const file of pdfFiles.files) {
        if (file.date < cutoffDate) {
          const deleteResult = await this.deletePDFFile(file.path);
          if (deleteResult.success) {
            deletedCount++;
          }
        }
      }
      
      return { success: true, deletedCount };
    } catch (error) {
      console.error('Failed to cleanup old PDFs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup old PDFs',
      };
    }
  }

  /**
   * Copy PDF to public Downloads folder for easy access
   */
  static async copyPDFToDownloads(
    pdfPath: string,
    fileName?: string
  ): Promise<{success: boolean; publicPath?: string; error?: string}> {
    try {
      const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI;
      
      if (isDesktop) {
        // Desktop - already accessible
        return { success: true, publicPath: pdfPath };
      } else {
        // Mobile - try to copy to accessible location
        const downloadDir = `${FileSystem.documentDirectory}../Library/Caches/Downloads/`;
        const finalFileName = fileName || pdfPath.split('/').pop() || 'receipt.pdf';
        const publicPath = `${downloadDir}${finalFileName}`;
        
        try {
          // Ensure downloads directory exists
          const downloadDirInfo = await FileSystem.getInfoAsync(downloadDir);
          if (!downloadDirInfo.exists) {
            await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
          }
          
          // Copy the file
          await FileSystem.copyAsync({
            from: pdfPath,
            to: publicPath,
          });
          
          return { success: true, publicPath };
        } catch (copyError) {
          // If copying fails, return original path
          console.warn('Could not copy to downloads, file remains in app directory:', copyError);
          return { success: true, publicPath: pdfPath };
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy PDF',
      };
    }
  }

  /**
   * Get folder structure info and storage usage
   */
  static async getFileSystemInfo(): Promise<{
    success: boolean;
    info?: {
      receiptsFolderPath: string;
      totalFiles: number;
      totalSizeMB: number;
      oldestFile?: Date;
      newestFile?: Date;
    };
    error?: string;
  }> {
    try {
      const pdfFiles = await this.getAllReceiptPDFs();
      if (!pdfFiles.success || !pdfFiles.files) {
        return { success: false, error: pdfFiles.error };
      }
      
      const folderPath = await this.createReceiptFolderStructure();
      const totalSizeBytes = pdfFiles.files.reduce((sum, file) => sum + file.size, 0);
      const totalSizeMB = Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100;
      
      const dates = pdfFiles.files.map(file => file.date).sort((a, b) => a.getTime() - b.getTime());
      const oldestFile = dates[0];
      const newestFile = dates[dates.length - 1];
      
      return {
        success: true,
        info: {
          receiptsFolderPath: folderPath,
          totalFiles: pdfFiles.files.length,
          totalSizeMB,
          oldestFile,
          newestFile,
        },
      };
    } catch (error) {
      console.error('Failed to get filesystem info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get filesystem info',
      };
    }
  }
}
