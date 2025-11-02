import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BrandLogoProps {
  size?: 'small' | 'medium' | 'large';
}

const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'large' }) => {
  const iconSize = size === 'large' ? 80 : size === 'medium' ? 60 : 40;
  const titleSize = size === 'large' ? 48 : size === 'medium' ? 36 : 24;
  const subtitleSize = size === 'large' ? 16 : size === 'medium' ? 12 : 10;
  
  return (
    <View style={styles.container}>
      {/* Beer Icon */}
      <View style={[styles.beerIcon, { width: iconSize, height: iconSize }]}>
        <View style={styles.beerGlass}>
          <View style={styles.foam} />
          <View style={styles.glass} />
          <View style={styles.handle} />
        </View>
      </View>
      
      {/* Brand Text */}
      <Text style={[styles.title, { fontSize: titleSize }]}>deeps</Text>
      <Text style={[styles.subtitle, { fontSize: subtitleSize, letterSpacing: subtitleSize * 0.4 }]}>
        BEERCAFE
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  beerIcon: {
    marginBottom: 16,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  beerGlass: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  foam: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '25%',
    height: '25%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: '#1F2937',
  },
  glass: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    right: '25%',
    bottom: '10%',
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderColor: '#1F2937',
  },
  handle: {
    position: 'absolute',
    right: '5%',
    top: '30%',
    width: '25%',
    height: '45%',
    borderWidth: 2,
    borderLeftWidth: 0,
    borderColor: '#1F2937',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  title: {
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontWeight: '500',
    color: '#6B7280',
  },
});

export default BrandLogo;
