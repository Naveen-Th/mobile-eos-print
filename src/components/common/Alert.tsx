import React from 'react';
import { 
  ALERT_TYPE, 
  Dialog, 
  AlertNotificationRoot, 
  Toast 
} from 'react-native-alert-notification';
import { Ionicons } from '@expo/vector-icons';

// Alert type definitions
export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertOptions {
  title?: string;
  message: string;
  type?: AlertType;
  duration?: number;
  autoClose?: boolean;
  onShow?: () => void;
  onHide?: () => void;
  onPress?: () => void;
}

export interface DialogOptions extends AlertOptions {
  textBody?: string;
  button?: string;
  onPressButton?: () => void;
}

export interface ToastOptions extends AlertOptions {
  textBody?: string;
}

// Color scheme for different alert types
const alertColors = {
  success: {
    background: '#10b981',
    text: '#ffffff',
    icon: '#ffffff',
  },
  error: {
    background: '#ef4444',
    text: '#ffffff',
    icon: '#ffffff',
  },
  warning: {
    background: '#f59e0b',
    text: '#ffffff',
    icon: '#ffffff',
  },
  info: {
    background: '#3b82f6',
    text: '#ffffff',
    icon: '#ffffff',
  },
};

// Icon mapping for different alert types
const alertIcons = {
  success: 'checkmark-circle' as const,
  error: 'close-circle' as const,
  warning: 'warning' as const,
  info: 'information-circle' as const,
};

/**
 * Alert utility class for showing various types of alerts
 */
export class AlertManager {
  /**
   * Show a toast notification
   */
  static showToast(options: ToastOptions) {
    const {
      title = '',
      message,
      type = 'info',
      duration = 3000,
      autoClose = true,
      onShow,
      onHide,
      onPress,
      textBody,
    } = options;

    const colors = alertColors[type];
    const iconName = alertIcons[type];

    const alertType = type === 'success' ? ALERT_TYPE.SUCCESS :
      type === 'error' ? ALERT_TYPE.DANGER :
      type === 'warning' ? ALERT_TYPE.WARNING :
      ALERT_TYPE.INFO;
    
    Toast.show({
      type: alertType,
      title: title,
      textBody: textBody || message,
      autoClose: autoClose,
      duration: duration,
      onShow: onShow,
      onHide: onHide,
      onPress: onPress,
      titleStyle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: 'bold',
      },
      textBodyStyle: {
        color: colors.text,
        fontSize: 14,
      },
      alertContainerStyle: {
        backgroundColor: colors.background,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 16,
        marginTop: 60,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 10,
        zIndex: 999999,
        position: 'relative',
      },
    });
  }

  /**
   * Show a dialog alert
   */
  static showDialog(options: DialogOptions) {
    const {
      title = 'Alert',
      message,
      type = 'info',
      button = 'OK',
      onPressButton,
      onShow,
      onHide,
      textBody,
    } = options;

    const colors = alertColors[type];

    const alertType = type === 'success' ? ALERT_TYPE.SUCCESS :
      type === 'error' ? ALERT_TYPE.DANGER :
      type === 'warning' ? ALERT_TYPE.WARNING :
      ALERT_TYPE.INFO;
    
    Dialog.show({
      type: alertType,
      title: title,
      textBody: textBody || message,
      button: button,
      onPressButton: onPressButton,
      onShow: onShow,
      onHide: onHide,
      titleStyle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
      },
      textBodyStyle: {
        color: colors.text,
        fontSize: 14,
        textAlign: 'center',
        marginVertical: 10,
      },
      alertContainerStyle: {
        backgroundColor: colors.background,
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 20,
        marginHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 15,
        zIndex: 999999,
        position: 'relative',
      },
      buttonStyle: {
        backgroundColor: '#ffffff',
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
        marginTop: 15,
      },
      buttonTextStyle: {
        color: colors.background,
        fontSize: 16,
        fontWeight: '600',
      },
    });
  }

  /**
   * Show success toast
   */
  static success(message: string, title?: string, duration?: number) {
    this.showToast({
      title: title || '✅ Success',
      message,
      type: 'success',
      duration: duration || 3000,
    });
  }

  /**
   * Show error toast
   */
  static error(message: string, title?: string, duration?: number) {
    this.showToast({
      title: title || '❌ Error',
      message,
      type: 'error',
      duration: duration || 4000,
    });
  }

  /**
   * Show warning toast
   */
  static warning(message: string, title?: string, duration?: number) {
    this.showToast({
      title: title || '⚠️ Warning',
      message,
      type: 'warning',
      duration: duration || 3500,
    });
  }

  /**
   * Show info toast
   */
  static info(message: string, title?: string, duration?: number) {
    this.showToast({
      title: title || 'ℹ️ Info',
      message,
      type: 'info',
      duration: duration || 3000,
    });
  }

  /**
   * Show success dialog
   */
  static successDialog(
    message: string, 
    title?: string, 
    onPress?: () => void
  ) {
    this.showDialog({
      title: title || '✅ Success',
      message,
      type: 'success',
      button: 'OK',
      onPressButton: onPress,
    });
  }

  /**
   * Show error dialog
   */
  static errorDialog(
    message: string, 
    title?: string, 
    onPress?: () => void
  ) {
    this.showDialog({
      title: title || '❌ Error',
      message,
      type: 'error',
      button: 'OK',
      onPressButton: onPress,
    });
  }

  /**
   * Show warning dialog
   */
  static warningDialog(
    message: string, 
    title?: string, 
    onPress?: () => void
  ) {
    this.showDialog({
      title: title || '⚠️ Warning',
      message,
      type: 'warning',
      button: 'OK',
      onPressButton: onPress,
    });
  }

  /**
   * Show info dialog
   */
  static infoDialog(
    message: string, 
    title?: string, 
    onPress?: () => void
  ) {
    this.showDialog({
      title: title || 'ℹ️ Information',
      message,
      type: 'info',
      button: 'OK',
      onPressButton: onPress,
    });
  }

  /**
   * Show confirmation dialog
   */
  static confirm(
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    title?: string
  ) {
    Dialog.show({
      type: ALERT_TYPE.WARNING,
      title: title || '⚠️ Confirm Action',
      textBody: message,
      button: 'Confirm',
      onPressButton: onConfirm,
      titleStyle: {
        color: '#f59e0b',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
      },
      textBodyStyle: {
        color: '#374151',
        fontSize: 14,
        textAlign: 'center',
        marginVertical: 10,
      },
      alertContainerStyle: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 20,
        marginHorizontal: 20,
        borderWidth: 2,
        borderColor: '#f59e0b',
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
      },
      buttonStyle: {
        backgroundColor: '#f59e0b',
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
        marginTop: 15,
      },
      buttonTextStyle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
      },
    });
  }

  /**
   * Show a generic dialog with multiple buttons (for backwards compatibility)
   */
  static dialog(
    message: string,
    title: string,
    buttons: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
  ) {
    const primaryButton = buttons.find(b => b.style !== 'cancel') || buttons[0];
    const cancelButton = buttons.find(b => b.style === 'cancel');

    Dialog.show({
      type: ALERT_TYPE.WARNING,
      title: title,
      textBody: message,
      button: primaryButton.text,
      onPressButton: primaryButton.onPress,
      // Note: react-native-alert-notification doesn't support multiple buttons,
      // so we'll show the primary action only
      titleStyle: {
        color: '#374151',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
      },
      textBodyStyle: {
        color: '#374151',
        fontSize: 14,
        textAlign: 'center',
        marginVertical: 10,
      },
      alertContainerStyle: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 20,
        marginHorizontal: 20,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
        zIndex: 9999,
      },
      buttonStyle: {
        backgroundColor: primaryButton.style === 'destructive' ? '#ef4444' : '#3b82f6',
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
        marginTop: 15,
      },
      buttonTextStyle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
      },
    });
  }

  /**
   * Test alert - for debugging visibility issues
   */
  static test() {
    console.log('Testing alert visibility...');
    
    // Test simple toast first
    Toast.show({
      type: ALERT_TYPE.SUCCESS,
      title: 'Test Alert',
      textBody: 'If you can see this, the alert system is working!',
      duration: 5000,
      onShow: () => console.log('Toast shown'),
      onHide: () => console.log('Toast hidden'),
    });
    
    // Test dialog after 2 seconds
    setTimeout(() => {
      Dialog.show({
        type: ALERT_TYPE.INFO,
        title: 'Test Dialog',
        textBody: 'Dialog test - alerts are working properly!',
        button: 'OK',
        onShow: () => console.log('Dialog shown'),
        onHide: () => console.log('Dialog hidden'),
      });
    }, 2000);
  }

  /**
   * Hide all alerts
   */
  static hideAll() {
    Dialog.hide();
    Toast.hide();
  }

  /**
   * Custom alert with full options
   */
  static custom(options: DialogOptions | ToastOptions, isDialog: boolean = false) {
    if (isDialog) {
      this.showDialog(options as DialogOptions);
    } else {
      this.showToast(options as ToastOptions);
    }
  }
}

/**
 * Alert Root Provider Component
 * This must wrap your entire app
 */
export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  return (
    <AlertNotificationRoot>
      {children}
    </AlertNotificationRoot>
  );
};

export default AlertManager;
