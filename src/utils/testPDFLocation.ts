/**
 * Test utility to help locate PDF files in Android emulator
 * Use this to debug and find where your PDFs are actually being saved
 */

import * as FileSystem from 'expo-file-system';
import { StorageService } from '../services/storage/StorageService';

export class PDFLocationTester {
  /**
   * Print all possible PDF locations for debugging
   */
  static async debugPDFLocations(): Promise<void> {
    console.log('=== PDF Location Debug Info ===');
    
    // 1. Print FileSystem paths
    console.log('Expo FileSystem Paths:');
    console.log('- documentDirectory:', FileSystem.documentDirectory);
    console.log('- cacheDirectory:', FileSystem.cacheDirectory);
    
    // 2. Check if receipts folder exists
    try {
      const receiptsPath = `${FileSystem.documentDirectory}Receipts/`;
      const receiptsInfo = await FileSystem.getInfoAsync(receiptsPath);
      console.log('\\nReceipts folder info:', {
        path: receiptsPath,
        exists: receiptsInfo.exists,
        isDirectory: receiptsInfo.isDirectory
      });
      
      if (receiptsInfo.exists) {
        // List contents of receipts folder
        const contents = await FileSystem.readDirectoryAsync(receiptsPath);
        console.log('Receipts folder contents:', contents);
        
        // Check each year folder
        for (const item of contents) {
          const itemPath = `${receiptsPath}${item}/`;
          const itemInfo = await FileSystem.getInfoAsync(itemPath);
          if (itemInfo.isDirectory) {
            console.log(`\\n${item}/ folder contents:`);
            const yearContents = await FileSystem.readDirectoryAsync(itemPath);
            console.log(yearContents);
            
            // Check month folders
            for (const monthItem of yearContents) {
              const monthPath = `${itemPath}${monthItem}/`;
              const monthInfo = await FileSystem.getInfoAsync(monthPath);
              if (monthInfo.isDirectory) {
                console.log(`\\n  ${item}/${monthItem}/ folder contents:`);
                const monthContents = await FileSystem.readDirectoryAsync(monthPath);
                console.log(monthContents);
              }
            }
          }
        }
      }
    } catch (error) {
      console.log('Error checking receipts folder:', error);
    }
    
    // 3. Use StorageService to get all PDFs
    console.log('\\n=== Using StorageService ===');
    try {
      const pdfFiles = await StorageService.getAllReceiptPDFs();
      if (pdfFiles.success && pdfFiles.files) {
        console.log(`Found ${pdfFiles.files.length} PDF files:`);
        pdfFiles.files.forEach((file, index) => {
          console.log(`${index + 1}. ${file.name}`);
          console.log(`   Path: ${file.path}`);
          console.log(`   Size: ${file.size} bytes`);
          console.log(`   Date: ${file.date.toISOString()}`);
        });
      } else {
        console.log('No PDF files found or error:', pdfFiles.error);
      }
    } catch (error) {
      console.log('Error using StorageService:', error);
    }
    
    // 4. Check system info
    console.log('\\n=== System Info ===');
    try {
      const info = await StorageService.getFileSystemInfo();
      if (info.success && info.info) {
        console.log('File System Info:', info.info);
      } else {
        console.log('Could not get file system info:', info.error);
      }
    } catch (error) {
      console.log('Error getting system info:', error);
    }
    
    console.log('\\n=== End Debug Info ===');
  }
  
  /**
   * Create a test PDF and show where it's saved
   */
  static async createTestPDF(): Promise<void> {
    console.log('Creating test PDF to demonstrate file location...');
    
    // Mock receipt data for testing
    const mockReceipt = {
      id: 'test-pdf-' + Date.now(),
      receiptNumber: 'TEST-001',
      date: new Date(),
      items: [
        { name: 'Test Item', price: 10.00, quantity: 1 }
      ],
      subtotal: 10.00,
      tax: 0.80,
      total: 10.80,
      companyName: 'Test Company',
      companyAddress: 'Test Address',
      footerMessage: 'Test Footer',
      customerName: 'Test Customer'
    };
    
    try {
      // Create the folder structure
      const folderPath = await StorageService.createReceiptFolderStructure();
      console.log('Created folder at:', folderPath);
      
      // Generate filename
      const fileName = StorageService.generateReceiptFileName(mockReceipt);
      console.log('Generated filename:', fileName);
      
      const fullPath = `${folderPath}${fileName}`;
      console.log('Full path would be:', fullPath);
      
      // Check if the folder actually exists
      const folderInfo = await FileSystem.getInfoAsync(folderPath);
      console.log('Folder exists:', folderInfo.exists);
      
      // For demonstration, create a simple text file instead of PDF
      const testContent = `Test Receipt\\nReceipt #: ${mockReceipt.receiptNumber}\\nDate: ${mockReceipt.date.toISOString()}\\nTotal: $${mockReceipt.total}`;
      const testFilePath = `${folderPath}test-receipt.txt`;
      
      await FileSystem.writeAsStringAsync(testFilePath, testContent);
      console.log('Created test file at:', testFilePath);
      
      // Verify the test file exists
      const testFileInfo = await FileSystem.getInfoAsync(testFilePath);
      console.log('Test file exists:', testFileInfo.exists);
      console.log('Test file size:', testFileInfo.size);
      
    } catch (error) {
      console.log('Error creating test PDF:', error);
    }
  }
  
  /**
   * Show user-friendly instructions for finding PDFs
   */
  static showInstructions(): void {
    console.log('\\n=== How to Find Your PDFs ===');
    console.log('');
    console.log('📱 ON ANDROID EMULATOR/DEVICE:');
    console.log('');
    console.log('1. APP DATA FOLDER (if accessible):');
    console.log('   Path: /data/data/com.thermalprinter.mobile/files/Receipts/');
    console.log('   Note: May not be accessible via regular file manager');
    console.log('');
    console.log('2. WHEN EXPORTING PDF FROM APP:');
    console.log('   - The app will show Android share dialog');
    console.log('   - Choose "Save to Downloads" or "Files"');
    console.log('   - PDF will be saved to accessible location');
    console.log('');
    console.log('3. USING ADB (Developer method):');
    console.log('   adb shell');
    console.log('   cp -r /data/data/com.thermalprinter.mobile/files/Receipts/ /sdcard/Download/');
    console.log('   Then check Downloads folder in file manager');
    console.log('');
    console.log('4. EXPO/REACT NATIVE DOCUMENT DIRECTORY:');
    console.log('   Base path: FileSystem.documentDirectory + "Receipts/"');
    console.log('   Usually: file:///data/data/com.thermalprinter.mobile/files/Receipts/');
    console.log('');
    console.log('💡 TIP: The easiest way is to use the app\'s export feature');
    console.log('   which automatically opens the system share dialog!');
  }
}

// Export a simple function to run all tests
export const debugPDFStorage = async () => {
  await PDFLocationTester.debugPDFLocations();
  await PDFLocationTester.createTestPDF();
  PDFLocationTester.showInstructions();
};
