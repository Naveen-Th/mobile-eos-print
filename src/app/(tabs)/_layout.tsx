import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { MobileUser } from '../../services/auth/MobileAuthService';

// Import screens
import HomeScreen from './index';
import ReceiptsScreen from './receipts';
import ItemsScreen from './items';
import SettingsScreen from './settings';

const Tab = createBottomTabNavigator();

interface TabLayoutProps {
  user?: MobileUser | null;
  onLogout?: () => void;
}

// Icon wrapper component to ensure proper rendering
const TabIcon = ({ name, color, size }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
};

export default function TabLayout({ user, onLogout }: TabLayoutProps) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          height: 86,
          paddingBottom: 24,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -2 },
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 5,
        },
      }}
    >
      <Tab.Screen
        name="index"
        component={HomeScreen}
        options={{
          title: 'POS',
          tabBarIcon: ({ color, size = 24 }) => (
            <TabIcon name="storefront-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="receipts"
        component={ReceiptsScreen}
        options={{
          title: 'Receipts',
          tabBarIcon: ({ color, size = 24 }) => (
            <TabIcon name="receipt-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="items"
        component={ItemsScreen}
        options={{
          title: 'Items',
          tabBarIcon: ({ color, size = 24 }) => (
            <TabIcon name="cube-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size = 24 }) => (
            <TabIcon name="settings-outline" color={color} size={size} />
          ),
        }}
      >
        {(props) => <SettingsScreen {...props} user={user} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
