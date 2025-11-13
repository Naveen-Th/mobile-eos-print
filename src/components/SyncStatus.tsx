import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { 
  useConnectionState, 
  usePendingUpdates, 
  useFailedUpdates, 
  useSyncMetrics,
  useSyncStore 
} from '../store/syncStore';
import { queryUtils } from '../providers/QueryProvider';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import OfflineFirstService from '../services/storage/OfflineFirstService';
import SyncEngine from '../sync/SyncEngine';

const SyncStatus: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  const connectionState = useConnectionState();
  const pendingUpdates = usePendingUpdates();
  const failedUpdates = useFailedUpdates();
  const metrics = useSyncMetrics();
  const { clearFailedUpdates, retryFailedUpdate } = useSyncStore();
  const networkStatus = useNetworkStatus();

  const getConnectionColor = () => {
    if (!connectionState.isOnline) return '#ef4444';
    if (!connectionState.isConnected) return '#f59e0b';
    switch (connectionState.connectionQuality) {
      case 'excellent': return '#10b981';
      case 'good': return '#10b981';
      case 'poor': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getConnectionIcon = () => {
    if (!connectionState.isOnline) return '🔴';
    if (!connectionState.isConnected) return '🟡';
    switch (connectionState.connectionQuality) {
      case 'excellent': return '🟢';
      case 'good': return '🟢';
      case 'poor': return '🟡';
      default: return '⚪';
    }
  };

  const handleRetryAll = async () => {
    const failed = Array.from(failedUpdates.keys());
    failed.forEach(id => retryFailedUpdate(id));
  };

  const handleManualSync = async () => {
    if (syncing || !connectionState.isConnected) return;
    
    setSyncing(true);
    try {
      await SyncEngine.sync();
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const cacheStats = queryUtils.getCacheStats();
  const pendingCount = pendingUpdates.size;
  const failedCount = failedUpdates.size;

  return (
    <>
      {/* Floating status indicator */}
      <TouchableOpacity
        onPress={() => setShowDetails(true)}
        style={{
          position: 'absolute',
          top: 100,
          right: 20,
          backgroundColor: 'rgba(0,0,0,0.8)',
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 6,
          flexDirection: 'row',
          alignItems: 'center',
          zIndex: 1000,
        }}
      >
        <Text style={{ color: 'white', fontSize: 12, marginRight: 4 }}>
          {getConnectionIcon()}
        </Text>
        {(pendingCount > 0 || failedCount > 0) && (
          <Text style={{ 
            color: failedCount > 0 ? '#ef4444' : '#f59e0b', 
            fontSize: 10, 
            fontWeight: 'bold' 
          }}>
            {pendingCount + failedCount}
          </Text>
        )}
      </TouchableOpacity>

      {/* Detailed status modal */}
      <Modal
        visible={showDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
          {/* Header */}
          <View style={{
            backgroundColor: 'white',
            paddingHorizontal: 20,
            paddingTop: 60,
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1f2937' }}>
                Sync Status
              </Text>
              <TouchableOpacity
                onPress={() => setShowDetails(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#f3f4f6',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 18, color: '#6b7280' }}>×</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <View style={{ flex: 1, padding: 20 }}>
            {/* Connection Status */}
            <View style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
            }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 15 }}>
                🌐 Connection Status
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>{getConnectionIcon()}</Text>
                <Text style={{ 
                  fontSize: 16, 
                  color: getConnectionColor(),
                  fontWeight: '600' 
                }}>
                  {connectionState.isOnline ? 
                    (connectionState.isConnected ? 
                      `Connected (${connectionState.connectionQuality})` : 
                      'Connecting...') : 
                    'Offline'
                  }
                </Text>
              </View>

              {connectionState.lastSync && (
                <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 10 }}>
                  Last sync: {connectionState.lastSync.toLocaleString()}
                </Text>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Network: </Text>
                <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '600' }}>
                  {networkStatus.type.toUpperCase()} {networkStatus.effectiveType ? `(${networkStatus.effectiveType})` : ''}
                </Text>
              </View>

              {connectionState.isConnected && (
                <TouchableOpacity
                  onPress={handleManualSync}
                  disabled={syncing}
                  style={{
                    backgroundColor: syncing ? '#9ca3af' : '#3b82f6',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {syncing ? (
                    <>
                      <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                      <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>
                        Syncing...
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>
                      🔄 Sync Now
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Sync Operations */}
            <View style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
            }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 15 }}>
                🔄 Sync Operations
              </Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Pending:</Text>
                <Text style={{ 
                  fontSize: 14, 
                  color: pendingCount > 0 ? '#f59e0b' : '#6b7280',
                  fontWeight: pendingCount > 0 ? 'bold' : 'normal'
                }}>
                  {pendingCount}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Failed:</Text>
                <Text style={{ 
                  fontSize: 14, 
                  color: failedCount > 0 ? '#ef4444' : '#6b7280',
                  fontWeight: failedCount > 0 ? 'bold' : 'normal'
                }}>
                  {failedCount}
                </Text>
              </View>

              {failedCount > 0 && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                  <TouchableOpacity
                    onPress={handleRetryAll}
                    style={{
                      backgroundColor: '#3b82f6',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 6,
                      flex: 1,
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
                      Retry All
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={clearFailedUpdates}
                    style={{
                      backgroundColor: '#ef4444',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 6,
                      flex: 1,
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
                      Clear Failed
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Performance Metrics */}
            <View style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
            }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 15 }}>
                📊 Performance Metrics
              </Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Total Syncs:</Text>
                <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '600' }}>
                  {metrics.totalSyncs}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Failed Syncs:</Text>
                <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '600' }}>
                  {metrics.failedSyncs}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Success Rate:</Text>
                <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '600' }}>
                  {metrics.totalSyncs > 0 ? 
                    `${(((metrics.totalSyncs - metrics.failedSyncs) / metrics.totalSyncs) * 100).toFixed(1)}%` : 
                    '0%'
                  }
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Avg Sync Time:</Text>
                <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '600' }}>
                  {metrics.avgSyncTime > 0 ? `${metrics.avgSyncTime.toFixed(0)}ms` : 'N/A'}
                </Text>
              </View>
            </View>

            {/* Cache Stats */}
            <View style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
            }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 15 }}>
                💾 Cache Statistics
              </Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Total Queries:</Text>
                <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '600' }}>
                  {cacheStats.totalQueries}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Active Queries:</Text>
                <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '600' }}>
                  {cacheStats.activeQueries}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Stale Queries:</Text>
                <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '600' }}>
                  {cacheStats.staleQueries}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  queryUtils.clearCache();
                  setShowDetails(false);
                }}
                style={{
                  backgroundColor: '#f59e0b',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 6,
                }}
              >
                <Text style={{ color: 'white', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
                  Clear Cache
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default SyncStatus;
