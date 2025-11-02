import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BrandLogo from '../components/auth/BrandLogo';
import DecorativeCircles from '../components/auth/DecorativeCircles';
import Button from '../components/auth/Button';

interface WelcomeScreenProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSignIn, onSignUp }) => {
  return (
    <View style={styles.container}>
      {/* Decorative Background Circles */}
      <DecorativeCircles variant="welcome" />
      
      {/* Top Logo */}
      <View style={styles.logoContainer}>
        <BrandLogo size="medium" />
      </View>
      
      {/* Welcome Card */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Welcome</Text>
        <Text style={styles.welcomeDescription}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do tempor incididunt ut labore et.
        </Text>
        
        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title="Sign In"
            onPress={onSignIn}
            variant="primary"
            style={styles.button}
          />
          <Button
            title="Sign Up"
            onPress={onSignUp}
            variant="secondary"
            style={styles.button}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
  },
  logoContainer: {
    paddingTop: 80,
    alignItems: 'center',
    zIndex: 10,
  },
  welcomeCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F59E0B',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 48,
    zIndex: 10,
  },
  welcomeTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
  },
  welcomeDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 32,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
  },
});

export default WelcomeScreen;
