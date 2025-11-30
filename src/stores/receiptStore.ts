import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { ItemDetails, ReceiptItem, Receipt } from '../types';
import { generateId, generateReceiptNumber } from '../utils';
import StockService from '../services/data/StockService';
import ReceiptFirebaseService from '../services/business/ReceiptFirebaseService';
import { getTaxRate } from '../services/utilities/TaxSettings';
import BalanceTrackingService from '../services/business/BalanceTrackingService';
import { performanceTime, performanceTimeEnd, performanceLog } from '../utils/performanceTiming';
import { batchUpdateOldReceipts, queueBackgroundOperation } from '../utils/firebaseBatchOperations';
import PersonDetailsService from '../services/data/PersonDetailsService';

// Form item interface for the receipt creation form
interface FormItem {
  id: string;
  selectedItemId: string;
  price: string;
  quantity: string;
  // Weight-based fields (table format)
  qty_200g?: string;  // Quantity of 200g packs
  qty_100g?: string;  // Quantity of 100g packs
  qty_50g?: string;   // Quantity of 50g packs
  totalKg?: string;   // Calculated total kg
  pricePerKg?: string; // Price per kg
  calculatedPrice?: string; // Total amount
  // Temporary state for UI
  isValidating?: boolean;
  stockError?: string;
}

// Customer information interface
interface CustomerInfo {
  customerName: string;
  isNewCustomer: boolean;
}

// Balance information interface
interface BalanceInfo {
  oldBalance: number;
  isManualOldBalance: boolean; // true if oldBalance was manually entered, false if dynamically calculated
  isPaid: boolean;
  amountPaid: number;
  newBalance: number;
}

// Receipt totals interface
interface ReceiptTotals {
  subtotal: number;
  tax: number;
  total: number;
  taxRate?: number; // Add tax rate to totals for display
}

// State interface for the receipt store
interface ReceiptState {
  // Form items
  formItems: FormItem[];
  
  // Customer information
  customer: CustomerInfo;
  
  // Balance information
  balance: BalanceInfo;
  
  // Available items from database
  availableItems: ItemDetails[];
  isLoadingItems: boolean;
  itemsError: string | null;
  
  // Processing states
  isProcessing: boolean;
  isValidating: boolean;
  
  // Tax rate
  taxRate: number;
  
  // Errors
  errors: {
    customer: string;
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
  clearCustomerErrors: () => void;
  
  // Balance actions
  updateBalanceInfo: (info: Partial<BalanceInfo>) => void;
  calculateNewBalance: () => void;
  
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
  
  // Tax rate actions
  loadTaxRate: () => Promise<void>;
  
  // Utility actions
  clearForm: () => void;
  resetStore: () => void;
  setError: (field: keyof ReceiptState['errors'], message: string) => void;
  clearError: (field: keyof ReceiptState['errors']) => void;
  clearAllErrors: () => void;
}

// Initial state
const initialState: ReceiptState = {
  formItems: [{ 
    id: '1', 
    selectedItemId: '', 
    price: '0.00', 
    quantity: '1',
    qty_200g: '0',
    qty_100g: '0',
    qty_50g: '0',
    totalKg: '0',
    pricePerKg: '0',
    calculatedPrice: '0.00'
  }],
  customer: {
    customerName: '',
    isNewCustomer: false
  },
  balance: {
    oldBalance: 0,
    isManualOldBalance: false,
    isPaid: false,
    amountPaid: 0,
    newBalance: 0
  },
  availableItems: [],
  isLoadingItems: true,
  itemsError: null,
  isProcessing: false,
  isValidating: false,
  taxRate: 8, // Default tax rate
  errors: {
    customer: '',
    form: ''
  },
  currentReceipt: null,
  receiptTotals: {
    subtotal: 0,
    tax: 0,
    total: 0,
    taxRate: 8
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
            quantity: '1',
            qty_200g: '0',
            qty_100g: '0',
            qty_50g: '0',
            totalKg: '0',
            pricePerKg: '0',
            calculatedPrice: '0.00'
          });
        });
        
        // Auto-calculate totals after adding item
        setTimeout(() => get().calculateTotals(), 0);
      },

      removeFormItem: (id: string) => {
        set((state) => {
          if (state.formItems.length > 1) {
            state.formItems = state.formItems.filter(item => item.id !== id);
          }
        });
        
        // Auto-calculate totals after removing item
        setTimeout(() => get().calculateTotals(), 0);
      },

      updateFormItem: (id: string, field: keyof FormItem, value: string) => {
        set((state) => {
          const itemIndex = state.formItems.findIndex(item => item.id === id);
          if (itemIndex !== -1) {
            (state.formItems[itemIndex] as any)[field] = value;
            
            // Calculate total kg and price when weight quantities or pricePerKg changes
            if (field === 'qty_200g' || field === 'qty_100g' || field === 'qty_50g' || field === 'pricePerKg') {
              const formItem = state.formItems[itemIndex];
              const qty_200g = parseFloat(formItem.qty_200g || '0');
              const qty_100g = parseFloat(formItem.qty_100g || '0');
              const qty_50g = parseFloat(formItem.qty_50g || '0');
              const pricePerKg = parseFloat(formItem.pricePerKg || '0');
              
              // Formula: Total KG = Qty_200g + Qty_100g + Qty_50g
              // Each quantity unit = 1 kg (200g×1 = 1kg, 100g×1 = 1kg, etc.)
              const totalKg = qty_200g + qty_100g + qty_50g;
              
              // Calculate total price: Total KG × Price Per KG
              const calculatedPrice = totalKg * pricePerKg;
              
              // Update calculated fields
              // Remove trailing zeros from totalKg display
              state.formItems[itemIndex].totalKg = totalKg.toString().replace(/\.?0+$/, '');
              state.formItems[itemIndex].calculatedPrice = calculatedPrice.toFixed(2);
              state.formItems[itemIndex].price = calculatedPrice.toFixed(2);
              
              // Set quantity based on total weight (for compatibility with existing logic)
              state.formItems[itemIndex].quantity = totalKg > 0 ? totalKg.toFixed(3) : '0';
            }
            
            // Clear stock error when updating
            if (field === 'quantity' || field === 'selectedItemId' || field === 'qty_200g' || field === 'qty_100g' || field === 'qty_50g') {
              state.formItems[itemIndex].stockError = undefined;
            }
            
          }
        });
        
        // Auto-calculate totals whenever form items change (after state update)
        setTimeout(() => get().calculateTotals(), 0);

        // Trigger stock validation for weight and quantity changes
        if ((field === 'quantity' || field === 'qty_200g' || field === 'qty_100g' || field === 'qty_50g') && value) {
          const state = get();
          const formItem = state.formItems.find(item => item.id === id);
          if (formItem && formItem.selectedItemId) {
            // For weight-based validation, use the calculated quantity (total weight)
            const quantityToValidate = field === 'quantity' ? parseInt(value) : parseFloat(formItem.quantity);
            if (quantityToValidate > 0) {
              state.validateQuantity(id, quantityToValidate, formItem.selectedItemId);
            }
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
            // Auto-populate pricePerKg from Firebase (the price field contains per kg price)
            state.formItems[itemIndex].pricePerKg = selectedItem.price.toFixed(2);
            // Reset weight fields when new item is selected
            state.formItems[itemIndex].qty_200g = '0';
            state.formItems[itemIndex].qty_100g = '0';
            state.formItems[itemIndex].qty_50g = '0';
            state.formItems[itemIndex].totalKg = '0';
            state.formItems[itemIndex].calculatedPrice = '0.00';
            state.formItems[itemIndex].stockError = undefined;
          }
        });
        
        // Auto-calculate totals after selecting item
        setTimeout(() => get().calculateTotals(), 0);

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
        });
      },

      clearCustomerErrors: () => {
        set((state) => {
          state.errors.customer = '';
        });
      },
      
      // Balance actions
      updateBalanceInfo: (info: Partial<BalanceInfo>) => {
        set((state) => {
          Object.assign(state.balance, info);
        });
        
        // Auto-calculate new balance whenever balance info changes
        setTimeout(() => get().calculateNewBalance(), 0);
      },
      
      calculateNewBalance: () => {
        const state = get();
        const { oldBalance, amountPaid } = state.balance;
        const { total } = state.receiptTotals;
        
        // Calculate new balance: oldBalance + current receipt total - amount paid
        // Payment priority: first covers old balance, then current receipt
        const newBalance = oldBalance + total - amountPaid;
        
        // A receipt is only "paid" when the new balance is 0 or negative (fully settled)
        const isPaid = newBalance <= 0.01; // Allow small rounding errors
        
        set((state) => {
          state.balance.newBalance = Math.max(0, newBalance); // Never negative
          state.balance.isPaid = isPaid;
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
          parseFloat(item.calculatedPrice || item.price || '0') > 0
        );

        const subtotal = validItems.reduce((sum, item) => {
          // Use calculatedPrice if available (for weight-based items), otherwise use price
          const itemPrice = parseFloat(item.calculatedPrice || item.price || '0');
          return sum + itemPrice;
        }, 0);
        
        const tax = subtotal * (state.taxRate / 100); // Use dynamic tax rate
        const total = subtotal + tax;

        const totals = { subtotal, tax, total, taxRate: state.taxRate };

        set((state) => {
          state.receiptTotals = totals;
        });
        
        // Recalculate new balance when totals change
        setTimeout(() => get().calculateNewBalance(), 0);

        return totals;
      },

      createReceipt: async (): Promise<{ success: boolean; receipt?: Receipt; error?: string }> => {
        const state = get();
        
        set((state) => {
          state.isProcessing = true;
        });

        try {
          performanceTime('⏱️ Receipt Creation Total Time');
          
          // Quick validation (customer name only, no stock check)
          if (!state.customer.customerName?.trim()) {
            return { success: false, error: 'Customer name is required' };
          }

          // Get valid items
          const validItems = state.formItems.filter(item => 
            item.selectedItemId && 
            parseFloat(item.price) > 0 && 
            parseInt(item.quantity) > 0
          );
          
          if (validItems.length === 0) {
            return { success: false, error: 'Please add at least one valid item' };
          }

          // OPTIMIZATION 1: Use cached stock data + business details fetch in parallel
          // No Firebase calls needed for stock - we already have it in availableItems!
          performanceTime('⏱️ Parallel Operations (Stock + Business Details)');
          const [stockValidations, businessDetails] = await Promise.all([
            // Stock validation - use cached data (no Firebase calls!)
            Promise.resolve(validItems.map((formItem) => {
              const selectedItem = state.availableItems.find(item => item.id === formItem.selectedItemId);
              if (selectedItem) {
                const quantity = parseInt(formItem.quantity);
                const currentStock = selectedItem.stocks || 0;
                const hasStock = currentStock >= quantity;
                return { formItem, selectedItem, hasStock, quantity };
              }
              return null;
            })),
            // Business details fetch with timeout to prevent delays
            Promise.race([
              (async () => {
                if (!state.customer.customerName?.trim()) return { businessName: '', businessPhone: '' };
                try {
                  const personDetails = await PersonDetailsService.getPersonDetails();
                  const customerDetail = personDetails.find(person => 
                    person.personName.toLowerCase() === state.customer.customerName?.toLowerCase().trim()
                  );
                  return {
                    businessName: customerDetail?.businessName || '',
                    businessPhone: customerDetail?.phoneNumber || ''
                  };
                } catch (error) {
                  return { businessName: '', businessPhone: '' };
                }
              })(),
              // Timeout after 1 second - don't block receipt creation for business details
              new Promise<{ businessName: string; businessPhone: string }>((resolve) => 
                setTimeout(() => resolve({ businessName: '', businessPhone: '' }), 1000)
              )
            ])
          ]);
          performanceTimeEnd('⏱️ Parallel Operations (Stock + Business Details)');
          
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
            const totalWeight = parseFloat(formItem.totalKg || '0');
            const isWeightBased = totalWeight > 0;
            const unitPrice = isWeightBased
              ? parseFloat(formItem.pricePerKg || formItem.price || '0')
              : parseFloat(formItem.price || '0');
            const quantity = isWeightBased
              ? totalWeight
              : (parseInt(formItem.quantity || '1') || 1);
            
            return {
              id: formItem.id,
              name: selectedItem?.item_name || '',
              price: unitPrice,
              quantity,
            };
          });

          const totals = state.calculateTotals();

          // Removed verbose payment breakdown logging for performance

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
            ...(businessDetails.businessName && { businessName: businessDetails.businessName }),
            ...(businessDetails.businessPhone && { businessPhone: businessDetails.businessPhone }),
            footerMessage: 'Thank you for your business!',
            customerName: state.customer.customerName?.trim(),
            oldBalance: state.balance.oldBalance,
            isManualOldBalance: state.balance.isManualOldBalance,
            isPaid: state.balance.isPaid,
            amountPaid: state.balance.amountPaid,
            newBalance: state.balance.newBalance,
          };
          
          performanceLog(`Creating receipt: ${receipt.receiptNumber}`);

          // OPTIMIZATION 2: Save receipt to Firebase (critical path)
          performanceTime('⏱️ Firebase Save Receipt');
          const result = await ReceiptFirebaseService.saveReceipt(receipt, 'thermal');
          performanceTimeEnd('⏱️ Firebase Save Receipt');
          
          if (!result.success) {
            return { success: false, error: result.error || 'Failed to create receipt' };
          }

          // CRITICAL: Invalidate balance cache immediately after receipt creation
          // This ensures the next receipt fetch gets the updated balance including this receipt
          BalanceTrackingService.invalidateCache(state.customer.customerName);
          performanceLog(`✅ Balance cache invalidated for "${state.customer.customerName}"`);

          // OPTIMIZATION 3: Defer old receipt updates to background (non-blocking)
          // User sees success immediately, updates happen in background
          const paymentExcess = state.balance.amountPaid - totals.total;
          
          if (state.balance.oldBalance > 0 && paymentExcess > 0) {
            // Defer old receipt updates to background
            queueBackgroundOperation(async () => {
              performanceLog(`🔄 Background: Applying payment excess (₹${paymentExcess}) to old receipts...`);
              const amountForOldReceipts = Math.min(paymentExcess, state.balance.oldBalance);
              
              const batchResult = await batchUpdateOldReceipts(
                state.customer.customerName,
                receipt.id,
                amountForOldReceipts,
                state.balance.oldBalance
              );
              
              if (batchResult.success) {
                performanceLog(`✅ Background: Updated ${batchResult.updatedCount} old receipt(s)`);
              } else {
                console.error('❌ Background: Failed to update old receipts:', batchResult.error);
              }
            }, 'Update Old Receipts');
          }

          // OPTIMIZATION 4: Defer balance sync to background (non-blocking)
          queueBackgroundOperation(async () => {
            performanceLog('🔄 Background: Syncing customer balance...');
            const balanceSyncResult = await BalanceTrackingService.syncCustomerBalance(
              state.customer.customerName,
              businessDetails.businessName || undefined,
              businessDetails.businessPhone || undefined
            );
            
            if (balanceSyncResult.success) {
              performanceLog(`✅ Background: Balance synced: ₹${balanceSyncResult.totalBalance}`);
            } else {
              console.warn('⚠️ Background: Balance sync warning:', balanceSyncResult.error);
            }
          }, 'Sync Customer Balance');
          
          performanceTimeEnd('✅ Receipt Creation Total Time');
          performanceLog('✅ Receipt created successfully (background operations queued)');

          // Set current receipt immediately
          set((state) => {
            state.currentReceipt = receipt;
          });

          // OPTIMIZATION 5: Move stock updates to background (non-blocking)
          // Stock updates don't need to block user success feedback
          queueBackgroundOperation(async () => {
            performanceLog('🔄 Background: Updating stock levels...');
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
                }
                
                return stockResult;
              }
              return { success: true, newStock: 0 };
            });

            const stockResults = await Promise.all(stockUpdatePromises);
            const failedStockUpdates = stockResults.filter(result => !result.success);
            
            if (failedStockUpdates.length > 0) {
              console.error(`❌ Background: ${failedStockUpdates.length} stock updates failed`);
            } else {
              performanceLog(`✅ Background: Updated stock for ${receiptItems.length} items`);
            }
          }, 'Update Stock Levels');

          // Return success immediately - all non-critical operations in background
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

      // Tax rate actions
      loadTaxRate: async () => {
        try {
          const rate = await getTaxRate();
          set((state) => {
            state.taxRate = rate;
          });
          // Recalculate totals with new tax rate
          get().calculateTotals();
        } catch (error) {
          console.error('Error loading tax rate:', error);
          // Keep default tax rate on error
        }
      },
      
      // Utility actions
      clearForm: () => {
        set((state) => {
          state.formItems = [{ 
            id: '1', 
            selectedItemId: '', 
            price: '0.00', 
            quantity: '1',
            kg: '0',
            gms: '0',
            pricePerKg: '',
            calculatedPrice: '0.00'
          }];
          state.customer = {
            customerName: '',
            isNewCustomer: false
          };
          state.balance = {
            oldBalance: 0,
            isManualOldBalance: false,
            isPaid: false,
            amountPaid: 0,
            newBalance: 0
          };
          state.errors = {
            customer: '',
            form: ''
          };
          state.currentReceipt = null;
          state.receiptTotals = {
            subtotal: 0,
            tax: 0,
            total: 0,
            taxRate: state.taxRate
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
export type { FormItem, CustomerInfo, BalanceInfo, ReceiptTotals };
