import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ReceiptTemplate } from '../types';
import ReceiptTemplateService from '../services/printing/ReceiptTemplateService';
import ReceiptTemplatePreview from '../components/ReceiptTemplatePreview';
import ReceiptTemplateEditor from '../components/ReceiptTemplateEditor';
import TemplateQuickStart from '../components/TemplateQuickStart';

interface ReceiptTemplatesScreenProps {
  onBack?: () => void;
}

const ReceiptTemplatesScreen: React.FC<ReceiptTemplatesScreenProps> = ({ onBack }) => {
  const [templates, setTemplates] = useState<ReceiptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReceiptTemplate | null>(null);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ReceiptTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReceiptTemplate | null>(null);
  const [showQuickStart, setShowQuickStart] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  /**
   * Load templates from service
   */
  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const [allTemplates, defaultTemplate] = await Promise.all([
        ReceiptTemplateService.getTemplates(),
        ReceiptTemplateService.getDefaultTemplate(),
      ]);
      
      setTemplates(allTemplates);
      setDefaultTemplateId(defaultTemplate?.id || null);
      
      if (allTemplates.length > 0 && !selectedTemplate) {
        setSelectedTemplate(allTemplates[0]);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert('Error', 'Failed to load receipt templates');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Set template as default
   */
  const handleSetDefault = async (template: ReceiptTemplate) => {
    try {
      const success = await ReceiptTemplateService.setDefaultTemplate(template.id);
      if (success) {
        setDefaultTemplateId(template.id);
        Alert.alert('Success', `${template.name} is now the default template`);
      } else {
        Alert.alert('Error', 'Failed to set default template');
      }
    } catch (error) {
      console.error('Error setting default template:', error);
      Alert.alert('Error', 'Failed to set default template');
    }
  };

  /**
   * Duplicate template
   */
  const handleDuplicate = async (template: ReceiptTemplate) => {
    try {
      const duplicatedTemplate = await ReceiptTemplateService.duplicateTemplate(template.id);
      if (duplicatedTemplate) {
        await loadTemplates();
        Alert.alert('Success', `Template duplicated as "${duplicatedTemplate.name}"`);
      } else {
        Alert.alert('Error', 'Failed to duplicate template');
      }
    } catch (error) {
      console.error('Error duplicating template:', error);
      Alert.alert('Error', 'Failed to duplicate template');
    }
  };

  /**
   * Delete template
   */
  const handleDelete = async (template: ReceiptTemplate) => {
    if (!template.isCustom) {
      Alert.alert('Cannot Delete', 'Default templates cannot be deleted');
      return;
    }

    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await ReceiptTemplateService.deleteTemplate(template.id);
              if (success) {
                await loadTemplates();
                if (selectedTemplate?.id === template.id) {
                  setSelectedTemplate(templates[0] || null);
                }
                Alert.alert('Success', 'Template deleted successfully');
              } else {
                Alert.alert('Error', 'Failed to delete template');
              }
            } catch (error) {
              console.error('Error deleting template:', error);
              Alert.alert('Error', 'Failed to delete template');
            }
          },
        },
      ]
    );
  };

  /**
   * Preview template
   */
  const handlePreview = (template: ReceiptTemplate) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  /**
   * Create new template
   */
  const handleCreateTemplate = () => {
    setShowQuickStart(true);
  };

  /**
   * Handle template selection from quick start
   */
  const handleQuickStartTemplateSelect = async (baseTemplate: ReceiptTemplate | null) => {
    if (baseTemplate) {
      // Create a copy of the base template for editing
      try {
        const duplicatedTemplate = await ReceiptTemplateService.duplicateTemplate(
          baseTemplate.id,
          `${baseTemplate.name} (Custom)`
        );
        if (duplicatedTemplate) {
          setEditingTemplate(duplicatedTemplate);
          setShowEditor(true);
        }
      } catch (error) {
        console.error('Error duplicating template:', error);
        Alert.alert('Error', 'Failed to create template from base');
      }
    } else {
      // Start from scratch
      setEditingTemplate(null);
      setShowEditor(true);
    }
  };

  /**
   * Handle quick start close
   */
  const handleQuickStartClose = () => {
    setShowQuickStart(false);
  };

  /**
   * Edit existing template
   */
  const handleEditTemplate = (template: ReceiptTemplate) => {
    if (!template.isCustom) {
      Alert.alert('Cannot Edit', 'Built-in templates cannot be edited. You can duplicate them to create custom versions.');
      return;
    }
    setEditingTemplate(template);
    setShowEditor(true);
  };

  /**
   * Handle template save from editor
   */
  const handleTemplateSave = async (template: ReceiptTemplate) => {
    await loadTemplates();
    setShowEditor(false);
    setEditingTemplate(null);
  };

  /**
   * Handle editor close
   */
  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingTemplate(null);
  };

  /**
   * Reset to defaults
   */
  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset Templates',
      'This will remove all custom templates and reset to default templates. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await ReceiptTemplateService.resetToDefaults();
              await loadTemplates();
              Alert.alert('Success', 'Templates reset to defaults');
            } catch (error) {
              console.error('Error resetting templates:', error);
              Alert.alert('Error', 'Failed to reset templates');
            }
          },
        },
      ]
    );
  };

  /**
   * Get template category badge
   */
  const getTemplateCategoryBadge = (template: ReceiptTemplate) => {
    if (template.isDefault) {
      return { text: 'Default', color: '#10b981', backgroundColor: '#d1fae5' };
    }
    if (!template.isCustom) {
      return { text: 'Built-in', color: '#3b82f6', backgroundColor: '#dbeafe' };
    }
    return { text: 'Custom', color: '#8b5cf6', backgroundColor: '#f3e8ff' };
  };

  /**
   * Render template card
   */
  const renderTemplateCard = (template: ReceiptTemplate) => {
    const isSelected = selectedTemplate?.id === template.id;
    const isDefault = defaultTemplateId === template.id;
    const badge = getTemplateCategoryBadge(template);

    return (
      <TouchableOpacity
        key={template.id}
        style={[styles.templateCard, isSelected && styles.selectedTemplateCard]}
        onPress={() => setSelectedTemplate(template)}
        activeOpacity={0.7}
      >
        <View style={styles.templateCardHeader}>
          <View style={styles.templateNameContainer}>
            <Text style={styles.templateName}>{template.name}</Text>
            {isDefault && (
              <View style={styles.defaultBadge}>
                <Ionicons name="star" size={12} color="#f59e0b" />
                <Text style={styles.defaultBadgeText}>DEFAULT</Text>
              </View>
            )}
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: badge.backgroundColor }]}>
            <Text style={[styles.categoryBadgeText, { color: badge.color }]}>
              {badge.text}
            </Text>
          </View>
        </View>

        <Text style={styles.templateDescription}>{template.description}</Text>

        <View style={styles.templateInfo}>
          <Text style={styles.templateInfoText}>
            Type: {template.type.toUpperCase()}
          </Text>
          <Text style={styles.templateInfoText}>
            Paper: {template.layout.paperWidth}mm
          </Text>
        </View>

        <View style={styles.templateActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePreview(template)}
          >
            <Ionicons name="eye-outline" size={16} color="#6b7280" />
            <Text style={styles.actionButtonText}>Preview</Text>
          </TouchableOpacity>

          {!isDefault && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleSetDefault(template)}
            >
              <Ionicons name="star-outline" size={16} color="#6b7280" />
              <Text style={styles.actionButtonText}>Set Default</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDuplicate(template)}
          >
            <Ionicons name="copy-outline" size={16} color="#6b7280" />
            <Text style={styles.actionButtonText}>Duplicate</Text>
          </TouchableOpacity>

          {template.isCustom && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEditTemplate(template)}
            >
              <Ionicons name="create-outline" size={16} color="#6b7280" />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
          )}

          {template.isCustom && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDelete(template)}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Receipt Templates</Text>
          <Text style={styles.headerSubtitle}>Customize your receipt layout</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Templates Count */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{templates.length}</Text>
              <Text style={styles.statLabel}>Templates Available</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {templates.filter(t => t.isCustom).length}
              </Text>
              <Text style={styles.statLabel}>Custom Templates</Text>
            </View>
          </View>

          {/* Actions Bar */}
          <View style={styles.actionsBar}>
            <View style={styles.actionsRow}>
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={handleCreateTemplate}
              >
                <Ionicons name="add" size={18} color="white" />
                <Text style={styles.primaryButtonText}>Create Template</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={handleResetToDefaults}
              >
                <Ionicons name="refresh-outline" size={18} color="#6b7280" />
                <Text style={styles.secondaryButtonText}>Reset to Defaults</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Templates List */}
          <View style={styles.templatesContainer}>
            <Text style={styles.sectionTitle}>Available Templates</Text>
            <Text style={styles.sectionSubtitle}>
              Choose and customize your receipt templates
            </Text>

            <View style={styles.templatesList}>
              {templates.map(renderTemplateCard)}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Preview Modal */}
      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPreview(false)}
      >
        <SafeAreaView style={styles.previewModalContainer}>
          <View style={styles.previewModalHeader}>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setShowPreview(false)}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <View style={styles.previewHeaderTitle}>
              <Text style={styles.previewModalTitle}>Template Preview</Text>
              <Text style={styles.previewModalSubtitle}>
                {previewTemplate?.name}
              </Text>
            </View>
          </View>
          
          {previewTemplate && (
            <ReceiptTemplatePreview
              template={previewTemplate}
              style={styles.previewContainer}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Template Quick Start Modal */}
      <TemplateQuickStart
        visible={showQuickStart}
        onClose={handleQuickStartClose}
        onSelectTemplate={handleQuickStartTemplateSelect}
      />

      {/* Template Editor Modal */}
      <Modal
        visible={showEditor}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleEditorClose}
      >
        <ReceiptTemplateEditor
          template={editingTemplate}
          onSave={handleTemplateSave}
          onClose={handleEditorClose}
        />
      </Modal>
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
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  scrollContent: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  actionsBar: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  primaryButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    flex: 1,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  templatesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  templatesList: {
    gap: 16,
  },
  templateCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedTemplateCard: {
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.1,
  },
  templateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  templateNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  templateDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  templateInfo: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  templateInfoText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  templateActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
  deleteButtonText: {
    color: '#ef4444',
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  previewModalHeader: {
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
  previewModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  previewModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  previewContainer: {
    flex: 1,
  },
});

export default ReceiptTemplatesScreen;
