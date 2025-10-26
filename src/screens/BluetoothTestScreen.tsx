import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  runAllBluetoothTests,
  getBluetoothCapabilities,
  BluetoothTestResult,
} from '../utils/BluetoothTest';

/**
 * Bluetooth Test Screen
 * 
 * Tests Bluetooth functionality for thermal printers
 */
const BluetoothTestScreen: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<BluetoothTestResult[]>([]);
  const [overallSuccess, setOverallSuccess] = useState<boolean | null>(null);

  const capabilities = getBluetoothCapabilities();

  const handleRunTests = async () => {
    setTesting(true);
    setTestResults([]);
    setOverallSuccess(null);

    try {
      const { results, overallSuccess: success } = await runAllBluetoothTests();
      setTestResults(results);
      setOverallSuccess(success);

      if (success) {
        Alert.alert('Success', 'All Bluetooth tests passed! ✓');
      } else {
        Alert.alert('Warning', 'Some Bluetooth tests failed. Check results below.');
      }
    } catch (error: any) {
      Alert.alert('Error', `Test failed: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? '✓' : '✗';
  };

  const getStatusColor = (success: boolean) => {
    return success ? '#10B981' : '#EF4444';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Bluetooth Test</Text>
        <Text style={styles.subtitle}>Check Bluetooth connectivity for thermal printers</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Capabilities Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bluetooth Capabilities</Text>
          
          <View style={styles.capabilityRow}>
            <Text style={styles.capabilityLabel}>Classic Bluetooth:</Text>
            <Text
              style={[
                styles.capabilityValue,
                { color: capabilities.classicBluetooth ? '#10B981' : '#EF4444' },
              ]}
            >
              {capabilities.classicBluetooth ? 'Supported ✓' : 'Not Available ✗'}
            </Text>
          </View>

          <View style={styles.capabilityRow}>
            <Text style={styles.capabilityLabel}>BLE (Low Energy):</Text>
            <Text
              style={[
                styles.capabilityValue,
                { color: capabilities.ble ? '#10B981' : '#9CA3AF' },
              ]}
            >
              {capabilities.ble ? 'Supported ✓' : 'Not Supported'}
            </Text>
          </View>

          <View style={styles.notesSection}>
            {capabilities.notes.map((note, index) => (
              <Text key={index} style={styles.noteText}>
                • {note}
              </Text>
            ))}
          </View>
        </View>

        {/* Test Button */}
        <TouchableOpacity
          style={[styles.testButton, testing && styles.testButtonDisabled]}
          onPress={handleRunTests}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.testButtonText}>Run Bluetooth Tests</Text>
          )}
        </TouchableOpacity>

        {/* Test Results */}
        {testResults.length > 0 && (
          <View style={styles.resultsCard}>
            <View style={styles.resultsHeader}>
              <Text style={styles.cardTitle}>Test Results</Text>
              {overallSuccess !== null && (
                <View
                  style={[
                    styles.overallBadge,
                    {
                      backgroundColor: overallSuccess
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.overallBadgeText,
                      { color: overallSuccess ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {overallSuccess ? 'PASSED' : 'FAILED'}
                  </Text>
                </View>
              )}
            </View>

            {testResults.map((result, index) => (
              <View key={index} style={styles.resultItem}>
                <View style={styles.resultHeader}>
                  <Text
                    style={[
                      styles.resultIcon,
                      { color: getStatusColor(result.success) },
                    ]}
                  >
                    {getStatusIcon(result.success)}
                  </Text>
                  <Text style={styles.resultMessage}>{result.message}</Text>
                </View>
                {result.details && (
                  <View style={styles.resultDetails}>
                    <Text style={styles.detailsLabel}>Details:</Text>
                    <Text style={styles.detailsText}>
                      {JSON.stringify(result.details, null, 2)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.cardTitle}>How to Test</Text>
          <Text style={styles.instructionText}>
            1. Ensure your device's Bluetooth is turned on{'\n'}
            2. Have a Bluetooth thermal printer nearby (powered on){'\n'}
            3. Tap "Run Bluetooth Tests" button{'\n'}
            4. Check results below{'\n\n'}
            
            Note: Most thermal printers use Classic Bluetooth, not BLE.
          </Text>
        </View>

        {/* Troubleshooting */}
        {overallSuccess === false && (
          <View style={styles.troubleshootingCard}>
            <Text style={styles.cardTitle}>Troubleshooting</Text>
            <Text style={styles.instructionText}>
              If tests fail:{'\n\n'}
              
              • Module not loaded: Rebuild the app{'\n'}
              • Bluetooth disabled: Enable in device settings{'\n'}
              • No devices found: Turn on printer and pair it{'\n'}
              • Permission denied: Grant Bluetooth permissions{'\n'}
              • Connection failed: Restart printer and try again
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#DC2626',
    padding: 20,
    paddingBottom: 30,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  capabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  capabilityLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  capabilityValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  notesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  noteText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  testButton: {
    backgroundColor: '#DC2626',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  testButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  overallBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  overallBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 12,
  },
  resultMessage: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  resultDetails: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  instructionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  troubleshootingCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
});

export default BluetoothTestScreen;
