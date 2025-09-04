export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ItemDetails {
  id: string;
  item_name: string;
  price: number;
  stocks: number;
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
  customerName?: string;
  businessName?: string;
  businessPhone?: string;
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

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormState<T> {
  data: T;
  errors: ValidationError[];
  isValid: boolean;
  isSubmitting: boolean;
}
