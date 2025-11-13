# Thermal Printer Quick Start

## What Changed?

✅ **Removed**: Mock Bluetooth data  
✅ **Added**: Real `react-native-bluetooth-escpos-printer` integration  
✅ **Updated**: ThermalPrinterService with actual Bluetooth scanning and ESC/POS printing  
✅ **Configured**: Android Bluetooth permissions for all API levels  

## Files Modified

1. **`src/services/ThermalPrinterService.ts`** - Complete rewrite with real implementation
2. **`src/screens/PrinterSetupScreen.tsx`** - Removed mock printers
3. **`android/app/src/main/AndroidManifest.xml`** - Added Bluetooth permissions

## Files Created

1. **`THERMAL_PRINTER_GUIDE.md`** - Comprehensive documentation
2. **`src/components/ThermalPrinterExample.tsx`** - Working example component
3. **`THERMAL_PRINTER_QUICKSTART.md`** - This file

## Next Steps

### 1. Rebuild the App

```bash
cd /Users/Apple/Documents/Print/ThermalReceiptPrinter/mobile

# For Android
cd android && ./gradlew clean && cd ..
npm run android

# For iOS (add Bluetooth permissions to Info.plist first)
cd ios && pod install && cd ..
npm run ios
```

### 2. Add iOS Bluetooth Permissions

Edit `ios/ThermalReceiptPrinter/Info.plist` and add:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app needs Bluetooth to connect to thermal printers</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app needs Bluetooth to connect to thermal printers</string>
```

### 3. Test the Implementation

Use the example component:

```typescript
import ThermalPrinterExample from './src/components/ThermalPrinterExample';

// Add to your app navigation
<ThermalPrinterExample />
```

## Quick Code Example

```typescript
import ThermalPrinterService from './services/ThermalPrinterService';

const service = ThermalPrinterService.getInstance();

// 1. Request permissions
await service.requestPermissions();

// 2. Scan for printers
const printers = await service.scanForPrinters();

// 3. Connect
await service.connectToPrinter(printers[0]);

// 4. Print
await service.printReceipt({
  storeInfo: { name: 'Store', address: '123 St', phone: '555-1234' },
  items: [{ name: 'Item', price: 10, quantity: 1, total: 10 }],
  subtotal: 10,
  tax: 1,
  total: 11,
  paymentMethod: 'Cash',
  receiptNumber: 'R001',
  timestamp: new Date(),
});
```

## Key Features

### Bluetooth Scanning
- Discovers paired devices
- Finds nearby unpaired devices
- Auto-enables Bluetooth if needed

### ESC/POS Printing
- Professional receipt formatting
- Multiple font sizes
- Column alignment
- Auto-cut support

### Configuration
```typescript
await service.updateConfiguration({
  paperWidth: 80,       // 58 or 80mm
  printDensity: 3,      // 0-4
  autoCutEnabled: true,
  testPrintEnabled: true
});
```

## Supported Printers

Works with ESC/POS compatible thermal printers:
- EPSON (TM-T82, TM-T88, etc.)
- Star Micronics (TSP143, TSP650, etc.)
- Zebra (ZD220, ZD410, etc.)
- Bixolon, Citizen, and generic ESC/POS printers

## Troubleshooting

### Can't find printers?
- Enable Bluetooth on device
- Grant location permission (required for Bluetooth scanning)
- Power on printer and put in pairing mode

### Connection fails?
- Unpair printer from Bluetooth settings
- Restart printer
- Check printer is ESC/POS compatible

### Print doesn't work?
- Verify connection: `service.isConnected()`
- Check paper is loaded
- Adjust print density (0-4)
- Try different paper width (58mm vs 80mm)

## Integration with Existing Code

Your existing PrinterSetupScreen already uses the ThermalPrinterService, so the real Bluetooth functionality is now active. The mock data has been removed.

To use in other parts of your app:

```typescript
import ThermalPrinterService from '../services/ThermalPrinterService';

const printerService = ThermalPrinterService.getInstance();

// Check if connected
if (printerService.isConnected()) {
  await printerService.printReceipt(receiptData);
}
```

## Documentation

- **Full Guide**: `THERMAL_PRINTER_GUIDE.md`
- **Example Component**: `src/components/ThermalPrinterExample.tsx`
- **Service Code**: `src/services/ThermalPrinterService.ts`

## Package Info

- **Package**: react-native-bluetooth-escpos-printer
- **Version**: 1.1.5
- **Platform**: React Native (Expo)
- **Compatibility**: Android & iOS

---

**Ready to test!** Build the app and connect to a real thermal printer.
