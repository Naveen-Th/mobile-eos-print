/**
 * Bluetooth Test Utility
 * 
 * Tests Bluetooth connectivity for thermal printers
 * Supports both Classic Bluetooth and BLE
 */

import { Platform } from 'react-native';

// Import Bluetooth modules
let BluetoothManager: any = null;

try {
  const BluetoothModule = require('react-native-bluetooth-escpos-printer');
  BluetoothManager = BluetoothModule.BluetoothManager;
} catch (error) {
  console.warn('Bluetooth module not available:', error);
}

export interface BluetoothTestResult {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Test if Bluetooth module is available
 */
export async function testBluetoothModule(): Promise<BluetoothTestResult> {
  if (!BluetoothManager) {
    return {
      success: false,
      message: 'Bluetooth module not loaded. Please rebuild the app.',
    };
  }

  return {
    success: true,
    message: 'Bluetooth module loaded successfully',
    details: {
      platform: Platform.OS,
      version: Platform.Version,
    },
  };
}

/**
 * Test if Bluetooth is enabled on device
 */
export async function testBluetoothEnabled(): Promise<BluetoothTestResult> {
  try {
    if (!BluetoothManager) {
      return {
        success: false,
        message: 'Bluetooth module not available',
      };
    }

    const isEnabled = await BluetoothManager.isBluetoothEnabled();
    
    return {
      success: isEnabled,
      message: isEnabled 
        ? 'Bluetooth is enabled' 
        : 'Bluetooth is disabled. Please enable it in device settings.',
      details: { isEnabled },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Bluetooth check failed: ${error.message}`,
      details: error,
    };
  }
}

/**
 * Test Bluetooth device scanning
 */
export async function testBluetoothScan(): Promise<BluetoothTestResult> {
  try {
    if (!BluetoothManager) {
      return {
        success: false,
        message: 'Bluetooth module not available',
      };
    }

    // Check if enabled first
    const isEnabled = await BluetoothManager.isBluetoothEnabled();
    if (!isEnabled) {
      return {
        success: false,
        message: 'Bluetooth is not enabled',
      };
    }

    // Scan for devices
    const devices = await BluetoothManager.scanDevices();
    const parsedDevices = typeof devices === 'string' ? JSON.parse(devices) : devices;

    const pairedCount = parsedDevices.paired?.length || 0;
    const foundCount = parsedDevices.found?.length || 0;
    const totalCount = pairedCount + foundCount;

    return {
      success: true,
      message: `Found ${totalCount} Bluetooth device(s)`,
      details: {
        paired: pairedCount,
        found: foundCount,
        devices: parsedDevices,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Bluetooth scan failed: ${error.message}`,
      details: error,
    };
  }
}

/**
 * Test connection to a specific device
 */
export async function testBluetoothConnection(
  address: string
): Promise<BluetoothTestResult> {
  try {
    if (!BluetoothManager) {
      return {
        success: false,
        message: 'Bluetooth module not available',
      };
    }

    await BluetoothManager.connect(address);

    return {
      success: true,
      message: `Successfully connected to ${address}`,
      details: { address },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
      details: { address, error },
    };
  }
}

/**
 * Run all Bluetooth tests
 */
export async function runAllBluetoothTests(): Promise<{
  results: BluetoothTestResult[];
  overallSuccess: boolean;
}> {
  const results: BluetoothTestResult[] = [];

  // Test 1: Module availability
  console.log('Testing Bluetooth module...');
  const moduleTest = await testBluetoothModule();
  results.push(moduleTest);
  console.log(`✓ Module test: ${moduleTest.message}`);

  if (!moduleTest.success) {
    return {
      results,
      overallSuccess: false,
    };
  }

  // Test 2: Bluetooth enabled
  console.log('Testing Bluetooth status...');
  const enabledTest = await testBluetoothEnabled();
  results.push(enabledTest);
  console.log(`✓ Enabled test: ${enabledTest.message}`);

  if (!enabledTest.success) {
    return {
      results,
      overallSuccess: false,
    };
  }

  // Test 3: Device scanning
  console.log('Testing Bluetooth scan...');
  const scanTest = await testBluetoothScan();
  results.push(scanTest);
  console.log(`✓ Scan test: ${scanTest.message}`);

  const overallSuccess = results.every((r) => r.success);

  return {
    results,
    overallSuccess,
  };
}

/**
 * Get Bluetooth capability information
 */
export function getBluetoothCapabilities(): {
  classicBluetooth: boolean;
  ble: boolean;
  notes: string[];
} {
  const notes: string[] = [];

  // Classic Bluetooth via react-native-bluetooth-escpos-printer
  const classicBluetooth = BluetoothManager !== null;
  
  if (classicBluetooth) {
    notes.push('Classic Bluetooth supported via react-native-bluetooth-escpos-printer');
    notes.push('Compatible with most thermal receipt printers');
  } else {
    notes.push('Classic Bluetooth not available - module not loaded');
  }

  // BLE status
  const ble = false; // Current implementation doesn't support BLE
  notes.push('BLE (Bluetooth Low Energy) not currently supported');
  notes.push('Most thermal printers use Classic Bluetooth, not BLE');

  return {
    classicBluetooth,
    ble,
    notes,
  };
}

export default {
  testBluetoothModule,
  testBluetoothEnabled,
  testBluetoothScan,
  testBluetoothConnection,
  runAllBluetoothTests,
  getBluetoothCapabilities,
};
