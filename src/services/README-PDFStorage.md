# Enhanced PDF Storage System

This document explains the enhanced PDF file storage system that organizes receipt PDFs into a structured folder hierarchy for better file management.

## 🗂️ Folder Structure

The system automatically organizes PDF files using the following structure:

```
Documents/
└── Receipts/
    └── 2024/
        ├── 01/
        │   ├── Receipt_R001_2024-01-15_09-30-15.pdf
        │   ├── Receipt_R002_2024-01-15_14-45-22.pdf
        │   └── Receipt_R003_2024-01-16_16-20-30.pdf
        ├── 02/
        │   ├── Receipt_R004_2024-02-01_10-15-30.pdf
        │   └── Receipt_R005_2024-02-03_16-45-12.pdf
        └── 03/
            └── Receipt_R006_2024-03-10_11-22-45.pdf
```

### Platform Differences

#### Desktop (Electron)
- **Base Path**: `~/Documents/Receipts/YEAR/MONTH/`
- **File Operations**: Native OS file system operations via Electron API
- **Features**: Full file management, system integration

#### Mobile (React Native/Expo)
- **Base Path**: `[App Documents]/Receipts/YEAR/MONTH/`
- **File Operations**: Expo FileSystem API
- **Features**: App-scoped storage, sharing via system share sheet

## 📁 File Naming Convention

PDF files are named using a structured format:

```
Receipt_[ReceiptNumber]_[Date]_[Time].pdf
```

**Example**: `Receipt_R001_2024-01-15_14-30-45.pdf`

- `Receipt_`: Fixed prefix
- `R001`: Receipt number (sanitized)
- `2024-01-15`: Date in YYYY-MM-DD format
- `14-30-45`: Time in HH-MM-SS format (colons replaced with dashes)
- `.pdf`: File extension

## 🛠️ Services and Classes

### StorageService Enhancements

The `StorageService` class has been enhanced with file system management methods:

#### Key Methods:

- `createReceiptFolderStructure(date)` - Creates organized folder structure
- `generateReceiptFileName(receipt)` - Generates structured filename
- `savePDFToOrganizedFolder(pdfUri, receipt, customFolderPath?)` - Saves PDF to organized structure
- `getAllReceiptPDFs()` - Lists all PDF files in organized structure
- `deletePDFFile(filePath)` - Deletes a specific PDF file
- `cleanupOldPDFs(daysOld)` - Removes PDFs older than specified days
- `getFileSystemInfo()` - Returns storage usage information

### PrintService Updates

The `PrintService` has been updated to use organized storage:

#### Key Changes:

- `generatePDF()` now has `saveToOrganizedFolder` parameter
- Automatic fallback to simple naming if organized save fails
- Integration with `StorageService` for file management

## 📝 Usage Examples

### Basic PDF Generation with Organized Storage

```typescript
import { PrintService } from '../services/PrintService';
import { StorageService } from '../services/StorageService';

// Generate and save PDF with organized structure
const result = await PrintService.generatePDF(receipt, companySettings, true);
if (result.success) {
  console.log(`PDF saved to: ${result.filePath}`);
}
```

### Custom Folder Path

```typescript
// Save to custom folder
const customPath = '/path/to/custom/folder/';
const result = await StorageService.savePDFToOrganizedFolder(
  pdfUri, 
  receipt, 
  customPath
);
```

### File Management Operations

```typescript
// Get all PDF files
const files = await StorageService.getAllReceiptPDFs();

// Get storage information
const info = await StorageService.getFileSystemInfo();

// Clean up old files (older than 90 days)
const cleanup = await StorageService.cleanupOldPDFs(90);
```

### Using the PDFStorageManager Utility

```typescript
import { PDFStorageManager } from '../utils/pdfStorageExample';

// Save receipt with organized structure
await PDFStorageManager.saveReceiptPDF(receipt, companySettings);

// Get storage information
await PDFStorageManager.getStorageInfo();

// List all PDFs
await PDFStorageManager.listAllPDFs();

// Cleanup old files
await PDFStorageManager.cleanupOldFiles(90);
```

## 🔧 Configuration Options

### Environment Detection

The system automatically detects the runtime environment:

```typescript
const isDesktop = typeof window !== 'undefined' && (window as any)?.electronAPI;
```

### Folder Structure Customization

You can customize the folder structure by modifying the `createReceiptFolderStructure` method:

```typescript
// Current structure: YYYY/MM
const year = date.getFullYear().toString();
const month = (date.getMonth() + 1).toString().padStart(2, '0');

// Example custom structure: YYYY/MM/DD
const day = date.getDate().toString().padStart(2, '0');
const folderPath = `${baseDir}Receipts/${year}/${month}/${day}/`;
```

## 🚨 Error Handling

The system includes comprehensive error handling:

1. **Folder Creation Failures**: Falls back to base documents directory
2. **File Save Failures**: Returns detailed error information
3. **Permission Issues**: Graceful degradation with fallback options
4. **Platform Compatibility**: Automatic detection and appropriate method selection

## 🔍 Monitoring and Maintenance

### Storage Information

```typescript
const info = await StorageService.getFileSystemInfo();
console.log(`Total files: ${info.info?.totalFiles}`);
console.log(`Total size: ${info.info?.totalSizeMB} MB`);
```

### Cleanup Operations

```typescript
// Cleanup files older than 90 days
const result = await StorageService.cleanupOldPDFs(90);
console.log(`Deleted ${result.deletedCount} old files`);
```

## 🔒 Security Considerations

1. **File Permissions**: Files are saved within app's sandbox on mobile
2. **Path Sanitization**: Receipt numbers are sanitized for safe filenames
3. **Access Control**: Desktop uses system permissions, mobile uses app permissions

## 🔄 Migration from Old System

If you have existing PDFs in the old flat structure, you can migrate them:

```typescript
// This is a conceptual example - implement based on your needs
async function migratePDFs() {
  // 1. Get all existing PDFs from old location
  // 2. Parse receipt information from filename
  // 3. Move to new organized structure
  // 4. Update database references if needed
}
```

## 🐛 Troubleshooting

### Common Issues:

1. **Permission Denied**: Check app permissions for file system access
2. **Folder Creation Failed**: Verify write permissions to documents directory
3. **File Not Found**: Check if organized structure exists before accessing files

### Debug Information:

Enable debug logging to troubleshoot issues:

```typescript
console.log('Platform detection:', {
  isDesktop: typeof window !== 'undefined' && (window as any)?.electronAPI,
  hasFileSystem: !!FileSystem,
  documentsDir: FileSystem?.documentDirectory
});
```

## 📈 Benefits

1. **Organization**: Files are automatically organized by date
2. **Scalability**: Structure remains efficient with thousands of files
3. **Maintenance**: Easy cleanup of old files
4. **User Experience**: Clear file paths and organized storage
5. **Cross-Platform**: Works on both desktop and mobile environments

## 🔮 Future Enhancements

Potential future improvements:

1. **Search Integration**: Index files for faster searching
2. **Compression**: Automatic compression of old PDFs
3. **Cloud Sync**: Optional cloud storage integration
4. **Batch Operations**: Bulk file operations
5. **Custom Templates**: User-defined folder structures
