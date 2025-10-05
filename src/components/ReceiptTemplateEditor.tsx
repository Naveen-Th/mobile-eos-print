import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ReceiptTemplate, ReceiptTemplateField, ReceiptTemplateLayout } from '../types';
import ReceiptTemplateService from '../services/ReceiptTemplateService';
import ReceiptTemplatePreview from './ReceiptTemplatePreview';
import { generateId } from '../utils';

interface ReceiptTemplateEditorProps {
  template?: ReceiptTemplate | null;
  onSave: (template: ReceiptTemplate) => void;
  onClose: () => void;
}

interface EditableSection {
  id: string;
  name: string;
  enabled: boolean;
  spacing: number;
  separator: boolean;
}

const ReceiptTemplateEditor: React.FC<ReceiptTemplateEditorProps> = ({
  template,
  onSave,
  onClose,
}) => {
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [paperWidth, setPaperWidth] = useState<58 | 80>(80);
  const [maxWidth, setMaxWidth] = useState(48);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'sections' | 'preview'>('basic');
  
  // Section states
  const [sections, setSections] = useState<EditableSection[]>([
    { id: 'header', name: 'Header', enabled: true, spacing: 1, separator: true },
    { id: 'receiptInfo', name: 'Receipt Info', enabled: true, spacing: 1, separator: true },
    { id: 'items', name: 'Items', enabled: true, spacing: 0, separator: true },
    { id: 'totals', name: 'Totals', enabled: true, spacing: 1, separator: true },
    { id: 'footer', name: 'Footer', enabled: true, spacing: 2, separator: false },
  ]);

  // Field visibility states
  const [fieldVisibility, setFieldVisibility] = useState<{[key: string]: boolean}>({
    'company-name': true,
    'company-address': true,
    'company-phone': true,
    'company-email': false,
    'receipt-number': true,
    'date': true,
    'customer-name': true,
    'subtotal': true,
    'tax': true,
    'total': true,
    'footer-message': true,
    'qr-code': false,
    'thank-you': true,
  });

  useEffect(() => {
    if (template) {
      // Load existing template data
      setTemplateName(template.name);
      setTemplateDescription(template.description || '');
      setPaperWidth(template.layout.paperWidth);
      setMaxWidth(template.layout.maxWidth);
      
      // Load section settings
      const layoutSections = template.layout.sections;
      setSections([
        { 
          id: 'header', 
          name: 'Header', 
          enabled: layoutSections.header.enabled, 
          spacing: layoutSections.header.style.spacing, 
          separator: layoutSections.header.style.separator 
        },
        { 
          id: 'receiptInfo', 
          name: 'Receipt Info', 
          enabled: layoutSections.receiptInfo.enabled, 
          spacing: layoutSections.receiptInfo.style.spacing, 
          separator: layoutSections.receiptInfo.style.separator 
        },
        { 
          id: 'items', 
          name: 'Items', 
          enabled: layoutSections.items.enabled, 
          spacing: layoutSections.items.style.spacing, 
          separator: layoutSections.items.style.separator 
        },
        { 
          id: 'totals', 
          name: 'Totals', 
          enabled: layoutSections.totals.enabled, 
          spacing: layoutSections.totals.style.spacing, 
          separator: layoutSections.totals.style.separator 
        },
        { 
          id: 'footer', 
          name: 'Footer', 
          enabled: layoutSections.footer.enabled, 
          spacing: layoutSections.footer.style.spacing, 
          separator: layoutSections.footer.style.separator 
        },
      ]);

      // Load field visibility
      const visibility: {[key: string]: boolean} = {};
      template.fields.forEach(field => {
        visibility[field.id] = field.visible;
      });
      setFieldVisibility(visibility);
    } else {
      // Set default values for new template
      setTemplateName('My Custom Template');
      setTemplateDescription('A custom receipt template');
    }
  }, [template]);

  const updateSection = (sectionId: string, updates: Partial<EditableSection>) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, ...updates } : section
    ));
  };

  const updateFieldVisibility = (fieldId: string, visible: boolean) => {
    setFieldVisibility(prev => ({ ...prev, [fieldId]: visible }));
  };

  const generateTemplateLayout = (): ReceiptTemplateLayout => {
    const sectionMap = sections.reduce((acc, section) => {
      acc[section.id] = section;
      return acc;
    }, {} as {[key: string]: EditableSection});

    return {
      paperWidth,
      maxWidth,
      margins: { top: 2, bottom: 3, left: 0, right: 0 },
      sections: {
        header: {
          enabled: sectionMap.header.enabled,
          fields: ['company-name', 'company-address', 'company-phone', 'company-email'].filter(
            fieldId => fieldVisibility[fieldId]
          ),
          style: { 
            separator: sectionMap.header.separator, 
            spacing: sectionMap.header.spacing 
          }
        },
        companyInfo: {
          enabled: false,
          fields: [],
          style: { separator: false, spacing: 0 }
        },
        receiptInfo: {
          enabled: sectionMap.receiptInfo.enabled,
          fields: ['receipt-number', 'date', 'customer-name'].filter(
            fieldId => fieldVisibility[fieldId]
          ),
          style: { 
            separator: sectionMap.receiptInfo.separator, 
            spacing: sectionMap.receiptInfo.spacing 
          }
        },
        items: {
          enabled: sectionMap.items.enabled,
          showHeaders: true,
          columns: {
            name: { width: 50, align: 'left' as const },
            quantity: { width: 15, align: 'center' as const },
            price: { width: 17, align: 'right' as const },
            total: { width: 18, align: 'right' as const }
          },
          style: { 
            separator: sectionMap.items.separator, 
            spacing: sectionMap.items.spacing 
          }
        },
        totals: {
          enabled: sectionMap.totals.enabled,
          fields: ['subtotal', 'tax', 'total'].filter(fieldId => fieldVisibility[fieldId]),
          style: { 
            separator: sectionMap.totals.separator, 
            spacing: sectionMap.totals.spacing, 
            highlightTotal: true 
          }
        },
        footer: {
          enabled: sectionMap.footer.enabled,
          fields: ['footer-message', 'qr-code', 'thank-you'].filter(
            fieldId => fieldVisibility[fieldId]
          ),
          style: { 
            separator: sectionMap.footer.separator, 
            spacing: sectionMap.footer.spacing 
          }
        }
      }
    };
  };

  const generateTemplateFields = (): ReceiptTemplateField[] => {
    const baseFields: ReceiptTemplateField[] = [
      {
        id: 'company-name',
        name: 'companyName',
        type: 'text',
        label: 'Company Name',
        required: true,
        position: { x: 0, y: 0 },
        style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
        visible: fieldVisibility['company-name'] || false
      },
      {
        id: 'company-address',
        name: 'companyAddress',
        type: 'text',
        label: 'Company Address',
        required: false,
        position: { x: 0, y: 1 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: fieldVisibility['company-address'] || false
      },
      {
        id: 'company-phone',
        name: 'companyPhone',
        type: 'text',
        label: 'Phone Number',
        required: false,
        position: { x: 0, y: 2 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: fieldVisibility['company-phone'] || false
      },
      {
        id: 'company-email',
        name: 'companyEmail',
        type: 'text',
        label: 'Email',
        required: false,
        position: { x: 0, y: 3 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: fieldVisibility['company-email'] || false
      },
      {
        id: 'receipt-number',
        name: 'receiptNumber',
        type: 'text',
        label: 'Receipt Number',
        required: true,
        position: { x: 0, y: 5 },
        style: { fontSize: 12, fontWeight: 'bold', textAlign: 'left' },
        visible: fieldVisibility['receipt-number'] || false
      },
      {
        id: 'date',
        name: 'date',
        type: 'date',
        label: 'Date',
        required: true,
        position: { x: 0, y: 6 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'left' },
        visible: fieldVisibility['date'] || false
      },
      {
        id: 'customer-name',
        name: 'customerName',
        type: 'text',
        label: 'Customer Name',
        required: false,
        position: { x: 0, y: 7 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'left' },
        visible: fieldVisibility['customer-name'] || false
      },
      {
        id: 'subtotal',
        name: 'subtotal',
        type: 'currency',
        label: 'Subtotal',
        required: true,
        position: { x: 0, y: 20 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right' },
        visible: fieldVisibility['subtotal'] || false
      },
      {
        id: 'tax',
        name: 'tax',
        type: 'currency',
        label: 'Tax',
        required: true,
        position: { x: 0, y: 21 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right' },
        visible: fieldVisibility['tax'] || false
      },
      {
        id: 'total',
        name: 'total',
        type: 'currency',
        label: 'Total',
        required: true,
        position: { x: 0, y: 22 },
        style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
        visible: fieldVisibility['total'] || false
      },
      {
        id: 'footer-message',
        name: 'footerMessage',
        type: 'text',
        label: 'Footer Message',
        required: false,
        position: { x: 0, y: 25 },
        style: { fontSize: 11, fontWeight: 'normal', textAlign: 'center' },
        visible: fieldVisibility['footer-message'] || false
      },
      {
        id: 'qr-code',
        name: 'qrCode',
        type: 'qrcode',
        label: 'QR Code',
        required: false,
        position: { x: 0, y: 26 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center', width: 100, height: 100 },
        visible: fieldVisibility['qr-code'] || false
      },
      {
        id: 'thank-you',
        name: 'thankYou',
        type: 'text',
        label: 'Thank You',
        value: 'Thank you for your business!',
        required: false,
        position: { x: 0, y: 27 },
        style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center' },
        visible: fieldVisibility['thank-you'] || false
      }
    ];

    return baseFields;
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      Alert.alert('Error', 'Please enter a template name');
      return;
    }

    setIsLoading(true);
    try {
      const layout = generateTemplateLayout();
      const fields = generateTemplateFields();

      if (template) {
        // Update existing template
        const updatedTemplate = await ReceiptTemplateService.updateTemplate(template.id, {
          name: templateName,
          description: templateDescription,
          layout,
          fields,
        });
        
        if (updatedTemplate) {
          Alert.alert('Success', 'Template updated successfully');
          onSave(updatedTemplate);
        } else {
          Alert.alert('Error', 'Failed to update template');
        }
      } else {
        // Create new template
        const newTemplate = await ReceiptTemplateService.createTemplate(
          templateName,
          templateDescription,
          layout,
          fields,
          'thermal'
        );
        
        Alert.alert('Success', 'Template created successfully');
        onSave(newTemplate);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Failed to save template');
    } finally {
      setIsLoading(false);
    }
  };

  const previewTemplate: ReceiptTemplate = {
    id: 'preview',
    name: templateName,
    description: templateDescription,
    type: 'thermal',
    isDefault: false,
    isCustom: true,
    layout: generateTemplateLayout(),
    fields: generateTemplateFields(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const renderBasicTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Basic Information</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Template Name *</Text>
        <TextInput
          style={styles.textInput}
          value={templateName}
          onChangeText={setTemplateName}
          placeholder="Enter template name"
          maxLength={50}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Description</Text>
        <TextInput
          style={[styles.textInput, styles.multilineInput]}
          value={templateDescription}
          onChangeText={setTemplateDescription}
          placeholder="Enter template description"
          multiline
          numberOfLines={3}
          maxLength={200}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Paper Width</Text>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentButton, paperWidth === 58 && styles.segmentButtonActive]}
            onPress={() => {
              setPaperWidth(58);
              setMaxWidth(32);
            }}
          >
            <Text style={[styles.segmentText, paperWidth === 58 && styles.segmentTextActive]}>
              58mm
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, paperWidth === 80 && styles.segmentButtonActive]}
            onPress={() => {
              setPaperWidth(80);
              setMaxWidth(48);
            }}
          >
            <Text style={[styles.segmentText, paperWidth === 80 && styles.segmentTextActive]}>
              80mm
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Max Characters: {maxWidth}</Text>
        <Text style={styles.inputHint}>
          Automatically adjusted based on paper width
        </Text>
      </View>
    </View>
  );

  const renderSectionsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Receipt Sections</Text>
      
      {sections.map((section) => (
        <View key={section.id} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Switch
                value={section.enabled}
                onValueChange={(enabled) => updateSection(section.id, { enabled })}
                trackColor={{ false: '#e5e7eb', true: '#3b82f6' }}
                thumbColor={section.enabled ? '#ffffff' : '#f4f3f4'}
              />
              <Text style={[styles.sectionName, !section.enabled && styles.disabledText]}>
                {section.name}
              </Text>
            </View>
          </View>

          {section.enabled && (
            <View style={styles.sectionOptions}>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Add Separator</Text>
                <Switch
                  value={section.separator}
                  onValueChange={(separator) => updateSection(section.id, { separator })}
                  trackColor={{ false: '#e5e7eb', true: '#3b82f6' }}
                  thumbColor={section.separator ? '#ffffff' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Spacing Lines: {section.spacing}</Text>
                <View style={styles.stepperButtons}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => updateSection(section.id, { spacing: Math.max(0, section.spacing - 1) })}
                  >
                    <Ionicons name="remove" size={16} color="#6b7280" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => updateSection(section.id, { spacing: Math.min(5, section.spacing + 1) })}
                  >
                    <Ionicons name="add" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      ))}

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Field Visibility</Text>
      
      {Object.entries(fieldVisibility).map(([fieldId, visible]) => (
        <View key={fieldId} style={styles.fieldRow}>
          <Switch
            value={visible}
            onValueChange={(value) => updateFieldVisibility(fieldId, value)}
            trackColor={{ false: '#e5e7eb', true: '#3b82f6' }}
            thumbColor={visible ? '#ffffff' : '#f4f3f4'}
          />
          <Text style={[styles.fieldName, !visible && styles.disabledText]}>
            {fieldId.split('-').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ')}
          </Text>
        </View>
      ))}
    </ScrollView>
  );

  const renderPreviewTab = () => (
    <ReceiptTemplatePreview
      template={previewTemplate}
      style={styles.previewContainer}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {template ? 'Edit Template' : 'Create Template'}
          </Text>
          <Text style={styles.headerSubtitle}>
            Customize your receipt layout
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'basic' && styles.activeTab]}
          onPress={() => setActiveTab('basic')}
        >
          <Text style={[styles.tabText, activeTab === 'basic' && styles.activeTabText]}>
            Basic
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sections' && styles.activeTab]}
          onPress={() => setActiveTab('sections')}
        >
          <Text style={[styles.tabText, activeTab === 'sections' && styles.activeTabText]}>
            Layout
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'preview' && styles.activeTab]}
          onPress={() => setActiveTab('preview')}
        >
          <Text style={[styles.tabText, activeTab === 'preview' && styles.activeTabText]}>
            Preview
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {activeTab === 'basic' && renderBasicTab()}
        {activeTab === 'sections' && renderSectionsTab()}
        {activeTab === 'preview' && renderPreviewTab()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  tabBar: {
    backgroundColor: 'white',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: 'white',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  segmentTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
  },
  disabledText: {
    color: '#9ca3af',
  },
  sectionOptions: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 14,
    color: '#374151',
  },
  stepperButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
  },
  fieldName: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
  },
  previewContainer: {
    flex: 1,
  },
});

export default ReceiptTemplateEditor;
