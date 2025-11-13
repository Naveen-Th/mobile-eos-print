# Paper Cutting Guide - Auto Cut Troubleshooting

## Overview

The thermal printer service now includes **intelligent paper cutting** that automatically tries multiple cutting methods to find what works with your specific printer.

## How It Works

### Automatic Method Detection

When you enable "Auto Cut Paper", the system tries **5 different cutting methods** in order:

1. **`cutOnePoint()`** - Standard ESC/POS partial cut (most common)
2. **`printerCut()`** - Alternative cut method
3. **`cutPaper()`** - Generic paper cutting function
4. **`printAndFeedPaper(100)`** - Feed paper for manual tear
5. **Raw ESC command** - Direct ESC/POS `ESC i` command

### Smart Caching

Once a cutting method succeeds:
- ✅ The working method is **cached** in settings
- ✅ Next time, that method is tried **first**
- ✅ Faster cutting on subsequent prints
- ✅ More reliable operation

## Checking Paper Cutting Support

### Method 1: Test During Connection

When you connect to a printer with "Test Print on Connect" enabled, the system automatically tests paper cutting.

**Look for these logs:**
```
✓ Paper cut successful using: cutOnePoint
💾 Cached cutOnePoint as preferred cutting method
```

### Method 2: Manual Test

Test paper cutting programmatically:

```typescript
const printerService = ThermalPrinterService.getInstance();

// Test cutting support
const result = await printerService.testPaperCutting();

console.log('Supported:', result.supported);
console.log('Method:', result.method);
console.log('Message:', result.message);
```

## What to Do If Auto-Cut Doesn't Work

### Option 1: Disable Auto-Cut (Recommended)

If your printer doesn't support automatic cutting:

1. Go to **Settings → Printer Setup**
2. Toggle **"Auto Cut Paper"** to **OFF**
3. Manually tear paper after each print

**This is normal** - Many thermal printers don't have auto-cut functionality. Manual tearing is standard practice.

### Option 2: Check Printer Specifications

Verify your printer model supports auto-cut:
- Check the printer's manual or specifications
- Look for "auto-cutter" or "guillotine" feature
- Some printers require a specific paper cutter accessory

### Option 3: Update Printer Firmware

Some printers need firmware updates for cutting to work properly:
1. Visit your printer manufacturer's website
2. Download latest firmware
3. Follow manufacturer instructions to update

## Understanding Cutting Methods

### Full Cut vs Partial Cut

**Full Cut** (ESC i)
- Completely separates the paper
- Requires manual removal of receipt
- More common in desktop printers

**Partial Cut** (cutOnePoint)
- Leaves small perforations
- Receipt stays attached for easy tear
- More common in portable printers

### Paper Feed Alternative

If no cutting methods work, the system will:
1. Feed extra paper (100 lines)
2. Create a tearable section
3. Allow manual tearing along perforation

## Printer Compatibility

### Printers WITH Auto-Cut Support
- ✅ EPSON TM-T88 series
- ✅ Star TSP143 series
- ✅ Zebra ZD410/ZD420
- ✅ Bixolon SRP-350 series
- ✅ Citizen CT-S310 series

### Printers WITHOUT Auto-Cut
- ❌ Most portable 58mm printers
- ❌ Budget thermal printers
- ❌ Battery-powered mobile printers (unless specified)

## Configuration Options

### Auto Cut Settings

```typescript
// Enable auto-cut
await printerService.updateConfiguration({
  autoCutEnabled: true,
});

// Disable auto-cut
await printerService.updateConfiguration({
  autoCutEnabled: false,
});

// Check current setting
const config = printerService.getConfiguration();
console.log('Auto-cut enabled:', config.autoCutEnabled);
```

### Cached Method

The successful cutting method is stored in:
```
AsyncStorage: 'printerConfig'
Key: lastSuccessfulCutMethod
```

Clear cache to test all methods again:
```typescript
await printerService.updateConfiguration({
  lastSuccessfulCutMethod: undefined,
});
```

## Troubleshooting

### Issue: "Could not cut paper" Warning

**Symptom**: Logs show all cutting methods failed

**Solutions**:
1. **Check if your printer has auto-cut** - Most don't!
2. **Disable auto-cut** - Use manual tearing instead
3. **Check paper jam** - Clear any jammed paper
4. **Update firmware** - If auto-cut is supposed to work

### Issue: Paper Feeds But Doesn't Cut

**Symptom**: Extra paper feeds out but doesn't cut

**Solutions**:
- This is expected behavior when auto-cut isn't supported
- The extra paper makes it easier to tear manually
- Tear along the perforated line
- Consider disabling auto-cut

### Issue: Partial Cuts Leave Paper Attached

**Symptom**: Paper is cut but not separated

**This is normal!** Partial cuts are designed this way:
- Tear off the receipt manually
- The cut makes tearing easier
- Prevents dropped receipts
- Common in retail environments

### Issue: Cutting Works Inconsistently

**Possible Causes**:
1. **Low battery** - Charge the printer
2. **Worn cutter blade** - May need service/replacement
3. **Wrong paper type** - Use thermal paper recommended by manufacturer
4. **Paper thickness** - Some cutters work only with specific thickness

## Best Practices

### For Reliable Cutting

1. **Use recommended paper**
   - Standard thermal paper (55-80gsm)
   - Correct width (58mm or 80mm)
   - Quality paper from reputable supplier

2. **Maintain the printer**
   - Clean the cutter mechanism monthly
   - Remove paper dust and debris
   - Keep printer in dust-free environment

3. **Battery considerations**
   - Cutting uses more power
   - Keep printer charged >50%
   - May fail with low battery

4. **Settings optimization**
   - Start with auto-cut OFF
   - Test with auto-cut ON
   - Only enable if consistently works

### For Manual Tearing

If using manual tearing:
1. **Feed extra paper** - Leave space to grip
2. **Tear straight up** - Not at an angle
3. **Use perforation** - If available
4. **Hold printer steady** - Prevents damage

## Error Messages Explained

| Message | Meaning | Action |
|---------|---------|--------|
| `✓ Paper cut successful using: cutOnePoint` | Cutting works! | No action needed |
| `✗ cutOnePoint failed` | Method not supported | System tries next method |
| `⚠️ Auto-cut not supported by this printer` | All methods failed | Disable auto-cut or tear manually |
| `💡 Manual paper cutting required` | Use manual tearing | Normal for many printers |
| `💾 Cached [method] as preferred` | Working method saved | Faster next time |

## API Reference

### Test Paper Cutting

```typescript
interface CuttingTestResult {
  supported: boolean;
  method?: string;
  message: string;
}

const result: CuttingTestResult = await printerService.testPaperCutting();
```

### Configuration Interface

```typescript
interface PrinterConfig {
  paperWidth: number;
  printDensity: number;
  autoCutEnabled: boolean;
  testPrintEnabled: boolean;
  lastSuccessfulCutMethod?: string; // Cached method
}
```

## Summary

**Key Takeaways:**
- ✅ Auto-cut is **optional** - not required for printing
- ✅ Many printers don't support it - this is **normal**
- ✅ Manual tearing is a **standard practice**
- ✅ System automatically finds what works for your printer
- ✅ Successful method is **cached** for speed

**Recommended Approach:**
1. Try printing with auto-cut enabled
2. Check logs to see if cutting worked
3. If not, disable auto-cut and tear manually
4. This is perfectly fine and very common!

---

**Still having issues?** The printer is working fine for printing - auto-cut is just an optional convenience feature. Use manual tearing instead!
