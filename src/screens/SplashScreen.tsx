import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import BrandLogo from '../components/auth/BrandLogo';
import DecorativeCircles from '../components/auth/DecorativeCircles';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    // Auto-transition to next screen after 2.5 seconds
    const timer = setTimeout(() => {
      onFinish();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={styles.container}>
      {/* Decorative Background Circles */}
      <DecorativeCircles variant="splash" />
      
      {/* Centered Logo */}
      <View style={styles.logoContainer}>
        <BrandLogo size="large" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    position: 'relative',
    overflow: 'hidden',
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});

export default SplashScreen;
