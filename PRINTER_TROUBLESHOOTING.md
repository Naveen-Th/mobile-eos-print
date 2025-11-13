# Thermal Printer Troubleshooting Guide

## Issue: Test Print Shows Success but Nothing Prints

### Root Cause
The app was sending print commands but **not properly initializing** the ESC/POS printer with required command sequences.

### What Was Fixed ✅

1. **Added proper printer initialization**
   - `BluetoothEscposPrinter.printerInit()` is now called first
   - Added 300ms delay for printer to be ready
   - Set proper print alignment

2. **Improved ESC/POS command sequence**
   - Commands are sent one-by-one with proper await
   - Using `printText()` for text content
   - Using `setBlob(0)` for bold text
   - Using `printerAlign()` for text alignment

3. **Better error handling**
   - Detailed error messages with context
   - JSON stringified error details
   - Clear success/failure indicators

### Testing the Fix

After the changes, you should see these logs:

```
📝 Starting test print...
1. Initializing printer...
2. Setting printer configuration...
3. Preparing test content...
4. Sending to printer...
✅ Test print completed successfully!
📦 Check your printer for output
```

### If It Still Doesn't Print

#### 1. Check Bluetooth Connection
```bash
# The printer should show as "Connected & Ready to Print"
# MAC Address should be visible (DC:0D:30:A7:AC:B8)
```

#### 2. Verify Printer Power
- Ensure printer is turned ON
- Check battery level (if battery-powered)
- Try connecting power adapter

#### 3. Check Paper
- Is paper loaded correctly?
- Is the paper roll not empty?
- Is the paper cover closed properly?

#### 4. Test with Another App
Try printing from another app (like a POS app) to verify printer hardware works.

#### 5. Re-pair Bluetooth
1. Disconnect printer in app
2. Go to phone Bluetooth settings
3. "Forget" the MLP 360 device
4. Re-scan and reconnect in app

#### 6. Check Printer Mode
Some thermal printers have different modes:
- **ESC/POS mode** (required) ✅
- **CPCL mode** ❌
- **ZPL mode** ❌

Make sure your printer is in ESC/POS mode (usually the default).

#### 7. Enable Detailed Logging

Add this to see raw ESC/POS commands:

```typescript
// In ThermalPrinterService.ts
console.log('Sending command:', command);
console.log('Command bytes:', [...Buffer.from(command)]);
```

#### 8. Try Different Print Commands

If standard commands don't work, try these alternatives:

```typescript
// Alternative 1: Raw ESC/POS commands
await BluetoothEscposPrinter.printText('\\x1B\\x40', {}); // ESC @: Initialize
await BluetoothEscposPrinter.printText('Hello World\\n', {});

// Alternative 2: Print column
await BluetoothEscposPrinter.printColumn(
  [20],
  [BluetoothEscposPrinter.ALIGN.LEFT],
  ['Test Print'],
  {}
);

// Alternative 3: Print and feed
await BluetoothEscposPrinter.printText('Test\\n', {});
await BluetoothEscposPrinter.printText('\\n\\n\\n', {}); // Feed paper
```

### Common MLP 360 Issues

#### Issue: Printer Prints Blank Paper
- **Cause**: Thermal paper installed upside down
- **Fix**: Flip the paper roll (thermal side should face the print head)

#### Issue: Faint/Light Printing
- **Cause**: Low print density or old thermal paper
- **Fix**: 
  1. Increase print density in settings (1-4)
  2. Replace thermal paper if expired

#### Issue: Characters Cut Off
- **Cause**: Wrong paper width setting
- **Fix**: Set paper width to match your paper (58mm or 80mm)

#### Issue: Printer Disconnects Randomly
- **Cause**: Low battery or Bluetooth interference
- **Fix**:
  1. Charge printer fully
  2. Move closer to phone
  3. Disable other Bluetooth devices nearby

### Printer Specifications

**MLP 360 Thermal Printer**
- Protocol: ESC/POS
- Connectivity: Bluetooth 2.0/3.0
- Paper Width: 58mm or 80mm
- Character Set: ASCII, Extended
- Max Print Width: 384 dots (58mm) / 576 dots (80mm)
- Baud Rate: 9600/19200/38400/115200

### Advanced Diagnostics

#### Check Bluetooth Module
```typescript
// In your code
const isEnabled = await BluetoothManager.isBluetoothEnabled();
console.log('Bluetooth enabled:', isEnabled);

const devices = await BluetoothManager.scanDevices();
console.log('Paired devices:', devices);
```

#### Send Raw ESC/POS Commands
```typescript
// ESC @ - Initialize printer
const initCmd = [0x1B, 0x40];
await BluetoothEscposPrinter.write(Buffer.from(initCmd));

// ESC a n - Select justification (0=left, 1=center, 2=right)
const alignCmd = [0x1B, 0x61, 0x00];
await BluetoothEscposPrinter.write(Buffer.from(alignCmd));

// Print text
await BluetoothEscposPrinter.printText('TEST\\n', {});

// LF - Line feed
const feedCmd = [0x0A];
await BluetoothEscposPrinter.write(Buffer.from(feedCmd));
```

### Getting Help

If none of the above works:

1. **Check printer manual** - Some printers have specific initialization requirements
2. **Contact manufacturer** - MLP support for firmware issues
3. **Try different library** - Consider react-native-thermal-receipt-printer-image
4. **Hardware issue** - Printer may need repair/replacement

### Success Indicators

When everything works correctly, you should see:

✅ Bluetooth connects successfully  
✅ "Connected & Ready to Print" status  
✅ Test print logs show all steps  
✅ **Physical paper comes out with text** 🎉  

---

**Updated**: 2025-11-09  
**For**: MLP 360 Thermal Printer  
**App Version**: Mobile v1.0
