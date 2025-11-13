import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { enableScreens } from 'react-native-screens';
import MobileApp from './src/MobileApp';
import { AlertProvider } from './src/components/common/Alert';
import { enableMapSet } from 'immer';
import './src/global.css';
import ErrorBoundary from './src/components/ErrorBoundary';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Enable react-native-screens for better performance and fix navigation issues
enableScreens();

// Enable Immer MapSet plugin for Map and Set support
enableMapSet();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  useEffect(() => {
    // Initialize the mobile app
    const initializeApp = async () => {
      try {
        console.log('Starting Thermal Receipt Printer Mobile App...');
        
        // Hide splash screen immediately for fast perceived load time
        await SplashScreen.hideAsync();
        
        console.log('Mobile app initialized successfully');
      } catch (error) {
        console.error('Error initializing mobile app:', error);
        // Hide splash screen even if there's an error
        await SplashScreen.hideAsync();
      }
    };

    initializeApp();
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AlertProvider>
          <MobileApp />
          <StatusBar style="auto" />
        </AlertProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
