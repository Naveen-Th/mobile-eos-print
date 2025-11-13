import React, { useState, useEffect } from 'react';
import ThermalPrinterService, { ThermalPrinter } from '../services/printing/ThermalPrinterService';

interface PrinterSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrinterSelected?: (printer: ThermalPrinter) => void;
}

interface Printer {
  id: string;
  name: string;
  address: string;
  type: 'bluetooth' | 'wifi' | 'usb';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
}

const PrinterSetupModal: React.FC<PrinterSetupModalProps> = ({
  isOpen,
  onClose,
  onPrinterSelected,
}) => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Configuration settings
  const [paperWidth, setPaperWidth] = useState('80');
  const [printDensity, setPrintDensity] = useState('3');
  const [autoCutEnabled, setAutoCutEnabled] = useState(true);
  const [testPrintEnabled, setTestPrintEnabled] = useState(true);
  
  const printerService = ThermalPrinterService.getInstance();

  useEffect(() => {
    if (isOpen) {
      loadSavedConfiguration();
    }
  }, [isOpen]);

  const loadSavedConfiguration = async () => {
    try {
      const config = printerService.getConfiguration();
      setPaperWidth(config.paperWidth.toString());
      setPrintDensity(config.printDensity.toString());
      setAutoCutEnabled(config.autoCutEnabled);
      setTestPrintEnabled(config.testPrintEnabled);
      
      const connectedPrinter = printerService.getConnectedPrinter();
      if (connectedPrinter) {
        setSelectedPrinter(connectedPrinter as Printer);
      }
    } catch (error) {
      console.error('Failed to load printer configuration:', error);
    }
  };

  const scanForPrinters = async () => {
    setIsScanning(true);
    
    try {
      const discoveredPrinters = await printerService.scanForPrinters();
      setPrinters(discoveredPrinters as Printer[]);
      
    } catch (error) {
      console.error('Failed to scan for printers:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const connectToPrinter = async (printer: Printer) => {
    setIsConnecting(true);
    
    try {
      const connected = await printerService.connectToPrinter(printer as ThermalPrinter);
      
      if (connected) {
        const connectedPrinter = { ...printer, status: 'connected' as const };
        setSelectedPrinter(connectedPrinter);
        
        // Update printer list
        setPrinters(prev => 
          prev.map(p => 
            p.id === printer.id 
              ? connectedPrinter
              : { ...p, status: 'disconnected' as const }
          )
        );
        
        // Update configuration
        await printerService.updateConfiguration({
          paperWidth: parseInt(paperWidth),
          printDensity: parseInt(printDensity),
          autoCutEnabled,
          testPrintEnabled,
        });
        
        if (onPrinterSelected) {
          onPrinterSelected(connectedPrinter as ThermalPrinter);
        }
      }
      
    } catch (error) {
      console.error('Failed to connect to printer:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectPrinter = async () => {
    if (!selectedPrinter) return;
    
    try {
      await printerService.disconnect();
      
      const disconnectedPrinter = { ...selectedPrinter, status: 'disconnected' as const };
      
      setPrinters(prev => 
        prev.map(p => 
          p.id === selectedPrinter.id ? disconnectedPrinter : p
        )
      );
      
      setSelectedPrinter(null);
      
    } catch (error) {
      console.error('Failed to disconnect printer:', error);
    }
  };

  const testPrint = async () => {
    if (!selectedPrinter) {
      return;
    }
    
    try {
      await printerService.testPrint();
    } catch (error) {
      console.error('Test print failed:', error);
    }
  };

  const saveConfiguration = async () => {
    try {
      await printerService.updateConfiguration({
        paperWidth: parseInt(paperWidth),
        printDensity: parseInt(printDensity),
        autoCutEnabled,
        testPrintEnabled,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-red-500 via-red-600 to-orange-500 rounded-t-2xl">
          <div className="p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.9 1 3 1.9 3 3V21C3 22.1 3.9 23 5 23H19C20.1 23 21 22.1 21 21V9M19 9H14V4L19 9Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Printer Setup</h1>
                <p className="text-white/80">Configure printer</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-b-2xl max-h-[70vh] overflow-y-auto">
          <div className="p-6 space-y-6">
            
            {/* Current Printer Status */}
            {selectedPrinter && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{selectedPrinter.name}</h3>
                      <p className="text-sm text-green-600">Connected & Ready</p>
                    </div>
                  </div>
                  <button 
                    onClick={testPrint}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                  >
                    Test Print
                  </button>
                </div>
              </div>
            )}

            {/* Available Printers */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Available Printers</h2>
                <button
                  onClick={scanForPrinters}
                  disabled={isScanning}
                  className="flex items-center space-x-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {isScanning ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  <span>{isScanning ? 'Scanning...' : 'Scan'}</span>
                </button>
              </div>

              {printers.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <p className="text-gray-600 font-medium">No printers found</p>
                  <p className="text-sm text-gray-500 mt-1">Tap scan to search for available thermal printers</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {printers.map((printer) => (
                    <div key={printer.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <svg 
                            className="w-6 h-6"
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke={printer.status === 'connected' ? '#10B981' : '#6B7280'}
                          >
                            {printer.type === 'bluetooth' && (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                            )}
                            {printer.type === 'wifi' && (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                            )}
                            {printer.type === 'usb' && (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                            )}
                          </svg>
                          <div>
                            <h3 className="font-semibold text-gray-900">{printer.name}</h3>
                            <p className="text-sm text-gray-500">{printer.address}</p>
                            <p className="text-xs text-gray-400 uppercase">{printer.type}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            printer.status === 'connected' 
                              ? 'bg-green-100 text-green-800'
                              : printer.status === 'connecting'
                              ? 'bg-yellow-100 text-yellow-800'
                              : printer.status === 'error'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {printer.status.toUpperCase()}
                          </span>
                          
                          <button
                            onClick={() => 
                              printer.status === 'connected' 
                                ? disconnectPrinter()
                                : connectToPrinter(printer)
                            }
                            disabled={isConnecting}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              printer.status === 'connected'
                                ? 'bg-gray-500 text-white hover:bg-gray-600'
                                : 'bg-red-500 text-white hover:bg-red-600'
                            } disabled:opacity-50`}
                          >
                            {isConnecting && selectedPrinter?.id === printer.id ? (
                              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              printer.status === 'connected' ? 'Disconnect' : 'Connect'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Advanced Settings */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <h2 className="text-lg font-semibold text-gray-900">Advanced Settings</h2>
                <svg 
                  className={`w-5 h-5 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 p-4 border border-gray-200 rounded-lg">
                  
                  {/* Paper Width */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Paper Width</label>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      {['58', '80'].map((width) => (
                        <button
                          key={width}
                          onClick={() => setPaperWidth(width)}
                          className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                            paperWidth === width
                              ? 'bg-red-500 text-white'
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {width}mm
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Print Density */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Print Density</label>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      {['1', '2', '3', '4'].map((density) => (
                        <button
                          key={density}
                          onClick={() => setPrintDensity(density)}
                          className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                            printDensity === density
                              ? 'bg-red-500 text-white'
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {density}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auto Cut */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Auto Cut Paper</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCutEnabled}
                        onChange={(e) => setAutoCutEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                    </label>
                  </div>

                  {/* Test Print on Connect */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Test Print on Connect</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={testPrintEnabled}
                        onChange={(e) => setTestPrintEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveConfiguration}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrinterSetupModal;
