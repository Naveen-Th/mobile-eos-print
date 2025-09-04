import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { CartProvider } from '../context/CartContext';
import TabLayout from '../app/(tabs)/_layout';

interface AppLayoutProps {
  user: any;
  onLogout: () => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({ user, onLogout }) => {
  return (
    <CartProvider>
      <NavigationContainer>
        <TabLayout />
      </NavigationContainer>
    </CartProvider>
  );
};

export default AppLayout;
