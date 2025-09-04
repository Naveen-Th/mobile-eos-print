// Alert components export
export { default as AlertManager, AlertProvider } from './Alert';
export type { AlertType, AlertOptions, DialogOptions, ToastOptions } from './Alert';
export { 
  ReceiptAlerts, 
  BusinessAlerts, 
  DevAlerts 
} from './SpecializedAlerts';

// Main alert instance for easy access
import AlertManager from './Alert';
export const Alert = AlertManager;
