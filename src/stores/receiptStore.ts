import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { ItemDetails, ReceiptItem, Receipt } from '../types';
import { generateId, generateReceiptNumber } from '../utils';
import StockService from '../services/StockService';
import ReceiptFirebaseService from '../services/ReceiptFirebaseService';

// Form item interface for the receipt creation form
interface FormItem {
  id: string;
  selectedItemId: string;
  price: string;
  quantity: string;
  // Temporary state for UI
  isValidating?: boolean;
  stockError?: string;
}

// Customer information interface
interface CustomerInfo {
  customerName: string;
  businessName: string;
  businessPhone: string;
  isNewCustomer: boolean;
  autoFilledFields: {
    businessName: boolean;
    businessPhone: boolean;
  };
}

// Receipt totals interface
interface ReceiptTotals {
  subtotal: number;
  tax: number;
  total: number;
}

// State interface for the receipt store
interface ReceiptState {
  // Form items
  formItems: FormItem[];
  
  // Customer information
  customer: CustomerInfo;
  
  // Available items from database
  availableItems: ItemDetails[];
  isLoadingItems: boolean;
  itemsError: string | null;
  
  // Processing states
  isProcessing: boolean;
  isValidating: boolean;
  
  // Errors
  errors: {
    customer: string;
    businessName: string;
    businessPhone: string;
    form: string;
  };
  
  // Receipt state
  currentReceipt: Receipt | null;
  receiptTotals: ReceiptTotals;
}

// Actions interface
interface ReceiptActions {
  // Form item actions
  addFormItem: () => void;
  removeFormItem: (id: string) => void;
  updateFormItem: (id: string, field: keyof FormItem, value: string) => void;
  selectItem: (formId: string, itemId: string) => Promise<void>;
  
  // Customer actions
  updateCustomerInfo: (info: Partial<CustomerInfo>) => void;
  setAutoFilledFields: (fields: Partial<CustomerInfo['autoFilledFields']>) => void;
  clearCustomerErrors: () => void;
  
  // Available items actions
  setAvailableItems: (items: ItemDetails[]) => void;
  setItemsLoading: (loading: boolean) => void;
  setItemsError: (error: string | null) => void;
  
  // Validation actions
  validateForm: () => Promise<boolean>;
  validateQuantity: (formId: string, quantity: number, itemId: string) => Promise<boolean>;
  
  // Receipt creation actions
  createReceipt: () => Promise<{ success: boolean; receipt?: Receipt; error?: string }>;
  calculateTotals: () => ReceiptTotals;
  
  // Utility actions
  clearForm: () => void;
  resetStore: () => void;
  setError: (field: keyof ReceiptState['errors'], message: string) => void;
  clearError: (field: keyof ReceiptState['errors']) => void;
  clearAllErrors: () => void;
}

// Initial state
const initialState: ReceiptState = {
  formItems: [{ id: '1', selectedItemId: '', price: '0.00', quantity: '1' }],
  customer: {
    customerName: '',
    businessName: '',
    businessPhone: '',
    isNewCustomer: false,
    autoFilledFields: {
      businessName: false,
      businessPhone: false
    }
  },
  availableItems: [],
  isLoadingItems: true,
  itemsError: null,
  isProcessing: false,
  isValidating: false,
  errors: {
    customer: '',
    businessName: '',
    businessPhone: '',
    form: ''
  },
  currentReceipt: null,
  receiptTotals: {
    subtotal: 0,
    tax: 0,
    total: 0
  }
};

// Create the store with Zustand + Immer + Devtools
export const useReceiptStore = create<ReceiptState & ReceiptActions>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // Form item actions
      addFormItem: () => {
        set((state) => {
          const newId = (state.formItems.length + 1).toString();
          state.formItems.push({
            id: newId,
            selectedItemId: '',
            price: '0.00',
            quantity: '1'
          });
        });
      },

      removeFormItem: (id: string) => {
        set((state) => {
          if (state.formItems.length > 1) {
            state.formItems = state.formItems.filter(item => item.id !== id);
          }
        });
      },

      updateFormItem: (id: string, field: keyof FormItem, value: string) => {
        set((state) => {
          const itemIndex = state.formItems.findIndex(item => item.id === id);
          if (itemIndex !== -1) {
            (state.formItems[itemIndex] as any)[field] = value;
            
            // Clear stock error when updating
            if (field === 'quantity' || field === 'selectedItemId') {
              state.formItems[itemIndex].stockError = undefined;
            }
          }
        });

        // Trigger quantity validation for quantity changes
        if (field === 'quantity' && value) {
          const state = get();
          const formItem = state.formItems.find(item => item.id === id);
          if (formItem && formItem.selectedItemId) {
            state.validateQuantity(id, parseInt(value), formItem.selectedItemId);
          }
        }
      },

      selectItem: async (formId: string, itemId: string) => {
        const state = get();
        const selectedItem = state.availableItems.find(item => item.id === itemId);
        
        if (!selectedItem) {
          console.error('Selected item not found:', itemId);
          return;
        }

        // Check stock availability
        if (selectedItem.stocks <= 0) {
          set((state) => {
            const itemIndex = state.formItems.findIndex(item => item.id === formId);
            if (itemIndex !== -1) {
              state.formItems[itemIndex].stockError = 'Out of stock';
            }
          });
          return;
        }

        set((state) => {
          const itemIndex = state.formItems.findIndex(item => item.id === formId);
          if (itemIndex !== -1) {
            state.formItems[itemIndex].selectedItemId = itemId;
            state.formItems[itemIndex].price = selectedItem.price.toFixed(2);
            state.formItems[itemIndex].stockError = undefined;
          }
        });

        // Validate current quantity against stock
        const formItem = state.formItems.find(item => item.id === formId);
        if (formItem) {
          await state.validateQuantity(formId, parseInt(formItem.quantity), itemId);
        }
      },

      // Customer actions
      updateCustomerInfo: (info: Partial<CustomerInfo>) => {
        set((state) => {
          Object.assign(state.customer, info);
          
          // Clear customer error when updating
          if (info.customerName !== undefined) {
            state.errors.customer = '';
          }
          if (info.businessName !== undefined) {
            state.errors.businessName = '';
          }
          if (info.businessPhone !== undefined) {
            state.errors.businessPhone = '';
          }
        });
      },

      setAutoFilledFields: (fields: Partial<CustomerInfo['autoFilledFields']>) => {
        set((state) => {
          Object.assign(state.customer.autoFilledFields, fields);
        });
      },

      clearCustomerErrors: () => {
        set((state) => {
          state.errors.customer = '';
          state.errors.businessName = '';
          state.errors.businessPhone = '';
        });
      },

      // Available items actions
      setAvailableItems: (items: ItemDetails[]) => {
        set((state) => {
          state.availableItems = items;
          state.isLoadingItems = false;
          state.itemsError = null;
        });
      },

      setItemsLoading: (loading: boolean) => {
        set((state) => {
          state.isLoadingItems = loading;
        });
      },

      setItemsError: (error: string | null) => {
        set((state) => {
          state.itemsError = error;
          state.isLoadingItems = false;
        });
      },

      // Validation actions
      validateQuantity: async (formId: string, quantity: number, itemId: string): Promise<boolean> => {
        const state = get();
        const selectedItem = state.availableItems.find(item => item.id === itemId);
        
        if (!selectedItem) {
          return false;
        }

        const currentStock = selectedItem.stocks || 0;
        const isValid = quantity <= currentStock && quantity > 0;

        set((state) => {
          const itemIndex = state.formItems.findIndex(item => item.id === formId);
          if (itemIndex !== -1) {
            if (!isValid) {
              state.formItems[itemIndex].stockError = 
                `Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`;
            } else {
              state.formItems[itemIndex].stockError = undefined;
            }
          }
        });

        return isValid;
      },

      validateForm: async (): Promise<boolean> => {
        const state = get();
        let isValid = true;

        set((state) => {
          state.isValidating = true;
          // Clear all errors
          state.errors.customer = '';
          state.errors.businessName = '';
          state.errors.businessPhone = '';
          state.errors.form = '';
        });

        // Validate customer name
        if (!state.customer.customerName.trim()) {
          set((state) => {
            state.errors.customer = 'Customer name is required';
          });
          isValid = false;
        }

        // Validate form items
        const validItems = state.formItems.filter(item => 
          item.selectedItemId && 
          parseFloat(item.price) > 0 && 
          parseInt(item.quantity) > 0
        );

        if (validItems.length === 0) {
          set((state) => {
            state.errors.form = 'Please add at least one valid item to the receipt';
          });
          isValid = false;
        }

        // Validate stock for all items
        for (const formItem of validItems) {
          const selectedItem = state.availableItems.find(item => item.id === formItem.selectedItemId);
          if (selectedItem) {
            const quantity = parseInt(formItem.quantity);
            const hasStock = await StockService.hasSufficientStock(selectedItem.id, quantity);
            
            if (!hasStock) {
              const currentStock = selectedItem.stocks || 0;
              set((state) => {
                const itemIndex = state.formItems.findIndex(item => item.id === formItem.id);
                if (itemIndex !== -1) {
                  state.formItems[itemIndex].stockError = 
                    `Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`;
                }
              });
              isValid = false;
            }
          }
        }

        set((state) => {
          state.isValidating = false;
        });

        return isValid;
      },

      // Receipt creation actions
      calculateTotals: (): ReceiptTotals => {
        const state = get();
        const validItems = state.formItems.filter(item => 
          item.selectedItemId && 
          parseFloat(item.price) > 0 && 
          parseInt(item.quantity) > 0
        );

        const subtotal = validItems.reduce((sum, item) => 
          sum + (parseFloat(item.price) * parseInt(item.quantity)), 0
        );
        
        const tax = subtotal * 0.1; // 10% tax rate
        const total = subtotal + tax;

        const totals = { subtotal, tax, total };

        set((state) => {
          state.receiptTotals = totals;
        });

        return totals;
      },

      createReceipt: async (): Promise<{ success: boolean; receipt?: Receipt; error?: string }> => {
        const state = get();
        
        set((state) => {
          state.isProcessing = true;
        });

        try {
          // Validate form first
          const isValid = await state.validateForm();
          if (!isValid) {
            return { success: false, error: 'Please fix validation errors before creating receipt' };
          }

          // Get valid items
          const validItems = state.formItems.filter(item => 
            item.selectedItemId && 
            parseFloat(item.price) > 0 && 
            parseInt(item.quantity) > 0
          );

          // Double-check stock availability before creating receipt
          const stockValidationPromises = validItems.map(async (formItem) => {
            const selectedItem = state.availableItems.find(item => item.id === formItem.selectedItemId);
            if (selectedItem) {
              const quantity = parseInt(formItem.quantity);
              const hasStock = await StockService.hasSufficientStock(selectedItem.id, quantity);
              return { formItem, selectedItem, hasStock, quantity };
            }
            return null;
          });

          const stockValidations = await Promise.all(stockValidationPromises);
          
          // Check for any stock issues
          for (const validation of stockValidations) {
            if (validation && !validation.hasStock) {
              const currentStock = await StockService.getItemStock(validation.selectedItem.id);
              return {
                success: false,
                error: `Insufficient stock for "${validation.selectedItem.item_name}". Available: ${currentStock}, Requested: ${validation.quantity}`
              };
            }
          }

          // Convert form items to receipt items
          const receiptItems: ReceiptItem[] = validItems.map(formItem => {
            const selectedItem = state.availableItems.find(item => item.id === formItem.selectedItemId);
            return {
              id: formItem.id,
              name: selectedItem?.item_name || '',
              price: parseFloat(formItem.price),
              quantity: parseInt(formItem.quantity),
            };
          });

          const totals = state.calculateTotals();

          // Create receipt object
          const receipt: Receipt = {
            id: generateId(),
            receiptNumber: generateReceiptNumber(),
            items: receiptItems,
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            date: new Date(),
            companyName: 'My Thermal Receipt Store',
            companyAddress: '123 Business St, City, State 12345',
            businessName: state.customer.businessName?.trim() || undefined,
            businessPhone: state.customer.businessPhone?.trim() || undefined,
            footerMessage: 'Thank you for your business!',
            customerName: state.customer.customerName?.trim(),
          };

          // Save receipt to Firebase
          const result = await ReceiptFirebaseService.saveReceipt(receipt, 'thermal');
          
          if (!result.success) {
            return { success: false, error: result.error || 'Failed to create receipt' };
          }

          // Update stock levels ONLY after successful receipt creation
          // This prevents double deduction
          const stockUpdatePromises = receiptItems.map(async (item) => {
            const selectedItem = state.availableItems.find(availableItem => 
              availableItem.item_name === item.name
            );
            
            if (selectedItem) {
              const stockResult = await StockService.subtractStock(
                selectedItem.id, 
                item.quantity, 
                'Receipt sale',
                receipt.id
              );
              
              if (!stockResult.success) {
                console.error(`Failed to update stock for ${item.name}:`, stockResult.error);
                // Log error but don't fail the entire operation since receipt is already created
              }
              
              return stockResult;
            }
            return { success: true, newStock: 0 };
          });

          const stockResults = await Promise.all(stockUpdatePromises);
          const failedStockUpdates = stockResults.filter(result => !result.success);

          set((state) => {
            state.currentReceipt = receipt;
          });

          if (failedStockUpdates.length > 0) {
            console.warn(`${failedStockUpdates.length} stock updates failed, but receipt was created successfully`);
          }

          return { success: true, receipt };

        } catch (error) {
          console.error('Error creating receipt:', error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error occurred' 
          };
        } finally {
          set((state) => {
            state.isProcessing = false;
          });
        }
      },

      // Utility actions
      clearForm: () => {
        set((state) => {
          state.formItems = [{ id: '1', selectedItemId: '', price: '0.00', quantity: '1' }];
          state.customer = {
            customerName: '',
            businessName: '',
            businessPhone: '',
            isNewCustomer: false,
            autoFilledFields: {
              businessName: false,
              businessPhone: false
            }
          };
          state.errors = {
            customer: '',
            businessName: '',
            businessPhone: '',
            form: ''
          };
          state.currentReceipt = null;
          state.receiptTotals = {
            subtotal: 0,
            tax: 0,
            total: 0
          };
        });
      },

      resetStore: () => {
        set(initialState);
      },

      setError: (field: keyof ReceiptState['errors'], message: string) => {
        set((state) => {
          state.errors[field] = message;
        });
      },

      clearError: (field: keyof ReceiptState['errors']) => {
        set((state) => {
          state.errors[field] = '';
        });
      },

      clearAllErrors: () => {
        set((state) => {
          state.errors = {
            customer: '',
            businessName: '',
            businessPhone: '',
            form: ''
          };
        });
      }
    })),
    {
      name: 'receipt-store',
      // Only enable devtools in development
      enabled: process.env.NODE_ENV === 'development'
    }
  )
);

// Export types for use in components
export type { FormItem, CustomerInfo, ReceiptTotals };
