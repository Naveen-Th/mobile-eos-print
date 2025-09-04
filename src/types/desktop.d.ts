// Electron API declarations
declare global {
  interface Window {
    electronAPI: {
      // Platform information
      getPlatform: () => Promise<string>;
      getAppVersion: () => Promise<string>;
      
      // App functionality
      checkForUpdates: () => Promise<{ hasUpdate: boolean }>;
      
      // Printer functionality
      getPrinters: () => Promise<any[]>;
      printReceipt: (receiptData: any) => Promise<{ success: boolean; error?: string }>;
      
      // Window controls
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      
      // Storage
      setStore: (key: string, value: any) => Promise<void>;
      getStore: (key: string) => Promise<any>;
      deleteStore: (key: string) => Promise<void>;
      
      // File operations
      openFile: (filters?: any[]) => Promise<string | null>;
      saveFile: (data: any, fileName: string) => Promise<string | null>;
      
      // Notifications
      showNotification: (title: string, body: string) => Promise<void>;
    };
    
    platformFeatures: {
      isElectron: boolean;
      canPrint: boolean;
      canAccessFileSystem: boolean;
      canShowNotifications: boolean;
      hasCamera: boolean;
      hasLocation: boolean;
      platform: string;
    };
    
    desktopAPI: {
      openExternal: (url: string) => Promise<void>;
      showItemInFolder: (path: string) => Promise<void>;
      isDev: boolean;
      appName: string;
      appVersion: string;
    };
  }
}

// Desktop-specific types
export interface DesktopPrinter {
  id: string;
  name: string;
  type: 'thermal' | 'standard';
  connection: 'usb' | 'network' | 'bluetooth';
  status: 'ready' | 'busy' | 'offline' | 'error';
  paperWidth: number;
  capabilities: {
    cutPaper: boolean;
    openDrawer: boolean;
    printBarcode: boolean;
    printQR: boolean;
  };
}

export interface DesktopReceiptData {
  id: string;
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
  timestamp: Date;
  customerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  storeInfo: {
    name: string;
    address: string;
    phone: string;
    taxId?: string;
  };
}

export interface DesktopAppConfig {
  theme: 'light' | 'dark' | 'system';
  autoStart: boolean;
  minimizeToTray: boolean;
  showNotifications: boolean;
  defaultPrinter?: string;
  receiptTemplate: string;
  language: string;
}

export interface DesktopStorageService {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
  remove: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

// Re-export shared types
export * from '../shared/types';

export {};