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
  async connectToPrinter(printer: ThermalPrinter): Promise<boolean> {
    try {
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
        
        // Test print if enabled
        if (this.config.testPrintEnabled) {
          await this.testPrint();
        }
      }

      return connected;
    } catch (error) {
      console.error('Failed to connect to printer:', error);
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
      await BluetoothManager.connect(printer.address);
      return true;
    } catch (error) {
      console.error('Bluetooth connection error:', error);
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
      // Disconnect based on printer type
      if (this.connectedPrinter.type === 'bluetooth' && BluetoothManager) {
        await BluetoothManager.unpair(this.connectedPrinter.address);
      }

      this.connectedPrinter = null;
      await AsyncStorage.removeItem('connectedPrinter');
    } catch (error) {
      console.error('Failed to disconnect printer:', error);
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
      const { storeInfo, items, subtotal, tax, total, paymentMethod, receiptNumber, timestamp } = receiptData;
      
      // Initialize printer
      await BluetoothEscposPrinter.printerInit();
      
      // Set alignment to center
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      
      // Print store name (large, bold)
      await BluetoothEscposPrinter.printText(storeInfo.name + '\n', {
        widthtimes: 2,
        heigthtimes: 2,
      });
      
      // Print store details
      await BluetoothEscposPrinter.setBlob(0);
      await BluetoothEscposPrinter.printText(storeInfo.address + '\n', {});
      await BluetoothEscposPrinter.printText(storeInfo.phone + '\n', {});
      
      // Print separator
      await BluetoothEscposPrinter.printText('================================\n', {});
      
      // Print receipt info
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
      await BluetoothEscposPrinter.printText(`Receipt #: ${receiptNumber}\n`, {});
      await BluetoothEscposPrinter.printText(
        `Date: ${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}\n`,
        {}
      );
      
      await BluetoothEscposPrinter.printText('================================\n', {});
      
      // Print items
      for (const item of items) {
        // Item name
        await BluetoothEscposPrinter.printText(item.name + '\n', {});
        
        // Item details (quantity, price, total)
        const itemLine = `  ${item.quantity} x $${item.price.toFixed(2)} = $${item.total.toFixed(2)}`;
        await BluetoothEscposPrinter.printText(itemLine + '\n', {});
      }
      
      // Print separator
      await BluetoothEscposPrinter.printText('--------------------------------\n', {});
      
      // Print totals
      await BluetoothEscposPrinter.printColumn(
        [18, 10],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['Subtotal:', `$${subtotal.toFixed(2)}`],
        {}
      );
      
      await BluetoothEscposPrinter.printColumn(
        [18, 10],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['Tax:', `$${tax.toFixed(2)}`],
        {}
      );
      
      await BluetoothEscposPrinter.printColumn(
        [18, 10],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['Total:', `$${total.toFixed(2)}`],
        { widthtimes: 1, heigthtimes: 1 }
      );
      
      await BluetoothEscposPrinter.printText('================================\n', {});
      
      // Payment method
      await BluetoothEscposPrinter.printText(`Payment: ${paymentMethod}\n`, {});
      
      await BluetoothEscposPrinter.printText('================================\n', {});
      
      // Thank you message
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      await BluetoothEscposPrinter.printText('Thank you for your business!\n', {});
      
      // Feed paper and cut
      await BluetoothEscposPrinter.printText('\n\n\n', {});
      
      if (this.config.autoCutEnabled) {
        await BluetoothEscposPrinter.cutOnePoint();
      }
      
      console.log('Receipt printed successfully');
    } catch (error) {
      console.error('Failed to print receipt:', error);
      throw error;
    }
  }

  /**
   * Format receipt content for thermal printing
   */
  private formatReceiptContent(receiptData: ReceiptData): string {
    const { storeInfo, items, subtotal, tax, total, paymentMethod, receiptNumber, timestamp } = receiptData;
    
    let content = '';
    
    // Header
    content += `${storeInfo.name}\n`;
    content += `${storeInfo.address}\n`;
    content += `${storeInfo.phone}\n`;
    content += '================================\n';
    content += `Receipt #: ${receiptNumber}\n`;
    content += `Date: ${timestamp.toLocaleDateString()}\n`;
    content += `Time: ${timestamp.toLocaleTimeString()}\n`;
    content += '================================\n';
    
    // Items
    items.forEach((item) => {
      content += `${item.name}\n`;
      content += `  ${item.quantity} x $${item.price.toFixed(2)} = $${item.total.toFixed(2)}\n`;
    });
    
    content += '--------------------------------\n';
    content += `Subtotal:     $${subtotal.toFixed(2)}\n`;
    content += `Tax:          $${tax.toFixed(2)}\n`;
    content += `Total:        $${total.toFixed(2)}\n`;
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
      // In a real implementation, you would check the actual printer status
      // For now, return a mock status
      return 'Ready';
    } catch (error) {
      return 'Error';
    }
  }
}

export default ThermalPrinterService;
export type { ThermalPrinter, PrinterConfig, ReceiptData };
