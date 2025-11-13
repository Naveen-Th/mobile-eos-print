import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import ThermalPrinterService, { ThermalPrinter } from '../services/printing/ThermalPrinterService';

/**
 * Example component demonstrating thermal printer usage
 * 
 * This shows how to:
 * 1. Request Bluetooth permissions
 * 2. Scan for available printers
 * 3. Connect to a printer
 * 4. Print a test receipt
 * 5. Disconnect from printer
 */
const ThermalPrinterExample: React.FC = () => {
  const [printers, setPrinters] = useState<ThermalPrinter[]>([]);
  const [connectedPrinter, setConnectedPrinter] = useState<ThermalPrinter | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const printerService = ThermalPrinterService.getInstance();

  // Load saved printer on mount
  useEffect(() => {
    loadSavedPrinter();
  }, []);

  const loadSavedPrinter = () => {
    const savedPrinter = printerService.getConnectedPrinter();
    if (savedPrinter) {
      setConnectedPrinter(savedPrinter);
    }
  };

  const handleRequestPermissions = async () => {
    try {
      const granted = await printerService.requestPermissions();
      if (granted) {
        Alert.alert('Success', 'Bluetooth permissions granted');
      } else {
        Alert.alert('Error', 'Bluetooth permissions required to scan for printers');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to request permissions');
    }
  };

  const handleScanPrinters = async () => {
    setIsScanning(true);
    try {
      const foundPrinters = await printerService.scanForPrinters();
      setPrinters(foundPrinters);
      
      if (foundPrinters.length === 0) {
        Alert.alert(
          'No Printers Found',
          'Make sure your Bluetooth printer is:\n\n' +
          '1. Powered on\n' +
          '2. In pairing mode\n' +
          '3. Within range\n' +
          '4. Not connected to another device'
        );
      } else {
        Alert.alert('Success', `Found ${foundPrinters.length} printer(s)`);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to scan for printers');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectPrinter = async (printer: ThermalPrinter) => {
    setIsConnecting(true);
    try {
      // Skip test print on connection to avoid auto-print
      const connected = await printerService.connectToPrinter(printer, true);
      
      if (connected) {
        setConnectedPrinter(printer);
        Alert.alert('Success', `Connected to ${printer.name}. Ready to print!`);
      }
    } catch (error: any) {
      Alert.alert(
        'Connection Failed', 
        error.message || 'Failed to connect to printer. Check printer is on and in range.'
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await printerService.disconnect();
      setConnectedPrinter(null);
      Alert.alert('Success', 'Disconnected from printer');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to disconnect');
    }
  };

  const handleTestPrint = async () => {
    if (!connectedPrinter) {
      Alert.alert('Error', 'Please connect to a printer first');
      return;
    }

    setIsPrinting(true);
    try {
      await printerService.testPrint();
      Alert.alert('Success', 'Test receipt printed successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to print test receipt');
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintCustomReceipt = async () => {
    if (!connectedPrinter) {
      Alert.alert('Error', 'Please connect to a printer first');
      return;
    }

    setIsPrinting(true);
    try {
      // Example receipt data
      const receiptData = {
        storeInfo: {
          name: 'Example Store',
          address: '123 Main Street, City',
          phone: '(555) 123-4567',
        },
        items: [
          {
            name: 'Coffee',
            price: 4.50,
            quantity: 2,
            total: 9.00,
          },
          {
            name: 'Sandwich',
            price: 7.99,
            quantity: 1,
            total: 7.99,
          },
          {
            name: 'Cookie',
            price: 2.50,
            quantity: 3,
            total: 7.50,
          },
        ],
        subtotal: 24.49,
        tax: 2.20,
        total: 26.69,
        paymentMethod: 'Credit Card',
        receiptNumber: `REC-${Date.now()}`,
        timestamp: new Date(),
      };

      await printerService.printReceipt(receiptData);
      Alert.alert('Success', 'Receipt printed successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to print receipt');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Thermal Printer Example</Text>

        {/* Connection Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Connection Status:</Text>
          {connectedPrinter ? (
            <>
              <Text style={styles.statusConnected}>✓ Connected</Text>
              <Text style={styles.printerName}>{connectedPrinter.name}</Text>
              <Text style={styles.printerAddress}>{connectedPrinter.address}</Text>
            </>
          ) : (
            <Text style={styles.statusDisconnected}>Not Connected</Text>
          )}
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleRequestPermissions}
        >
          <Text style={styles.buttonText}>1. Request Permissions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, isScanning && styles.buttonDisabled]}
          onPress={handleScanPrinters}
          disabled={isScanning}
        >
          {isScanning ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>2. Scan for Printers</Text>
          )}
        </TouchableOpacity>

        {/* Printer List */}
        {printers.length > 0 && (
          <View style={styles.printerList}>
            <Text style={styles.sectionTitle}>Available Printers:</Text>
            {printers.map((printer) => (
              <TouchableOpacity
                key={printer.id}
                style={styles.printerItem}
                onPress={() => handleConnectPrinter(printer)}
                disabled={isConnecting}
              >
                <View style={styles.printerInfo}>
                  <Text style={styles.printerItemName}>{printer.name}</Text>
                  <Text style={styles.printerItemAddress}>{printer.address}</Text>
                  <Text style={styles.printerItemType}>{printer.type.toUpperCase()}</Text>
                </View>
                {isConnecting ? (
                  <ActivityIndicator color="#DC2626" />
                ) : (
                  <Text style={styles.connectText}>Connect</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Print Actions */}
        {connectedPrinter && (
          <View style={styles.printActions}>
            <TouchableOpacity
              style={[styles.button, styles.printButton, isPrinting && styles.buttonDisabled]}
              onPress={handleTestPrint}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Print Test Receipt</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.printButton, isPrinting && styles.buttonDisabled]}
              onPress={handlePrintCustomReceipt}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Print Custom Receipt</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.disconnectButton]}
              onPress={handleDisconnect}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Instructions:</Text>
          <Text style={styles.instructionsText}>
            1. Tap "Request Permissions" to enable Bluetooth{'\n'}
            2. Tap "Scan for Printers" to find devices{'\n'}
            3. Tap on a printer to connect{'\n'}
            4. Once connected, print test or custom receipts{'\n'}
            5. Tap "Disconnect" when done
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  statusConnected: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4,
  },
  statusDisconnected: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  printerName: {
    fontSize: 16,
    color: '#1F2937',
    marginTop: 4,
  },
  printerAddress: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  button: {
    backgroundColor: '#DC2626',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0.1,
  },
  printButton: {
    backgroundColor: '#10B981',
  },
  disconnectButton: {
    backgroundColor: '#6B7280',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  printerList: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  printerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  printerInfo: {
    flex: 1,
  },
  printerItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  printerItemAddress: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  printerItemType: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  connectText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  printActions: {
    marginTop: 20,
  },
  instructions: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});

export default ThermalPrinterExample;
