import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { ReceiptTemplate, ReceiptTemplateField, Receipt } from '../types';
import { formatCurrency, formatReceiptDate, createSeparatorLine, centerText, rightAlignText } from '../utils';

interface ReceiptTemplatePreviewProps {
  template: ReceiptTemplate;
  sampleData?: Partial<Receipt>;
  style?: any;
}

interface SampleData {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  receiptNumber: string;
  date: Date;
  customerName?: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  footerMessage?: string;
  thankYou?: string;
}

const ReceiptTemplatePreview: React.FC<ReceiptTemplatePreviewProps> = ({
  template,
  sampleData,
  style,
}) => {
  // Default sample data
  const defaultSampleData: SampleData = {
    companyName: 'Sample Store',
    companyAddress: '123 Main Street, City, State 12345',
    companyPhone: '(555) 123-4567',
    companyEmail: 'info@samplestore.com',
    receiptNumber: 'REC-20241005-0001',
    date: new Date(),
    customerName: 'John Doe',
    items: [
      { name: 'Coffee', price: 4.50, quantity: 2 },
      { name: 'Sandwich', price: 8.99, quantity: 1 },
      { name: 'Cookie', price: 2.25, quantity: 3 },
    ],
    subtotal: 24.24,
    tax: 1.94,
    total: 26.18,
    footerMessage: 'Visit us again soon!',
    thankYou: 'Thank you for your business!',
  };

  const data = { ...defaultSampleData, ...sampleData };
  const maxWidth = template.layout.maxWidth;

  /**
   * Get field value from sample data
   */
  const getFieldValue = (field: ReceiptTemplateField): string => {
    switch (field.name) {
      case 'companyName':
        return data.companyName;
      case 'companyAddress':
        return data.companyAddress || '';
      case 'companyPhone':
        return data.companyPhone || '';
      case 'companyEmail':
        return data.companyEmail || '';
      case 'receiptNumber':
        return data.receiptNumber;
      case 'date':
        return formatReceiptDate(data.date);
      case 'customerName':
        return data.customerName || 'Walk-in Customer';
      case 'subtotal':
        return formatCurrency(data.subtotal);
      case 'tax':
        return formatCurrency(data.tax);
      case 'total':
        return formatCurrency(data.total);
      case 'footerMessage':
        return data.footerMessage || '';
      case 'thankYou':
        return data.thankYou || field.value || '';
      default:
        return field.value || field.label;
    }
  };

  /**
   * Format text according to field style
   */
  const formatText = (text: string, field: ReceiptTemplateField): string => {
    if (!text) return '';

    switch (field.style.textAlign) {
      case 'center':
        return centerText(text, maxWidth);
      case 'right':
        return rightAlignText(text, maxWidth);
      default:
        return text;
    }
  };

  /**
   * Render a template field
   */
  const renderField = (field: ReceiptTemplateField): React.ReactElement | null => {
    if (!field.visible) return null;

    const value = getFieldValue(field);
    if (!value && field.type !== 'separator') return null;

    const textStyle = {
      fontSize: field.style.fontSize,
      fontWeight: field.style.fontWeight,
      textAlign: field.style.textAlign as 'left' | 'center' | 'right',
      marginTop: field.style.marginTop || 0,
      marginBottom: field.style.marginBottom || 0,
    };

    switch (field.type) {
      case 'separator':
        return (
          <Text key={field.id} style={[styles.monospaceText, { fontSize: 10 }]}>
            {createSeparatorLine(maxWidth)}
          </Text>
        );
        
      case 'qrcode':
        return (
          <View key={field.id} style={styles.qrCodePlaceholder}>
            <Text style={styles.qrCodeText}>QR CODE</Text>
          </View>
        );
        
      default:
        return (
          <Text key={field.id} style={[styles.monospaceText, textStyle]}>
            {formatText(value, field)}
          </Text>
        );
    }
  };

  /**
   * Render receipt section
   */
  const renderSection = (
    sectionName: keyof typeof template.layout.sections,
    fieldIds: string[]
  ): React.ReactElement[] => {
    const section = template.layout.sections[sectionName];
    if (!section.enabled) return [];

    const elements: React.ReactElement[] = [];

    // Add spacing before section
    if (section.style.spacing > 0) {
      for (let i = 0; i < section.style.spacing; i++) {
        elements.push(
          <Text key={`${sectionName}-spacing-${i}`} style={styles.emptyLine}>
            {' '}
          </Text>
        );
      }
    }

    // Render fields
    fieldIds.forEach(fieldId => {
      const field = template.fields.find(f => f.id === fieldId);
      if (field) {
        const element = renderField(field);
        if (element) {
          elements.push(element);
        }
      }
    });

    // Add separator
    if (section.style.separator) {
      elements.push(
        <Text key={`${sectionName}-separator`} style={[styles.monospaceText, { fontSize: 10 }]}>
          {createSeparatorLine(maxWidth)}
        </Text>
      );
    }

    return elements;
  };

  /**
   * Render items section
   */
  const renderItemsSection = (): React.ReactElement[] => {
    const section = template.layout.sections.items;
    if (!section.enabled) return [];

    const elements: React.ReactElement[] = [];

    // Add spacing before section
    if (section.style.spacing > 0) {
      for (let i = 0; i < section.style.spacing; i++) {
        elements.push(
          <Text key={`items-spacing-${i}`} style={styles.emptyLine}>
            {' '}
          </Text>
        );
      }
    }

    // Add headers if enabled
    if (section.showHeaders) {
      const headerText = 
        'Item'.padEnd(Math.floor(maxWidth * 0.5)) +
        'Qty'.padStart(8) +
        'Price'.padStart(12) +
        'Total'.padStart(12);
        
      elements.push(
        <Text key="items-header" style={[styles.monospaceText, { fontWeight: 'bold', fontSize: 11 }]}>
          {headerText}
        </Text>
      );
    }

    // Add items
    data.items.forEach((item, index) => {
      const itemTotal = item.price * item.quantity;
      let itemLine = '';
      
      // Format based on column widths
      if (section.columns.quantity.width === 0) {
        // Modern style - no separate quantity/price columns
        const nameWidth = Math.floor(maxWidth * 0.65);
        const totalWidth = maxWidth - nameWidth - 1;
        
        itemLine = item.name.substring(0, nameWidth).padEnd(nameWidth) + ' ' + 
                   formatCurrency(itemTotal).padStart(totalWidth);
      } else {
        // Classic/Detailed style - all columns
        const nameWidth = Math.floor(maxWidth * 0.5);
        const qtyText = item.quantity.toString();
        const priceText = formatCurrency(item.price);
        const totalText = formatCurrency(itemTotal);
        
        itemLine = item.name.substring(0, nameWidth).padEnd(nameWidth) + 
                   qtyText.padStart(6) + 
                   priceText.padStart(10) + 
                   totalText.padStart(10);
      }

      elements.push(
        <Text key={`item-${index}`} style={[styles.monospaceText, { fontSize: 11 }]}>
          {itemLine}
        </Text>
      );

      // Add quantity x price line for modern style
      if (section.columns.quantity.width === 0 && item.quantity > 1) {
        const qtyPriceLine = `  ${item.quantity} × ${formatCurrency(item.price)}`;
        elements.push(
          <Text key={`item-${index}-details`} style={[styles.monospaceText, { fontSize: 10, color: '#666' }]}>
            {qtyPriceLine}
          </Text>
        );
      }
    });

    // Add separator
    if (section.style.separator) {
      elements.push(
        <Text key="items-separator" style={[styles.monospaceText, { fontSize: 10 }]}>
          {createSeparatorLine(maxWidth)}
        </Text>
      );
    }

    return elements;
  };

  return (
    <ScrollView style={[styles.container, style]} showsVerticalScrollIndicator={false}>
      <View style={styles.receiptContainer}>
        <View style={[styles.receiptPaper, { width: maxWidth * 8.5 }]}>
          {/* Header Section */}
          {renderSection('header', template.layout.sections.header.fields)}
          
          {/* Company Info Section */}
          {renderSection('companyInfo', template.layout.sections.companyInfo.fields)}
          
          {/* Receipt Info Section */}
          {renderSection('receiptInfo', template.layout.sections.receiptInfo.fields)}
          
          {/* Items Section */}
          {renderItemsSection()}
          
          {/* Totals Section */}
          {renderSection('totals', template.layout.sections.totals.fields)}
          
          {/* Footer Section */}
          {renderSection('footer', template.layout.sections.footer.fields)}
          
          {/* Bottom margin */}
          {Array.from({ length: template.layout.margins.bottom }, (_, i) => (
            <Text key={`bottom-margin-${i}`} style={styles.emptyLine}>
              {' '}
            </Text>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  receiptContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  receiptPaper: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 300,
  },
  monospaceText: {
    fontFamily: Platform.select({
      ios: 'Courier New',
      android: 'monospace',
      default: 'monospace',
    }),
    fontSize: 12,
    lineHeight: 16,
    color: '#000',
  },
  emptyLine: {
    fontSize: 12,
    lineHeight: 16,
    color: 'transparent',
  },
  qrCodePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  qrCodeText: {
    fontSize: 10,
    color: '#666',
    fontWeight: 'bold',
  },
});

export default ReceiptTemplatePreview;
