import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryProvider } from './providers/QueryProvider';
import { useConnectionMonitor } from './hooks/useSyncManager';
import ItemsScreenNew from './components/ItemsScreenNew';
import SyncStatus from './components/SyncStatus';

// Connection monitor component
const ConnectionMonitor: React.FC = () => {
  useConnectionMonitor();
  return null;
};

const AppContent: React.FC = () => {
  return (
    <>
      <ConnectionMonitor />
      <ItemsScreenNew />
      <SyncStatus />
      <StatusBar style="auto" />
    </>
  );
};

export default function App() {
  return (
    <QueryProvider>
      <AppContent />
    </QueryProvider>
  );
}
