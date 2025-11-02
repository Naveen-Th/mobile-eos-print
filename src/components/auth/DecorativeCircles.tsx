import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface DecorativeCirclesProps {
  variant?: 'splash' | 'welcome';
}

const DecorativeCircles: React.FC<DecorativeCirclesProps> = ({ variant = 'splash' }) => {
  return (
    <>
      {/* Top Right Circle */}
      <View style={[styles.circle, styles.topRight]} />
      
      {/* Bottom Left Circle */}
      <View style={[styles.circle, styles.bottomLeft]} />
      
      {variant === 'splash' && (
        /* Top Left Accent for Splash */
        <View style={[styles.circle, styles.topLeftAccent]} />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    backgroundColor: '#F59E0B',
    borderRadius: 9999,
  },
  topRight: {
    width: width * 0.6,
    height: width * 0.6,
    top: -width * 0.3,
    right: -width * 0.15,
  },
  bottomLeft: {
    width: width * 0.7,
    height: width * 0.7,
    bottom: -width * 0.35,
    left: -width * 0.2,
  },
  topLeftAccent: {
    width: width * 0.25,
    height: width * 0.25,
    top: height * 0.05,
    left: -width * 0.1,
    opacity: 0.8,
  },
});

export default DecorativeCircles;
