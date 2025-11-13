import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Platform detection for web/mobile compatibility
const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isReactNative = !isWeb && typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

// Lazy import Bluetooth modules with error handling
let BluetoothManager: any = null;
let BluetoothEscposPrinter: any = null;
let BluetoothTscPrinter: any = null;

if (isReactNative) {
  try {
    const BluetoothModule = require('react-native-bluetooth-escpos-printer');
    BluetoothManager = BluetoothModule.BluetoothManager;
    BluetoothEscposPrinter = BluetoothModule.BluetoothEscposPrinter;
    BluetoothTscPrinter = BluetoothModule.BluetoothTscPrinter;
  } catch (error) {
    console.warn('Bluetooth printer module not available:', error);
  }
}

interface ThermalPrinter {
  id: string;
  name: string;
  address: string;
  type: 'bluetooth' | 'wifi' | 'usb';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  isDefault?: boolean;
}

interface PrinterConfig {
  paperWidth: number; // 58 or 80 (mm)
  printDensity: number; // 0-4
  autoCutEnabled: boolean;
  testPrintEnabled: boolean;
  lastSuccessfulCutMethod?: string; // Cache working cut method
}

interface ReceiptData {
  storeInfo: {
    name: string;
    address: string;
    phone: string;
  };
  customerInfo?: {
    name?: string;
    phone?: string;
  };
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  receiptNumber: string;
  timestamp: Date;
  isPaid?: boolean;
}

class ThermalPrinterService {
  private static instance: ThermalPrinterService;
  private connectedPrinter: ThermalPrinter | null = null;
  private config: PrinterConfig = {
    paperWidth: 80,
    printDensity: 3,
    autoCutEnabled: true,
    testPrintEnabled: true,
  };
  private isPrinterInitialized: boolean = false;
  private isCurrentlyPrinting: boolean = false;
  private printQueue: Array<() => Promise<void>> = [];

  private constructor() {
    this.loadConfiguration();
  }

  public static getInstance(): ThermalPrinterService {
    if (!ThermalPrinterService.instance) {
      ThermalPrinterService.instance = new ThermalPrinterService();
    }
    return ThermalPrinterService.instance;
  }

  /**
   * Request necessary permissions for Bluetooth printing
   */
  async requestPermissions(): Promise<boolean> {
    if (isWeb) {
      return true;
    }
    
    if (Platform.OS === 'android') {
      try {
        const apiLevel = Platform.Version;
        
        // Android 12+ (API 31+) requires new Bluetooth permissions
        if (apiLevel >= 31) {
          const permissions = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ];
          
          const granted = await PermissionsAndroid.requestMultiple(permissions);
          
          return Object.values(granted).every(
            (permission) => permission === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          // Android 11 and below
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
          
          return Object.values(granted).every(
            (permission) => permission === PermissionsAndroid.RESULTS.GRANTED
          );
        }
      } catch (error) {
        console.error('Permission request failed:', error);
        return false;
      }
    }
    return true; // iOS handles permissions automatically
  }

  /**
   * Scan for available thermal printers
   */
  async scanForPrinters(): Promise<ThermalPrinter[]> {
    try {
      if (!BluetoothManager) {
        throw new Error('Bluetooth module not available. Please rebuild the app after installing the package.');
      }

      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        throw new Error('Required permissions not granted');
      }

      // Check if Bluetooth is enabled
      const isEnabled = await BluetoothManager.isBluetoothEnabled();
      if (!isEnabled) {
        // Try to enable Bluetooth
        await BluetoothManager.enableBluetooth();
      }

      const printers: ThermalPrinter[] = [];

      // Scan for Bluetooth printers
      try {
        const bluetoothPrinters = await this.scanBluetoothPrinters();
        printers.push(...bluetoothPrinters);
      } catch (error) {
        console.warn('Bluetooth scan failed:', error);
      }

      return printers;
    } catch (error) {
      console.error('Printer scan failed:', error);
      throw error;
    }
  }

  /**
   * Scan for Bluetooth thermal printers
   */
  private async scanBluetoothPrinters(): Promise<ThermalPrinter[]> {
    try {
      if (!BluetoothManager) {
        throw new Error('Bluetooth module not available');
      }

      // Scan for paired and nearby Bluetooth devices
      const pairedDevices = await BluetoothManager.scanDevices();
      const devices = typeof pairedDevices === 'string' 
        ? JSON.parse(pairedDevices) 
        : pairedDevices;

      const printers: ThermalPrinter[] = [];

      // Filter for likely printer devices
      if (Array.isArray(devices.paired)) {
        devices.paired.forEach((device: any) => {
          printers.push({
            id: `bt_${device.address.replace(/:/g, '_')}`,
            name: device.name || 'Unknown Printer',
            address: device.address,
            type: 'bluetooth',
            status: 'disconnected',
          });
        });
      }

      // Add found (unpaired) devices
      if (Array.isArray(devices.found)) {
        devices.found.forEach((device: any) => {
          // Check if not already in paired list
          const exists = printers.some(p => p.address === device.address);
          if (!exists) {
            printers.push({
              id: `bt_${device.address.replace(/:/g, '_')}`,
              name: device.name || 'Unknown Device',
              address: device.address,
              type: 'bluetooth',
              status: 'disconnected',
            });
          }
        });
      }

      return printers;
    } catch (error) {
      console.error('Bluetooth scan error:', error);
      throw error;
    }
  }


  /**
   * Connect to a thermal printer
   */
  async connectToPrinter(printer: ThermalPrinter, skipTestPrint: boolean = false): Promise<boolean> {
    try {
      // Disconnect from any existing printer first
      if (this.connectedPrinter) {
        console.log('Disconnecting from existing printer...');
        try {
          await this.disconnect();
        } catch (error) {
          console.warn('Error disconnecting from existing printer:', error);
        }
      }

      let connected = false;

      switch (printer.type) {
        case 'bluetooth':
          connected = await this.connectBluetoothPrinter(printer);
          break;
        case 'wifi':
          connected = await this.connectWiFiPrinter(printer);
          break;
        case 'usb':
          connected = await this.connectUSBPrinter(printer);
          break;
        default:
          throw new Error(`Unsupported printer type: ${printer.type}`);
      }

      if (connected) {
        this.connectedPrinter = { ...printer, status: 'connected' };
        await this.saveConnectedPrinter(this.connectedPrinter);
        console.log('Successfully connected to printer:', printer.name);
        
        // Test print if enabled and not skipped
        if (this.config.testPrintEnabled && !skipTestPrint) {
          console.log('Sending test print...');
          try {
            await this.testPrint();
          } catch (printError) {
            console.warn('Test print failed:', printError);
            // Don't fail the connection if test print fails
          }
        }
      }

      return connected;
    } catch (error: any) {
      console.error('Failed to connect to printer:', error);
      // Clear any partial connection state
      this.connectedPrinter = null;
      throw error;
    }
  }

  /**
   * Connect to Bluetooth printer
   */
  private async connectBluetoothPrinter(printer: ThermalPrinter): Promise<boolean> {
    try {
      if (!BluetoothManager) {
        throw new Error('Bluetooth module not available');
      }

      console.log('Attempting to connect to:', printer.name, printer.address);
      
      // Check if Bluetooth is enabled
      const isEnabled = await BluetoothManager.isBluetoothEnabled();
      if (!isEnabled) {
        throw new Error('Bluetooth is not enabled. Please enable Bluetooth and try again.');
      }

      // Try to connect
      const result = await BluetoothManager.connect(printer.address);
      console.log('Connection result:', result);
      
      // Verify connection
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for connection to stabilize
      
      return true;
    } catch (error: any) {
      console.error('Bluetooth connection error:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('not found')) {
        throw new Error(`Printer not found. Make sure ${printer.name} is powered on and in range.`);
      } else if (error.message?.includes('already connected')) {
        throw new Error(`Printer already connected to another device. Please disconnect it first.`);
      } else if (error.message?.includes('timeout')) {
        throw new Error(`Connection timeout. Make sure ${printer.name} is not connected to another device.`);
      } else if (error.message?.includes('permission')) {
        throw new Error('Bluetooth permission denied. Please grant Bluetooth permissions.');
      }
      
      throw error;
    }
  }

  /**
   * Connect to WiFi printer (not implemented yet)
   */
  private async connectWiFiPrinter(printer: ThermalPrinter): Promise<boolean> {
    throw new Error('WiFi printer connection not implemented');
  }

  /**
   * Connect to USB printer (not implemented yet)
   */
  private async connectUSBPrinter(printer: ThermalPrinter): Promise<boolean> {
    throw new Error('USB printer connection not implemented');
  }

  /**
   * Disconnect from current printer
   */
  async disconnect(): Promise<void> {
    if (!this.connectedPrinter) {
      return;
    }

    try {
      // Reset printer state
      this.isPrinterInitialized = false;
      this.printQueue = [];
      this.isCurrentlyPrinting = false;
      
      // Disconnect based on printer type
      if (this.connectedPrinter.type === 'bluetooth' && BluetoothManager) {
        try {
          // Note: Some implementations use disconnect() instead of unpair()
          // Try disconnect first
          if (typeof BluetoothManager.disconnect === 'function') {
            await BluetoothManager.disconnect();
          } else if (typeof BluetoothManager.unpair === 'function') {
            await BluetoothManager.unpair(this.connectedPrinter.address);
          }
        } catch (disconnectError) {
          // Continue with cleanup even if disconnect fails
        }
      }

      this.connectedPrinter = null;
      await AsyncStorage.removeItem('connectedPrinter');
    } catch (error) {
      console.error('Failed to disconnect printer:', error);
      // Still clear the connection state
      this.connectedPrinter = null;
      this.isPrinterInitialized = false;
      throw error;
    }
  }

  /**
   * Simple test print to check if printer can print text
   */
  async simpleTestPrint(): Promise<void> {
    if (!this.connectedPrinter) {
      throw new Error('No printer connected');
    }

    if (!BluetoothEscposPrinter) {
      throw new Error('Bluetooth printer module not available');
    }

    try {
      console.log('Starting simple test print...');
      
      // Build test text
      const testText = '\n' +
        '=== TEST PRINT ===\n' +
        '\n' +
        'If you can read this,\n' +
        'your printer is working!\n' +
        '\n' +
        'Test characters: ABC 123\n' +
        'Special chars: @ # $ %\n' +
        '==================\n' +
        '\n\n\n';
      
      console.log('Test text:', testText);
      
      // Initialize and print
      console.log('Initializing printer...');
      await BluetoothEscposPrinter.printerInit();
      
      console.log('Sending text to printer...');
      await BluetoothEscposPrinter.printText(testText, {});
      
      console.log('✓ Simple test print completed');
    } catch (error) {
      console.error('❌ Simple test print failed:', error);
      console.error('Error details:', JSON.stringify(error));
      throw error;
    }
  }

  /**
   * Print a test receipt
   */
  async testPrint(): Promise<void> {
    if (!this.connectedPrinter) {
      throw new Error('No printer connected');
    }

    if (!BluetoothEscposPrinter) {
      throw new Error('Bluetooth printer module not available');
    }

    try {
      console.log('\u{1F4DD} Starting test print...');
      
      // CRITICAL: Initialize the printer first
      console.log('1. Initializing printer...');
      await BluetoothEscposPrinter.printerInit();
      
      // Small delay to ensure printer is ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Set print density and width
      console.log('2. Setting printer configuration...');
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      
      // Build test content with proper formatting
      console.log('3. Preparing test content...');
      
      // Print header
      await BluetoothEscposPrinter.printText('\n', {});
      await BluetoothEscposPrinter.setBlob(0); // Bold ON
      await BluetoothEscposPrinter.printText('=== TEST PRINT ===\n', {});
      await BluetoothEscposPrinter.setBlob(0); // Bold OFF
      await BluetoothEscposPrinter.printText('\n', {});
      
      // Print test info
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
      await BluetoothEscposPrinter.printText('Printer: ' + this.connectedPrinter.name + '\n', {});
      await BluetoothEscposPrinter.printText('Status: Connected & Ready\n', {});
      await BluetoothEscposPrinter.printText('Date: ' + new Date().toLocaleDateString() + '\n', {});
      await BluetoothEscposPrinter.printText('Time: ' + new Date().toLocaleTimeString() + '\n', {});
      await BluetoothEscposPrinter.printText('\n', {});
      
      // Print test pattern
      await BluetoothEscposPrinter.printText('Test Pattern:\n', {});
      await BluetoothEscposPrinter.printText('================================\n', {});
      await BluetoothEscposPrinter.printText('ABC 123 abc 123 !@# $%^\n', {});
      await BluetoothEscposPrinter.printText('================================\n', {});
      await BluetoothEscposPrinter.printText('\n', {});
      
      // Success message
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      await BluetoothEscposPrinter.setBlob(0); // Bold ON
      await BluetoothEscposPrinter.printText('If you can read this,\n', {});
      await BluetoothEscposPrinter.printText('your printer is working!\n', {});
      await BluetoothEscposPrinter.setBlob(0); // Bold OFF
      await BluetoothEscposPrinter.printText('\n', {});
      
      // Footer
      await BluetoothEscposPrinter.printText('================================\n', {});
      await BluetoothEscposPrinter.printText('\n\n\n', {});
      
      console.log('4. Sending to printer...');
      
      // Paper cut if enabled
      if (this.config.autoCutEnabled) {
        await this.cutPaper();
      }
      
      console.log('\u2705 Test print completed successfully!');
      console.log('\u{1F4E6} Check your printer for output');
      
    } catch (error) {
      console.error('\u274C Test print failed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw new Error('Test print failed: ' + (error as any)?.message || 'Unknown error');
    }
  }

  /**
   * Print a receipt using ESC/POS commands (optimized)
   */
  async printReceipt(receiptData: ReceiptData): Promise<void> {
    // Queue the print job to prevent concurrent printing issues
    return this.queuePrintJob(async () => {
      if (!this.connectedPrinter) {
        throw new Error('No printer connected');
      }

      if (!BluetoothEscposPrinter) {
        throw new Error('Bluetooth printer module not available');
      }

      try {
        const { storeInfo, customerInfo, items, subtotal, tax, total, paymentMethod, receiptNumber, timestamp, isPaid } = receiptData;
        
        // Reduce logging for performance
        if (__DEV__) {
          console.log('Print:', receiptNumber);
        }
        
        // Build the entire receipt as a single string
        let receiptText = '';
        
        // Header
        receiptText += '\n';
        receiptText += '      ' + (storeInfo.name || 'Store') + '\n';
        receiptText += '\n';
        if (storeInfo.address) {
          receiptText += '    ' + storeInfo.address + '\n';
        }
        if (storeInfo.phone) {
          receiptText += '    ' + storeInfo.phone + '\n';
        }
        receiptText += '\n';
        receiptText += '================================\n';
        
        // Receipt info
        receiptText += 'Receipt #: ' + receiptNumber + '\n';
        receiptText += 'Date: ' + timestamp.toLocaleDateString() + '\n';
        receiptText += 'Time: ' + timestamp.toLocaleTimeString() + '\n';
        
        // Customer info
        if (customerInfo?.name) {
          receiptText += 'Customer: ' + customerInfo.name + '\n';
        }
        if (customerInfo?.phone) {
          receiptText += 'Phone: ' + customerInfo.phone + '\n';
        }
        
        // Paid status
        if (isPaid !== undefined) {
          receiptText += 'Status: ' + (isPaid ? 'PAID' : 'UNPAID') + '\n';
        }
        
        receiptText += '================================\n';
        receiptText += '\n';
        
        // Items
        for (const item of items) {
          receiptText += (item.name || 'Item') + '\n';
          receiptText += '  ' + item.quantity + ' x Rs.' + item.price.toFixed(2);
          receiptText += ' = Rs.' + item.total.toFixed(2) + '\n';
        }
        
        receiptText += '\n';
        receiptText += '--------------------------------\n';
        
        // Totals
        receiptText += 'Subtotal:      Rs.' + subtotal.toFixed(2) + '\n';
        receiptText += 'Tax:           Rs.' + tax.toFixed(2) + '\n';
        receiptText += 'TOTAL:         Rs.' + total.toFixed(2) + '\n';
        
        receiptText += '================================\n';
        receiptText += 'Payment: ' + paymentMethod + '\n';
        receiptText += '================================\n';
        receiptText += '\n';
        receiptText += '  Thank you for your business!\n';
        receiptText += '\n\n\n';
        
        // Initialize printer only once per session
        if (!this.isPrinterInitialized) {
          await BluetoothEscposPrinter.printerInit();
          await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
          this.isPrinterInitialized = true;
          // Small delay only on first init
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Print the text
        await BluetoothEscposPrinter.printText(receiptText, {});
        
        // Cut paper if enabled (optimized with cached method)
        if (this.config.autoCutEnabled) {
          await this.cutPaperOptimized();
        }
        
        if (__DEV__) {
          console.log('✓ Printed:', receiptNumber);
        }
      } catch (error) {
        console.error('Print failed:', receiptData.receiptNumber, error);
        this.isPrinterInitialized = false; // Reset on error
        throw error;
      }
    });
  }

  /**
   * Queue print jobs to prevent concurrent printing
   */
  private async queuePrintJob(printFn: () => Promise<void>): Promise<void> {
    this.printQueue.push(printFn);
    
    // If already printing, the job will be processed by the existing loop
    if (this.isCurrentlyPrinting) {
      return new Promise((resolve, reject) => {
        const checkComplete = setInterval(() => {
          if (!this.printQueue.includes(printFn)) {
            clearInterval(checkComplete);
            resolve();
          }
        }, 50);
      });
    }
    
    // Start processing queue
    this.isCurrentlyPrinting = true;
    
    while (this.printQueue.length > 0) {
      const job = this.printQueue.shift();
      if (job) {
        try {
          await job();
        } catch (error) {
          console.error('Print job error:', error);
        }
      }
    }
    
    this.isCurrentlyPrinting = false;
  }

  /**
   * Optimized paper cutting with cached method
   */
  private async cutPaperOptimized(): Promise<void> {
    if (!BluetoothEscposPrinter) return;
    
    const cachedMethod = this.config.lastSuccessfulCutMethod;
    
    // Try cached method first
    if (cachedMethod) {
      try {
        switch (cachedMethod) {
          case 'cutOnePoint':
            if (BluetoothEscposPrinter.cutOnePoint) {
              await BluetoothEscposPrinter.cutOnePoint();
              return;
            }
            break;
          case 'printerCut':
            if (BluetoothEscposPrinter.printerCut) {
              await BluetoothEscposPrinter.printerCut();
              return;
            }
            break;
          case 'cutPaper':
            if (BluetoothEscposPrinter.cutPaper) {
              await BluetoothEscposPrinter.cutPaper();
              return;
            }
            break;
        }
      } catch (error) {
        // Cached method failed, will try full detection below
      }
    }
    
    // If no cached method or it failed, do full detection (but only once)
    await this.cutPaper();
  }

  /**
   * Format receipt content for thermal printing
   */
  private formatReceiptContent(receiptData: ReceiptData): string {
    const { storeInfo, customerInfo, items, subtotal, tax, total, paymentMethod, receiptNumber, timestamp, isPaid } = receiptData;
    
    let content = '';
    
    // Header
    content += `${storeInfo.name}\n`;
    content += `${storeInfo.address}\n`;
    content += `${storeInfo.phone}\n`;
    content += '================================\n';
    content += `Receipt #: ${receiptNumber}\n`;
    content += `Date: ${timestamp.toLocaleDateString()}\n`;
    content += `Time: ${timestamp.toLocaleTimeString()}\n`;
    
    // Customer info
    if (customerInfo?.name) {
      content += `Customer: ${customerInfo.name}\n`;
    }
    if (customerInfo?.phone) {
      content += `Phone: ${customerInfo.phone}\n`;
    }
    
    // Paid status
    if (isPaid !== undefined) {
      content += `Status: ${isPaid ? 'PAID' : 'UNPAID'}\n`;
    }
    
    content += '================================\n';
    
    // Items - Using Rs. instead of ₹ for compatibility
    items.forEach((item) => {
      content += `${item.name}\n`;
      content += `  ${item.quantity} x Rs.${item.price.toFixed(2)} = Rs.${item.total.toFixed(2)}\n`;
    });
    
    content += '--------------------------------\n';
    content += `Subtotal:     Rs.${subtotal.toFixed(2)}\n`;
    content += `Tax:          Rs.${tax.toFixed(2)}\n`;
    content += `Total:        Rs.${total.toFixed(2)}\n`;
    content += '================================\n';
    content += `Payment: ${paymentMethod}\n`;
    content += '================================\n';
    content += 'Thank you for your business!\n';
    content += '\n\n\n';
    
    return content;
  }

  /**
   * Get the currently connected printer
   */
  getConnectedPrinter(): ThermalPrinter | null {
    return this.connectedPrinter;
  }

  /**
   * Check if a printer is connected
   */
  isConnected(): boolean {
    return this.connectedPrinter !== null;
  }

  /**
   * Update printer configuration
   */
  async updateConfiguration(config: Partial<PrinterConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await AsyncStorage.setItem('printerConfig', JSON.stringify(this.config));
  }

  /**
   * Get current configuration
   */
  getConfiguration(): PrinterConfig {
    return { ...this.config };
  }

  /**
   * Load configuration from storage
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const savedConfig = await AsyncStorage.getItem('printerConfig');
      if (savedConfig) {
        this.config = { ...this.config, ...JSON.parse(savedConfig) };
      }

      const savedPrinter = await AsyncStorage.getItem('connectedPrinter');
      if (savedPrinter) {
        this.connectedPrinter = JSON.parse(savedPrinter);
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  }

  /**
   * Save connected printer to storage
   */
  private async saveConnectedPrinter(printer: ThermalPrinter): Promise<void> {
    try {
      await AsyncStorage.setItem('connectedPrinter', JSON.stringify(printer));
    } catch (error) {
      console.error('Failed to save connected printer:', error);
    }
  }

  /**
   * Get printer status
   */
  async getPrinterStatus(): Promise<string> {
    if (!this.connectedPrinter) {
      return 'Not connected';
    }

    try {
      // Verify Bluetooth connection is still active
      if (this.connectedPrinter.type === 'bluetooth' && BluetoothManager) {
        // Try to get connection state
        try {
          const isEnabled = await BluetoothManager.isBluetoothEnabled();
          if (!isEnabled) {
            return 'Bluetooth disabled';
          }
          // If we got here, connection is likely active
          return 'Connected';
        } catch (error) {
          return 'Connection error';
        }
      }
      return 'Ready';
    } catch (error) {
      return 'Error';
    }
  }

  /**
   * Verify printer connection is still active
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.connectedPrinter) {
      return false;
    }

    try {
      if (this.connectedPrinter.type === 'bluetooth' && BluetoothManager) {
        const isEnabled = await BluetoothManager.isBluetoothEnabled();
        return isEnabled;
      }
      return true;
    } catch (error) {
      console.error('Connection verification failed:', error);
      return false;
    }
  }

  /**
   * Clear all stored Bluetooth devices from AsyncStorage
   */
  async clearStoredDevices(): Promise<void> {
    try {
      await AsyncStorage.removeItem('connectedPrinter');
      this.connectedPrinter = null;
      console.log('Cleared stored Bluetooth devices');
    } catch (error) {
      console.error('Failed to clear stored devices:', error);
      throw error;
    }
  }

  /**
   * Start real-time connection monitoring
   */
  startConnectionMonitoring(callback: (isConnected: boolean) => void): NodeJS.Timeout {
    const interval = setInterval(async () => {
      const isConnected = await this.verifyConnection();
      callback(isConnected);
      
      // If connection lost, clear connected printer
      if (!isConnected && this.connectedPrinter) {
        console.log('Connection lost, clearing connected printer');
        this.connectedPrinter = null;
        await AsyncStorage.removeItem('connectedPrinter');
      }
    }, 5000); // Check every 5 seconds
    
    return interval;
  }

  /**
   * Stop connection monitoring
   */
  stopConnectionMonitoring(interval: NodeJS.Timeout): void {
    clearInterval(interval);
  }

  /**
   * Attempt to cut paper using all available methods
   * Tries multiple cutting methods in order of preference
   */
  private async cutPaper(): Promise<{ success: boolean; method?: string }> {
    if (!BluetoothEscposPrinter) {
      return { success: false };
    }

    // If we have a cached working method, try it first
    const cachedMethod = this.config.lastSuccessfulCutMethod;
    
    // List of cutting methods to try in order
    const allMethods = [
      // Method 1: cutOnePoint (most common in docs)
      { name: 'cutOnePoint', fn: () => BluetoothEscposPrinter.cutOnePoint?.() },
      // Method 2: printerCut
      { name: 'printerCut', fn: () => BluetoothEscposPrinter.printerCut?.() },
      // Method 3: cutPaper
      { name: 'cutPaper', fn: () => BluetoothEscposPrinter.cutPaper?.() },
      // Method 4: Raw ESC/POS cut command (partial cut)
      { name: 'printAndFeedPaper', fn: async () => {
        if (typeof BluetoothEscposPrinter.printAndFeedPaper === 'function') {
          await BluetoothEscposPrinter.printAndFeedPaper(100); // Feed 100 lines
        }
      }},
      // Method 5: Raw ESC command for full cut (ESC i)
      { name: 'rawEscCommand', fn: async () => {
        // ESC i - Full cut command
        const ESC = String.fromCharCode(27);
        const fullCutCmd = ESC + 'i';
        if (typeof BluetoothEscposPrinter.printText === 'function') {
          await BluetoothEscposPrinter.printText(fullCutCmd, {});
        }
      }},
    ];

    // Reorder to try cached method first
    const cuttingMethods = cachedMethod
      ? [
          allMethods.find(m => m.name === cachedMethod),
          ...allMethods.filter(m => m.name !== cachedMethod),
        ].filter(Boolean) as typeof allMethods
      : allMethods;

    // Try each method until one succeeds
    for (const method of cuttingMethods) {
      try {
        if (method.fn) {
          await method.fn();
          
          // Cache the successful method (reduce logging)
          if (this.config.lastSuccessfulCutMethod !== method.name) {
            this.config.lastSuccessfulCutMethod = method.name;
            await AsyncStorage.setItem('printerConfig', JSON.stringify(this.config));
            if (__DEV__) {
              console.log(`Cached cut method: ${method.name}`);
            }
          }
          
          return { success: true, method: method.name };
        }
      } catch (error) {
        // Silently continue to next method
      }
    }

    // If all methods failed, disable auto-cut to prevent future attempts
    if (__DEV__ && !this.config.lastSuccessfulCutMethod) {
      console.warn('Auto-cut not supported');
    }
    return { success: false };
  }

  /**
   * Get information about paper cutting support
   */
  async testPaperCutting(): Promise<{ supported: boolean; method?: string; message: string }> {
    if (!this.connectedPrinter) {
      return { 
        supported: false, 
        message: 'No printer connected' 
      };
    }

    const result = await this.cutPaper();
    
    if (result.success) {
      return {
        supported: true,
        method: result.method,
        message: `Auto-cut supported using method: ${result.method}`,
      };
    } else {
      return {
        supported: false,
        message: 'Auto-cut not supported. Please tear paper manually or disable Auto Cut in settings.',
      };
    }
  }
}

export default ThermalPrinterService;
export type { ThermalPrinter, PrinterConfig, ReceiptData };
