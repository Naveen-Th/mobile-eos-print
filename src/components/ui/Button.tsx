import React from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator, GestureResponderEvent } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  textClassName?: string;
  accessibilityLabel?: string;
}

const baseClasses = 'flex-row items-center justify-center rounded-xl';
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-2',
  md: 'px-4 py-3',
  lg: 'px-5 py-4',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 active:bg-primary-700',
  secondary: 'bg-secondary-700 active:bg-secondary-800',
  outline: 'bg-transparent border border-secondary-400',
  ghost: 'bg-transparent',
  destructive: 'bg-danger-600 active:bg-danger-700',
};

const textVariantClasses: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: 'text-secondary-800',
  ghost: 'text-secondary-900',
  destructive: 'text-white',
};

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  className = '',
  textClassName = '',
  accessibilityLabel,
}) => {
  const isDisabled = disabled || loading;
  const opacity = isDisabled ? 'opacity-60' : 'opacity-100';

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={accessibilityLabel || title}
      disabled={isDisabled}
      activeOpacity={0.8}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${opacity} ${className}`}
    >
      {loading ? (
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color={variant === 'outline' || variant === 'ghost' ? '#334155' : '#fff'} />
          <Text className={`ml-2 font-semibold ${textVariantClasses[variant]} ${textClassName}`}>{title}</Text>
        </View>
      ) : (
        <View className="flex-row items-center">
          {leftIcon ? <View className="mr-2">{leftIcon}</View> : null}
          <Text className={`font-semibold ${textVariantClasses[variant]} ${textClassName}`}>{title}</Text>
          {rightIcon ? <View className="ml-2">{rightIcon}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default Button;
