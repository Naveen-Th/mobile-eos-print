import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ReceiptTemplate } from '../types';
import ReceiptTemplateService from '../services/printing/ReceiptTemplateService';
import ReceiptTemplatePreview from './ReceiptTemplatePreview';

interface TemplateQuickStartProps {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ReceiptTemplate | null) => void;
}

const TemplateQuickStart: React.FC<TemplateQuickStartProps> = ({
  visible,
  onClose,
  onSelectTemplate,
}) => {
  const [templates, setTemplates] = useState<ReceiptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReceiptTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible]);

  const loadTemplates = async () => {
    try {
      const allTemplates = await ReceiptTemplateService.getTemplates();
      // Only show built-in templates as starting points
      const builtInTemplates = allTemplates.filter(t => !t.isCustom);
      setTemplates(builtInTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleTemplateSelect = (template: ReceiptTemplate) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const handleUseTemplate = () => {
    onSelectTemplate(selectedTemplate);
    onClose();
  };

  const handleStartFromScratch = () => {
    onSelectTemplate(null);
    onClose();
  };

  const renderTemplateCard = (template: ReceiptTemplate) => {
    const getTemplateIcon = (templateId: string) => {
      switch (templateId) {
        case 'classic-thermal':
          return 'document-text-outline';
        case 'modern-thermal':
          return 'phone-portrait-outline';
        case 'detailed-thermal':
          return 'newspaper-outline';
        case 'compact-thermal':
          return 'contract-outline';
        case 'restaurant-thermal':
          return 'restaurant-outline';
        case 'retail-thermal':
          return 'storefront-outline';
        case 'express-thermal':
          return 'flash-outline';
        case 'premium-thermal':
          return 'diamond-outline';
        default:
          return 'receipt-outline';
      }
    };

    const getTemplateColor = (templateId: string) => {
      switch (templateId) {
        case 'classic-thermal':
          return '#3b82f6';
        case 'modern-thermal':
          return '#10b981';
        case 'detailed-thermal':
          return '#8b5cf6';
        case 'compact-thermal':
          return '#f59e0b';
        case 'restaurant-thermal':
          return '#ef4444';
        case 'retail-thermal':
          return '#06b6d4';
        case 'express-thermal':
          return '#84cc16';
        case 'premium-thermal':
          return '#ec4899';
        default:
          return '#6b7280';
      }
    };

    return (
      <TouchableOpacity
        key={template.id}
        style={styles.templateCard}
        onPress={() => handleTemplateSelect(template)}
        activeOpacity={0.7}
      >
        <View style={[styles.templateIcon, { backgroundColor: getTemplateColor(template.id) + '20' }]}>
          <Ionicons 
            name={getTemplateIcon(template.id) as any} 
            size={28} 
            color={getTemplateColor(template.id)} 
          />
        </View>
        
        <View style={styles.templateInfo}>
          <Text style={styles.templateName}>{template.name}</Text>
          <Text style={styles.templateDescription}>{template.description}</Text>
          
          <View style={styles.templateMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="resize-outline" size={12} color="#6b7280" />
              <Text style={styles.metaText}>{template.layout.paperWidth}mm</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="layers-outline" size={12} color="#6b7280" />
              <Text style={styles.metaText}>
                {Object.values(template.layout.sections).filter(s => s.enabled).length} sections
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.templateArrow}>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Create Custom Template</Text>
            <Text style={styles.headerSubtitle}>Choose a starting point</Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Quick Start Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Start from Scratch</Text>
            <TouchableOpacity 
              style={styles.scratchCard}
              onPress={handleStartFromScratch}
              activeOpacity={0.7}
            >
              <View style={styles.scratchIcon}>
                <Ionicons name="create-outline" size={32} color="#3b82f6" />
              </View>
              <View style={styles.scratchInfo}>
                <Text style={styles.scratchTitle}>Blank Template</Text>
                <Text style={styles.scratchDescription}>
                  Start with a completely blank template and customize every detail
                </Text>
              </View>
              <View style={styles.scratchArrow}>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Template Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Or Start with a Built-in Template</Text>
            <Text style={styles.sectionSubtitle}>
              Use an existing template as your starting point and customize it
            </Text>
            
            <View style={styles.templatesList}>
              {templates.map(renderTemplateCard)}
            </View>
          </View>
        </ScrollView>

        {/* Preview Modal */}
        <Modal
          visible={showPreview}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowPreview(false)}
        >
          <SafeAreaView style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <TouchableOpacity 
                style={styles.previewCloseButton}
                onPress={() => setShowPreview(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#374151" />
              </TouchableOpacity>
              <View style={styles.previewHeaderTitle}>
                <Text style={styles.previewTitle}>
                  Preview: {selectedTemplate?.name}
                </Text>
                <Text style={styles.previewSubtitle}>
                  This will be your starting template
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.useTemplateButton}
                onPress={handleUseTemplate}
              >
                <Text style={styles.useTemplateButtonText}>Use This</Text>
              </TouchableOpacity>
            </View>

            {selectedTemplate && (
              <ReceiptTemplatePreview
                template={selectedTemplate}
                style={styles.previewContent}
              />
            )}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
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
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  scratchCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
  },
  scratchIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  scratchInfo: {
    flex: 1,
  },
  scratchTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  scratchDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  scratchArrow: {
    marginLeft: 12,
  },
  templatesList: {
    gap: 12,
  },
  templateCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  templateIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  templateMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  templateArrow: {
    marginLeft: 12,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  previewHeader: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  previewCloseButton: {
    padding: 8,
    marginRight: 12,
  },
  previewHeaderTitle: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  previewSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  useTemplateButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  useTemplateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  previewContent: {
    flex: 1,
  },
});

export default TemplateQuickStart;
