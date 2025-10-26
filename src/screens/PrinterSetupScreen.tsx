import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReceiptAlerts } from '../components/common/SpecializedAlerts';
import ThermalPrinterService, { ThermalPrinter } from '../services/ThermalPrinterService';

const { width, height } = Dimensions.get('window');

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
  
  // Configuration settings
  const [paperWidth, setPaperWidth] = useState('80'); // 58mm or 80mm
  const [printDensity, setPrintDensity] = useState('3'); // 0-4
  const [autoCutEnabled, setAutoCutEnabled] = useState(true);
  const [testPrintEnabled, setTestPrintEnabled] = useState(true);
  
  const printerService = ThermalPrinterService.getInstance();
  
  // Load saved printer configuration
  useEffect(() => {
    loadSavedConfiguration();
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
      }
    } catch (error) {
      console.error('Failed to load printer configuration:', error);
    }
  };


  const scanForPrinters = async () => {
    setIsScanning(true);
    
    try {
      const discoveredPrinters = await printerService.scanForPrinters();
      setPrinters(discoveredPrinters);
      
      if (discoveredPrinters.length > 0) {
        ReceiptAlerts.printerConnected(`Found ${discoveredPrinters.length} printer(s)`);
      } else {
        ReceiptAlerts.printerError('No printers found. Make sure Bluetooth is enabled.');
      }
    } catch (error: any) {
      ReceiptAlerts.printerError(error?.message || 'Failed to scan for printers');
    } finally {
      setIsScanning(false);
    }
  };

  const connectToPrinter = async (printer: Printer) => {
    setIsConnecting(true);
    setConnectingPrinterId(printer.id);
    
    try {
      // Skip test print on connection
      const connected = await printerService.connectToPrinter(printer, true);
      
      if (connected) {
        const connectedPrinter = { ...printer, status: 'connected' as const };
        setSelectedPrinter(connectedPrinter);
        
        // Update printer list to show connected status
        setPrinters(prev => 
          prev.map(p => 
            p.id === printer.id 
              ? connectedPrinter
              : { ...p, status: 'disconnected' as const }
          )
        );
        
        // Show success message
        ReceiptAlerts.printerConnected(`Successfully connected to ${printer.name}`);
        
        // Update configuration
        await printerService.updateConfiguration({
          paperWidth: parseInt(paperWidth),
          printDensity: parseInt(printDensity),
          autoCutEnabled,
          testPrintEnabled,
        });
        
        if (onPrinterSelected) {
          onPrinterSelected(connectedPrinter);
        }
      }
      
    } catch (error: any) {
      console.error('Connection error:', error);
      ReceiptAlerts.printerError(
        error?.message || 'Failed to connect to printer. Check printer is on and in range.'
      );
    } finally {
      setIsConnecting(false);
      setConnectingPrinterId(null);
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
      ReceiptAlerts.printerDisconnected();
      
    } catch (error) {
      ReceiptAlerts.printerError('Failed to disconnect printer');
    }
  };

  const testPrint = async () => {
    if (!selectedPrinter) {
      ReceiptAlerts.printerError('No printer selected');
      return;
    }
    
    try {
      await printerService.testPrint();
      ReceiptAlerts.receiptPrintSuccess();
    } catch (error) {
      ReceiptAlerts.printerError('Test print failed');
    }
  };

  const renderPrinterItem = (printer: Printer) => (
    <View key={printer.id} style={styles.printerItem}>
      <View style={styles.printerInfo}>
        <View style={styles.printerHeader}>
          <Ionicons
            name={
              printer.type === 'bluetooth' ? 'bluetooth' :
              printer.type === 'wifi' ? 'wifi' : 'cable'
            }
            size={24}
            color={printer.status === 'connected' ? '#10B981' : '#6B7280'}
          />
          <Text style={styles.printerName}>{printer.name}</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: 
              printer.status === 'connected' ? '#10B981' :
              printer.status === 'connecting' ? '#F59E0B' :
              printer.status === 'error' ? '#EF4444' : '#6B7280'
            }
          ]}>
            <Text style={styles.statusText}>
              {printer.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.printerAddress}>{printer.address}</Text>
        <Text style={styles.printerType}>{printer.type.toUpperCase()}</Text>
      </View>
      
      <TouchableOpacity
        style={[
          styles.connectButton,
          printer.status === 'connected' && styles.disconnectButton
        ]}
        onPress={() => 
          printer.status === 'connected' 
            ? disconnectPrinter()
            : connectToPrinter(printer)
        }
        disabled={isConnecting}
      >
        {connectingPrinterId === printer.id ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.connectButtonText}>
            {printer.status === 'connected' ? 'Disconnect' : 'Connect'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.fullScreenContainer}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LinearGradient
          colors={['#DC2626', '#EF4444', '#F97316']}
          style={styles.gradientBackground}
        >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="settings" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Printer Setup</Text>
              <Text style={styles.headerSubtitle}>Configure printer</Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.contentCard}>
            {/* Connected Device Section - Shows when printer is connected */}
            {selectedPrinter && (
              <View style={styles.currentPrinterSection}>
                <Text style={styles.sectionTitle}>✓ Connected Device</Text>
                <View style={styles.currentPrinter}>
                  <View style={styles.connectedIconContainer}>
                    <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                  </View>
                  <View style={styles.currentPrinterInfo}>
                    <Text style={styles.currentPrinterName}>{selectedPrinter.name}</Text>
                    <Text style={styles.currentPrinterStatus}>✓ Connected & Ready to Print</Text>
                    <Text style={styles.currentPrinterAddress}>{selectedPrinter.address}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.testButton}
                    onPress={testPrint}
                  >
                    <Text style={styles.testButtonText}>Test Print</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Available Printers Section */}
            <View style={styles.scanSection}>
              <View style={styles.scanHeader}>
                <Text style={styles.sectionTitle}>Available Printers</Text>
                <TouchableOpacity
                  style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
                  onPress={scanForPrinters}
                  disabled={isScanning}
                >
                  {isScanning ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="refresh" size={16} color="#FFFFFF" />
                  )}
                  <Text style={styles.scanButtonText}>
                    {isScanning ? 'Scanning...' : 'Scan'}
                  </Text>
                </TouchableOpacity>
              </View>

              {printers.length === 0 && !isScanning ? (
                <View style={styles.emptyState}>
                  <Ionicons name="print-outline" size={48} color="#9CA3AF" />
                  <Text style={styles.emptyStateText}>No printers found</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Tap scan to search for available thermal printers
                  </Text>
                </View>
              ) : isScanning ? (
                <View style={styles.scanningState}>
                  <ActivityIndicator size="large" color="#DC2626" />
                  <Text style={styles.scanningText}>Scanning for printers...</Text>
                  <Text style={styles.scanningSubtext}>This may take a few moments</Text>
                </View>
              ) : (
                <View style={styles.printersList}>
                  {printers.map(renderPrinterItem)}
                </View>
              )}
            </View>

            {/* Configuration Section */}
            <View style={styles.configSection}>
              <TouchableOpacity
                style={styles.advancedToggle}
                onPress={() => setShowAdvanced(!showAdvanced)}
              >
                <Text style={styles.sectionTitle}>Advanced Settings</Text>
                <Ionicons
                  name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>

              {showAdvanced && (
                <View style={styles.advancedSettings}>
                  
                  {/* Paper Width */}
                  <View style={styles.settingItem}>
                    <Text style={styles.settingLabel}>Paper Width</Text>
                    <View style={styles.segmentedControl}>
                      {['58', '80'].map((width) => (
                        <TouchableOpacity
                          key={width}
                          style={[
                            styles.segmentedButton,
                            paperWidth === width && styles.segmentedButtonActive
                          ]}
                          onPress={() => setPaperWidth(width)}
                        >
                          <Text style={[
                            styles.segmentedButtonText,
                            paperWidth === width && styles.segmentedButtonTextActive
                          ]}>
                            {width}mm
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Print Density */}
                  <View style={styles.settingItem}>
                    <Text style={styles.settingLabel}>Print Density</Text>
                    <View style={styles.segmentedControl}>
                      {['1', '2', '3', '4'].map((density) => (
                        <TouchableOpacity
                          key={density}
                          style={[
                            styles.segmentedButton,
                            printDensity === density && styles.segmentedButtonActive
                          ]}
                          onPress={() => setPrintDensity(density)}
                        >
                          <Text style={[
                            styles.segmentedButtonText,
                            printDensity === density && styles.segmentedButtonTextActive
                          ]}>
                            {density}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Auto Cut */}
                  <View style={styles.settingItem}>
                    <Text style={styles.settingLabel}>Auto Cut Paper</Text>
                    <Switch
                      value={autoCutEnabled}
                      onValueChange={setAutoCutEnabled}
                      trackColor={{ false: '#E5E7EB', true: '#DC2626' }}
                      thumbColor={autoCutEnabled ? '#FFFFFF' : '#9CA3AF'}
                    />
                  </View>

                  {/* Test Print on Connect */}
                  <View style={styles.settingItem}>
                    <Text style={styles.settingLabel}>Test Print on Connect</Text>
                    <Switch
                      value={testPrintEnabled}
                      onValueChange={setTestPrintEnabled}
                      trackColor={{ false: '#E5E7EB', true: '#DC2626' }}
                      thumbColor={testPrintEnabled ? '#FFFFFF' : '#9CA3AF'}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={async () => {
                await printerService.updateConfiguration({
                  paperWidth: parseInt(paperWidth),
                  printDensity: parseInt(printDensity),
                  autoCutEnabled,
                  testPrintEnabled,
                });
                ReceiptAlerts.receiptSaveSuccess('Printer configuration');
                onClose();
              }}
            >
              <Text style={styles.saveButtonText}>Save Configuration</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width,
    height: height,
    zIndex: 1000,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
    padding: 8,
    borderRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  contentCard: {
    padding: 20,
    paddingBottom: 40,
  },
  currentPrinterSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  currentPrinter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  connectedIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  currentPrinterInfo: {
    flex: 1,
    marginLeft: 12,
  },
  currentPrinterName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  currentPrinterStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 2,
  },
  currentPrinterAddress: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  testButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  scanSection: {
    marginBottom: 24,
  },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  scanButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0.1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  scanningState: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  scanningText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 16,
  },
  scanningSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  printersList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  printerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  printerInfo: {
    flex: 1,
  },
  printerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  printerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  printerAddress: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  printerType: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  connectButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  disconnectButton: {
    backgroundColor: '#6B7280',
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  configSection: {
    marginBottom: 24,
  },
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  advancedSettings: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1F2937',
    flex: 1,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  segmentedButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  segmentedButtonActive: {
    backgroundColor: '#DC2626',
  },
  segmentedButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  segmentedButtonTextActive: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PrinterSetupScreen;
