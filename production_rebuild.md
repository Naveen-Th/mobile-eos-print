# Production Rebuild Guide

Complete guide for clean rebuilding the Android app with proper cache clearing.

## Quick Commands

### Full Clean Rebuild (Recommended)
```bash
cd /Users/Apple/Documents/Print/ThermalReceiptPrinter/mobile && \
lsof -ti:8081 | xargs kill -9 2>/dev/null && \
rm -rf node_modules/.cache .expo android/app/build android/.gradle android/build && \
cd android && ./gradlew clean && cd .. && \
npx expo run:android
```

### Quick Clean + Rebuild
```bash
cd /Users/Apple/Documents/Print/ThermalReceiptPrinter/mobile && \
rm -rf android/app/build android/.gradle android/build && \
cd android && ./gradlew clean && cd .. && \
npx expo run:android
```

### Nuclear Option (Complete Reset)
```bash
cd /Users/Apple/Documents/Print/ThermalReceiptPrinter/mobile && \
lsof -ti:8081 | xargs kill -9 2>/dev/null && \
rm -rf node_modules/.cache .expo android/app/build android/.gradle android/build && \
rm -rf node_modules && \
npm install && \
cd android && ./gradlew clean && cd .. && \
npx expo run:android
```

## Shell Alias Setup

Add this to your `~/.zshrc` for quick access:

```bash
# Android rebuild aliases
alias rebuild-android='cd /Users/Apple/Documents/Print/ThermalReceiptPrinter/mobile && lsof -ti:8081 | xargs kill -9 2>/dev/null; rm -rf node_modules/.cache .expo android/app/build android/.gradle android/build; cd android && ./gradlew clean && cd ..; npx expo run:android'

alias rebuild-android-quick='cd /Users/Apple/Documents/Print/ThermalReceiptPrinter/mobile && rm -rf android/app/build android/.gradle android/build; cd android && ./gradlew clean && cd ..; npx expo run:android'

alias rebuild-android-nuclear='cd /Users/Apple/Documents/Print/ThermalReceiptPrinter/mobile && lsof -ti:8081 | xargs kill -9 2>/dev/null; rm -rf node_modules/.cache .expo android/app/build android/.gradle android/build node_modules; npm install; cd android && ./gradlew clean && cd ..; npx expo run:android'
```

After adding, reload your shell:
```bash
source ~/.zshrc
```

Then use:
```bash
rebuild-android        # Full clean rebuild
rebuild-android-quick  # Quick rebuild
rebuild-android-nuclear # Complete reset
```

## What Each Command Does

### 1. Kill Metro Bundler
```bash
lsof -ti:8081 | xargs kill -9 2>/dev/null
```
- Finds and kills any process running on port 8081
- Prevents conflicts with new Metro instance

### 2. Clear Metro Cache
```bash
rm -rf node_modules/.cache
```
- Removes Metro bundler cache
- Forces fresh JavaScript bundling

### 3. Clear Expo Cache
```bash
rm -rf .expo
```
- Removes Expo development cache
- Clears cached native builds

### 4. Clear Android Build Outputs
```bash
rm -rf android/app/build
```
- Removes compiled APK files
- Deletes intermediate build artifacts

### 5. Clear Gradle Cache
```bash
rm -rf android/.gradle
```
- Removes Gradle daemon cache
- Clears dependency cache

### 6. Clear Gradle Build Cache
```bash
rm -rf android/build
```
- Removes build output directory
- Clears compiled native code

### 7. Run Gradle Clean
```bash
cd android && ./gradlew clean && cd ..
```
- Gradle's built-in clean task
- Removes all build artifacts

### 8. Rebuild and Install
```bash
npx expo run:android
```
- Bundles JavaScript with Metro
- Compiles native Android code
- Builds APK
- Installs on device/emulator

## When to Use Each Option

### Quick Rebuild
**Use when:**
- Making JavaScript/TypeScript changes
- Editing React components
- Updating business logic
- No native code changes

```bash
rebuild-android-quick
```

### Full Clean Rebuild
**Use when:**
- App behaves unexpectedly
- Build cache issues suspected
- After pulling new code from git
- Switching branches
- After npm package updates

```bash
rebuild-android
```

### Nuclear Option
**Use when:**
- Complete app malfunction
- Dependency conflicts
- node_modules corruption
- Last resort troubleshooting

```bash
rebuild-android-nuclear
```

## Development vs Production Builds

### Development Mode (Recommended for dev)
```bash
npx expo start -c
```
- ✅ Instant code updates (hot reload)
- ✅ No rebuild required
- ✅ Fast iteration
- ✅ Debug mode enabled
- ❌ Slower performance

### Production Build
```bash
npx expo run:android
```
- ✅ Production-ready APK
- ✅ Optimized performance
- ✅ Tests native features
- ❌ Requires rebuild for changes
- ❌ Slower build time

## Troubleshooting

### Port 8081 Already in Use
```bash
lsof -ti:8081 | xargs kill -9
```

### Gradle Daemon Issues
```bash
cd android && ./gradlew --stop && cd ..
```

### Build Failed - Duplicate Classes
```bash
git checkout android/  # Restore android folder
rm -rf android/app/build android/.gradle
cd android && ./gradlew clean && cd ..
npx expo run:android
```

### Metro Bundler Frozen
```bash
rm -rf node_modules/.cache
npx expo start --clear
```

## Quick Reference Table

| Scenario | Command | Time | Risk |
|----------|---------|------|------|
| JS changes only | `rebuild-android-quick` | ~2 min | Low |
| After git pull | `rebuild-android` | ~3 min | Low |
| Major issues | `rebuild-android-nuclear` | ~5 min | Medium |
| Development | `npx expo start -c` | ~30 sec | None |

## Best Practices

1. **Use dev mode for daily development**
   ```bash
   npx expo start -c
   ```

2. **Test native builds before releasing**
   ```bash
   rebuild-android
   ```

3. **Clean after branch switches**
   ```bash
   rebuild-android
   ```

4. **Nuclear option only when desperate**
   ```bash
   rebuild-android-nuclear
   ```

## Understanding the Rebuild Process

### Why Rebuild is Necessary

React Native apps contain two types of code:

```
┌─────────────────────────────────────┐
│     Native Android APK              │
├─────────────────────────────────────┤
│  1. Native Code (Java/Kotlin)      │  ← Compiled
│     - Android SDK                   │
│     - Native modules                │
├─────────────────────────────────────┤
│  2. JavaScript Bundle               │  ← Your code
│     - React components              │
│     - Business logic                │
│     - FROZEN at build time          │
└─────────────────────────────────────┘
```

**The JavaScript bundle is embedded IN the APK during build.**

When you edit `.tsx/.ts/.js` files:
- ❌ Changes don't appear in existing APK
- ✅ Must rebuild to bundle new code

### Build Process Flow

```
1. Metro Bundler
   └─> Reads all .tsx/.ts/.js files
   └─> Transforms to JavaScript
   └─> Creates index.android.bundle

2. Gradle Build
   └─> Compiles native code
   └─> Embeds JS bundle in APK
   └─> Signs APK

3. Install
   └─> Installs app-debug.apk
   └─> JavaScript now frozen in APK
```

### Cache Layers

Multiple caches can hold old code:

```
Cache Layer                  Location                      Clear Command
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Metro Bundler Cache          node_modules/.cache          rm -rf node_modules/.cache
Expo Cache                   .expo                         rm -rf .expo
Android Build Cache          android/app/build            rm -rf android/app/build
Gradle Cache                 android/.gradle              rm -rf android/.gradle
Gradle Build Output          android/build                rm -rf android/build
Installed APK               Device/Emulator              Automatic on reinstall
```

## Production Release

For production builds, use EAS Build:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build production APK
eas build --platform android --profile production

# Build AAB for Play Store
eas build --platform android --profile production --format aab
```

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Android Gradle Plugin Guide](https://developer.android.com/studio/build)

---

**Last Updated:** 2025-11-10
**Project:** Thermal Receipt Printer Mobile App

