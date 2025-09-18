// Platform detection for web/mobile compatibility
const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isReactNative = !isWeb && typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

// Dynamic imports for platform-specific modules
let Platform: any;
let PermissionsAndroid: any;
let AsyncStorage: any;

if (isReactNative) {
  try {
    const RN = require('react-native');
    Platform = RN.Platform;
    PermissionsAndroid = RN.PermissionsAndroid;
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch (e) {
    console.warn('React Native modules not available:', e);
  }
} else if (isWeb) {
  // Web fallbacks
  Platform = { OS: 'web' };
  PermissionsAndroid = null;
  // Simple localStorage-based AsyncStorage fallback for web
  AsyncStorage = {
    setItem: (key: string, value: string) => {
      localStorage.setItem(key, value);
      return Promise.resolve();
    },
    getItem: (key: string) => {
      return Promise.resolve(localStorage.getItem(key));
    },
    removeItem: (key: string) => {
      localStorage.removeItem(key);
      return Promise.resolve();
    },
  };
}

// Import the thermal printer library
// Note: You'll need to install react-native-thermal-receipt-printer
// npm install react-native-thermal-receipt-printer

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
      // Web environment - assume permissions are handled by browser
      return true;
    }
    
    if (Platform?.OS === 'android' && PermissionsAndroid) {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        return Object.values(granted).every(
          (permission) => permission === PermissionsAndroid.RESULTS.GRANTED
        );
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
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        throw new Error('Required permissions not granted');
      }

      const printers: ThermalPrinter[] = [];

      // Scan for Bluetooth printers
      try {
        const bluetoothPrinters = await this.scanBluetoothPrinters();
        printers.push(...bluetoothPrinters);
      } catch (error) {
        console.warn('Bluetooth scan failed:', error);
      }

      // Scan for WiFi/Network printers
      try {
        const wifiPrinters = await this.scanWiFiPrinters();
        printers.push(...wifiPrinters);
      } catch (error) {
        console.warn('WiFi scan failed:', error);
      }

      // Check for USB printers (mainly for Android with OTG support)
      try {
        const usbPrinters = await this.scanUSBPrinters();
        printers.push(...usbPrinters);
      } catch (error) {
        console.warn('USB scan failed:', error);
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
    // This is a mock implementation
    // In a real app, you would use the actual thermal printer library
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockPrinters: ThermalPrinter[] = [
          {
            id: 'bt_epson_tm82',
            name: 'EPSON TM-T82II',
            address: '00:22:58:3C:4B:7A',
            type: 'bluetooth',
            status: 'disconnected',
          },
          {
            id: 'bt_star_tsp143',
            name: 'Star TSP143IIIU',
            address: '00:11:67:2A:8C:5F',
            type: 'bluetooth',
            status: 'disconnected',
          },
        ];
        resolve(mockPrinters);
      }, 2000);
    });

    /* 
    // Real implementation would look like this:
    const ThermalPrinterLib = require('react-native-thermal-receipt-printer');
    
    return new Promise((resolve, reject) => {
      ThermalPrinterLib.scanBluetoothPrinters(
        (printers: any[]) => {
          const thermalPrinters = printers.map((printer) => ({
            id: `bt_${printer.address.replace(/:/g, '_')}`,
            name: printer.name || 'Unknown Printer',
            address: printer.address,
            type: 'bluetooth' as const,
            status: 'disconnected' as const,
          }));
          resolve(thermalPrinters);
        },
        (error: any) => reject(error)
      );
    });
    */
  }

  /**
   * Scan for WiFi/Network thermal printers
   */
  private async scanWiFiPrinters(): Promise<ThermalPrinter[]> {
    // This is a mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockPrinters: ThermalPrinter[] = [
          {
            id: 'wifi_star_tsp100',
            name: 'Star TSP100IIIU',
            address: '192.168.1.100',
            type: 'wifi',
            status: 'disconnected',
          },
        ];
        resolve(mockPrinters);
      }, 1500);
    });
  }

  /**
   * Scan for USB thermal printers
   */
  private async scanUSBPrinters(): Promise<ThermalPrinter[]> {
    // This is a mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockPrinters: ThermalPrinter[] = [
          {
            id: 'usb_zebra_zd220',
            name: 'Zebra ZD220',
            address: 'USB001',
            type: 'usb',
            status: 'disconnected',
          },
        ];
        resolve(mockPrinters);
      }, 1000);
    });
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
    // Mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 2000);
    });

    /*
    // Real implementation:
    const ThermalPrinterLib = require('react-native-thermal-receipt-printer');
    
    return new Promise((resolve, reject) => {
      ThermalPrinterLib.connectBluetooth(
        printer.address,
        () => resolve(true),
        (error: any) => reject(error)
      );
    });
    */
  }

  /**
   * Connect to WiFi printer
   */
  private async connectWiFiPrinter(printer: ThermalPrinter): Promise<boolean> {
    // Mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 1500);
    });
  }

  /**
   * Connect to USB printer
   */
  private async connectUSBPrinter(printer: ThermalPrinter): Promise<boolean> {
    // Mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 1000);
    });
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
      switch (this.connectedPrinter.type) {
        case 'bluetooth':
          // ThermalPrinterLib.disconnectBluetooth();
          break;
        case 'wifi':
          // Disconnect WiFi printer
          break;
        case 'usb':
          // Disconnect USB printer
          break;
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
   * Print a receipt
   */
  async printReceipt(receiptData: ReceiptData): Promise<void> {
    if (!this.connectedPrinter) {
      throw new Error('No printer connected');
    }

    try {
      const receiptContent = this.formatReceiptContent(receiptData);
      
      // Mock printing - replace with actual thermal printer commands
      await new Promise((resolve) => {
        setTimeout(resolve, 1500);
      });

      console.log('Receipt printed successfully');

      /*
      // Real implementation would use the thermal printer library:
      const ThermalPrinterLib = require('react-native-thermal-receipt-printer');
      
      await ThermalPrinterLib.printText(receiptContent, {
        paperWidth: this.config.paperWidth,
        density: this.config.printDensity,
        autoCut: this.config.autoCutEnabled,
      });
      */
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
