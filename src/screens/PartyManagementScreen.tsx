import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
// Navigation handled by parent modal
import PersonDetailsService, { PersonDetail } from '../services/data/PersonDetailsService';
import AddEditPartyModal from '../components/AddEditPartyModal';

interface PartyManagementScreenProps {
  onBack?: () => void;
}

const PartyManagementScreen: React.FC<PartyManagementScreenProps> = ({ onBack }) => {
  const [persons, setPersons] = useState<PersonDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPersons, setFilteredPersons] = useState<PersonDetail[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonDetail | null>(null);

  useEffect(() => {
    loadPersons();
    
    // Set up real-time listener
    const unsubscribe = PersonDetailsService.subscribeToPersonDetails(
      (updatedPersons) => {
        setPersons(updatedPersons);
        setLoading(false);
      },
      (error) => {
        console.error('Error in person details subscription:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Filter persons based on search query
    if (searchQuery.trim()) {
      const filtered = persons.filter(person =>
        person.personName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.phoneNumber.includes(searchQuery)
      );
      setFilteredPersons(filtered);
    } else {
      setFilteredPersons(persons);
    }
  }, [persons, searchQuery]);

  const loadPersons = async () => {
    try {
      setLoading(true);
      const data = await PersonDetailsService.getPersonDetails();
      setPersons(data);
    } catch (error) {
      console.error('Error loading persons:', error);
      Alert.alert('Error', 'Failed to load party details');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPersons();
    setRefreshing(false);
  };

  const handleDelete = (person: PersonDetail) => {
    Alert.alert(
      'Delete Party',
      `Are you sure you want to delete "${person.personName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await PersonDetailsService.deletePersonDetail(person.id);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete party');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (person: PersonDetail) => {
    setEditingPerson(person);
    setShowAddModal(true);
  };

  const handleAdd = () => {
    setEditingPerson(null);
    setShowAddModal(true);
  };

  const renderPersonItem = ({ item }: { item: PersonDetail }) => (
    <View style={styles.personCard}>
      <View style={styles.personInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.personName.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.personDetails}>
          <Text style={styles.personName}>{item.personName}</Text>
          <Text style={styles.businessName}>{item.businessName}</Text>
          <Text style={styles.phoneNumber}>
            {PersonDetailsService.formatPhoneNumber(item.phoneNumber)}
          </Text>
        </View>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(item)}
        >
          <Ionicons name="pencil" size={18} color="#3b82f6" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color="#9ca3af" />
      <Text style={styles.emptyStateTitle}>No Parties Found</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery ? 'Try adjusting your search terms.' : 'Add your first party to get started.'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Add Party</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading parties...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={onBack || (() => console.log('Back pressed'))}
        >
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Party Management</Text>
        
        <TouchableOpacity style={styles.addHeaderButton} onPress={handleAdd}>
          <Ionicons name="add" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search parties..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {filteredPersons.length} {filteredPersons.length === 1 ? 'Party' : 'Parties'}
          {searchQuery && ` found for "${searchQuery}"`}
        </Text>
      </View>

      {/* Party List */}
      {filteredPersons.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredPersons}
          renderItem={renderPersonItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3b82f6']}
              tintColor="#3b82f6"
            />
          }
        />
      )}

      {/* Add/Edit Modal */}
      <AddEditPartyModal
        visible={showAddModal}
        editingPerson={editingPerson}
        onClose={() => {
          setShowAddModal(false);
          setEditingPerson(null);
        }}
        onSuccess={() => {
          // Modal will close automatically, real-time updates will refresh the list
          console.log('Party saved successfully');
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  addHeaderButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  clearButton: {
    padding: 4,
  },
  statsContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statsText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  personDetails: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  businessName: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  phoneNumber: {
    fontSize: 14,
    color: '#9ca3af',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  editButton: {
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PartyManagementScreen;
