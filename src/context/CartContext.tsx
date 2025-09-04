import React, {createContext, useContext, useReducer, ReactNode} from 'react';
import {ReceiptItem, CartState, CompanySettings} from '../types';
import {calculateTotals, generateId} from '../utils/index';

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
}

type CartAction =
  | {type: 'ADD_RECEIPT'; payload: Omit<ReceiptItem, 'id'>}
  | {type: 'UPDATE_RECEIPT'; payload: {id: string; updates: Partial<Omit<ReceiptItem, 'id'>>}}
  | {type: 'REMOVE_RECEIPT'; payload: {id: string}}
  | {type: 'CLEAR_RECEIPT'}
  | {type: 'UPDATE_QUANTITY'; payload: {id: string; quantity: number}}
  | {type: 'UPDATE_CUSTOMER_INFO'; payload: {customerName?: string; businessName?: string; businessPhone?: string}}
  | {type: 'RECALCULATE_TOTALS'; payload: {taxRate: number}};

const CartContext = createContext<CartContextType | undefined>(undefined);

const cartReducer = (state: CartState, action: CartAction): CartState => {
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
      
      const totals = calculateTotals(newItems);
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
      const totals = calculateTotals(newItems);
      return {
        ...state,
        items: newItems,
        ...totals,
      };
    }
    
    case 'REMOVE_RECEIPT': {
      const newItems = state.items.filter(item => item.id !== action.payload.id);
      const totals = calculateTotals(newItems);
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
        const totals = calculateTotals(newItems);
        return {
          ...state,
          items: newItems,
          ...totals,
        };
      }
      
      const newItems = state.items.map(item =>
        item.id === id ? {...item, quantity} : item
      );
      const totals = calculateTotals(newItems);
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
    
    case 'CLEAR_RECEIPT': {
      return {
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        customerName: undefined,
        businessName: undefined,
        businessPhone: undefined,
      };
    }
    
    case 'RECALCULATE_TOTALS': {
      const totals = calculateTotals(state.items, action.payload.taxRate);
      return {
        ...state,
        ...totals,
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
  customerName: undefined,
  businessName: undefined,
  businessPhone: undefined,
};

interface CartProviderProps {
  children: ReactNode;
  companySettings?: CompanySettings;
}

export const CartProvider: React.FC<CartProviderProps> = ({
  children,
  companySettings,
}) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  
  // Recalculate totals when tax rate changes
  React.useEffect(() => {
    if (companySettings?.taxRate !== undefined && state.items.length > 0) {
      dispatch({
        type: 'RECALCULATE_TOTALS',
        payload: {taxRate: companySettings.taxRate},
      });
    }
  }, [companySettings?.taxRate, state.items.length]);

  const addItem = (item: Omit<ReceiptItem, 'id'>) => {
    dispatch({type: 'ADD_RECEIPT', payload: item});
  };

  const updateItem = (id: string, updates: Partial<Omit<ReceiptItem, 'id'>>) => {
    dispatch({type: 'UPDATE_RECEIPT', payload: {id, updates}});
  };

  const removeItem = (id: string) => {
    dispatch({type: 'REMOVE_RECEIPT', payload: {id}});
  };

  const clearCart = () => {
    dispatch({type: 'CLEAR_RECEIPT'});
  };

  const updateQuantity = (id: string, quantity: number) => {
    dispatch({type: 'UPDATE_QUANTITY', payload: {id, quantity}});
  };

  const updateCustomerInfo = (customerInfo: {
    customerName?: string;
    businessName?: string;
    businessPhone?: string;
  }) => {
    dispatch({type: 'UPDATE_CUSTOMER_INFO', payload: customerInfo});
  };

  const getTotalItems = (): number => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  };

  const contextValue: CartContextType = {
    state,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    updateQuantity,
    getTotalItems,
    updateCustomerInfo,
  };

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
