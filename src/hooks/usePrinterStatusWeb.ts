import { useState, useEffect, useCallback } from 'react';
import ThermalPrinterService, { ThermalPrinter } from '../services/ThermalPrinterService';

export interface PrinterStatus {
  isConnected: boolean;
  printer: ThermalPrinter | null;
  status: 'ready' | 'busy' | 'error' | 'offline' | 'paper_low' | 'paper_empty';
  lastCheck: Date;
  error?: string;
}

// Web-compatible version of the printer status hook
export const usePrinterStatusWeb = (checkInterval: number = 10000) => {
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>({
    isConnected: false,
    printer: null,
    status: 'offline',
    lastCheck: new Date(),
  });
  const [isChecking, setIsChecking] = useState(false);

  const printerService = ThermalPrinterService.getInstance();

  const checkPrinterStatus = useCallback(async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    
    try {
      const connectedPrinter = printerService.getConnectedPrinter();
      const isConnected = printerService.isConnected();
      
      if (!connectedPrinter || !isConnected) {
        setPrinterStatus({
          isConnected: false,
          printer: null,
          status: 'offline',
          lastCheck: new Date(),
        });
        return;
      }

      // Get detailed printer status
      const statusString = await printerService.getPrinterStatus();
      let status: PrinterStatus['status'] = 'ready';
      let error: string | undefined;

      switch (statusString.toLowerCase()) {
        case 'busy':
        case 'printing':
          status = 'busy';
          break;
        case 'error':
        case 'fault':
          status = 'error';
          error = 'Printer error detected';
          break;
        case 'paper_low':
          status = 'paper_low';
          break;
        case 'paper_empty':
        case 'no_paper':
          status = 'paper_empty';
          error = 'Paper is empty';
          break;
        case 'offline':
        case 'disconnected':
          status = 'offline';
          error = 'Printer is offline';
          break;
        case 'ready':
        default:
          status = 'ready';
          break;
      }

      setPrinterStatus({
        isConnected: true,
        printer: connectedPrinter,
        status,
        lastCheck: new Date(),
        error,
      });

    } catch (error) {
      console.error('Failed to check printer status:', error);
      setPrinterStatus(prev => ({
        ...prev,
        status: 'error',
        lastCheck: new Date(),
        error: 'Failed to check printer status',
      }));
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, printerService]);

  // Initial status check
  useEffect(() => {
    checkPrinterStatus();
  }, []);

  // Set up periodic status checking
  useEffect(() => {
    if (checkInterval <= 0) return;

    const interval = setInterval(() => {
      checkPrinterStatus();
    }, checkInterval);

    return () => clearInterval(interval);
  }, [checkInterval, checkPrinterStatus]);

  const refreshStatus = useCallback(() => {
    checkPrinterStatus();
  }, [checkPrinterStatus]);

  const getStatusColor = useCallback((status: PrinterStatus['status']) => {
    switch (status) {
      case 'ready':
        return '#10B981'; // Green
      case 'busy':
        return '#F59E0B'; // Yellow/Orange
      case 'error':
      case 'paper_empty':
        return '#EF4444'; // Red
      case 'paper_low':
        return '#F97316'; // Orange
      case 'offline':
      default:
        return '#6B7280'; // Gray
    }
  }, []);

  const getStatusText = useCallback((status: PrinterStatus['status']) => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'busy':
        return 'Printing...';
      case 'error':
        return 'Error';
      case 'paper_low':
        return 'Paper Low';
      case 'paper_empty':
        return 'Paper Empty';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  }, []);

  return {
    printerStatus,
    isChecking,
    refreshStatus,
    getStatusColor,
    getStatusText,
  };
};
