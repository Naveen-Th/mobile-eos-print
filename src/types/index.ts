export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  // Optional fields that might be present
  description?: string;
  category?: string;
  sku?: string;
  tax?: number;
  discount?: number;
}

export interface ItemDetails {
  id: string;
  item_name: string;
  price: number;
  stocks: number;
  // Additional fields that might be present from Firebase
  description?: string;
  category?: string;
  sku?: string;
  unit?: string;
  minStock?: number;
  maxStock?: number;
  isActive?: boolean;
  createdAt?: Date | any;
  updatedAt?: Date | any;
}

export interface Receipt {
  id: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  date: Date;
  receiptNumber: string;
  companyName: string;
  companyAddress?: string;
  businessName?: string;
  businessPhone?: string;
  footerMessage?: string;
  customerName?: string;
  // Additional receipt properties
  paymentMethod?: 'cash' | 'card' | 'digital' | 'other';
  paymentReference?: string;
  notes?: string;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  roundingAdjustment?: number;
}

export interface CompanySettings {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  taxRate: number;
}

export interface CartState {
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  discount: number;
  customerName?: string;
  businessName?: string;
  businessPhone?: string;
  globalDiscount?: number;
  globalDiscountType?: 'percentage' | 'fixed';
}

export type PrintMethod = 'pdf' | 'thermal';

export interface StoredReceipt extends Receipt {
  printed: boolean;
  printedAt?: Date;
  pdfPath?: string;
}

// Firebase-specific receipt interface
export interface FirebaseReceiptData {
  id: string;
  receiptNumber: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  date: Date;
  companyName: string;
  companyAddress?: string;
  footerMessage?: string;
  customerName?: string;
  printMethod: PrintMethod;
  printed: boolean;
  printedAt?: Date;
  pdfPath?: string;
  status: 'draft' | 'printed' | 'exported';
  createdAt: Date;
  updatedAt: Date;
}

export type Theme = 'light' | 'dark' | 'system';

export interface AppError {
  code: string;
  message: string;
  details?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormState<T> {
  data: T;
  errors: ValidationError[];
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

// Loading states
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T = any> {
  status: LoadingState;
  data?: T;
  error?: string;
  lastUpdated?: Date;
}

// User-related types
export interface UserRole {
  id: string;
  name: 'admin' | 'cashier' | 'viewer';
  permissions: string[];
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole['name'];
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Stock-related types
export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: 'add' | 'subtract' | 'set' | 'adjustment';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  userId?: string;
  receiptId?: string;
  timestamp: Date;
}

// Print-related types
export interface PrintOptions {
  method: PrintMethod;
  device?: string;
  copies?: number;
  paperSize?: 'small' | 'medium' | 'large';
  includeLogo?: boolean;
  includeFooter?: boolean;
}

export interface PrintResult extends ServiceResult {
  filePath?: string;
  printJobId?: string;
  queuePosition?: number;
}

// Notification types
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  autoClose?: boolean;
  duration?: number;
  timestamp: Date;
}

// Settings types
export interface AppSettings {
  theme: Theme;
  autoBackup: boolean;
  backupInterval: number; // in hours
  defaultTaxRate: number;
  defaultCurrency: string;
  enableNotifications: boolean;
  enableSounds: boolean;
  printerSettings: {
    defaultPrinter?: string;
    defaultPaperSize: string;
    autoConnect: boolean;
  };
  receiptSettings: {
    includeTimestamp: boolean;
    includeLogo: boolean;
    includeFooter: boolean;
    footerText: string;
    autoIncrementReceiptNumber: boolean;
  };
}
