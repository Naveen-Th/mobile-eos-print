import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReceiptTemplate, ReceiptTemplatePreset, ReceiptTemplateField, ReceiptTemplateLayout } from '../../types';
import { generateId } from '../../utils';

const TEMPLATE_STORAGE_KEY = 'receipt_templates';
const DEFAULT_TEMPLATE_KEY = 'default_template_id';

class ReceiptTemplateService {
  private static instance: ReceiptTemplateService;
  private templates: ReceiptTemplate[] = [];
  private defaultTemplateId: string | null = null;

  private constructor() {
    this.loadTemplates();
  }

  public static getInstance(): ReceiptTemplateService {
    if (!ReceiptTemplateService.instance) {
      ReceiptTemplateService.instance = new ReceiptTemplateService();
    }
    return ReceiptTemplateService.instance;
  }

  /**
   * Load templates from storage
   */
  private async loadTemplates(): Promise<void> {
    try {
      const storedTemplates = await AsyncStorage.getItem(TEMPLATE_STORAGE_KEY);
      const defaultTemplateId = await AsyncStorage.getItem(DEFAULT_TEMPLATE_KEY);
      
      if (storedTemplates) {
        this.templates = JSON.parse(storedTemplates);
      } else {
        // Initialize with predefined templates
        this.templates = this.createPredefinedTemplates();
        await this.saveTemplates();
      }
      
      this.defaultTemplateId = defaultTemplateId;
      
      // Ensure we have a default template
      if (!this.defaultTemplateId && this.templates.length > 0) {
        this.defaultTemplateId = this.templates[0].id;
        await AsyncStorage.setItem(DEFAULT_TEMPLATE_KEY, this.defaultTemplateId);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      // Fallback to predefined templates
      this.templates = this.createPredefinedTemplates();
    }
  }

  /**
   * Save templates to storage
   */
  private async saveTemplates(): Promise<void> {
    try {
      await AsyncStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(this.templates));
    } catch (error) {
      console.error('Error saving templates:', error);
      throw error;
    }
  }

  /**
   * Create predefined thermal printer templates
   */
  private createPredefinedTemplates(): ReceiptTemplate[] {
    const now = new Date();
    
    return [
      // Classic Template
      {
        id: 'classic-thermal',
        name: 'Classic Thermal',
        description: 'Traditional thermal receipt layout with clear sections',
        type: 'thermal',
        isDefault: true,
        isCustom: false,
        layout: this.createClassicLayout(),
        fields: this.createClassicFields(),
        createdAt: now,
        updatedAt: now,
      },
      
      // Modern Template
      {
        id: 'modern-thermal',
        name: 'Modern Minimal',
        description: 'Clean, modern design with efficient space usage',
        type: 'thermal',
        isDefault: false,
        isCustom: false,
        layout: this.createModernLayout(),
        fields: this.createModernFields(),
        createdAt: now,
        updatedAt: now,
      },
      
      // Detailed Template
      {
        id: 'detailed-thermal',
        name: 'Detailed Business',
        description: 'Comprehensive layout with all business details',
        type: 'thermal',
        isDefault: false,
        isCustom: false,
        layout: this.createDetailedLayout(),
        fields: this.createDetailedFields(),
        createdAt: now,
        updatedAt: now,
      },
      
      // Compact Template
      {
        id: 'compact-thermal',
        name: 'Compact Receipt',
        description: 'Space-saving design for small thermal papers (58mm)',
        type: 'thermal',
        isDefault: false,
        isCustom: false,
        layout: this.createCompactLayout(),
        fields: this.createCompactFields(),
        createdAt: now,
        updatedAt: now,
      },
      
      // Restaurant Template
      {
        id: 'restaurant-thermal',
        name: 'Restaurant Style',
        description: 'Optimized for food service with item descriptions',
        type: 'thermal',
        isDefault: false,
        isCustom: false,
        layout: this.createRestaurantLayout(),
        fields: this.createRestaurantFields(),
        createdAt: now,
        updatedAt: now,
      },
      
      // Retail Template
      {
        id: 'retail-thermal',
        name: 'Retail Pro',
        description: 'Professional retail layout with SKU and categories',
        type: 'thermal',
        isDefault: false,
        isCustom: false,
        layout: this.createRetailLayout(),
        fields: this.createRetailFields(),
        createdAt: now,
        updatedAt: now,
      },
      
      // Express Template
      {
        id: 'express-thermal',
        name: 'Express Quick',
        description: 'Ultra-fast printing with minimal information',
        type: 'thermal',
        isDefault: false,
        isCustom: false,
        layout: this.createExpressLayout(),
        fields: this.createExpressFields(),
        createdAt: now,
        updatedAt: now,
      },
      
      // Premium Template
      {
        id: 'premium-thermal',
        name: 'Premium Boutique',
        description: 'Elegant design for high-end retail and services',
        type: 'thermal',
        isDefault: false,
        isCustom: false,
        layout: this.createPremiumLayout(),
        fields: this.createPremiumFields(),
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  /**
   * Create classic thermal layout
   */
  private createClassicLayout(): ReceiptTemplateLayout {
    return {
      paperWidth: 80,
      maxWidth: 48,
      margins: { top: 2, bottom: 4, left: 0, right: 0 },
      sections: {
        header: {
          enabled: true,
          fields: ['company-name', 'company-address', 'company-phone'],
          style: { separator: true, spacing: 1 }
        },
        companyInfo: {
          enabled: false,
          fields: [],
          style: { separator: false, spacing: 0 }
        },
        receiptInfo: {
          enabled: true,
          fields: ['receipt-number', 'date', 'customer-name'],
          style: { separator: true, spacing: 1 }
        },
        items: {
          enabled: true,
          showHeaders: true,
          columns: {
            name: { width: 60, align: 'left' },
            quantity: { width: 10, align: 'center' },
            price: { width: 15, align: 'right' },
            total: { width: 15, align: 'right' }
          },
          style: { separator: true, spacing: 0 }
        },
        totals: {
          enabled: true,
          fields: ['subtotal', 'tax', 'total'],
          style: { separator: true, spacing: 1, highlightTotal: true }
        },
        footer: {
          enabled: true,
          fields: ['footer-message', 'thank-you'],
          style: { separator: true, spacing: 2 }
        }
      }
    };
  }

  /**
   * Create modern thermal layout
   */
  private createModernLayout(): ReceiptTemplateLayout {
    return {
      paperWidth: 80,
      maxWidth: 48,
      margins: { top: 1, bottom: 3, left: 0, right: 0 },
      sections: {
        header: {
          enabled: true,
          fields: ['company-name', 'receipt-number', 'date'],
          style: { separator: false, spacing: 0 }
        },
        companyInfo: {
          enabled: false,
          fields: [],
          style: { separator: false, spacing: 0 }
        },
        receiptInfo: {
          enabled: true,
          fields: ['customer-name'],
          style: { separator: true, spacing: 1 }
        },
        items: {
          enabled: true,
          showHeaders: false,
          columns: {
            name: { width: 70, align: 'left' },
            quantity: { width: 0, align: 'center' },
            price: { width: 0, align: 'right' },
            total: { width: 30, align: 'right' }
          },
          style: { separator: true, spacing: 0 }
        },
        totals: {
          enabled: true,
          fields: ['total'],
          style: { separator: false, spacing: 1, highlightTotal: true }
        },
        footer: {
          enabled: true,
          fields: ['thank-you'],
          style: { separator: false, spacing: 1 }
        }
      }
    };
  }

  /**
   * Create detailed thermal layout
   */
  private createDetailedLayout(): ReceiptTemplateLayout {
    return {
      paperWidth: 80,
      maxWidth: 48,
      margins: { top: 3, bottom: 5, left: 0, right: 0 },
      sections: {
        header: {
          enabled: true,
          fields: ['company-name', 'company-address', 'company-phone', 'company-email'],
          style: { separator: true, spacing: 2 }
        },
        companyInfo: {
          enabled: false,
          fields: [],
          style: { separator: false, spacing: 0 }
        },
        receiptInfo: {
          enabled: true,
          fields: ['receipt-number', 'date', 'customer-name'],
          style: { separator: true, spacing: 1 }
        },
        items: {
          enabled: true,
          showHeaders: true,
          columns: {
            name: { width: 50, align: 'left' },
            quantity: { width: 15, align: 'center' },
            price: { width: 17, align: 'right' },
            total: { width: 18, align: 'right' }
          },
          style: { separator: true, spacing: 1 }
        },
        totals: {
          enabled: true,
          fields: ['subtotal', 'tax', 'total'],
          style: { separator: true, spacing: 1, highlightTotal: true }
        },
        footer: {
          enabled: true,
          fields: ['footer-message', 'qr-code', 'thank-you'],
          style: { separator: true, spacing: 2 }
        }
      }
    };
  }

  /**
   * Create classic template fields
   */
  private createClassicFields(): ReceiptTemplateField[] {
    return [
      {
        id: 'company-name',
        name: 'companyName',
        type: 'text',
        label: 'Company Name',
        required: true,
        position: { x: 0, y: 0 },
        style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
        visible: true
      },
      {
        id: 'company-address',
        name: 'companyAddress',
        type: 'text',
        label: 'Company Address',
        required: false,
        position: { x: 0, y: 1 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'company-phone',
        name: 'companyPhone',
        type: 'text',
        label: 'Phone Number',
        required: false,
        position: { x: 0, y: 2 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'receipt-number',
        name: 'receiptNumber',
        type: 'text',
        label: 'Receipt Number',
        required: true,
        position: { x: 0, y: 4 },
        style: { fontSize: 14, fontWeight: 'bold', textAlign: 'left' },
        visible: true
      },
      {
        id: 'date',
        name: 'date',
        type: 'date',
        label: 'Date',
        required: true,
        position: { x: 0, y: 5 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'customer-name',
        name: 'customerName',
        type: 'text',
        label: 'Customer Name',
        required: false,
        position: { x: 0, y: 6 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'subtotal',
        name: 'subtotal',
        type: 'currency',
        label: 'Subtotal',
        required: true,
        position: { x: 0, y: 20 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right' },
        visible: true
      },
      {
        id: 'tax',
        name: 'tax',
        type: 'currency',
        label: 'Tax',
        required: true,
        position: { x: 0, y: 21 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right' },
        visible: true
      },
      {
        id: 'total',
        name: 'total',
        type: 'currency',
        label: 'Total',
        required: true,
        position: { x: 0, y: 22 },
        style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
        visible: true
      },
      {
        id: 'footer-message',
        name: 'footerMessage',
        type: 'text',
        label: 'Footer Message',
        required: false,
        position: { x: 0, y: 25 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'thank-you',
        name: 'thankYou',
        type: 'text',
        label: 'Thank You',
        value: 'Thank you for your business!',
        required: false,
        position: { x: 0, y: 26 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      }
    ];
  }

  /**
   * Create modern template fields
   */
  private createModernFields(): ReceiptTemplateField[] {
    return [
      {
        id: 'company-name',
        name: 'companyName',
        type: 'text',
        label: 'Company Name',
        required: true,
        position: { x: 0, y: 0 },
        style: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
        visible: true
      },
      {
        id: 'receipt-number',
        name: 'receiptNumber',
        type: 'text',
        label: 'Receipt Number',
        required: true,
        position: { x: 0, y: 1 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'date',
        name: 'date',
        type: 'date',
        label: 'Date',
        required: true,
        position: { x: 0, y: 2 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'customer-name',
        name: 'customerName',
        type: 'text',
        label: 'Customer Name',
        required: false,
        position: { x: 0, y: 4 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'total',
        name: 'total',
        type: 'currency',
        label: 'Total',
        required: true,
        position: { x: 0, y: 20 },
        style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
        visible: true
      },
      {
        id: 'thank-you',
        name: 'thankYou',
        type: 'text',
        label: 'Thank You',
        value: 'Thank you!',
        required: false,
        position: { x: 0, y: 22 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      }
    ];
  }

  /**
   * Create compact thermal layout (58mm)
   */
  private createCompactLayout(): ReceiptTemplateLayout {
    return {
      paperWidth: 58,
      maxWidth: 32,
      margins: { top: 1, bottom: 2, left: 0, right: 0 },
      sections: {
        header: {
          enabled: true,
          fields: ['company-name', 'receipt-number'],
          style: { separator: false, spacing: 0 }
        },
        companyInfo: {
          enabled: false,
          fields: [],
          style: { separator: false, spacing: 0 }
        },
        receiptInfo: {
          enabled: true,
          fields: ['date'],
          style: { separator: true, spacing: 0 }
        },
        items: {
          enabled: true,
          showHeaders: false,
          columns: {
            name: { width: 60, align: 'left' },
            quantity: { width: 0, align: 'center' },
            price: { width: 0, align: 'right' },
            total: { width: 40, align: 'right' }
          },
          style: { separator: true, spacing: 0 }
        },
        totals: {
          enabled: true,
          fields: ['total'],
          style: { separator: false, spacing: 0, highlightTotal: true }
        },
        footer: {
          enabled: true,
          fields: ['thank-you'],
          style: { separator: false, spacing: 1 }
        }
      }
    };
  }

  /**
   * Create restaurant thermal layout
   */
  private createRestaurantLayout(): ReceiptTemplateLayout {
    return {
      paperWidth: 80,
      maxWidth: 48,
      margins: { top: 2, bottom: 4, left: 0, right: 0 },
      sections: {
        header: {
          enabled: true,
          fields: ['company-name', 'company-address', 'company-phone'],
          style: { separator: true, spacing: 1 }
        },
        companyInfo: {
          enabled: false,
          fields: [],
          style: { separator: false, spacing: 0 }
        },
        receiptInfo: {
          enabled: true,
          fields: ['receipt-number', 'date', 'customer-name'],
          style: { separator: true, spacing: 1 }
        },
        items: {
          enabled: true,
          showHeaders: false,
          columns: {
            name: { width: 100, align: 'left' },
            quantity: { width: 0, align: 'center' },
            price: { width: 0, align: 'right' },
            total: { width: 0, align: 'right' }
          },
          style: { separator: true, spacing: 0 }
        },
        totals: {
          enabled: true,
          fields: ['subtotal', 'tax', 'total'],
          style: { separator: true, spacing: 1, highlightTotal: true }
        },
        footer: {
          enabled: true,
          fields: ['footer-message', 'thank-you'],
          style: { separator: true, spacing: 2 }
        }
      }
    };
  }

  /**
   * Create retail thermal layout
   */
  private createRetailLayout(): ReceiptTemplateLayout {
    return {
      paperWidth: 80,
      maxWidth: 48,
      margins: { top: 2, bottom: 3, left: 0, right: 0 },
      sections: {
        header: {
          enabled: true,
          fields: ['company-name', 'company-address'],
          style: { separator: true, spacing: 1 }
        },
        companyInfo: {
          enabled: false,
          fields: [],
          style: { separator: false, spacing: 0 }
        },
        receiptInfo: {
          enabled: true,
          fields: ['receipt-number', 'date', 'customer-name'],
          style: { separator: true, spacing: 1 }
        },
        items: {
          enabled: true,
          showHeaders: true,
          columns: {
            name: { width: 55, align: 'left' },
            quantity: { width: 12, align: 'center' },
            price: { width: 16, align: 'right' },
            total: { width: 17, align: 'right' }
          },
          style: { separator: true, spacing: 0 }
        },
        totals: {
          enabled: true,
          fields: ['subtotal', 'tax', 'total'],
          style: { separator: true, spacing: 1, highlightTotal: true }
        },
        footer: {
          enabled: true,
          fields: ['thank-you'],
          style: { separator: false, spacing: 1 }
        }
      }
    };
  }

  /**
   * Create express thermal layout
   */
  private createExpressLayout(): ReceiptTemplateLayout {
    return {
      paperWidth: 80,
      maxWidth: 48,
      margins: { top: 0, bottom: 2, left: 0, right: 0 },
      sections: {
        header: {
          enabled: true,
          fields: ['company-name'],
          style: { separator: false, spacing: 0 }
        },
        companyInfo: {
          enabled: false,
          fields: [],
          style: { separator: false, spacing: 0 }
        },
        receiptInfo: {
          enabled: true,
          fields: ['receipt-number', 'date'],
          style: { separator: true, spacing: 0 }
        },
        items: {
          enabled: true,
          showHeaders: false,
          columns: {
            name: { width: 70, align: 'left' },
            quantity: { width: 0, align: 'center' },
            price: { width: 0, align: 'right' },
            total: { width: 30, align: 'right' }
          },
          style: { separator: false, spacing: 0 }
        },
        totals: {
          enabled: true,
          fields: ['total'],
          style: { separator: true, spacing: 0, highlightTotal: true }
        },
        footer: {
          enabled: false,
          fields: [],
          style: { separator: false, spacing: 0 }
        }
      }
    };
  }

  /**
   * Create premium thermal layout
   */
  private createPremiumLayout(): ReceiptTemplateLayout {
    return {
      paperWidth: 80,
      maxWidth: 48,
      margins: { top: 3, bottom: 5, left: 0, right: 0 },
      sections: {
        header: {
          enabled: true,
          fields: ['company-name', 'company-address', 'company-phone', 'company-email'],
          style: { separator: true, spacing: 2 }
        },
        companyInfo: {
          enabled: false,
          fields: [],
          style: { separator: false, spacing: 0 }
        },
        receiptInfo: {
          enabled: true,
          fields: ['receipt-number', 'date', 'customer-name'],
          style: { separator: true, spacing: 2 }
        },
        items: {
          enabled: true,
          showHeaders: true,
          columns: {
            name: { width: 50, align: 'left' },
            quantity: { width: 15, align: 'center' },
            price: { width: 17, align: 'right' },
            total: { width: 18, align: 'right' }
          },
          style: { separator: true, spacing: 2 }
        },
        totals: {
          enabled: true,
          fields: ['subtotal', 'tax', 'total'],
          style: { separator: true, spacing: 2, highlightTotal: true }
        },
        footer: {
          enabled: true,
          fields: ['footer-message', 'qr-code', 'thank-you'],
          style: { separator: true, spacing: 3 }
        }
      }
    };
  }

  /**
   * Create detailed template fields
   */
  private createDetailedFields(): ReceiptTemplateField[] {
    return [
      {
        id: 'company-name',
        name: 'companyName',
        type: 'text',
        label: 'Company Name',
        required: true,
        position: { x: 0, y: 0 },
        style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
        visible: true
      },
      {
        id: 'company-address',
        name: 'companyAddress',
        type: 'text',
        label: 'Company Address',
        required: false,
        position: { x: 0, y: 1 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'company-phone',
        name: 'companyPhone',
        type: 'text',
        label: 'Phone Number',
        required: false,
        position: { x: 0, y: 2 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'company-email',
        name: 'companyEmail',
        type: 'text',
        label: 'Email',
        required: false,
        position: { x: 0, y: 3 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'receipt-number',
        name: 'receiptNumber',
        type: 'text',
        label: 'Receipt Number',
        required: true,
        position: { x: 0, y: 6 },
        style: { fontSize: 12, fontWeight: 'bold', textAlign: 'left' },
        visible: true
      },
      {
        id: 'date',
        name: 'date',
        type: 'date',
        label: 'Date',
        required: true,
        position: { x: 0, y: 7 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'customer-name',
        name: 'customerName',
        type: 'text',
        label: 'Customer Name',
        required: false,
        position: { x: 0, y: 8 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'subtotal',
        name: 'subtotal',
        type: 'currency',
        label: 'Subtotal',
        required: true,
        position: { x: 0, y: 22 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right' },
        visible: true
      },
      {
        id: 'tax',
        name: 'tax',
        type: 'currency',
        label: 'Tax',
        required: true,
        position: { x: 0, y: 23 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right' },
        visible: true
      },
      {
        id: 'total',
        name: 'total',
        type: 'currency',
        label: 'Total',
        required: true,
        position: { x: 0, y: 24 },
        style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
        visible: true
      },
      {
        id: 'footer-message',
        name: 'footerMessage',
        type: 'text',
        label: 'Footer Message',
        required: false,
        position: { x: 0, y: 27 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'qr-code',
        name: 'qrCode',
        type: 'qrcode',
        label: 'QR Code',
        required: false,
        position: { x: 0, y: 28 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center', width: 100, height: 100 },
        visible: true
      },
      {
        id: 'thank-you',
        name: 'thankYou',
        type: 'text',
        label: 'Thank You',
        value: 'Thank you for your business!',
        required: false,
        position: { x: 0, y: 30 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      }
    ];
  }

  /**
   * Create compact template fields (58mm)
   */
  private createCompactFields(): ReceiptTemplateField[] {
    return [
      {
        id: 'company-name',
        name: 'companyName',
        type: 'text',
        label: 'Company Name',
        required: true,
        position: { x: 0, y: 0 },
        style: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
        visible: true
      },
      {
        id: 'receipt-number',
        name: 'receiptNumber',
        type: 'text',
        label: 'Receipt Number',
        required: true,
        position: { x: 0, y: 1 },
        style: { fontSize: 10, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'date',
        name: 'date',
        type: 'date',
        label: 'Date',
        required: true,
        position: { x: 0, y: 3 },
        style: { fontSize: 10, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'total',
        name: 'total',
        type: 'currency',
        label: 'Total',
        required: true,
        position: { x: 0, y: 15 },
        style: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
        visible: true
      },
      {
        id: 'thank-you',
        name: 'thankYou',
        type: 'text',
        label: 'Thank You',
        value: 'Thank you!',
        required: false,
        position: { x: 0, y: 17 },
        style: { fontSize: 10, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      }
    ];
  }

  /**
   * Create restaurant template fields
   */
  private createRestaurantFields(): ReceiptTemplateField[] {
    return [
      {
        id: 'company-name',
        name: 'companyName',
        type: 'text',
        label: 'Restaurant Name',
        required: true,
        position: { x: 0, y: 0 },
        style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
        visible: true
      },
      {
        id: 'company-address',
        name: 'companyAddress',
        type: 'text',
        label: 'Restaurant Address',
        required: false,
        position: { x: 0, y: 1 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'company-phone',
        name: 'companyPhone',
        type: 'text',
        label: 'Phone',
        required: false,
        position: { x: 0, y: 2 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'receipt-number',
        name: 'receiptNumber',
        type: 'text',
        label: 'Order Number',
        required: true,
        position: { x: 0, y: 5 },
        style: { fontSize: 13, fontWeight: 'bold', textAlign: 'left' },
        visible: true
      },
      {
        id: 'date',
        name: 'date',
        type: 'date',
        label: 'Order Time',
        required: true,
        position: { x: 0, y: 6 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'customer-name',
        name: 'customerName',
        type: 'text',
        label: 'Customer',
        required: false,
        position: { x: 0, y: 7 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'subtotal',
        name: 'subtotal',
        type: 'currency',
        label: 'Subtotal',
        required: true,
        position: { x: 0, y: 20 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right' },
        visible: true
      },
      {
        id: 'tax',
        name: 'tax',
        type: 'currency',
        label: 'Tax',
        required: true,
        position: { x: 0, y: 21 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right' },
        visible: true
      },
      {
        id: 'total',
        name: 'total',
        type: 'currency',
        label: 'Total',
        required: true,
        position: { x: 0, y: 22 },
        style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
        visible: true
      },
      {
        id: 'footer-message',
        name: 'footerMessage',
        type: 'text',
        label: 'Footer Message',
        required: false,
        position: { x: 0, y: 25 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'thank-you',
        name: 'thankYou',
        type: 'text',
        label: 'Thank You',
        value: 'Enjoy your meal!',
        required: false,
        position: { x: 0, y: 26 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      }
    ];
  }

  /**
   * Create retail template fields
   */
  private createRetailFields(): ReceiptTemplateField[] {
    return [
      {
        id: 'company-name',
        name: 'companyName',
        type: 'text',
        label: 'Store Name',
        required: true,
        position: { x: 0, y: 0 },
        style: { fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
        visible: true
      },
      {
        id: 'company-address',
        name: 'companyAddress',
        type: 'text',
        label: 'Store Address',
        required: false,
        position: { x: 0, y: 1 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'receipt-number',
        name: 'receiptNumber',
        type: 'text',
        label: 'Transaction ID',
        required: true,
        position: { x: 0, y: 4 },
        style: { fontSize: 12, fontWeight: 'bold', textAlign: 'left' },
        visible: true
      },
      {
        id: 'date',
        name: 'date',
        type: 'date',
        label: 'Sale Date',
        required: true,
        position: { x: 0, y: 5 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'customer-name',
        name: 'customerName',
        type: 'text',
        label: 'Customer',
        required: false,
        position: { x: 0, y: 6 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'subtotal',
        name: 'subtotal',
        type: 'currency',
        label: 'Subtotal',
        required: true,
        position: { x: 0, y: 20 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right' },
        visible: true
      },
      {
        id: 'tax',
        name: 'tax',
        type: 'currency',
        label: 'Sales Tax',
        required: true,
        position: { x: 0, y: 21 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right' },
        visible: true
      },
      {
        id: 'total',
        name: 'total',
        type: 'currency',
        label: 'Total Amount',
        required: true,
        position: { x: 0, y: 22 },
        style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
        visible: true
      },
      {
        id: 'thank-you',
        name: 'thankYou',
        type: 'text',
        label: 'Thank You',
        value: 'Thank you for shopping with us!',
        required: false,
        position: { x: 0, y: 24 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      }
    ];
  }

  /**
   * Create express template fields
   */
  private createExpressFields(): ReceiptTemplateField[] {
    return [
      {
        id: 'company-name',
        name: 'companyName',
        type: 'text',
        label: 'Business Name',
        required: true,
        position: { x: 0, y: 0 },
        style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
        visible: true
      },
      {
        id: 'receipt-number',
        name: 'receiptNumber',
        type: 'text',
        label: 'Receipt #',
        required: true,
        position: { x: 0, y: 2 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'date',
        name: 'date',
        type: 'date',
        label: 'Date',
        required: true,
        position: { x: 0, y: 3 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'total',
        name: 'total',
        type: 'currency',
        label: 'TOTAL',
        required: true,
        position: { x: 0, y: 15 },
        style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
        visible: true
      }
    ];
  }

  /**
   * Create premium template fields
   */
  private createPremiumFields(): ReceiptTemplateField[] {
    return [
      {
        id: 'company-name',
        name: 'companyName',
        type: 'text',
        label: 'Boutique Name',
        required: true,
        position: { x: 0, y: 0 },
        style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
        visible: true
      },
      {
        id: 'company-address',
        name: 'companyAddress',
        type: 'text',
        label: 'Address',
        required: false,
        position: { x: 0, y: 1 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'company-phone',
        name: 'companyPhone',
        type: 'text',
        label: 'Phone',
        required: false,
        position: { x: 0, y: 2 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'company-email',
        name: 'companyEmail',
        type: 'text',
        label: 'Email',
        required: false,
        position: { x: 0, y: 3 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'receipt-number',
        name: 'receiptNumber',
        type: 'text',
        label: 'Purchase Order',
        required: true,
        position: { x: 0, y: 7 },
        style: { fontSize: 12, fontWeight: 'bold', textAlign: 'left' },
        visible: true
      },
      {
        id: 'date',
        name: 'date',
        type: 'date',
        label: 'Purchase Date',
        required: true,
        position: { x: 0, y: 8 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'customer-name',
        name: 'customerName',
        type: 'text',
        label: 'Valued Customer',
        required: false,
        position: { x: 0, y: 9 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'left' },
        visible: true
      },
      {
        id: 'subtotal',
        name: 'subtotal',
        type: 'currency',
        label: 'Subtotal',
        required: true,
        position: { x: 0, y: 25 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right' },
        visible: true
      },
      {
        id: 'tax',
        name: 'tax',
        type: 'currency',
        label: 'Tax',
        required: true,
        position: { x: 0, y: 26 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right' },
        visible: true
      },
      {
        id: 'total',
        name: 'total',
        type: 'currency',
        label: 'Total',
        required: true,
        position: { x: 0, y: 27 },
        style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
        visible: true
      },
      {
        id: 'footer-message',
        name: 'footerMessage',
        type: 'text',
        label: 'Footer Message',
        required: false,
        position: { x: 0, y: 31 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      },
      {
        id: 'qr-code',
        name: 'qrCode',
        type: 'qrcode',
        label: 'QR Code',
        required: false,
        position: { x: 0, y: 32 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center', width: 100, height: 100 },
        visible: true
      },
      {
        id: 'thank-you',
        name: 'thankYou',
        type: 'text',
        label: 'Thank You',
        value: 'Thank you for choosing us!',
        required: false,
        position: { x: 0, y: 34 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: true
      }
    ];
  }

  /**
   * Get all templates
   */
  public async getTemplates(): Promise<ReceiptTemplate[]> {
    if (this.templates.length === 0) {
      await this.loadTemplates();
    }
    return [...this.templates];
  }

  /**
   * Get template by ID
   */
  public async getTemplate(id: string): Promise<ReceiptTemplate | null> {
    const templates = await this.getTemplates();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * Get default template
   */
  public async getDefaultTemplate(): Promise<ReceiptTemplate | null> {
    if (!this.defaultTemplateId) {
      await this.loadTemplates();
    }
    
    if (this.defaultTemplateId) {
      return this.getTemplate(this.defaultTemplateId);
    }
    
    const templates = await this.getTemplates();
    return templates.find(t => t.isDefault) || templates[0] || null;
  }

  /**
   * Set default template
   */
  public async setDefaultTemplate(templateId: string): Promise<boolean> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Update current default
      this.templates = this.templates.map(t => ({
        ...t,
        isDefault: t.id === templateId
      }));

      this.defaultTemplateId = templateId;
      await AsyncStorage.setItem(DEFAULT_TEMPLATE_KEY, templateId);
      await this.saveTemplates();
      
      return true;
    } catch (error) {
      console.error('Error setting default template:', error);
      return false;
    }
  }

  /**
   * Create new template
   */
  public async createTemplate(
    name: string,
    description: string,
    layout: ReceiptTemplateLayout,
    fields: ReceiptTemplateField[],
    type: 'thermal' | 'pdf' | 'both' = 'thermal'
  ): Promise<ReceiptTemplate> {
    const now = new Date();
    const newTemplate: ReceiptTemplate = {
      id: generateId(),
      name,
      description,
      type,
      isDefault: false,
      isCustom: true,
      layout,
      fields,
      createdAt: now,
      updatedAt: now,
    };

    this.templates.push(newTemplate);
    await this.saveTemplates();
    
    return newTemplate;
  }

  /**
   * Update template
   */
  public async updateTemplate(
    id: string,
    updates: Partial<Omit<ReceiptTemplate, 'id' | 'createdAt' | 'isCustom'>>
  ): Promise<ReceiptTemplate | null> {
    try {
      const templateIndex = this.templates.findIndex(t => t.id === id);
      if (templateIndex === -1) {
        return null;
      }

      const updatedTemplate = {
        ...this.templates[templateIndex],
        ...updates,
        updatedAt: new Date(),
      };

      this.templates[templateIndex] = updatedTemplate;
      await this.saveTemplates();
      
      return updatedTemplate;
    } catch (error) {
      console.error('Error updating template:', error);
      return null;
    }
  }

  /**
   * Delete template
   */
  public async deleteTemplate(id: string): Promise<boolean> {
    try {
      const template = await this.getTemplate(id);
      if (!template) {
        return false;
      }

      // Cannot delete non-custom templates
      if (!template.isCustom) {
        throw new Error('Cannot delete predefined templates');
      }

      // If this is the default template, set a new default
      if (template.isDefault) {
        const otherTemplate = this.templates.find(t => t.id !== id);
        if (otherTemplate) {
          await this.setDefaultTemplate(otherTemplate.id);
        }
      }

      this.templates = this.templates.filter(t => t.id !== id);
      await this.saveTemplates();
      
      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      return false;
    }
  }

  /**
   * Duplicate template
   */
  public async duplicateTemplate(id: string, name?: string): Promise<ReceiptTemplate | null> {
    try {
      const template = await this.getTemplate(id);
      if (!template) {
        return null;
      }

      const duplicatedTemplate = await this.createTemplate(
        name || `${template.name} (Copy)`,
        template.description || '',
        { ...template.layout },
        template.fields.map(field => ({ ...field })),
        template.type
      );

      return duplicatedTemplate;
    } catch (error) {
      console.error('Error duplicating template:', error);
      return null;
    }
  }

  /**
   * Reset to default templates
   */
  public async resetToDefaults(): Promise<void> {
    try {
      this.templates = this.createPredefinedTemplates();
      this.defaultTemplateId = this.templates[0].id;
      
      await this.saveTemplates();
      await AsyncStorage.setItem(DEFAULT_TEMPLATE_KEY, this.defaultTemplateId);
    } catch (error) {
      console.error('Error resetting templates:', error);
      throw error;
    }
  }
}

export default ReceiptTemplateService.getInstance();
