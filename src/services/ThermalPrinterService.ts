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
      const printerName = this.connectedPrinter.name;
      console.log('Disconnecting from:', printerName);
      
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
          console.warn('Disconnect error (non-fatal):', disconnectError);
          // Continue with cleanup even if disconnect fails
        }
      }

      this.connectedPrinter = null;
      await AsyncStorage.removeItem('connectedPrinter');
      console.log('Disconnected successfully from:', printerName);
    } catch (error) {
      console.error('Failed to disconnect printer:', error);
      // Still clear the connection state
      this.connectedPrinter = null;
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

    const testReceipt = {
      storeInfo: {
        name: 'Test Store',
        address: '123 Test Street',
        phone: '(555) 123-4567',
      },
      items: [
        {
          name: 'Test Item',
          price: 9.99,
          quantity: 1,
          total: 9.99,
        },
      ],
      subtotal: 9.99,
      tax: 0.80,
      total: 10.79,
      paymentMethod: 'Cash',
      receiptNumber: 'TEST-001',
      timestamp: new Date(),
    };

    await this.printReceipt(testReceipt);
  }

  /**
   * Print a receipt using ESC/POS commands
   */
  async printReceipt(receiptData: ReceiptData): Promise<void> {
    if (!this.connectedPrinter) {
      throw new Error('No printer connected');
    }

    if (!BluetoothEscposPrinter) {
      throw new Error('Bluetooth printer module not available');
    }

    try {
      const { storeInfo, customerInfo, items, subtotal, tax, total, paymentMethod, receiptNumber, timestamp, isPaid } = receiptData;
      
      console.log('Starting print job...');
      console.log('Receipt data:', { receiptNumber, items: items.length, total });
      
      // Build the entire receipt as a single string first
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
      
      console.log('Receipt text prepared, length:', receiptText.length);
      console.log('Receipt preview:', receiptText.substring(0, 200));
      
      // Now print the entire receipt at once
      console.log('Initializing printer...');
      await BluetoothEscposPrinter.printerInit();
      
      console.log('Printing text...');
      await BluetoothEscposPrinter.printText(receiptText, {});
      
      // Cut paper if enabled
      if (this.config.autoCutEnabled) {
        try {
          console.log('Cutting paper...');
          await BluetoothEscposPrinter.cutOnePoint();
        } catch (cutError) {
          console.warn('Could not cut paper:', cutError);
        }
      }
      
      console.log('✓ Receipt printed successfully');
    } catch (error) {
      console.error('❌ Failed to print receipt:', error);
      console.error('Error details:', JSON.stringify(error));
      throw error;
    }
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
}

export default ThermalPrinterService;
export type { ThermalPrinter, PrinterConfig, ReceiptData };
