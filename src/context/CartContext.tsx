import React, {createContext, useContext, useReducer, ReactNode, useEffect} from 'react';
import {ReceiptItem, CartState, CompanySettings} from '../types';
import {calculateTotals, generateId, addMoneyAmounts} from '../utils/index';
import { getTaxRate } from '../services/TaxSettings';

interface CartContextType {
  state: CartState;
  addItem: (item: Omit<ReceiptItem, 'id'>) => void;
  updateItem: (id: string, updates: Partial<Omit<ReceiptItem, 'id'>>) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  updateQuantity: (id: string, quantity: number) => void;
  getTotalItems: () => number;
  updateCustomerInfo: (customerInfo: {
    customerName?: string;
    businessName?: string;
    businessPhone?: string;
  }) => void;
  applyGlobalDiscount: (discount: number, discountType: 'percentage' | 'fixed') => void;
  updateBalance: (oldBalance: number, amountPaid: number) => void;
}

type CartAction =
  | {type: 'ADD_RECEIPT'; payload: Omit<ReceiptItem, 'id'>}
  | {type: 'UPDATE_RECEIPT'; payload: {id: string; updates: Partial<Omit<ReceiptItem, 'id'>>}}
  | {type: 'REMOVE_RECEIPT'; payload: {id: string}}
  | {type: 'CLEAR_RECEIPT'}
  | {type: 'UPDATE_QUANTITY'; payload: {id: string; quantity: number}}
  | {type: 'UPDATE_CUSTOMER_INFO'; payload: {customerName?: string; businessName?: string; businessPhone?: string}}
  | {type: 'RECALCULATE_TOTALS'; payload: {taxRate: number; globalDiscount?: number; globalDiscountType?: 'percentage' | 'fixed'}}
  | {type: 'APPLY_GLOBAL_DISCOUNT'; payload: {discount: number; discountType: 'percentage' | 'fixed'}}
  | {type: 'UPDATE_BALANCE'; payload: {oldBalance: number; amountPaid: number}};

const CartContext = createContext<CartContextType | undefined>(undefined);

const cartReducer = (state: CartState, action: CartAction, taxRate: number = 8): CartState => {
  switch (action.type) {
    case 'ADD_RECEIPT': {
      const newItem: ReceiptItem = {
        ...action.payload,
        id: generateId(),
      };
      
      // Check if item with same name already exists
      const existingItemIndex = state.items.findIndex(
        item => item.name.toLowerCase() === newItem.name.toLowerCase()
      );
      
      let newItems: ReceiptItem[];
      if (existingItemIndex >= 0) {
        // Update quantity of existing item
        newItems = state.items.map((item, index) =>
          index === existingItemIndex
            ? {...item, quantity: item.quantity + newItem.quantity}
            : item
        );
      } else {
        // Add new item
        newItems = [...state.items, newItem];
      }
      
      const totals = calculateTotals(
        newItems, 
        taxRate,
        state.globalDiscount || 0,
        state.globalDiscountType || 'percentage'
      );
      return {
        ...state,
        items: newItems,
        ...totals,
      };
    }
    
    case 'UPDATE_RECEIPT': {
      const newItems = state.items.map(item =>
        item.id === action.payload.id
          ? {...item, ...action.payload.updates}
          : item
      );
      const totals = calculateTotals(
        newItems, 
        taxRate,
        state.globalDiscount || 0,
        state.globalDiscountType || 'percentage'
      );
      return {
        ...state,
        items: newItems,
        ...totals,
      };
    }
    
    case 'REMOVE_RECEIPT': {
      const newItems = state.items.filter(item => item.id !== action.payload.id);
      const totals = calculateTotals(
        newItems, 
        taxRate,
        state.globalDiscount || 0,
        state.globalDiscountType || 'percentage'
      );
      return {
        ...state,
        items: newItems,
        ...totals,
      };
    }
    
    case 'UPDATE_QUANTITY': {
      const {id, quantity} = action.payload;
      
      if (quantity <= 0) {
        // Remove item if quantity is 0 or less
        const newItems = state.items.filter(item => item.id !== id);
        const totals = calculateTotals(
          newItems,
          taxRate,
          state.globalDiscount || 0,
          state.globalDiscountType || 'percentage'
        );
        return {
          ...state,
          items: newItems,
          ...totals,
        };
      }
      
      const newItems = state.items.map(item =>
        item.id === id ? {...item, quantity} : item
      );
      const totals = calculateTotals(
        newItems,
        taxRate,
        state.globalDiscount || 0,
        state.globalDiscountType || 'percentage'
      );
      return {
        ...state,
        items: newItems,
        ...totals,
      };
    }
    
    case 'UPDATE_CUSTOMER_INFO': {
      return {
        ...state,
        ...action.payload,
      };
    }
    
    case 'APPLY_GLOBAL_DISCOUNT': {
      const {discount, discountType} = action.payload;
      const totals = calculateTotals(
        state.items,
        taxRate,
        discount,
        discountType
      );
      return {
        ...state,
        globalDiscount: discount,
        globalDiscountType: discountType,
        ...totals,
      };
    }
    
    case 'CLEAR_RECEIPT': {
      return {
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        discount: 0,
        customerName: undefined,
        businessName: undefined,
        businessPhone: undefined,
        globalDiscount: undefined,
        globalDiscountType: undefined,
      };
    }
    
    case 'RECALCULATE_TOTALS': {
      const {taxRate, globalDiscount, globalDiscountType} = action.payload;
      const totals = calculateTotals(
        state.items, 
        taxRate,
        globalDiscount !== undefined ? globalDiscount : state.globalDiscount || 0,
        globalDiscountType !== undefined ? globalDiscountType : state.globalDiscountType || 'percentage'
      );
      return {
        ...state,
        ...totals,
      };
    }
    
    case 'UPDATE_BALANCE': {
      const {oldBalance, amountPaid} = action.payload;
      return {
        ...state,
        oldBalance,
        amountPaid,
        newBalance: oldBalance - amountPaid,
      };
    }
    
    default:
      return state;
  }
};

const initialState: CartState = {
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  discount: 0,
  customerName: undefined,
  businessName: undefined,
  businessPhone: undefined,
  globalDiscount: undefined,
  globalDiscountType: undefined,
  oldBalance: undefined,
  amountPaid: undefined,
  newBalance: undefined,
};

interface CartProviderProps {
  children: ReactNode;
  companySettings?: CompanySettings;
}

export const CartProvider: React.FC<CartProviderProps> = ({
  children,
  companySettings,
}) => {
  const [dynamicTaxRate, setDynamicTaxRate] = React.useState(8);
  
  // Load tax rate from AsyncStorage on component mount
  React.useEffect(() => {
    const loadTaxRate = async () => {
      try {
        const rate = await getTaxRate();
        setDynamicTaxRate(rate);
      } catch (error) {
        console.error('Error loading tax rate in CartProvider:', error);
        setDynamicTaxRate(8); // fallback to default
      }
    };
    loadTaxRate();
  }, []);
  
  // Memoize tax rate to prevent unnecessary re-renders
  const taxRate = React.useMemo(() => 
    companySettings?.taxRate || dynamicTaxRate, 
    [companySettings?.taxRate, dynamicTaxRate]
  );
  
  const [state, dispatch] = useReducer(
    (state: CartState, action: CartAction) => cartReducer(state, action, taxRate),
    initialState
  );
  
  // Recalculate totals when tax rate changes
  React.useEffect(() => {
    if (state.items.length > 0) {
      dispatch({
        type: 'RECALCULATE_TOTALS',
        payload: {
          taxRate,
          globalDiscount: state.globalDiscount,
          globalDiscountType: state.globalDiscountType
        },
      });
    }
  }, [taxRate, state.items.length]);

  // Memoize callback functions to prevent child re-renders
  const addItem = React.useCallback((item: Omit<ReceiptItem, 'id'>) => {
    if (!item || typeof item !== 'object') {
      console.error('Invalid item data provided to addItem');
      return;
    }
    dispatch({type: 'ADD_RECEIPT', payload: item});
  }, []);

  const updateItem = React.useCallback((id: string, updates: Partial<Omit<ReceiptItem, 'id'>>) => {
    if (!id || typeof id !== 'string' || !updates) {
      console.error('Invalid parameters provided to updateItem');
      return;
    }
    dispatch({type: 'UPDATE_RECEIPT', payload: {id, updates}});
  }, []);

  const removeItem = React.useCallback((id: string) => {
    if (!id || typeof id !== 'string') {
      console.error('Invalid item ID provided to removeItem');
      return;
    }
    dispatch({type: 'REMOVE_RECEIPT', payload: {id}});
  }, []);

  const clearCart = React.useCallback(() => {
    dispatch({type: 'CLEAR_RECEIPT'});
  }, []);

  const updateQuantity = React.useCallback((id: string, quantity: number) => {
    if (!id || typeof quantity !== 'number' || quantity < 0) {
      console.error('Invalid parameters provided to updateQuantity');
      return;
    }
    dispatch({type: 'UPDATE_QUANTITY', payload: {id, quantity}});
  }, []);

  const updateCustomerInfo = React.useCallback((customerInfo: {
    customerName?: string;
    businessName?: string;
    businessPhone?: string;
  }) => {
    if (!customerInfo) {
      console.error('Invalid customer info provided');
      return;
    }
    dispatch({type: 'UPDATE_CUSTOMER_INFO', payload: customerInfo});
  }, []);

  const applyGlobalDiscount = React.useCallback((discount: number, discountType: 'percentage' | 'fixed') => {
    if (typeof discount !== 'number' || discount < 0) {
      console.error('Invalid discount value provided');
      return;
    }
    dispatch({type: 'APPLY_GLOBAL_DISCOUNT', payload: {discount, discountType}});
  }, []);

  const updateBalance = React.useCallback((oldBalance: number, amountPaid: number) => {
    if (typeof oldBalance !== 'number' || typeof amountPaid !== 'number') {
      console.error('Invalid balance values provided');
      return;
    }
    dispatch({type: 'UPDATE_BALANCE', payload: {oldBalance, amountPaid}});
  }, []);

  const getTotalItems = React.useCallback((): number => {
    return state.items.reduce((total, item) => {
      const quantity = typeof item.quantity === 'number' ? item.quantity : 0;
      return total + quantity;
    }, 0);
  }, [state.items]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: CartContextType = React.useMemo(() => ({
    state,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    updateQuantity,
    getTotalItems,
    updateCustomerInfo,
    applyGlobalDiscount,
    updateBalance,
  }), [state, addItem, updateItem, removeItem, clearCart, updateQuantity, getTotalItems, updateCustomerInfo, applyGlobalDiscount, updateBalance]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
