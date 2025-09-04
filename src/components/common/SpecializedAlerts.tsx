import AlertManager from './Alert';

/**
 * Specialized alert functions for common use cases in the thermal receipt printer app
 */
export class ReceiptAlerts {
  /**
   * PDF export success alerts
   */
  static pdfExportSuccess(message: string) {
    AlertManager.success(
      message,
      '✅ PDF Export Complete'
    );
  }

  static pdfExportError(error: string) {
    AlertManager.errorDialog(
      `Failed to export PDF: ${error}\n\nPlease try again or contact support if the problem persists.`,
      '❌ Export Failed'
    );
  }

  /**
   * Printer connection alerts
   */
  static printerConnected(printerName: string) {
    AlertManager.success(
      `Connected to ${printerName}`,
      '🖨️ Printer Connected'
    );
  }

  static printerDisconnected() {
    AlertManager.warning(
      'Printer connection lost. Please reconnect to continue printing.',
      '🖨️ Printer Disconnected'
    );
  }

  static printerError(error: string) {
    AlertManager.error(
      `Printer error: ${error}`,
      '🖨️ Printer Error'
    );
  }

  /**
   * Permission alerts
   */
  static storagePermissionNeeded() {
    AlertManager.warningDialog(
      'Storage permission is required to save PDF files directly to your device.\n\nPlease grant permission in your device settings.',
      '🔐 Permission Required'
    );
  }

  static bluetoothPermissionNeeded() {
    AlertManager.warningDialog(
      'Bluetooth permission is required to connect to thermal printers.\n\nPlease grant permission in your device settings.',
      '🔐 Bluetooth Permission Required'
    );
  }

  /**
   * Receipt processing alerts
   */
  static receiptSaveSuccess(receiptNumber: string) {
    AlertManager.success(
      `Receipt ${receiptNumber} saved successfully`,
      '💾 Saved'
    );
  }

  static receiptSaveError(error?: string) {
    AlertManager.error(
      error || 'Failed to save receipt data. Please try again.',
      '💾 Save Failed'
    );
  }

  /**
   * Network/Firebase alerts
   */
  static syncSuccess() {
    AlertManager.success(
      'Data synchronized successfully',
      '☁️ Sync Complete'
    );
  }

  static syncError(error: string) {
    AlertManager.error(
      `Sync failed: ${error}`,
      '☁️ Sync Error'
    );
  }

  static offlineMode() {
    AlertManager.warning(
      'Working offline. Data will sync when connection is restored.',
      '📶 Offline Mode'
    );
  }

  /**
   * Cart alerts
   */
  static cartCleared() {
    AlertManager.info(
      'Shopping cart cleared',
      '🛒 Cart Empty'
    );
  }

  static itemAdded(itemName: string) {
    AlertManager.success(
      `${itemName} added to cart`,
      '🛒 Item Added',
      2000
    );
  }

  static itemRemoved(itemName: string) {
    AlertManager.info(
      `${itemName} removed from cart`,
      '🛒 Item Removed',
      2000
    );
  }

  /**
   * Validation alerts
   */
  static validationError(field: string, message: string) {
    AlertManager.warning(
      `${field}: ${message}`,
      '⚠️ Validation Error'
    );
  }

  static requiredFields(fields: string[]) {
    AlertManager.warning(
      `Please fill in required fields: ${fields.join(', ')}`,
      '⚠️ Required Fields'
    );
  }

  /**
   * File system alerts
   */
  static directFileAccessSuccess(path: string) {
    AlertManager.successDialog(
      `✅ PDF saved to public storage!\n\n📁 Location: ${path}\n\n🗂️ You can now access this file directly through your device's file manager!`,
      '🗃️ Direct File Access'
    );
  }

  static directFileAccessError(error: string) {
    AlertManager.errorDialog(
      `Failed to save to public storage: ${error}\n\nThe file may have been saved to app storage instead.`,
      '🗃️ Direct Access Failed'
    );
  }

  static receiptCreatedSuccessfully(receiptNumber: string) {
    AlertManager.success(
      `Receipt #${receiptNumber} created successfully!`,
      '🧾 Receipt Created'
    );
  }

  static receiptPrintSuccess() {
    AlertManager.success(
      'Receipt printed successfully!',
      '🖨️ Print Complete'
    );
  }

  static permissionRequired(message: string) {
    AlertManager.warning(
      message,
      '🔐 Permission Required'
    );
  }

  /**
   * General confirmation alerts
   */
  static confirmDeleteReceipt(receiptNumber: string, onConfirm: () => void) {
    AlertManager.confirm(
      `Are you sure you want to delete receipt ${receiptNumber}? This action cannot be undone.`,
      onConfirm,
      undefined,
      '🗑️ Delete Receipt'
    );
  }

  static confirmClearCart(onConfirm: () => void) {
    AlertManager.confirm(
      'Are you sure you want to clear the shopping cart? All items will be removed.',
      onConfirm,
      undefined,
      '🛒 Clear Cart'
    );
  }

  static confirmLogout(onConfirm: () => void) {
    AlertManager.confirm(
      'Are you sure you want to log out?',
      onConfirm,
      undefined,
      '🚪 Logout'
    );
  }

  /**
   * Update and maintenance alerts
   */
  static updateAvailable(version: string, onUpdate: () => void) {
    AlertManager.showDialog({
      title: '📦 Update Available',
      message: `A new version (${version}) is available. Would you like to update now?`,
      type: 'info',
      button: 'Update',
      onPressButton: onUpdate,
    });
  }

  static maintenanceMode() {
    AlertManager.warningDialog(
      'The app is currently under maintenance. Some features may be unavailable.',
      '🔧 Maintenance Mode'
    );
  }

  /**
   * Loading states
   */
  static loadingToast(message: string = 'Loading...') {
    AlertManager.info(message, '⏳ Please Wait', 2000);
  }
}

/**
 * Business logic alerts
 */
export class BusinessAlerts {
  static lowStock(itemName: string, quantity: number) {
    AlertManager.warning(
      `${itemName} is running low (${quantity} remaining)`,
      '📦 Low Stock Alert'
    );
  }

  static outOfStock(itemName: string) {
    AlertManager.error(
      `${itemName} is out of stock`,
      '📦 Out of Stock'
    );
  }

  static dailySalesReport(total: number, transactions: number) {
    AlertManager.infoDialog(
      `Total Sales: $${total.toFixed(2)}\nTransactions: ${transactions}`,
      '📊 Daily Sales Report'
    );
  }

  static paymentSuccess(amount: number, method: string) {
    AlertManager.success(
      `Payment of $${amount.toFixed(2)} processed via ${method}`,
      '💳 Payment Successful'
    );
  }

  static paymentFailed(error: string) {
    AlertManager.error(
      `Payment failed: ${error}`,
      '💳 Payment Error'
    );
  }
}

/**
 * Development and debug alerts
 */
export class DevAlerts {
  static debug(message: string, data?: any) {
    if (__DEV__) {
      AlertManager.info(
        `${message}${data ? `\n\nData: ${JSON.stringify(data, null, 2)}` : ''}`,
        '🐛 Debug Info'
      );
    }
  }

  static apiError(endpoint: string, error: string) {
    if (__DEV__) {
      AlertManager.error(
        `API Error at ${endpoint}: ${error}`,
        '🌐 API Error'
      );
    }
  }

  static performanceWarning(operation: string, duration: number) {
    if (__DEV__ && duration > 1000) {
      AlertManager.warning(
        `${operation} took ${duration}ms to complete`,
        '⚡ Performance Warning'
      );
    }
  }
}

export default {
  ReceiptAlerts,
  BusinessAlerts,
  DevAlerts,
};
