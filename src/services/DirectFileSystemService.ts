import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform } from 'react-native';
import { Receipt } from '../types';

export interface DirectFileSystemResult {
  success: boolean;
  filePath?: string;
  publicPath?: string;
  error?: string;
  needsPermission?: boolean;
}

export class DirectFileSystemService {
  // Public storage directories
  private static readonly PUBLIC_DIRECTORIES = {
    DOWNLOADS: `${FileSystem.documentDirectory}../../Download/`,
    DOCUMENTS: `${FileSystem.documentDirectory}../../Documents/`,
    DCIM: `${FileSystem.documentDirectory}../../DCIM/`,
    EXTERNAL_DOWNLOADS: '/storage/emulated/0/Download/',
    EXTERNAL_DOCUMENTS: '/storage/emulated/0/Documents/',
  };

  /**
   * Request storage permissions from user
   */
  static async requestStoragePermissions(): Promise<{granted: boolean; error?: string}> {
    try {
      if (Platform.OS !== 'android') {
        return { granted: true };
      }

      // Request media library permissions
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      
      if (mediaStatus !== 'granted') {
        return { 
          granted: false, 
          error: 'Storage permission denied. Please grant permission in Settings.' 
        };
      }

      console.log('Storage permissions granted');
      return { granted: true };
    } catch (error) {
      console.error('Failed to request storage permissions:', error);
      return { 
        granted: false, 
        error: error instanceof Error ? error.message : 'Permission request failed' 
      };
    }
  }

  /**
   * Check if we have storage permissions
   */
  static async hasStoragePermissions(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return true;
      }

      const { status } = await MediaLibrary.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to check storage permissions:', error);
      return false;
    }
  }

  /**
   * Get available public storage directories
   */
  static async getAvailableDirectories(): Promise<{
    success: boolean;
    directories?: Array<{name: string; path: string; exists: boolean; writable: boolean}>;
    error?: string;
  }> {
    try {
      const directories = [];
      
      for (const [name, path] of Object.entries(this.PUBLIC_DIRECTORIES)) {
        try {
          const info = await FileSystem.getInfoAsync(path);
          // Test if directory is writable by attempting to create a test file
          let writable = false;
          if (info.exists) {
            try {
              const testFile = `${path}test_write_${Date.now()}.tmp`;
              await FileSystem.writeAsStringAsync(testFile, 'test');
              await FileSystem.deleteAsync(testFile, { idempotent: true });
              writable = true;
            } catch {
              writable = false;
            }
          }

          directories.push({
            name,
            path,
            exists: info.exists,
            writable
          });
        } catch (error) {
          directories.push({
            name,
            path,
            exists: false,
            writable: false
          });
        }
      }

      return { success: true, directories };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get directories'
      };
    }
  }

  /**
   * Create organized folder structure in public storage
   */
  static async createPublicReceiptFolder(
    baseDirectory: string = this.PUBLIC_DIRECTORIES.EXTERNAL_DOWNLOADS,
    date: Date = new Date()
  ): Promise<{success: boolean; folderPath?: string; error?: string}> {
    try {
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      
      const folderPath = `${baseDirectory}Receipts/${year}/${month}/`;
      
      // Ensure the directory exists
      const folderInfo = await FileSystem.getInfoAsync(folderPath);
      if (!folderInfo.exists) {
        await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
        console.log('Created public receipt folder:', folderPath);
      }
      
      return { success: true, folderPath };
    } catch (error) {
      console.error('Failed to create public receipt folder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create folder'
      };
    }
  }

  /**
   * Generate receipt filename with enhanced information
   */
  static generateReceiptFileName(receipt: Receipt, includeCompany: boolean = true): string {
    const date = new Date(receipt.date);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    
    // Clean receipt number and company name for filename
    const cleanReceiptNumber = receipt.receiptNumber.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanCompanyName = includeCompany 
      ? receipt.companyName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)
      : '';
    
    const companyPart = includeCompany && cleanCompanyName ? `_${cleanCompanyName}` : '';
    
    return `Receipt_${cleanReceiptNumber}${companyPart}_${dateStr}_${timeStr}.pdf`;
  }

  /**
   * Save PDF directly to public storage with user directory selection
   */
  static async saveToPublicStorage(
    pdfUri: string,
    receipt: Receipt,
    options: {
      directory?: string;
      showDirectoryDialog?: boolean;
      includeCompanyInFilename?: boolean;
      createYearMonthFolders?: boolean;
    } = {}
  ): Promise<DirectFileSystemResult> {
    try {
      // Check permissions first
      const hasPermissions = await this.hasStoragePermissions();
      if (!hasPermissions) {
        const permissionResult = await this.requestStoragePermissions();
        if (!permissionResult.granted) {
          return {
            success: false,
            needsPermission: true,
            error: permissionResult.error || 'Storage permission required'
          };
        }
      }

      // Determine target directory
      let targetDirectory = options.directory || this.PUBLIC_DIRECTORIES.EXTERNAL_DOWNLOADS;
      
      // If user wants directory selection, show available options
      if (options.showDirectoryDialog) {
        const dirResult = await this.showDirectorySelectionDialog();
        if (dirResult.selectedPath) {
          targetDirectory = dirResult.selectedPath;
        }
      }

      // Create organized folder structure if requested
      let finalDirectory = targetDirectory;
      if (options.createYearMonthFolders !== false) { // Default to true
        const folderResult = await this.createPublicReceiptFolder(targetDirectory, receipt.date);
        if (folderResult.success && folderResult.folderPath) {
          finalDirectory = folderResult.folderPath;
        }
      }

      // Generate filename
      const fileName = this.generateReceiptFileName(
        receipt, 
        options.includeCompanyInFilename !== false // Default to true
      );
      
      const finalPath = `${finalDirectory}${fileName}`;

      // Copy the PDF file to the target location
      await FileSystem.copyAsync({
        from: pdfUri,
        to: finalPath,
      });

      // Verify the file was created
      const fileInfo = await FileSystem.getInfoAsync(finalPath);
      if (!fileInfo.exists) {
        throw new Error('File was not created successfully');
      }

      console.log('PDF saved to public storage:', finalPath);
      
      // Try to add to media library for better discoverability
      try {
        if (Platform.OS === 'android') {
          await MediaLibrary.createAssetAsync(finalPath);
          console.log('PDF added to media library');
        }
      } catch (mediaError) {
        console.warn('Could not add to media library (this is normal):', mediaError);
      }

      return {
        success: true,
        filePath: pdfUri,
        publicPath: finalPath
      };

    } catch (error) {
      console.error('Failed to save to public storage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save PDF to public storage'
      };
    }
  }

  /**
   * Show directory selection dialog to user
   */
  private static async showDirectorySelectionDialog(): Promise<{selectedPath?: string}> {
    return new Promise((resolve) => {
      const directories = [
        { title: 'Downloads', path: this.PUBLIC_DIRECTORIES.EXTERNAL_DOWNLOADS },
        { title: 'Documents', path: this.PUBLIC_DIRECTORIES.EXTERNAL_DOCUMENTS },
        { title: 'App Downloads', path: this.PUBLIC_DIRECTORIES.DOWNLOADS },
        { title: 'App Documents', path: this.PUBLIC_DIRECTORIES.DOCUMENTS },
      ];

      const buttons = directories.map(dir => ({
        text: dir.title,
        onPress: () => resolve({ selectedPath: dir.path })
      }));

      buttons.push({
        text: 'Cancel',
        onPress: () => resolve({})
      });

      Alert.alert(
        'Select Save Location',
        'Choose where to save your receipt PDF:',
        buttons,
        { cancelable: true, onDismiss: () => resolve({}) }
      );
    });
  }

  /**
   * List all PDF files from public receipts folders
   */
  static async getPublicReceiptPDFs(
    baseDirectory: string = this.PUBLIC_DIRECTORIES.EXTERNAL_DOWNLOADS
  ): Promise<{
    success: boolean;
    files?: Array<{path: string; name: string; date: Date; size: number; directory: string}>;
    error?: string;
  }> {
    try {
      const receiptsPath = `${baseDirectory}Receipts/`;
      const files: Array<{path: string; name: string; date: Date; size: number; directory: string}> = [];

      try {
        const receiptsInfo = await FileSystem.getInfoAsync(receiptsPath);
        if (!receiptsInfo.exists) {
          return { success: true, files: [] };
        }

        // Recursively scan directories
        const scanDirectory = async (dirPath: string) => {
          try {
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
                  directory: dirPath.replace(receiptsPath, '')
                });
              }
            }
          } catch (scanError) {
            console.warn('Could not scan directory:', dirPath, scanError);
          }
        };

        await scanDirectory(receiptsPath);
      } catch (receiptsScanError) {
        console.warn('Could not scan receipts directory:', receiptsScanError);
      }

      return { success: true, files };
    } catch (error) {
      console.error('Failed to get public receipt PDFs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list PDF files'
      };
    }
  }

  /**
   * Delete a PDF file from public storage
   */
  static async deletePublicPDF(filePath: string): Promise<{success: boolean; error?: string}> {
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      console.log('Deleted public PDF:', filePath);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete public PDF:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete PDF file'
      };
    }
  }

  /**
   * Get detailed information about public storage
   */
  static async getPublicStorageInfo(): Promise<{
    success: boolean;
    info?: {
      hasPermissions: boolean;
      availableDirectories: Array<{name: string; path: string; exists: boolean; writable: boolean}>;
      totalPublicFiles: number;
      totalPublicSizeMB: number;
      recommendedDirectory: string;
    };
    error?: string;
  }> {
    try {
      const hasPermissions = await this.hasStoragePermissions();
      const dirResult = await this.getAvailableDirectories();
      
      if (!dirResult.success) {
        return { success: false, error: dirResult.error };
      }

      // Get file counts and sizes
      let totalFiles = 0;
      let totalSize = 0;
      
      for (const dir of dirResult.directories || []) {
        if (dir.exists) {
          try {
            const files = await this.getPublicReceiptPDFs(dir.path);
            if (files.success && files.files) {
              totalFiles += files.files.length;
              totalSize += files.files.reduce((sum, file) => sum + file.size, 0);
            }
          } catch {
            // Ignore errors for individual directories
          }
        }
      }

      // Recommend best directory (writable external storage first)
      const writableExternalDir = dirResult.directories?.find(d => 
        d.name.startsWith('EXTERNAL_') && d.writable
      );
      const writableDir = dirResult.directories?.find(d => d.writable);
      const recommendedDirectory = writableExternalDir?.path || 
                                  writableDir?.path || 
                                  this.PUBLIC_DIRECTORIES.EXTERNAL_DOWNLOADS;

      return {
        success: true,
        info: {
          hasPermissions,
          availableDirectories: dirResult.directories || [],
          totalPublicFiles: totalFiles,
          totalPublicSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
          recommendedDirectory
        }
      };
    } catch (error) {
      console.error('Failed to get public storage info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get storage info'
      };
    }
  }

  /**
   * Setup and verify direct file system access
   */
  static async setupDirectFileAccess(): Promise<{
    success: boolean;
    info?: {
      permissionsGranted: boolean;
      recommendedPath: string;
      testFileCreated: boolean;
      writableDirectories: string[];
    };
    error?: string;
  }> {
    try {
      console.log('Setting up direct file system access...');
      
      // 1. Check/request permissions
      const permissionResult = await this.requestStoragePermissions();
      if (!permissionResult.granted) {
        return {
          success: false,
          error: 'Storage permissions are required for direct file access. ' + permissionResult.error
        };
      }

      // 2. Get available directories
      const dirResult = await this.getAvailableDirectories();
      if (!dirResult.success) {
        return { success: false, error: dirResult.error };
      }

      const writableDirectories = dirResult.directories
        ?.filter(d => d.writable)
        .map(d => d.path) || [];

      // 3. Find best directory
      const recommendedPath = writableDirectories.find(path => 
        path.includes('/storage/emulated/0/')
      ) || writableDirectories[0] || this.PUBLIC_DIRECTORIES.EXTERNAL_DOWNLOADS;

      // 4. Create test file to verify access
      let testFileCreated = false;
      try {
        const testFilePath = `${recommendedPath}test_receipt_access_${Date.now()}.tmp`;
        await FileSystem.writeAsStringAsync(testFilePath, 'Direct file access test');
        
        const testInfo = await FileSystem.getInfoAsync(testFilePath);
        testFileCreated = testInfo.exists;
        
        // Clean up test file
        await FileSystem.deleteAsync(testFilePath, { idempotent: true });
        
        console.log('Direct file access test successful');
      } catch (testError) {
        console.warn('Direct file access test failed:', testError);
      }

      return {
        success: true,
        info: {
          permissionsGranted: true,
          recommendedPath,
          testFileCreated,
          writableDirectories
        }
      };

    } catch (error) {
      console.error('Failed to setup direct file access:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Setup failed'
      };
    }
  }
}
