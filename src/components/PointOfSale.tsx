import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { AddItemScreen } from './AddItemScreen';
import { PrintOptionsScreen } from './PrintOptionsScreen';
import { ReceiptPreviewScreen } from './ReceiptPreviewScreen';
import { ReceiptsScreen } from './ReceiptsScreen';
import ItemsScreen from './ItemsScreen';
import PrinterSetupModal from './PrinterSetupModal';
import PrinterStatusIndicatorWeb from './PrinterStatusIndicatorWeb';
import ThermalPrinterService, { ThermalPrinter } from '../services/printing/ThermalPrinterService';
import { formatCurrency, validateCustomerInfo } from '../utils/index';

interface PointOfSaleProps {
  user: any;
  onLogout: () => void;
}

type NavigationTab = 'pos' | 'receipts' | 'items' | 'settings';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center px-4 py-3.5 text-left rounded-xl transition-all duration-200 group ${
        isActive 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
          : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900'
      }`}
    >
      <div className={`mr-3 ${
        isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'
      }`}>
        {icon}
      </div>
      <span className="font-medium">{label}</span>
    </button>
  );
};

const PointOfSale: React.FC<PointOfSaleProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('pos');
  const [showAddItemScreen, setShowAddItemScreen] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [showPrinterSetup, setShowPrinterSetup] = useState(false);
  const [customerError, setCustomerError] = useState<string>('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', price: 0, quantity: 1 });
  const [connectedPrinter, setConnectedPrinter] = useState<ThermalPrinter | null>(null);
  
  const { state: cartState, updateQuantity, removeItem, clearCart, updateCustomerInfo, updateItem } = useCart();
  const { items: cartItems, subtotal, tax, total } = cartState;
  
  const printerService = ThermalPrinterService.getInstance();
  
  // Load connected printer on component mount
  React.useEffect(() => {
    const connectedPrinter = printerService.getConnectedPrinter();
    setConnectedPrinter(connectedPrinter);
  }, []);

  const handlePreviewReceipt = () => {
    // Validate customer information before preview
    const customerErrors = validateCustomerInfo({
      customerName: cartState.customerName?.trim(),
    });
    
    if (customerErrors.length > 0) {
      setCustomerError(customerErrors[0].message);
      return;
    }
    
    setCustomerError('');
    setShowReceiptPreview(true);
  };

  const handlePrint = () => {
    // Validate customer information before print
    const customerErrors = validateCustomerInfo({
      customerName: cartState.customerName?.trim(),
    });
    
    if (customerErrors.length > 0) {
      setCustomerError(customerErrors[0].message);
      return;
    }
    
    setCustomerError('');
    setShowPrintOptions(true);
  };

  const handlePrintComplete = () => {
    // Print completed successfully
    console.log('Print completed successfully');
  };

  const handleReceiptProcessed = () => {
    // Receipt has been processed (printed/exported)
    // You can add any additional logic here if needed
    console.log('Receipt processed successfully');
  };

  const handleEditItem = (item: any) => {
    setEditingItemId(item.id);
    setEditForm({
      name: item.name,
      price: item.price,
      quantity: item.quantity
    });
  };

  const handleSaveEdit = () => {
    if (editingItemId && editForm.name.trim() && editForm.price > 0 && editForm.quantity > 0) {
      updateItem(editingItemId, {
        name: editForm.name.trim(),
        price: editForm.price,
        quantity: editForm.quantity
      });
      setEditingItemId(null);
      setEditForm({ name: '', price: 0, quantity: 1 });
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditForm({ name: '', price: 0, quantity: 1 });
  };
  
  const handlePrinterSelected = (printer: ThermalPrinter) => {
    setConnectedPrinter(printer);
  };

  // Return PrintOptionsScreen if showing print options
  if (showPrintOptions) {
    return (
      <PrintOptionsScreen
        onClose={() => setShowPrintOptions(false)}
        onPrintComplete={handlePrintComplete}
      />
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'pos':
        return renderPOSContent();
      case 'receipts':
        return renderReceiptsContent();
      case 'items':
        return renderItemsContent();
      case 'settings':
        return renderSettingsContent();
      default:
        return renderPOSContent();
    }
  };

  const renderPOSContent = () => (
    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-gray-900/5 border border-gray-200/60 overflow-hidden">
      {/* Receipt Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Receipt ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})
        </h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddItemScreen(true)}
            className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Items</span>
          </button>
          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              className="px-4 py-2 text-sm text-blue-500 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
        {cartItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6M7 13h10M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
            <p>Your Receipt is empty</p>
            <p className="text-sm">Add items to get started</p>
          </div>
        ) : (
          cartItems.map((item) => (
            <div key={item.id} className="p-4 hover:bg-gray-50 rounded-lg transition-colors">
              {editingItemId === item.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Item name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Price</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.price}
                        onChange={(e) => setEditForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.quantity}
                        onChange={(e) => setEditForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="1"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Total: ${(editForm.price * editForm.quantity).toFixed(2)}
                    </p>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editForm.name.trim() || editForm.price <= 0 || editForm.quantity <= 0}
                        className="px-3 py-1 text-sm text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-500">{item.quantity} × ${item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-md transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-md transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    <button
                      onClick={() => handleEditItem(item)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit item"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove item"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="font-semibold text-lg text-blue-600">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>


      {/* Customer Name Input */}
      {cartItems.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cartState.customerName || ''}
              onChange={(e) => {
                updateCustomerInfo({ customerName: e.target.value || undefined });
                setCustomerError(''); // Clear error when typing
              }}
              placeholder="Enter customer name (required)"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                customerError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {customerError && (
              <p className="text-red-500 text-sm mt-1">{customerError}</p>
            )}
          </div>
        </div>
      )}

      {/* Totals */}
      {cartItems.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tax:</span>
            <span className="font-medium">${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-3">
            <span>Total:</span>
            <span className="text-blue-600">${total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Print Button */}
      {cartItems.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={handlePrint}
            className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print</span>
          </button>
        </div>
      )}
    </div>
  );

  const renderReceiptsContent = () => <ReceiptsScreen />;

  const renderItemsContent = () => <ItemsScreen />;



  const renderSettingsContent = () => (
    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-gray-900/5 border border-gray-200/60 p-8">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Application Settings</h3>
          
          {/* Printer Status */}
          <div className="mb-6">
            <PrinterStatusIndicatorWeb 
              showDetailedStatus={true}
              onPress={() => setShowPrinterSetup(true)}
              className="mb-4"
            />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">Printer Configuration</h4>
                <p className="text-sm text-gray-500">
                  {connectedPrinter 
                    ? `Connected: ${connectedPrinter.name}`
                    : 'No printer connected'
                  }
                </p>
              </div>
              <button 
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                onClick={() => setShowPrinterSetup(true)}
              >
                {connectedPrinter ? 'Manage' : 'Setup'}
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">Tax Settings</h4>
                <p className="text-sm text-gray-500">Current rate: 8%</p>
              </div>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                Edit
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">Store Information</h4>
                <p className="text-sm text-gray-500">Update store details</p>
              </div>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 flex">
      {/* Left Sidebar */}
      <div className="w-72 bg-white/95 backdrop-blur-xl border-r border-gray-200/80 p-6 flex flex-col shadow-sm">
        {/* App Header */}
        <div className="mb-10">
          <div className="flex items-center space-x-4 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">My Store</h1>
              <p className="text-sm text-gray-600">Desktop POS System</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-3 flex-1">
          <SidebarItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6M7 13h10M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            }
            label="Point of Sale"
            isActive={activeTab === 'pos'}
            onClick={() => setActiveTab('pos')}
          />
          <SidebarItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            label="Receipts"
            isActive={activeTab === 'receipts'}
            onClick={() => setActiveTab('receipts')}
          />
          <SidebarItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            label="Items"
            isActive={activeTab === 'items'}
            onClick={() => setActiveTab('items')}
          />
          <SidebarItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            label="Settings"
            isActive={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </nav>

        {/* User Section */}
        <div className="border-t border-gray-200/70 pt-6">
          <div className="flex items-center space-x-3 mb-5">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-semibold text-sm">
                {(user.displayName || user.email).charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user.displayName || user.email}
              </p>
              <p className="text-xs text-gray-500 capitalize font-medium">{user.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 pl-10 pr-12">
        <div className="max-w-6xl mx-auto">
          {renderTabContent()}
        </div>
      </div>
      
      {/* Add Item Screen Modal */}
      {showAddItemScreen && (
        <AddItemScreen onClose={() => setShowAddItemScreen(false)} />
      )}
      
      {/* Receipt Preview Screen Modal */}
      {showReceiptPreview && (
        <ReceiptPreviewScreen 
          onClose={() => setShowReceiptPreview(false)}
          onReceiptProcessed={handleReceiptProcessed}
        />
      )}
      
      {/* Printer Setup Modal */}
      <PrinterSetupModal
        isOpen={showPrinterSetup}
        onClose={() => setShowPrinterSetup(false)}
        onPrinterSelected={handlePrinterSelected}
      />
      
    </div>
  );
};

export default PointOfSale;
