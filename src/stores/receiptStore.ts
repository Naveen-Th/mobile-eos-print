import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { ItemDetails, ReceiptItem, Receipt } from '../types';
import { generateId, generateReceiptNumber } from '../utils';
import StockService from '../services/StockService';
import ReceiptFirebaseService from '../services/ReceiptFirebaseService';
import { getTaxRate } from '../services/TaxSettings';
import BalanceTrackingService from '../services/BalanceTrackingService';

// Form item interface for the receipt creation form
interface FormItem {
  id: string;
  selectedItemId: string;
  price: string;
  quantity: string;
  // New weight-based fields
  kg?: string;
  gms?: string;
  pricePerKg?: string;
  calculatedPrice?: string;
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
    kg: '0',
    gms: '0',
    pricePerKg: '',
    calculatedPrice: '0.00'
  }],
  customer: {
    customerName: '',
    isNewCustomer: false
  },
  balance: {
    oldBalance: 0,
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
            kg: '0',
            gms: '0',
            pricePerKg: '',
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
            
            // Calculate price when kg, gms, or pricePerKg changes
            if (field === 'kg' || field === 'gms' || field === 'pricePerKg') {
              const formItem = state.formItems[itemIndex];
              const kg = parseFloat(formItem.kg || '0');
              const gms = parseFloat(formItem.gms || '0');
              const pricePerKg = parseFloat(formItem.pricePerKg || '0');
              
              // Convert gms to kg and add to kg value
              const totalKg = kg + (gms / 1000);
              
              // Calculate total price
              const calculatedPrice = totalKg * pricePerKg;
              
              // Update the calculated price and main price fields
              state.formItems[itemIndex].calculatedPrice = calculatedPrice.toFixed(2);
              state.formItems[itemIndex].price = calculatedPrice.toFixed(2);
              
              // Set quantity based on total weight (for compatibility with existing logic)
              state.formItems[itemIndex].quantity = totalKg > 0 ? totalKg.toFixed(3) : '0';
            }
            
            // Clear stock error when updating
            if (field === 'quantity' || field === 'selectedItemId' || field === 'kg' || field === 'gms') {
              state.formItems[itemIndex].stockError = undefined;
            }
            
          }
        });
        
        // Auto-calculate totals whenever form items change (after state update)
        setTimeout(() => get().calculateTotals(), 0);

        // Trigger stock validation for weight and quantity changes
        if ((field === 'quantity' || field === 'kg' || field === 'gms') && value) {
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
            state.formItems[itemIndex].kg = '0';
            state.formItems[itemIndex].gms = '0';
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
            const kg = parseFloat(formItem.kg || '0');
            const gms = parseFloat(formItem.gms || '0');
            const totalWeight = kg + (gms / 1000);

            // Determine if this is a weight-based entry
            const isWeightBased = totalWeight > 0;

            // For weight-based items: store unit price (per Kg) and quantity as total weight.
            // For normal items: store unit price and integer quantity as provided.
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

          // Validate payment amount
          const totalDue = state.balance.oldBalance + totals.total;
          if (state.balance.amountPaid > totalDue) {
            console.warn(`⚠️ Payment (₹${state.balance.amountPaid}) exceeds total due (₹${totalDue}). Excess will be recorded as credit.`);
            // You could choose to:
            // 1. Auto-adjust: state.balance.amountPaid = totalDue;
            // 2. Show warning and continue (current behavior)
            // 3. Block and show error
          }
          
          // Log payment breakdown for transparency
          if (state.balance.amountPaid > 0) {
            const paymentBreakdown = {
              totalDue,
              amountPaid: state.balance.amountPaid,
              toOldBalance: Math.min(state.balance.amountPaid, state.balance.oldBalance),
              toCurrentReceipt: Math.max(0, state.balance.amountPaid - state.balance.oldBalance),
              excess: Math.max(0, state.balance.amountPaid - totalDue)
            };
            console.log('💰 Payment breakdown:', paymentBreakdown);
          }

          // Fetch business details from person_details collection
          let businessName = '';
          let businessPhone = '';
          
          if (state.customer.customerName?.trim()) {
            try {
              // Import PersonDetailsService here to avoid circular dependencies
              const { default: PersonDetailsService } = await import('../services/PersonDetailsService');
              const personDetails = await PersonDetailsService.getPersonDetails();
              const customerDetail = personDetails.find(person => 
                person.personName.toLowerCase() === state.customer.customerName?.toLowerCase().trim()
              );
              
              if (customerDetail) {
                businessName = customerDetail.businessName || '';
                businessPhone = customerDetail.phoneNumber || '';
              }
            } catch (error) {
              console.warn('Could not fetch business details from person_details:', error);
            }
          }

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
            businessName: businessName || undefined,
            businessPhone: businessPhone || undefined,
            footerMessage: 'Thank you for your business!',
            customerName: state.customer.customerName?.trim(),
            oldBalance: state.balance.oldBalance,
            isPaid: state.balance.isPaid,
            amountPaid: state.balance.amountPaid,
            newBalance: state.balance.newBalance,
          };
          
          console.log('Creating receipt with balance data:', {
            oldBalance: receipt.oldBalance,
            isPaid: receipt.isPaid,
            amountPaid: receipt.amountPaid,
            newBalance: receipt.newBalance
          });

          // Save receipt to Firebase
          const result = await ReceiptFirebaseService.saveReceipt(receipt, 'thermal');
          
          if (!result.success) {
            return { success: false, error: result.error || 'Failed to create receipt' };
          }

          // PAYMENT LOGIC FIX:
          // Only apply payment to old receipts if the payment EXCEEDS the current receipt total
          // This ensures that marking current receipt as "PAID" doesn't accidentally pay old receipts
          const paymentExcess = state.balance.amountPaid - totals.total;
          
          if (state.balance.oldBalance > 0 && paymentExcess > 0) {
            try {
              console.log(`🔄 Payment exceeds current receipt. Applying excess (₹${paymentExcess}) to old receipts...`);
              
              // Import Firebase services
              const { getFirebaseDb } = await import('../config/firebase');
              const { collection, query, where, getDocs, updateDoc, doc } = await import('firebase/firestore');
              
              const db = getFirebaseDb();
              if (db && state.customer.customerName) {
                // Get all unpaid receipts for this customer (excluding the current one)
                const receiptsRef = collection(db, 'receipts');
                const q = query(
                  receiptsRef,
                  where('customerName', '==', state.customer.customerName.trim())
                );
                const querySnapshot = await getDocs(q);
                
                // Calculate how much we can apply to old receipts (only the excess)
                const amountForOldReceipts = Math.min(paymentExcess, state.balance.oldBalance);
                let remainingPayment = amountForOldReceipts;
                
                console.log(`💰 Amount allocated for old receipts: ₹${amountForOldReceipts}`);
                
                // Process old receipts in order (oldest first)
                const oldReceipts: any[] = [];
                querySnapshot.forEach(docSnap => {
                  const receiptData = docSnap.data();
                  // Skip the current receipt we just created
                  if (docSnap.id !== receipt.id) {
                    const remainingBalance = receiptData.newBalance || (receiptData.oldBalance + receiptData.total - (receiptData.amountPaid || 0));
                    if (remainingBalance > 0) {
                      oldReceipts.push({ id: docSnap.id, ...receiptData, remainingBalance });
                    }
                  }
                });
                
                // Sort by date (oldest first)
                oldReceipts.sort((a, b) => {
                  const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                  const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                  return dateA.getTime() - dateB.getTime();
                });
                
                // Apply payment to old receipts
                for (const oldReceipt of oldReceipts) {
                  if (remainingPayment <= 0) break;
                  
                  const paymentToApply = Math.min(remainingPayment, oldReceipt.remainingBalance);
                  const newAmountPaid = (oldReceipt.amountPaid || 0) + paymentToApply;
                  const newBalance = oldReceipt.oldBalance + oldReceipt.total - newAmountPaid;
                  const isPaid = newBalance <= 0.01; // Allow small rounding
                  
                  console.log(`  ✅ Updating receipt ${oldReceipt.receiptNumber}: paying ₹${paymentToApply}, new balance: ₹${newBalance}`);
                  
                  // Update the receipt
                  const receiptRef = doc(db, 'receipts', oldReceipt.id);
                  await updateDoc(receiptRef, {
                    amountPaid: newAmountPaid,
                    newBalance: newBalance,
                    isPaid: isPaid,
                    updatedAt: new Date()
                  });
                  
                  remainingPayment -= paymentToApply;
                }
                
                console.log(`✅ Successfully updated ${oldReceipts.length} old receipt(s)`);
              }
            } catch (updateError) {
              console.error('Error updating old receipts:', updateError);
              // Don't fail receipt creation if old receipt update fails
            }
          } else if (paymentExcess > 0) {
            console.log(`ℹ️ No old balance to pay. Payment is only for current receipt.`);
          } else {
            console.log(`ℹ️ Payment (₹${state.balance.amountPaid}) covers only current receipt (₹${totals.total}). No excess to apply to old receipts.`);
          }

          // Sync customer balance in person_details from all receipts
          // This calculates total balance from all unpaid receipts (source of truth)
          try {
            const balanceSyncResult = await BalanceTrackingService.syncCustomerBalance(
              state.customer.customerName,
              businessName || undefined,
              businessPhone || undefined
            );
            
            if (!balanceSyncResult.success) {
              console.warn('Balance sync warning:', balanceSyncResult.error);
              // Don't fail the receipt creation if balance sync fails
              // The balance is still tracked in the receipt
            } else {
              console.log(`✅ Customer balance synced successfully in person_details: ₹${balanceSyncResult.totalBalance}`);
            }
          } catch (balanceError) {
            console.error('Error syncing customer balance:', balanceError);
            // Don't fail the receipt creation if balance sync fails
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
