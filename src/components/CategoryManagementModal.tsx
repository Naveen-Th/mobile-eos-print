import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import CategoryService, { Category } from '../services/data/CategoryService';

interface CategoryManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  visible,
  onClose,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
  });

  useEffect(() => {
    if (visible) {
      loadCategories();
    }
  }, [visible]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await CategoryService.getInstance().getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
      Alert.alert('Error', 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Category name is required');
      return;
    }

    try {
      if (editingCategory) {
        await CategoryService.getInstance().updateCategory(editingCategory.id, {
          name: formData.name,
          description: formData.description,
          color: formData.color,
        });
        Alert.alert('Success', 'Category updated successfully');
      } else {
        await CategoryService.getInstance().createCategory({
          name: formData.name,
          description: formData.description,
          color: formData.color,
        });
        Alert.alert('Success', 'Category created successfully');
      }

      setFormData({ name: '', description: '', color: '#3b82f6' });
      setShowAddForm(false);
      setEditingCategory(null);
      loadCategories();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save category');
    }
  };

  const handleDelete = (category: Category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await CategoryService.getInstance().deleteCategory(category.id);
              Alert.alert('Success', 'Category deleted successfully');
              loadCategories();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#3b82f6',
    });
    setShowAddForm(true);
  };

  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-5 pt-12 pb-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-gray-900">
              Category Management
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-blue-500 font-semibold">Done</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Add Button */}
        {!showAddForm && (
          <View className="px-5 pt-4">
            <TouchableOpacity
              onPress={() => {
                setFormData({ name: '', description: '', color: '#3b82f6' });
                setEditingCategory(null);
                setShowAddForm(true);
              }}
              className="bg-blue-500 py-4 rounded-xl flex-row items-center justify-center"
            >
              <Text className="text-white font-semibold text-lg mr-2">+</Text>
              <Text className="text-white font-semibold text-lg">Add Category</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <View className="bg-white mx-5 mt-4 p-5 rounded-xl shadow-sm">
            <Text className="text-lg font-bold text-gray-900 mb-4">
              {editingCategory ? 'Edit Category' : 'New Category'}
            </Text>

            <View className="mb-4">
              <Text className="text-gray-700 font-medium mb-2">Name *</Text>
              <TextInput
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Category name"
                className="bg-gray-100 rounded-lg px-4 py-3"
              />
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 font-medium mb-2">Description</Text>
              <TextInput
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Optional description"
                className="bg-gray-100 rounded-lg px-4 py-3"
                multiline
              />
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 font-medium mb-2">Color</Text>
              <View className="flex-row flex-wrap gap-2">
                {colors.map((color) => (
                  <TouchableOpacity
                    key={color}
                    onPress={() => setFormData({ ...formData, color })}
                    className="w-10 h-10 rounded-full border-2"
                    style={{
                      backgroundColor: color,
                      borderColor: formData.color === color ? '#000' : color,
                    }}
                  />
                ))}
              </View>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowAddForm(false);
                  setEditingCategory(null);
                  setFormData({ name: '', description: '', color: '#3b82f6' });
                }}
                className="flex-1 bg-gray-200 py-3 rounded-lg"
              >
                <Text className="text-gray-700 font-semibold text-center">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                className="flex-1 bg-blue-500 py-3 rounded-lg"
              >
                <Text className="text-white font-semibold text-center">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Categories List */}
        <ScrollView className="flex-1 px-5 pt-4">
          {loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text className="text-gray-600 mt-4">Loading categories...</Text>
            </View>
          ) : categories.length === 0 ? (
            <View className="py-12 items-center">
              <Text className="text-6xl mb-4">📁</Text>
              <Text className="text-xl font-bold text-gray-900 mb-2">
                No Categories
              </Text>
              <Text className="text-gray-600 text-center">
                Create your first category to organize items
              </Text>
            </View>
          ) : (
            categories.map((category) => (
              <View
                key={category.id}
                className="bg-white rounded-xl p-4 mb-3 shadow-sm"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View
                      className="w-12 h-12 rounded-full mr-3"
                      style={{ backgroundColor: category.color || '#3b82f6' }}
                    />
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-gray-900">
                        {category.name}
                      </Text>
                      {category.description && (
                        <Text className="text-sm text-gray-500">
                          {category.description}
                        </Text>
                      )}
                      <Text className="text-xs text-gray-400 mt-1">
                        {category.itemCount || 0} items
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleEdit(category)}
                      className="bg-blue-100 p-2 rounded-lg"
                    >
                      <Text className="text-blue-600">✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(category)}
                      className="bg-red-100 p-2 rounded-lg"
                    >
                      <Text className="text-red-600">🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
          <View className="h-8" />
        </ScrollView>
      </View>
    </Modal>
  );
};

export default CategoryManagementModal;
