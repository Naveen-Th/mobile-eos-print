# Thermal Printer Integration Guide

## Overview
This app now uses **react-native-bluetooth-escpos-printer** for real Bluetooth thermal printer connectivity. The mock implementation has been replaced with actual hardware integration.

## Features Implemented

### ✅ Bluetooth Scanning
- Real Bluetooth device scanning using `BluetoothManager.scanDevices()`
- Discovers both paired and unpaired thermal printers
- Auto-detects nearby Bluetooth devices

### ✅ Printer Connection
- Direct Bluetooth connection to thermal printers
- Connection state management
- Persistent printer configuration storage

### ✅ ESC/POS Printing
- Full ESC/POS command support
- Professional receipt formatting
- Multiple text sizes and alignments
- Auto-cut paper support (configurable)

### ✅ Permission Handling
- Android 12+ (API 31+) Bluetooth permissions
- Android 11 and below Bluetooth permissions
- Location permission for Bluetooth scanning
- Runtime permission requests

## Package Used

```json
"react-native-bluetooth-escpos-printer": "^1.1.5"
```

This package provides:
- `BluetoothManager` - Device scanning and connection
- `BluetoothEscposPrinter` - ESC/POS printing commands
- `BluetoothTscPrinter` - TSC label printer commands

## Setup Instructions

### 1. Installation (Already Done)
```bash
npm install react-native-bluetooth-escpos-printer --save
```

### 2. iOS Setup (Info.plist)
Add these keys to `ios/ThermalReceiptPrinter/Info.plist`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app needs Bluetooth to connect to thermal printers</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app needs Bluetooth to connect to thermal printers</string>
```

### 3. Android Setup (Already Configured)
Permissions are already added to `AndroidManifest.xml`:
- ✅ BLUETOOTH_CONNECT
- ✅ BLUETOOTH_SCAN
- ✅ BLUETOOTH (for Android 11-)
- ✅ BLUETOOTH_ADMIN (for Android 11-)
- ✅ ACCESS_FINE_LOCATION

### 4. Rebuild Native Code
After installing the package, rebuild the app:

```bash
# For Android
cd android && ./gradlew clean && cd ..
npm run android

# For iOS
cd ios && pod install && cd ..
npm run ios
```

## Usage Examples

### Basic Usage in Your App

```typescript
import ThermalPrinterService from './services/ThermalPrinterService';

// Get service instance
const printerService = ThermalPrinterService.getInstance();

// 1. Request Permissions
const hasPermissions = await printerService.requestPermissions();
if (!hasPermissions) {
  Alert.alert('Error', 'Bluetooth permissions required');
  return;
}

// 2. Scan for Printers
const printers = await printerService.scanForPrinters();
console.log('Found printers:', printers);

// 3. Connect to a Printer
const printer = printers[0]; // Select first printer
const connected = await printerService.connectToPrinter(printer);

if (connected) {
  console.log('Connected to:', printer.name);
}

// 4. Print a Receipt
const receiptData = {
  storeInfo: {
    name: 'My Store',
    address: '123 Main Street',
    phone: '(555) 123-4567',
  },
  items: [
    {
      name: 'Product 1',
      price: 19.99,
      quantity: 2,
      total: 39.98,
    },
    {
      name: 'Product 2',
      price: 9.99,
      quantity: 1,
      total: 9.99,
    },
  ],
  subtotal: 49.97,
  tax: 4.00,
  total: 53.97,
  paymentMethod: 'Cash',
  receiptNumber: 'REC-001',
  timestamp: new Date(),
};

await printerService.printReceipt(receiptData);

// 5. Disconnect (optional)
await printerService.disconnect();
```

### Configuration Options

```typescript
// Update printer configuration
await printerService.updateConfiguration({
  paperWidth: 80,        // 58mm or 80mm
  printDensity: 3,       // 0-4 (higher = darker)
  autoCutEnabled: true,  // Auto-cut paper after print
  testPrintEnabled: true // Test print on connection
});

// Get current configuration
const config = printerService.getConfiguration();
console.log(config);
```

### Check Connection Status

```typescript
// Check if printer is connected
const isConnected = printerService.isConnected();

// Get connected printer info
const connectedPrinter = printerService.getConnectedPrinter();
if (connectedPrinter) {
  console.log('Connected to:', connectedPrinter.name);
}

// Get printer status
const status = await printerService.getPrinterStatus();
console.log('Printer status:', status);
```

## Advanced ESC/POS Commands

The service uses ESC/POS commands for professional thermal printing:

### Text Formatting
```typescript
// Initialize printer
await BluetoothEscposPrinter.printerInit();

// Print large text
await BluetoothEscposPrinter.printText('LARGE TEXT\n', {
  widthtimes: 2,
  heigthtimes: 2,
});

// Print normal text
await BluetoothEscposPrinter.printText('Normal text\n', {});

// Set alignment
await BluetoothEscposPrinter.printerAlign(
  BluetoothEscposPrinter.ALIGN.CENTER
);
await BluetoothEscposPrinter.printerAlign(
  BluetoothEscposPrinter.ALIGN.LEFT
);
await BluetoothEscposPrinter.printerAlign(
  BluetoothEscposPrinter.ALIGN.RIGHT
);
```

### Column Printing
```typescript
// Print two columns (e.g., item and price)
await BluetoothEscposPrinter.printColumn(
  [20, 10],  // Column widths
  [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
  ['Item Name', '$19.99'],
  {}
);
```

### Paper Control
```typescript
// Feed paper
await BluetoothEscposPrinter.printText('\n\n\n', {});

// Cut paper
await BluetoothEscposPrinter.cutOnePoint();
```

## Compatible Thermal Printers

This implementation works with ESC/POS compatible thermal printers:

### Tested Brands
- ✅ EPSON (TM-T82, TM-T88, etc.)
- ✅ Star Micronics (TSP143, TSP650, etc.)
- ✅ Zebra (ZD220, ZD410, etc.)
- ✅ Bixolon (SRP-275, SRP-350, etc.)
- ✅ Citizen (CT-S310, CT-S651, etc.)
- ✅ Generic ESC/POS printers

### Paper Sizes Supported
- 58mm thermal paper
- 80mm thermal paper (default)

## Troubleshooting

### Bluetooth Not Scanning
```typescript
// Enable Bluetooth programmatically
await BluetoothManager.enableBluetooth();

// Check if Bluetooth is enabled
const isEnabled = await BluetoothManager.isBluetoothEnabled();
console.log('Bluetooth enabled:', isEnabled);
```

### Connection Issues
- Ensure printer is powered on and charged
- Make sure printer is in pairing mode
- Check Bluetooth permissions are granted
- Try unpairing and re-pairing the device
- Restart Bluetooth on the phone

### Printing Issues
- Verify printer is ESC/POS compatible
- Check paper is loaded correctly
- Ensure printer has sufficient battery
- Try adjusting print density (0-4)
- Test with paper width setting (58mm vs 80mm)

### Permission Denied
```typescript
// Check permission status
import { PermissionsAndroid } from 'react-native';

const granted = await PermissionsAndroid.check(
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
);

if (!granted) {
  await printerService.requestPermissions();
}
```

## Error Handling

```typescript
try {
  await printerService.printReceipt(receiptData);
} catch (error) {
  if (error.message.includes('not connected')) {
    Alert.alert('Error', 'Printer not connected');
  } else if (error.message.includes('permission')) {
    Alert.alert('Error', 'Bluetooth permission required');
  } else {
    Alert.alert('Error', 'Failed to print: ' + error.message);
  }
}
```

## Performance Tips

1. **Reuse connections**: Don't disconnect after each print
2. **Batch operations**: Combine multiple prints when possible
3. **Cache printer info**: Store last connected printer
4. **Handle background**: Save state when app backgrounds

## Testing

### Test Print
```typescript
// Print a test receipt
await printerService.testPrint();
```

### Manual Testing Checklist
- [ ] Scan discovers printers
- [ ] Connection succeeds
- [ ] Test print works
- [ ] Receipt prints correctly
- [ ] Auto-cut works (if enabled)
- [ ] Disconnect works
- [ ] Reconnection works
- [ ] Multiple prints work
- [ ] Battery level sufficient
- [ ] Paper loaded correctly

## Next Steps

### Potential Enhancements
1. **WiFi Printer Support**: Add network printer capability
2. **USB Printer Support**: Add USB OTG printer support
3. **QR Code Printing**: Generate and print QR codes
4. **Barcode Printing**: Print various barcode formats
5. **Logo Printing**: Print store logo/images
6. **Multi-language**: Support international character sets
7. **Receipt Templates**: Pre-defined receipt layouts
8. **Print Queue**: Queue multiple print jobs

## Resources

- [react-native-bluetooth-escpos-printer docs](https://github.com/januslo/react-native-bluetooth-escpos-printer)
- [ESC/POS Command Reference](https://reference.epson-biz.com/modules/ref_escpos/index.php)
- [Bluetooth Permissions Guide](https://developer.android.com/guide/topics/connectivity/bluetooth/permissions)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review printer compatibility
3. Verify permissions are granted
4. Check Bluetooth is enabled
5. Ensure printer is ESC/POS compatible

---

**Last Updated**: 2025-10-26
**Package Version**: react-native-bluetooth-escpos-printer@1.1.5
