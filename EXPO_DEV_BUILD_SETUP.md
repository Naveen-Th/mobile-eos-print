# Expo Development Build Setup for Bluetooth Printer

## Problem

The error `TypeError: Cannot set property 'DIRECTION' of null` occurs because `react-native-bluetooth-escpos-printer` is a **native module** that requires native code compilation. Expo Go doesn't support custom native modules.

## Solution: Create Expo Development Build

You need to create a custom development build that includes the Bluetooth printer native module.

### Option 1: Local Development Build (Recommended for Testing)

#### For Android:

```bash
cd /Users/Apple/Documents/Print/ThermalReceiptPrinter/mobile

# Install EAS CLI if you haven't
npm install -g eas-cli

# Login to Expo (or create account)
eas login

# Configure the project
eas build:configure

# Create a development build for Android
eas build --profile development --platform android

# Or build locally (faster, but requires Android SDK)
npm run android
```

#### For iOS:

```bash
# Create development build for iOS
eas build --profile development --platform ios

# Or build locally (requires Xcode and Mac)
npm run ios
```

### Option 2: Use Expo Prebuild (Faster Local Testing)

```bash
cd /Users/Apple/Documents/Print/ThermalReceiptPrinter/mobile

# Generate native projects
npx expo prebuild

# Run on Android
npm run android

# Run on iOS (Mac only)
npm run ios
```

This will generate the `ios/` and `android/` folders with the native code.

### Option 3: Use EAS Build with Cloud Build

```bash
# Build for Android (cloud build)
eas build --profile development --platform android

# When complete, download and install the APK on your device
# Then run:
npx expo start --dev-client
```

## Update app.json for Development Build

The `app.json` already has the expo configuration, but let's ensure the plugin is configured:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-font"
    ]
  }
}
```

## Important: Install Expo Dev Client

```bash
npm install expo-dev-client
```

## After Building

1. **Install the development build** on your device/emulator
2. **Start the dev server**:
   ```bash
   npx expo start --dev-client
   ```
3. **Open the app** on your device - it will connect to the dev server

## Quick Start (Recommended)

```bash
# Step 1: Prebuild to generate native code
npx expo prebuild --clean

# Step 2: Run on Android
npm run android

# Or run on iOS (Mac only)
npm run ios
```

This will:
- Generate the native Android/iOS projects
- Include the Bluetooth printer module
- Build and install on your device/emulator

## Troubleshooting

### "Module not found" error
```bash
# Clean and rebuild
cd android && ./gradlew clean && cd ..
npm run android
```

### iOS build fails
```bash
cd ios
pod deintegrate
pod install
cd ..
npm run ios
```

### Can't use Expo Go anymore
That's correct. Once you add native modules, you must use a development build. Expo Go only supports Expo's pre-included modules.

## Alternative: Use Mock Data (For Web/Testing)

If you want to keep using Expo Go for testing, the service now has fallbacks and will show proper error messages. The mock data has been removed, but you can test the UI without actual Bluetooth hardware.

## Next Steps

1. Run `npx expo prebuild --clean`
2. Run `npm run android` (or `npm run ios`)
3. Test the Bluetooth printer scanning and connection

The app will now have the native Bluetooth module compiled in and will work properly!
