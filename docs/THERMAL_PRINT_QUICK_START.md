# Thermal Print Button - Quick Start Guide

## ✨ What's New

A **print button** has been added to each receipt card, allowing you to print receipts directly from the list with a single tap!

## 🎯 Button Location

```
Receipt Card:
┌──────────────────────────────────┐
│ Customer Name      [PAID]  [🖨]  │ ← Print button here!
│ #REC-123 • Nov 7                 │
│                                  │
│ Receipt Total    ₹331.05         │
│ Amount Paid      ₹331.05         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
└──────────────────────────────────┘
```

## 🚀 How to Use

### 1. Connect Your Printer First
- Go to **Settings → Printer Setup**
- Scan for your Bluetooth thermal printer
- Connect to your printer

### 2. Print a Receipt
- Open the **Receipts** tab
- Find the receipt you want to print
- Tap the **green print button** (🖨) in the top-right corner
- Receipt will print automatically!

### 3. Check Status
- Receipt status changes to **"PRINTED"** after successful print
- Green checkmark confirms successful print

## 🎨 Button Design

| State | Appearance |
|-------|-----------|
| **Ready** | Green printer icon on light green background |
| **Printing** | Animated spinner (green color) |
| **Hidden** | Not visible when selecting multiple receipts |

## ⚠️ Requirements

Before you can print:
- ✅ Bluetooth thermal printer must be connected
- ✅ Bluetooth must be enabled on your device
- ✅ Printer must be powered on and in range

## 🔧 Troubleshooting

### "Printer Not Connected" Alert

**Problem**: You see "Printer Not Connected" when tapping print

**Solution**: 
1. Go to **Settings → Printer Setup**
2. Connect to your thermal printer
3. Try printing again

### Print Button Not Visible

**Problem**: Can't see the print button

**Possible Causes**:
- You're in **selection mode** (long-press on a receipt)
  - Solution: Exit selection mode by tapping Cancel
- Screen needs refresh
  - Solution: Pull down to refresh the receipt list

### Receipt Prints But Status Doesn't Update

**Problem**: Receipt prints successfully but status stays as "Draft"

**Solution**: 
- Check your internet connection
- Firebase might be syncing - wait a few seconds
- Pull down to refresh the list

## 📱 Features

✅ **One-tap printing** - No menus, no confirmations needed
✅ **Smart validation** - Checks printer connection automatically
✅ **Visual feedback** - See printing progress with spinner
✅ **Auto status update** - Status changes to "PRINTED" automatically
✅ **Non-intrusive** - Button only shows when needed

## 💡 Tips

### Best Practices
- **Connect once** - Printer stays connected for future prints
- **Check status** - Look for "PAID" badge before printing
- **Batch printing** - For multiple receipts, use the helper utility (see full docs)

### Performance
- Prints take ~3-5 seconds depending on receipt size
- Allow 1-2 seconds between prints for best results
- Keep printer within 10 meters of your device

## 📚 Additional Resources

- **Full Documentation**: `docs/THERMAL_PRINTING_RECEIPTS.md`
- **Printer Setup Guide**: `docs/THERMAL_PRINTER_GUIDE.md`
- **Printer Service**: `src/services/printing/ThermalPrinterService.ts`
- **Helper Utilities**: `src/utils/thermalPrintHelper.ts`

## 🎯 Example Workflow

```
1. Customer completes purchase
   ↓
2. Open Receipts tab
   ↓
3. Find customer's receipt
   ↓
4. Tap print button (🖨)
   ↓
5. Receipt prints automatically
   ↓
6. Status changes to "PRINTED" ✓
```

## 🔐 Permissions Required

The app needs these permissions to print:
- **Bluetooth** - To communicate with printer
- **Location** (Android) - Required for Bluetooth device scanning
- **Storage** - For saving printer settings

## 🆘 Need Help?

If you encounter issues:
1. Check printer is powered on
2. Verify Bluetooth is enabled
3. Reconnect printer in Settings
4. Restart the app if needed
5. Check printer has paper

## ⚡ Quick Reference

| Action | How To |
|--------|--------|
| Print receipt | Tap green print button on receipt card |
| Connect printer | Settings → Printer Setup → Scan → Connect |
| Check connection | Settings → Printer Setup → View status |
| Disconnect | Settings → Printer Setup → Disconnect |
| View print history | Check receipt status badge |

---

**Need more details?** See the full documentation in `THERMAL_PRINTING_RECEIPTS.md`
