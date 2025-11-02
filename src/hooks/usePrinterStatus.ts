import { useState, useEffect, useCallback, useRef } from 'react';
import ThermalPrinterService, { ThermalPrinter } from '../services/ThermalPrinterService';
import AudioService from '../services/AudioService';

export interface PrinterStatus {
  isConnected: boolean;
  printer: ThermalPrinter | null;
  status: 'ready' | 'busy' | 'error' | 'offline' | 'paper_low' | 'paper_empty';
  lastCheck: Date;
  error?: string;
}

export const usePrinterStatus = (checkInterval: number = 5000) => {
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>({
    isConnected: false,
    printer: null,
    status: 'offline',
    lastCheck: new Date(),
  });
  const [isChecking, setIsChecking] = useState(false);
  const previousConnectionState = useRef<boolean>(false);

  const printerService = ThermalPrinterService.getInstance();
  const audioService = AudioService.getInstance();

  const checkPrinterStatus = useCallback(async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    
    try {
      const connectedPrinter = printerService.getConnectedPrinter();
      const isConnected = printerService.isConnected();
      
      if (!connectedPrinter || !isConnected) {
        const newStatus = {
          isConnected: false,
          printer: null,
          status: 'offline' as const,
          lastCheck: new Date(),
        };
        
        setPrinterStatus(newStatus);
        
        // Update previous connection state
        previousConnectionState.current = newStatus.isConnected;
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

      const newStatus = {
        isConnected: true,
        printer: connectedPrinter,
        status,
        lastCheck: new Date(),
        error,
      };
      
      setPrinterStatus(newStatus);
      
      // Play sound if printer just connected (wasn't connected before)
      if (!previousConnectionState.current && newStatus.isConnected) {
        console.log('Printer connected - playing connection sound');
        audioService.playPrinterConnectedSound().catch(console.error);
      }
      
      // Update previous connection state
      previousConnectionState.current = newStatus.isConnected;

    } catch (error) {
      console.error('Failed to check printer status:', error);
      setPrinterStatus(prev => {
        const newStatus = {
          ...prev,
          status: 'error' as const,
          lastCheck: new Date(),
          error: 'Failed to check printer status',
        };
        
        // Update previous connection state
        previousConnectionState.current = newStatus.isConnected;
        
        return newStatus;
      });
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

  const getStatusIcon = useCallback((status: PrinterStatus['status']) => {
    switch (status) {
      case 'ready':
        return 'checkmark-circle';
      case 'busy':
        return 'time';
      case 'error':
        return 'alert-circle';
      case 'paper_low':
      case 'paper_empty':
        return 'document-text';
      case 'offline':
        return 'cloud-offline';
      default:
        return 'help-circle'
    }
  }, []);

  return {
    printerStatus,
    isChecking,
    refreshStatus,
    getStatusColor,
    getStatusText,
    getStatusIcon,
  };
};
