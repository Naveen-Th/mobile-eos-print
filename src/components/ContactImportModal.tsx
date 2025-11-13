import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ContactsService, { DeviceContact, ContactsPermissionStatus } from '../services/utilities/ContactsService';
import PersonDetailsService from '../services/data/PersonDetailsService';
import * as Contacts from 'expo-contacts';

interface ContactImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImportComplete?: (results: {
    imported: number;
    skipped: number;
    failed: number;
  }) => void;
}

const ContactImportModal: React.FC<ContactImportModalProps> = ({
  visible,
  onClose,
  onImportComplete,
}) => {
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<DeviceContact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<ContactsPermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectAll, setSelectAll] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setContacts([]);
      setFilteredContacts([]);
      setSearchTerm('');
      setError(null);
      setSelectAll(false);
      checkPermissionAndLoadContacts();
    }
  }, [visible]);

  // Filter contacts based on search term
  useEffect(() => {
    const filtered = ContactsService.searchContacts(contacts, searchTerm);
    setFilteredContacts(filtered);
  }, [contacts, searchTerm]);

  const checkPermissionAndLoadContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check current permission status
      const currentPermission = await ContactsService.getContactsPermissionStatus();
      setPermissionStatus(currentPermission);

      if (!currentPermission.granted) {
        // Request permission if not granted
        const requestedPermission = await ContactsService.requestContactsPermission();
        setPermissionStatus(requestedPermission);

        if (!requestedPermission.granted) {
          setError('Contacts permission is required to import contacts');
          return;
        }
      }

      // Load contacts
      await loadContacts();
    } catch (err: any) {
      console.error('Error checking permissions:', err);
      setError(err.message || 'Failed to check contacts permission');
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const deviceContacts = await ContactsService.fetchDeviceContacts();
      
      // Filter to only include contacts with valid Indian mobile numbers
      const validContacts = ContactsService.filterContactsWithValidMobileNumbers(deviceContacts);
      
      setContacts(validContacts);
      console.log(`Loaded ${validContacts.length} contacts with valid mobile numbers`);
    } catch (err: any) {
      console.error('Error loading contacts:', err);
      setError(err.message || 'Failed to load contacts');
    }
  };

  const handleContactToggle = (contactId: string) => {
    setContacts(prevContacts =>
      prevContacts.map(contact =>
        contact.id === contactId
          ? { ...contact, selected: !contact.selected }
          : contact
      )
    );
  };

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    
    setContacts(prevContacts =>
      prevContacts.map(contact => ({
        ...contact,
        selected: newSelectAll
      }))
    );
  };

  const handleImport = async () => {
    try {
      const selectedContacts = contacts.filter(c => c.selected);
      
      if (selectedContacts.length === 0) {
        Alert.alert('No Selection', 'Please select at least one contact to import');
        return;
      }

      Alert.alert(
        'Confirm Import',
        `Import ${selectedContacts.length} selected contact${selectedContacts.length === 1 ? '' : 's'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: async () => {
              setImporting(true);
              try {
                const contactsToImport = ContactsService.convertContactsToPersonDetails(selectedContacts);
                const result = await PersonDetailsService.bulkImportContacts(contactsToImport);

                if (result.success || result.results.imported > 0) {
                  let message = `Import completed!\n\n`;
                  if (result.results.imported > 0) {
                    message += `✅ Imported: ${result.results.imported}\n`;
                  }
                  if (result.results.skipped > 0) {
                    message += `⏩ Skipped: ${result.results.skipped}\n`;
                  }
                  if (result.results.failed > 0) {
                    message += `❌ Failed: ${result.results.failed}\n`;
                  }

                  if (result.errors.length > 0) {
                    message += `\nErrors encountered:\n${result.errors.slice(0, 3).join('\n')}`;
                    if (result.errors.length > 3) {
                      message += `\n... and ${result.errors.length - 3} more`;
                    }
                  }

                  Alert.alert('Import Results', message, [
                    {
                      text: 'OK',
                      onPress: () => {
                        onImportComplete?.(result.results);
                        onClose();
                      }
                    }
                  ]);
                } else {
                  Alert.alert(
                    'Import Failed',
                    result.errors.length > 0 ? result.errors.join('\n') : 'No contacts were imported'
                  );
                }
              } catch (error: any) {
                console.error('Import error:', error);
                Alert.alert('Import Error', error.message || 'An unexpected error occurred during import');
              } finally {
                setImporting(false);
              }
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error preparing import:', error);
      Alert.alert('Error', error.message || 'Failed to prepare import');
    }
  };

  const handleOpenSettings = () => {
    Alert.alert(
      'Open Settings',
      'To enable contacts access, go to Settings and grant permission for this app to access your contacts.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() }
      ]
    );
  };

  const contactStats = useMemo(() => {
    return ContactsService.getContactStats(contacts);
  }, [contacts]);

  const renderPermissionError = () => (
    <View style={styles.centerContainer}>
      <Ionicons name="contacts-outline" size={64} color="#9ca3af" />
      <Text style={styles.errorTitle}>Contacts Permission Required</Text>
      <Text style={styles.errorMessage}>
        This app needs access to your contacts to import customer information.
      </Text>
      <TouchableOpacity style={styles.permissionButton} onPress={handleOpenSettings}>
        <Text style={styles.permissionButtonText}>Open Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.retryButton} onPress={checkPermissionAndLoadContacts}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.loadingText}>Loading contacts...</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.centerContainer}>
      <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
      <Text style={styles.errorTitle}>Error Loading Contacts</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={checkPermissionAndLoadContacts}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyContacts = () => (
    <View style={styles.centerContainer}>
      <Ionicons name="people-outline" size={64} color="#9ca3af" />
      <Text style={styles.errorTitle}>No Valid Contacts Found</Text>
      <Text style={styles.errorMessage}>
        No contacts with valid Indian mobile numbers were found on your device.
      </Text>
    </View>
  );

  const renderContactItem = (contact: DeviceContact) => (
    <TouchableOpacity
      key={contact.id}
      style={styles.contactItem}
      onPress={() => handleContactToggle(contact.id)}
    >
      <View style={styles.contactInfo}>
        <View style={styles.contactHeader}>
          <Text style={styles.contactName}>{contact.name}</Text>
          <View style={[styles.checkbox, contact.selected && styles.checkboxSelected]}>
            {contact.selected && <Ionicons name="checkmark" size={16} color="white" />}
          </View>
        </View>
        
        <Text style={styles.contactBusiness}>
          {contact.company || contact.jobTitle || 'N/A'}
        </Text>
        
        <View style={styles.phoneContainer}>
          {contact.phoneNumbers.map((phone, index) => (
            <Text key={index} style={styles.contactPhone}>
              📱 {phone}
            </Text>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );

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
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Import Contacts</Text>
          
          <View style={styles.headerRight}>
            {contacts.length > 0 && (
              <TouchableOpacity
                onPress={handleImport}
                style={[styles.importButton, importing && styles.importButtonDisabled]}
                disabled={importing}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.importButtonText}>Import</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Main Content */}
        {loading ? (
          renderLoading()
        ) : error && !permissionStatus?.granted ? (
          renderPermissionError()
        ) : error ? (
          renderError()
        ) : contacts.length === 0 ? (
          renderEmptyContacts()
        ) : (
          <>
            {/* Search and Stats */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                />
              </View>
              
              <View style={styles.statsContainer}>
                <Text style={styles.statsText}>
                  {contactStats.selected} of {contactStats.withValidMobile} contacts selected
                </Text>
                <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllButton}>
                  <Text style={styles.selectAllText}>
                    {selectAll ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Contact List */}
            <ScrollView style={styles.contactsList} showsVerticalScrollIndicator={false}>
              {filteredContacts.map(renderContactItem)}
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerRight: {
    width: 80,
    alignItems: 'flex-end',
  },
  importButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  retryButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    color: '#6b7280',
  },
  selectAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  contactsList: {
    flex: 1,
  },
  contactItem: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  contactBusiness: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  phoneContainer: {
    marginTop: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 2,
  },
});

export default ContactImportModal;
