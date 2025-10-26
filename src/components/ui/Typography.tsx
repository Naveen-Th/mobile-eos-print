import React from 'react';
import { Text, TextProps } from 'react-native';

export const Title: React.FC<TextProps> = ({ children, className = '', ...props }: any) => (
  <Text {...props} className={`text-2xl font-extrabold text-secondary-900 ${className}`}>{children}</Text>
);

export const Subtitle: React.FC<TextProps> = ({ children, className = '', ...props }: any) => (
  <Text {...props} className={`text-sm font-semibold text-secondary-500 ${className}`}>{children}</Text>
);

export const Body: React.FC<TextProps> = ({ children, className = '', ...props }: any) => (
  <Text {...props} className={`text-base text-secondary-800 ${className}`}>{children}</Text>
);

export const Muted: React.FC<TextProps> = ({ children, className = '', ...props }: any) => (
  <Text {...props} className={`text-sm text-secondary-500 ${className}`}>{children}</Text>
);
