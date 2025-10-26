import React from 'react';
import { Text, View, ViewProps } from 'react-native';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps extends ViewProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  textClassName?: string;
}

const bgByVariant: Record<BadgeVariant, string> = {
  primary: 'bg-primary-500',
  secondary: 'bg-secondary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-primary-400',
  neutral: 'bg-secondary-300',
};

const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '', textClassName = '', ...rest }) => {
  return (
    <View {...rest} className={`px-2.5 py-1 rounded-full ${bgByVariant[variant]} ${className}`}>
      <Text className={`text-white text-xs font-semibold ${textClassName}`}>{children}</Text>
    </View>
  );
};

export default Badge;
