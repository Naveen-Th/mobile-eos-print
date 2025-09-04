import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SignInForm from './components/SignInForm';
import MobileAuthService, { MobileUser } from './services/MobileAuthService';
import AppLayout from './layout/AppLayout';

const MobileApp: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<MobileUser | null>(null);

  useEffect(() => {
    // Initialize Firebase Auth service
    MobileAuthService.initialize();
    
    // Set up auth state listener
    const unsubscribe = MobileAuthService.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    try {
      await MobileAuthService.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleSignInSuccess = (user: MobileUser) => {
    console.log('User signed in successfully:', user.email);
    // User state is automatically updated via auth state listener
  };

  const handleSignInError = (error: string) => {
    console.error('Sign in error:', error);
  };

  // Loading screen
  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f0f9ff',
          padding: 20
        }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{
              width: 64,
              height: 64,
              backgroundColor: '#2563eb',
              borderRadius: 32,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16
            }}>
              <ActivityIndicator size="large" color="white" />
            </View>
            <Text style={{
              fontSize: 20,
              fontWeight: '600',
              color: '#111827',
              marginBottom: 8,
              textAlign: 'center'
            }}>
              Thermal Receipt Printer
            </Text>
            <Text style={{
              fontSize: 16,
              color: '#6b7280',
              textAlign: 'center'
            }}>
              Initializing Firebase...
            </Text>
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  // Main app when user is authenticated
  if (currentUser) {
    return (
      <SafeAreaProvider>
        <AppLayout user={currentUser} onLogout={handleSignOut} />
      </SafeAreaProvider>
    );
  }

  // Sign-in form when user is not authenticated
  return (
    <SafeAreaProvider>
      <SignInForm 
        onSignInSuccess={handleSignInSuccess}
        onSignInError={handleSignInError}
      />
    </SafeAreaProvider>
  );
};

export default MobileApp;
