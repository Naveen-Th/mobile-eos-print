import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { CartProvider } from '../context/CartContext';
import TabLayout from '../app/(tabs)/_layout';
import QueryProvider from '../providers/QueryProvider';
import { enableMapSet } from 'immer';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import MobileAuthService, { MobileUser } from '../services/auth/MobileAuthService';
import { useSyncStore } from '../store/syncStore';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import PendingBillsScreen from '../screens/PendingBillsScreen';
import PaymentRemindersScreen from '../screens/PaymentRemindersScreen';

// Enable Immer MapSet plugin for Map and Set support
enableMapSet();

const Stack = createStackNavigator();

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
    if (__DEV__) {
      console.log('AppLayout: Initializing auth service...');
    }
    
    // If user is provided from props, we're already authenticated (possibly offline)
    if (propUser) {
      if (__DEV__) {
        console.log('✅ AppLayout: User provided from props, skipping auth initialization');
      }
      setCurrentUser(propUser);
      setIsLoading(false);
      return;
    }
    
    const initializeAuth = async () => {
      try {
        // Try to restore stored session from AsyncStorage first (for instant app access)
        // This is already handled by MobileApp, so skip here to avoid duplication
        // try {
        //   const stored = await MobileAuthService.loadStoredSession();
        //   if (stored) {
        //     console.log('🔄 Restored stored session, user can access app immediately');
        //     setCurrentUser(stored);
        //     setIsLoading(false);
        //   }
        // } catch (restoreError) {
        //   console.warn('Failed to restore session:', restoreError);
        // }

        // Initialize the auth service (will sync with Firebase in background)
        // This is safe to call even if Firebase isn't initialized - it will just skip setup
        MobileAuthService.initialize();

        // Set up auth state change listener
        // This returns a no-op function if Firebase isn't initialized
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
        // Don't set error if we have a stored session
        if (!currentUser) {
          setAuthError(error instanceof Error ? error.message : 'Failed to initialize authentication');
        }
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
      
      // Call the provided onLogout callback first if available (for MobileApp coordination)
      if (onLogout && typeof onLogout === 'function') {
        await onLogout();
      } else {
        // If no callback provided, handle logout directly
        await MobileAuthService.signOut();
      }
    } catch (error) {
      console.error('AppLayout: Logout error:', error);
      Alert.alert(
        'Logout Error',
        'Failed to logout properly. Please try again.',
        [{ text: 'OK' }]
      );
      throw error; // Re-throw to let caller handle if needed
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
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs">
              {(props) => <TabLayout {...props} user={currentUser} onLogout={handleLogout} />}
            </Stack.Screen>
            <Stack.Screen 
              name="AnalyticsScreen" 
              component={AnalyticsScreen}
              options={{
                headerShown: true,
                title: 'Analytics & Reports',
                headerStyle: { backgroundColor: '#fff' },
                headerTitleStyle: { fontWeight: 'bold' },
              }}
            />
            <Stack.Screen 
              name="PendingBillsScreen" 
              component={PendingBillsScreen}
              options={{
                headerShown: true,
                title: 'Pending Bills',
                headerStyle: { backgroundColor: '#fff' },
                headerTitleStyle: { fontWeight: 'bold' },
              }}
            />
            <Stack.Screen 
              name="PaymentRemindersScreen" 
              component={PaymentRemindersScreen}
              options={{
                headerShown: false,
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </CartProvider>
    </QueryProvider>
  );
};

export default AppLayout;
