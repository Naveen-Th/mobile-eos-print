# Bluetooth Printer Connection Troubleshooting

## Common Connection Issues & Fixes

### 1. "Bluetooth module not available"

**Cause**: App not rebuilt after installing the package

**Fix**:
```bash
cd /Users/Apple/Documents/Print/ThermalReceiptPrinter/mobile
npx expo prebuild --clean
npm run android  # or npm run ios
```

### 2. "Bluetooth is not enabled"

**Cause**: Device Bluetooth is turned off

**Fix**:
1. Go to device Settings
2. Enable Bluetooth
3. Try connecting again

Or programmatically:
```typescript
// The service will try to enable it automatically
const service = ThermalPrinterService.getInstance();
await service.requestPermissions();
```

### 3. "Printer not found"

**Cause**: Printer not powered on, out of range, or not in pairing mode

**Fix**:
1. **Power on the printer** - Check battery/power
2. **Check range** - Move printer closer (within 10 meters)
3. **Pairing mode** - Check printer manual for pairing button/mode
4. **Pair via system first** - Go to device Bluetooth settings and pair the printer
5. **Restart printer** - Power cycle the printer

### 4. "Printer already connected to another device"

**Cause**: Printer is connected to another phone/tablet/computer

**Fix**:
1. Disconnect from the other device
2. Turn off Bluetooth on the other device
3. Restart the printer
4. Try connecting again

### 5. "Connection timeout"

**Cause**: Printer not responding or busy

**Fix**:
1. **Restart printer** - Power off, wait 10 seconds, power on
2. **Forget and re-pair**:
   - Go to device Bluetooth settings
   - Forget/Unpair the printer
   - Pair it again
3. **Check printer status lights** - Ensure it's ready (not printing/busy)
4. **Try from system Bluetooth first** - Pair via Settings before app

### 6. "Permission denied"

**Cause**: Bluetooth permissions not granted

**Fix**:
```typescript
// Request permissions explicitly
const service = ThermalPrinterService.getInstance();
const granted = await service.requestPermissions();

if (!granted) {
  Alert.alert(
    'Permissions Required',
    'Please grant Bluetooth permissions in Settings'
  );
}
```

Manual fix:
1. Go to device Settings → Apps → Your App → Permissions
2. Enable Location and Bluetooth permissions

### 7. Connection works but test print fails

**Cause**: Connection succeeded but printer communication issue

**Fix**: Skip test print
```typescript
// Connect without test print
await service.connectToPrinter(printer, true); // true = skip test print

// Then try manual print
await service.testPrint();
```

If manual print also fails:
1. Check paper is loaded
2. Verify printer supports ESC/POS
3. Check paper width setting (58mm vs 80mm)

## Connection Best Practices

### Before Connecting

```typescript
const service = ThermalPrinterService.getInstance();

// 1. Check permissions
const hasPermissions = await service.requestPermissions();
if (!hasPermissions) {
  Alert.alert('Error', 'Bluetooth permissions required');
  return;
}

// 2. Scan for printers
const printers = await service.scanForPrinters();
if (printers.length === 0) {
  Alert.alert('No Printers', 'No printers found. Is your printer on?');
  return;
}

// 3. Connect (skip test print if you want)
const printer = printers[0];
try {
  await service.connectToPrinter(printer, true); // Skip test print
  Alert.alert('Success', 'Connected!');
} catch (error) {
  Alert.alert('Error', error.message);
}
```

### Verify Connection Status

```typescript
// Check if connected
const isConnected = service.isConnected();

// Get connected printer info
const connectedPrinter = service.getConnectedPrinter();

// Get status
const status = await service.getPrinterStatus();
console.log('Printer status:', status);

// Verify connection is still active
const isActive = await service.verifyConnection();
if (!isActive) {
  Alert.alert('Warning', 'Connection lost. Please reconnect.');
}
```

### Proper Disconnection

```typescript
// Always disconnect when done
try {
  await service.disconnect();
  console.log('Disconnected successfully');
} catch (error) {
  console.warn('Disconnect error:', error);
  // Connection state is still cleared
}
```

## Debug Logging

Enable detailed console logging to see what's happening:

```typescript
// The service now logs:
// - Connection attempts
// - Connection results  
// - Bluetooth state
// - Error details

// Check your console for messages like:
// "Attempting to connect to: EPSON TM-T82 ..."
// "Connection result: ..."
// "Successfully connected to printer: ..."
```

## Printer-Specific Issues

### EPSON Printers
- Ensure printer is in "Bluetooth" mode (not USB)
- Check if printer is paired in system Bluetooth first
- Some models need to be manually put in pairing mode

### Star Micronics
- Star printers often auto-sleep - wake them up first
- Check connection type in printer settings
- May need Star-specific SDK for advanced features

### Zebra Printers
- Verify ESC/POS mode is enabled (not CPCL)
- Check Bluetooth is in SPP mode
- Some models need firmware update

### Generic/Chinese Printers
- Usually work well with ESC/POS
- May need specific paper width settings
- Check manual for Bluetooth pairing procedure

## Testing Connection Step-by-Step

### 1. Basic Connection Test

```typescript
import { runAllBluetoothTests } from './src/utils/BluetoothTest';

const { results, overallSuccess } = await runAllBluetoothTests();

results.forEach((result, index) => {
  console.log(`Test ${index + 1}:`, result.message);
  console.log('  Success:', result.success);
  if (result.details) {
    console.log('  Details:', result.details);
  }
});
```

### 2. Manual Connection Test

```typescript
const service = ThermalPrinterService.getInstance();

try {
  // Step 1: Permissions
  console.log('Step 1: Requesting permissions...');
  const granted = await service.requestPermissions();
  console.log('Permissions granted:', granted);

  // Step 2: Scan
  console.log('Step 2: Scanning for printers...');
  const printers = await service.scanForPrinters();
  console.log('Found printers:', printers.length);
  printers.forEach(p => console.log(`  - ${p.name} (${p.address})`));

  // Step 3: Connect (skip test print for debugging)
  if (printers.length > 0) {
    console.log('Step 3: Connecting to first printer...');
    const connected = await service.connectToPrinter(printers[0], true);
    console.log('Connected:', connected);

    // Step 4: Verify
    console.log('Step 4: Verifying connection...');
    const status = await service.getPrinterStatus();
    console.log('Status:', status);

    // Step 5: Test print
    console.log('Step 5: Testing print...');
    await service.testPrint();
    console.log('Print successful!');
  }
} catch (error) {
  console.error('Test failed:', error);
}
```

### 3. Use Test Screen

```typescript
import BluetoothTestScreen from './src/screens/BluetoothTestScreen';

// Add to your navigation
<BluetoothTestScreen />
```

## Configuration Options

Disable test print on connection:

```typescript
const service = ThermalPrinterService.getInstance();

// Disable auto test print
await service.updateConfiguration({
  testPrintEnabled: false,
});

// Now connections won't auto-print
await service.connectToPrinter(printer);
```

Adjust paper width and density:

```typescript
await service.updateConfiguration({
  paperWidth: 58,       // or 80
  printDensity: 3,      // 0-4 (higher = darker)
  autoCutEnabled: true,
});
```

## Still Having Issues?

### Check These:

1. **App rebuilt?** - `npm run android` after installing package
2. **Permissions granted?** - Check app settings
3. **Bluetooth on?** - Check device settings
4. **Printer on?** - Check power/battery
5. **Printer paired?** - Pair in system Bluetooth first
6. **In range?** - < 10 meters, no obstacles
7. **Not connected elsewhere?** - Disconnect from other devices
8. **Paper loaded?** - Check printer has paper
9. **Correct printer type?** - ESC/POS compatible?
10. **Logs checked?** - Look at console output

### Get More Help

Run the test screen and copy the error details:
```typescript
import BluetoothTestScreen from './src/screens/BluetoothTestScreen';
```

Check the error message for specific guidance:
- "module not available" → Rebuild app
- "not enabled" → Enable Bluetooth  
- "not found" → Check printer power/range
- "already connected" → Disconnect from other device
- "timeout" → Restart printer
- "permission" → Grant permissions

---

**TIP**: Always pair the printer via system Bluetooth settings first before trying to connect from the app!
