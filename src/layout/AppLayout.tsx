import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { CartProvider } from '../context/CartContext';
import TabLayout from '../app/(tabs)/_layout';
import QueryProvider from '../providers/QueryProvider';
import { enableMapSet } from 'immer';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import MobileAuthService, { MobileUser } from '../services/MobileAuthService';
import { useSyncStore } from '../store/syncStore';

// Enable Immer MapSet plugin for Map and Set support
enableMapSet();

interface AppLayoutProps {
  user?: MobileUser | null;
  onLogout?: () => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({ user: propUser, onLogout }) => {
  const [currentUser, setCurrentUser] = useState<MobileUser | null>(propUser || null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const { reset: resetSyncStore } = useSyncStore();

  // Initialize auth service and setup auth state listener
  useEffect(() => {
    console.log('AppLayout: Initializing auth service...');
    
    const initializeAuth = async () => {
      try {
        // Initialize the auth service
        MobileAuthService.initialize();

        // Set up auth state change listener
        const unsubscribe = MobileAuthService.onAuthStateChanged((user) => {
          console.log('AppLayout: Auth state changed:', user ? `User ${user.email}` : 'No user');
          setCurrentUser(user);
          setAuthError(null);
          setIsLoading(false);
          
          // Reset sync store when user changes
          if (!user) {
            resetSyncStore();
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('AppLayout: Failed to initialize auth:', error);
        setAuthError(error instanceof Error ? error.message : 'Failed to initialize authentication');
        setIsLoading(false);
      }
    };

    const unsubscribe = initializeAuth();
    
    // Cleanup function
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      } else if (unsubscribe && typeof unsubscribe.then === 'function') {
        // Handle Promise<() => void>
        unsubscribe.then(unsub => {
          if (typeof unsub === 'function') {
            unsub();
          }
        });
      }
    };
  }, [resetSyncStore]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      console.log('AppLayout: Logging out user...');
      await MobileAuthService.signOut();
      
      // Call the provided onLogout callback if available
      if (onLogout && typeof onLogout === 'function') {
        onLogout();
      }
    } catch (error) {
      console.error('AppLayout: Logout error:', error);
      Alert.alert(
        'Logout Error',
        'Failed to logout properly. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [onLogout]);

  // Show loading state
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#6b7280' }}>Initializing app...</Text>
      </View>
    );
  }

  // Show auth error state
  if (authError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 20 }}>
        <Text style={{ fontSize: 18, color: '#ef4444', textAlign: 'center', marginBottom: 16 }}>
          Authentication Error
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
          {authError}
        </Text>
      </View>
    );
  }

  // For now, we'll render the app without requiring authentication
  // In a full implementation, you might want to show a login screen when currentUser is null
  return (
    <QueryProvider>
      <CartProvider>
        <NavigationContainer>
          <TabLayout user={currentUser} onLogout={handleLogout} />
        </NavigationContainer>
      </CartProvider>
    </QueryProvider>
  );
};

export default AppLayout;
