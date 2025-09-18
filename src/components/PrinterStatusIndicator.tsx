import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterStatus, PrinterStatus } from '../hooks/usePrinterStatus';

interface PrinterStatusIndicatorProps {
  onPress?: () => void;
  showDetailedStatus?: boolean;
  style?: any;
}

const PrinterStatusIndicator: React.FC<PrinterStatusIndicatorProps> = ({
  onPress,
  showDetailedStatus = false,
  style,
}) => {
  const {
    printerStatus,
    isChecking,
    refreshStatus,
    getStatusColor,
    getStatusText,
    getStatusIcon,
  } = usePrinterStatus();

  const formatLastCheck = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours}h ago`;
    }
  };

  const renderCompactStatus = () => (
    <TouchableOpacity
      style={[styles.compactContainer, style]}
      onPress={onPress || refreshStatus}
      activeOpacity={0.7}
    >
      <View style={styles.statusRow}>
        <View style={[
          styles.statusDot,
          { backgroundColor: getStatusColor(printerStatus.status) }
        ]} />
        
        {printerStatus.isConnected ? (
          <View style={styles.printerInfo}>
            <Text style={styles.printerName} numberOfLines={1}>
              {printerStatus.printer?.name || 'Unknown Printer'}
            </Text>
            <Text style={[
              styles.statusText,
              { color: getStatusColor(printerStatus.status) }
            ]}>
              {getStatusText(printerStatus.status)}
            </Text>
          </View>
        ) : (
          <Text style={styles.offlineText}>No printer connected</Text>
        )}

        {isChecking ? (
          <ActivityIndicator size="small" color="#6B7280" />
        ) : (
          <Ionicons
            name={getStatusIcon(printerStatus.status) as any}
            size={16}
            color={getStatusColor(printerStatus.status)}
          />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderDetailedStatus = () => (
    <TouchableOpacity
      style={[styles.detailedContainer, style]}
      onPress={onPress || refreshStatus}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons
            name="print"
            size={20}
            color={getStatusColor(printerStatus.status)}
          />
          <Text style={styles.title}>Printer Status</Text>
          {isChecking && (
            <ActivityIndicator size="small" color="#6B7280" />
          )}
        </View>
        <TouchableOpacity
          onPress={refreshStatus}
          style={styles.refreshButton}
        >
          <Ionicons
            name="refresh"
            size={16}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>

      {printerStatus.isConnected ? (
        <View style={styles.printerDetails}>
          <View style={styles.printerRow}>
            <Text style={styles.label}>Printer:</Text>
            <Text style={styles.value} numberOfLines={1}>
              {printerStatus.printer?.name || 'Unknown'}
            </Text>
          </View>
          
          <View style={styles.printerRow}>
            <Text style={styles.label}>Connection:</Text>
            <Text style={styles.value}>
              {printerStatus.printer?.type.toUpperCase() || 'Unknown'}
            </Text>
          </View>
          
          <View style={styles.printerRow}>
            <Text style={styles.label}>Status:</Text>
            <View style={styles.statusContainer}>
              <View style={[
                styles.smallStatusDot,
                { backgroundColor: getStatusColor(printerStatus.status) }
              ]} />
              <Text style={[
                styles.statusValue,
                { color: getStatusColor(printerStatus.status) }
              ]}>
                {getStatusText(printerStatus.status)}
              </Text>
            </View>
          </View>

          {printerStatus.error && (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={16} color="#EF4444" />
              <Text style={styles.errorText}>
                {printerStatus.error}
              </Text>
            </View>
          )}
          
          <View style={styles.lastCheckRow}>
            <Text style={styles.lastCheckText}>
              Last checked: {formatLastCheck(printerStatus.lastCheck)}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.offlineContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color="#9CA3AF" />
          <Text style={styles.offlineTitle}>No printer connected</Text>
          <Text style={styles.offlineSubtitle}>
            Tap to configure a thermal printer
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return showDetailedStatus ? renderDetailedStatus() : renderCompactStatus();
};

const styles = StyleSheet.create({
  compactContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  printerInfo: {
    flex: 1,
  },
  printerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  offlineText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  detailedContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  refreshButton: {
    padding: 4,
  },
  printerDetails: {
    space: 12,
  },
  printerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginLeft: 6,
    flex: 1,
  },
  lastCheckRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  lastCheckText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  offlineContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  offlineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  offlineSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default PrinterStatusIndicator;
