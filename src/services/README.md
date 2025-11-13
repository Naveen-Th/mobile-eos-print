# Services Directory Structure

Services are now organized into logical folders for better maintainability and clarity.

## Directory Structure

```
services/
├── auth/              # Authentication services
├── business/          # Business logic services
├── data/              # Data management services
├── features/          # Feature-specific services
├── printing/          # Printing-related services
├── storage/           # Storage and sync services
├── utilities/         # Utility services
└── index.ts           # Main export file
```

## Categories

### 📱 Auth (`/auth`)
- **MobileAuthService**: Firebase authentication for mobile
- **FirebaseService**: Firebase configuration and initialization

### 💼 Business (`/business`)
- **PaymentService**: Payment processing and recording
- **ReceiptFirebaseService**: Receipt synchronization with Firebase
- **PendingBillsService**: Customer pending bill management
- **BalanceTrackingService**: Customer balance tracking
- **BalanceSyncUtility**: Balance synchronization utility

### 📊 Data (`/data`)
- **ItemService**: Product/item CRUD operations
- **CustomerService**: Customer management
- **PersonDetailsService**: Person details management
- **StockService**: Inventory/stock management
- **CategoryService**: Item category management

### 🎯 Features (`/features`)
- **AnalyticsService**: Sales analytics and reporting
- **PaymentReminderService**: Automated payment reminders
- **LowStockAlertService**: Low stock notifications
- **ReceiptDeliveryService**: Receipt delivery options

### 🖨️ Printing (`/printing`)
- **PrintService**: General printing functionality
- **ThermalPrinterService**: Thermal printer integration
- **PDFService**: PDF generation for receipts
- **ReceiptTemplateService**: Receipt template management

### 💾 Storage (`/storage`)
- **StorageService**: File storage operations
- **OfflineDataService**: Offline data management
- **OfflineFirstService**: Offline-first architecture
- **DirectFileSystemService**: Direct filesystem access
- **AutoSyncService**: Auto synchronization with backend

### 🛠️ Utilities (`/utilities`)
- **LanguageService**: Internationalization support
- **TaxSettings**: Tax calculation settings
- **ContactsService**: Device contacts integration
- **AudioService**: Audio feedback for events

## Usage

### Import from organized folders:

```typescript
// Auth services
import MobileAuthService, { MobileUser } from '../services/auth/MobileAuthService';

// Business services
import PaymentService from '../services/business/PaymentService';

// Data services
import ItemService from '../services/data/ItemService';

// Feature services
import AnalyticsService from '../services/features/AnalyticsService';

// Printing services
import ThermalPrinterService from '../services/printing/ThermalPrinterService';

// Storage services
import AutoSyncService from '../services/storage/AutoSyncService';

// Utilities
import { getTaxRate } from '../services/utilities/TaxSettings';
```

### Or use the main index (imports all services):

```typescript
import { MobileAuthService, ItemService, PaymentService } from '../services';
```

## Migration Notes

All imports have been updated from the flat structure:
- ❌ `from '../services/ItemService'`
- ✅ `from '../services/data/ItemService'`

## Benefits

1. **Better Organization**: Related services grouped together
2. **Easier Navigation**: Find services by category
3. **Scalability**: Easy to add new services in appropriate folders
4. **Clear Dependencies**: Understand service relationships
5. **Maintainability**: Simpler to refactor and test
