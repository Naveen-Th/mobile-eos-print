import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import MobileApp from './src/MobileApp';
import { AlertProvider } from './src/components/common/Alert';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  useEffect(() => {
    // Initialize the mobile app
    const initializeApp = async () => {
      try {
        console.log('Starting Thermal Receipt Printer Mobile App...');
        
        // Simulate initialization time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Hide splash screen
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
    <AlertProvider>
      <MobileApp />
      <StatusBar style="auto" />
    </AlertProvider>
  );
}
