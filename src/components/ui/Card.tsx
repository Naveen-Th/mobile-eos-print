import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
  children: React.ReactNode;
  accent?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'none';
}

const Card: React.FC<CardProps> = ({ children, className = '', style, accent = 'none', ...rest }) => {
  const accentRing =
    accent === 'none'
      ? ''
      : accent === 'primary'
      ? 'ring-1 ring-primary-200'
      : accent === 'secondary'
      ? 'ring-1 ring-secondary-300'
      : accent === 'success'
      ? 'ring-1 ring-success-300'
      : accent === 'warning'
      ? 'ring-1 ring-warning-300'
      : 'ring-1 ring-danger-300';

  return (
    <View
      {...rest}
      className={`bg-white rounded-2xl p-2 shadow-sm ${accentRing} ${className}`}
      style={style}
    >
      {children}
    </View>
  );
};

export default Card;
