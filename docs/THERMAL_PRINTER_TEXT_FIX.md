# Thermal Printer Text Printing Fix

## Problem
Thermal printer was executing print commands but no text appeared on the receipt paper.

## Root Causes Identified

1. **Unicode Character Issue**: The Rupee symbol (₹) is a Unicode character that many thermal printers cannot render properly
2. **Missing Encoding Setup**: Printer needed proper character encoding configuration
3. **No Line Spacing**: Some printers need explicit line spacing settings

## Changes Made

### 1. Character Encoding
Added encoding setup at the start of each print job:
```typescript
await BluetoothEscposPrinter.setEncoding('GBK');
```

### 2. Line Spacing
Added line spacing for better readability:
```typescript
await BluetoothEscposPrinter.setLineSpacing(30);
```

### 3. Currency Symbol
**Changed from:** `₹` (Unicode Rupee symbol)  
**Changed to:** `Rs.` (ASCII characters)

**Examples:**
- `₹150.00` → `Rs.150.00`
- `₹1,250.50` → `Rs.1250.50`

### 4. Null Safety
Added checks for empty/null values to prevent printing blank lines:
```typescript
if (storeInfo.address) {
  await BluetoothEscposPrinter.printText(storeInfo.address + '\n', {});
}
```

### 5. Simple Test Print Method
Added `simpleTestPrint()` method for debugging:
```typescript
const printerService = ThermalPrinterService.getInstance();
await printerService.simpleTestPrint();
```

## Files Modified

- `src/services/ThermalPrinterService.ts`
  - Added encoding setup
  - Added line spacing
  - Changed ₹ to Rs. in all locations
  - Added null safety checks
  - Added simpleTestPrint() method

## Testing Steps

### Test 1: Simple Test Print
```typescript
// In your printer setup screen or console
import ThermalPrinterService from './services/ThermalPrinterService';

const printerService = ThermalPrinterService.getInstance();
await printerService.simpleTestPrint();
```

**Expected Output:**
```
=== TEST PRINT ===
If you can read this,
the printer is working!
==================
```

### Test 2: Print Receipt from App
1. Go to Receipts screen
2. Click ••• on any receipt
3. Click "Print"
4. Check if receipt prints with text visible

**Expected Output:**
```
        Store Name

     Store Address
     Store Phone

================================
Receipt #: RCP-001
Date: 10/26/2025 4:14:21 PM
Customer: John Doe
Status: PAID
================================

Item Name
  2 x Rs.100.00 = Rs.200.00

--------------------------------
Subtotal:         Rs.200.00
Tax:              Rs.16.00
Total:            Rs.216.00
================================
Payment: Cash
================================

   Thank you for your business!
```

## Troubleshooting

### Issue: Still No Text Printing

**Try these encodings (one at a time):**
```typescript
// In ThermalPrinterService.ts line ~430
await BluetoothEscposPrinter.setEncoding('GBK');    // Try first
await BluetoothEscposPrinter.setEncoding('UTF-8');  // If GBK fails
await BluetoothEscposPrinter.setEncoding('ASCII');  // If UTF-8 fails
```

### Issue: Text is Very Faint

**Increase print density:**
```typescript
// In printer setup screen
const printerService = ThermalPrinterService.getInstance();
await printerService.updateConfiguration({
  printDensity: 4, // 0-4, higher = darker
});
```

### Issue: Characters are Garbled

**Problem:** Wrong encoding
**Solution:** Change encoding to 'UTF-8' or 'ASCII'

### Issue: Some Text Missing

**Problem:** Printer buffer overflow
**Solution:** Add small delays between print commands
```typescript
// Add after each printText call
await new Promise(resolve => setTimeout(resolve, 50));
```

### Issue: Paper Feeds But No Print

**Possible causes:**
1. Thermal paper is inserted upside down (thermal side down)
2. Thermal paper is expired or low quality
3. Printer head is dirty or damaged
4. Power/heat settings too low

**Solutions:**
1. Flip the paper roll (thermal side should face the print head)
2. Use fresh thermal paper
3. Clean printer head with isopropyl alcohol
4. Increase print density setting

## Thermal Paper Check

**How to identify thermal side:**
1. Scratch paper with fingernail - thermal side will show a dark mark
2. Most rolls have thermal coating on INSIDE when rolled
3. When paper comes out of printer, thermal side should face YOU

## Additional Notes

### Why Rs. Instead of ₹?

Thermal printers use ESC/POS commands which have limited Unicode support:
- ASCII characters (Rs., USD, etc.) = ✅ Always work
- Unicode symbols (₹, €, £) = ⚠️ May not work on many printers

### Encoding Options

| Encoding | Best For | Support |
|----------|----------|---------|
| GBK | Chinese/Asian characters | Good |
| UTF-8 | Western characters | Fair |
| ASCII | English only | Excellent |

### Future Improvements

1. **Auto-detect encoding**: Try encodings and use the one that works
2. **Configurable currency symbol**: Let users choose Rs., INR, or ₹
3. **Print preview**: Show what will print before sending to printer
4. **Retry mechanism**: Auto-retry print with different settings if failed

## Quick Reference

### Test Print Commands
```typescript
// Simple test
await printerService.simpleTestPrint();

// Full receipt test
await printerService.testPrint();
```

### Change Currency Display
Search for `Rs.` and replace with your preferred format:
- `INR ` (INR 100.00)
- `Rs ` (Rs 100.00)
- `₹` (₹100.00 - may not work)

### Files to Modify
- Currency display: `ThermalPrinterService.ts`
- Encoding: `ThermalPrinterService.ts` line ~430
- Print density: Settings screen or config

## Summary

✅ **Fixed:** Unicode Rupee symbol replaced with ASCII "Rs."  
✅ **Added:** Character encoding setup (GBK)  
✅ **Added:** Line spacing configuration  
✅ **Added:** Null safety checks  
✅ **Added:** Simple test print method  

The thermal printer should now print text correctly! If issues persist, try the troubleshooting steps above.

---

**Last Updated:** October 26, 2025  
**Status:** ✅ Ready for testing
