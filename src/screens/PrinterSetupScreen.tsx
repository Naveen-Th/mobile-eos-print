import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Animated,
  Easing,
  StatusBar,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { ReceiptAlerts } from '../components/common/SpecializedAlerts';
import ThermalPrinterService, { ThermalPrinter } from '../services/printing/ThermalPrinterService';

type Printer = ThermalPrinter;

interface PrinterSetupScreenProps {
  onClose: () => void;
  onPrinterSelected?: (printer: Printer) => void;
}

const PrinterSetupScreen: React.FC<PrinterSetupScreenProps> = ({
  onClose,
  onPrinterSelected,
}) => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingPrinterId, setConnectingPrinterId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  
  const [paperWidth, setPaperWidth] = useState('80');
  const [printDensity, setPrintDensity] = useState('3');
  const [autoCutEnabled, setAutoCutEnabled] = useState(true);
  const [testPrintEnabled, setTestPrintEnabled] = useState(true);
  
  const printerService = ThermalPrinterService.getInstance();
  
  const scanPulse = useRef(new Animated.Value(0)).current;
  const connectionMonitorRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    loadSavedConfiguration();
    connectionMonitorRef.current = printerService.startConnectionMonitoring((isConnected) => {
      if (!isConnected && selectedPrinter) {
        setSelectedPrinter(null);
        ReceiptAlerts.printerDisconnected();
      }
    });
    return () => {
      if (connectionMonitorRef.current) {
        printerService.stopConnectionMonitoring(connectionMonitorRef.current);
      }
    };
  }, []);

  const loadSavedConfiguration = async () => {
    try {
      const config = printerService.getConfiguration();
      setPaperWidth(config.paperWidth.toString());
      setPrintDensity(config.printDensity.toString());
      setAutoCutEnabled(config.autoCutEnabled);
      setTestPrintEnabled(config.testPrintEnabled);
      const connectedPrinter = printerService.getConnectedPrinter();
      if (connectedPrinter) {
        setSelectedPrinter(connectedPrinter);
        setBluetoothEnabled(true);
      }
    } catch (error) {
      console.error('Failed to load printer configuration:', error);
    }
  };

  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanPulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scanPulse, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      scanPulse.setValue(0);
    }
  }, [isScanning]);

  const stopScanRef = useRef<(() => void) | null>(null);

  const handleBluetoothToggle = async (value: boolean) => {
    setBluetoothEnabled(value);
    if (value) {
      scanForPrinters();
    } else {
      stopScanRef.current?.();
      if (selectedPrinter) await disconnectPrinter();
      setPrinters([]);
    }
  };

  const scanForPrinters = () => {
    // Stop any existing scan
    stopScanRef.current?.();
    
    setIsScanning(true);
    setPrinters([]);
    
    // Use progressive scanning - devices appear as they're found
    stopScanRef.current = printerService.scanForPrintersProgressive(
      // onDeviceFound - called for each device discovered
      (device) => {
        setPrinters(prev => {
          const exists = prev.some(p => p.address === device.address);
          if (exists) return prev;
          return [...prev, device];
        });
      },
      // onScanComplete
      () => {
        setIsScanning(false);
        setPrinters(prev => {
          if (prev.length === 0) {
            ReceiptAlerts.printerError('No printers found nearby');
          }
          return prev;
        });
      },
      // onError
      (error) => {
        setIsScanning(false);
        ReceiptAlerts.printerError(error?.message || 'Scan failed');
        setBluetoothEnabled(false);
      }
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanRef.current?.();
    };
  }, []);

  const clearStoredDevices = async () => {
    try {
      await printerService.clearStoredDevices();
      setSelectedPrinter(null);
      setPrinters([]);
      ReceiptAlerts.receiptSaveSuccess('Devices cleared');
    } catch (error) {
      ReceiptAlerts.printerError('Failed to clear devices');
    }
  };

  const connectToPrinter = async (printer: Printer) => {
    setIsConnecting(true);
    setConnectingPrinterId(printer.id);
    try {
      const connected = await printerService.connectToPrinter(printer, true);
      if (connected) {
        const connectedPrinter = { ...printer, status: 'connected' as const };
        setSelectedPrinter(connectedPrinter);
        setPrinters(prev => prev.map(p => p.id === printer.id ? connectedPrinter : { ...p, status: 'disconnected' as const }));
        ReceiptAlerts.printerConnected(`Connected to ${printer.name}`);
        await printerService.updateConfiguration({ paperWidth: parseInt(paperWidth), printDensity: parseInt(printDensity), autoCutEnabled, testPrintEnabled });
        onPrinterSelected?.(connectedPrinter);
      }
    } catch (error: any) {
      ReceiptAlerts.printerError(error?.message || 'Connection failed');
    } finally {
      setIsConnecting(false);
      setConnectingPrinterId(null);
    }
  };

  const disconnectPrinter = async () => {
    if (!selectedPrinter) return;
    try {
      await printerService.disconnect();
      setPrinters(prev => prev.map(p => p.id === selectedPrinter.id ? { ...p, status: 'disconnected' as const } : p));
      setSelectedPrinter(null);
      ReceiptAlerts.printerDisconnected();
    } catch (error) {
      ReceiptAlerts.printerError('Disconnect failed');
    }
  };

  const testPrint = async () => {
    if (!selectedPrinter) return;
    try {
      await printerService.testPrint();
      ReceiptAlerts.receiptPrintSuccess();
    } catch (error) {
      ReceiptAlerts.printerError('Test print failed');
    }
  };

  const saveConfig = async () => {
    await printerService.updateConfiguration({ paperWidth: parseInt(paperWidth), printDensity: parseInt(printDensity), autoCutEnabled, testPrintEnabled });
    ReceiptAlerts.receiptSaveSuccess('Settings saved');
    onClose();
  };

  const pulseScale = scanPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
  const pulseOpacity = scanPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] });


  return (
    <View style={styles.container}>
      <View style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bluetooth Printer</Text>
          <TouchableOpacity onPress={clearStoredDevices} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Bluetooth Toggle Card */}
          <View style={styles.card}>
            <View style={styles.btRow}>
              <View style={styles.btIconWrap}>
                <Animated.View style={[styles.btIconBg, isScanning && { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}>
                  <Ionicons name="bluetooth" size={24} color={bluetoothEnabled ? '#3B82F6' : '#9CA3AF'} />
                </Animated.View>
              </View>
              <View style={styles.btInfo}>
                <Text style={styles.btTitle}>Bluetooth</Text>
                <Text style={styles.btStatus}>
                  {isScanning ? 'Scanning...' : bluetoothEnabled ? (selectedPrinter ? 'Connected' : 'Ready') : 'Off'}
                </Text>
              </View>
              <Switch
                value={bluetoothEnabled}
                onValueChange={handleBluetoothToggle}
                trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                thumbColor="#FFFFFF"
                disabled={isScanning}
              />
            </View>
            {bluetoothEnabled && !isScanning && (
              <TouchableOpacity style={styles.scanBtn} onPress={scanForPrinters}>
                <Ionicons name="refresh" size={16} color="#3B82F6" />
                <Text style={styles.scanBtnText}>Scan Again</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Connected Device */}
          {selectedPrinter && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.sectionTitle}>Connected</Text>
              </View>
              <View style={styles.deviceRow}>
                <View style={[styles.deviceIcon, styles.deviceIconConnected]}>
                  <Ionicons name="print" size={20} color="#10B981" />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{selectedPrinter.name}</Text>
                  <Text style={styles.deviceAddr}>{selectedPrinter.address}</Text>
                </View>
                <View style={styles.deviceActions}>
                  <TouchableOpacity style={styles.testBtn} onPress={testPrint}>
                    <Text style={styles.testBtnText}>Test</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.disconnectBtn} onPress={disconnectPrinter}>
                    <Ionicons name="close" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Available Devices */}
          {bluetoothEnabled && printers.length > 0 && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Ionicons name="radio-outline" size={18} color="#6B7280" />
                <Text style={styles.sectionTitle}>Available ({printers.filter(p => p.status !== 'connected').length})</Text>
              </View>
              {printers.filter(p => p.id !== selectedPrinter?.id).map((printer) => (
                <TouchableOpacity
                  key={printer.id}
                  style={styles.deviceRow}
                  onPress={() => connectToPrinter(printer)}
                  disabled={isConnecting}
                >
                  <View style={styles.deviceIcon}>
                    <Ionicons name={printer.type === 'wifi' ? 'wifi' : 'bluetooth'} size={20} color="#6B7280" />
                  </View>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{printer.name}</Text>
                    <Text style={styles.deviceAddr}>{printer.address}</Text>
                  </View>
                  {connectingPrinterId === printer.id ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <View style={styles.connectChip}>
                      <Text style={styles.connectChipText}>Connect</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Empty State */}
          {bluetoothEnabled && !isScanning && printers.length === 0 && !selectedPrinter && (
            <View style={styles.emptyCard}>
              <Ionicons name="bluetooth-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No devices found</Text>
              <Text style={styles.emptySubtext}>Make sure your printer is on and nearby</Text>
            </View>
          )}

          {/* Scanning State */}
          {isScanning && (
            <View style={styles.emptyCard}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.emptyText}>Searching for printers...</Text>
            </View>
          )}

          {/* Advanced Settings */}
          <TouchableOpacity style={styles.advancedHeader} onPress={() => setShowAdvanced(!showAdvanced)}>
            <View style={styles.advancedLeft}>
              <Ionicons name="settings-outline" size={18} color="#6B7280" />
              <Text style={styles.advancedTitle}>Advanced Settings</Text>
            </View>
            <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.card}>
              {/* Paper Width */}
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Paper Width</Text>
                <View style={styles.segmented}>
                  {['58', '80'].map((w) => (
                    <TouchableOpacity key={w} style={[styles.segmentBtn, paperWidth === w && styles.segmentBtnActive]} onPress={() => setPaperWidth(w)}>
                      <Text style={[styles.segmentText, paperWidth === w && styles.segmentTextActive]}>{w}mm</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Print Density */}
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Density</Text>
                <View style={styles.segmented}>
                  {['1', '2', '3', '4'].map((d) => (
                    <TouchableOpacity key={d} style={[styles.segmentBtn, printDensity === d && styles.segmentBtnActive]} onPress={() => setPrintDensity(d)}>
                      <Text style={[styles.segmentText, printDensity === d && styles.segmentTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Toggles */}
              <View style={styles.toggleRow}>
                <Text style={styles.settingLabel}>Auto Cut</Text>
                <Switch value={autoCutEnabled} onValueChange={setAutoCutEnabled} trackColor={{ false: '#E5E7EB', true: '#3B82F6' }} thumbColor="#FFF" />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.settingLabel}>Test on Connect</Text>
                <Switch value={testPrintEnabled} onValueChange={setTestPrintEnabled} trackColor={{ false: '#E5E7EB', true: '#3B82F6' }} thumbColor="#FFF" />
              </View>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity style={styles.saveBtn} onPress={saveConfig}>
            <Text style={styles.saveBtnText}>Save Settings</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8FAFC',
    zIndex: 1000,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 50,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  btRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btIconWrap: {
    marginRight: 12,
  },
  btIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btInfo: {
    flex: 1,
  },
  btTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  btStatus: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
  },
  scanBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
    marginLeft: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceIconConnected: {
    backgroundColor: '#ECFDF5',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  deviceAddr: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  deviceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3B82F6',
  },
  disconnectBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#3B82F6',
    borderRadius: 20,
  },
  connectChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    marginBottom: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  advancedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  advancedTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  segmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#3B82F6',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PrinterSetupScreen;
