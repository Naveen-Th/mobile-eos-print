import React from 'react';
import { TextInput, View, TextInputProps, ViewProps } from 'react-native';

interface InputProps extends TextInputProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  containerClassName?: string;
  className?: string;
}

const Input: React.FC<InputProps> = ({ left, right, containerClassName = '', className = '', ...props }) => {
  return (
    <View className={`flex-row items-center rounded-2xl bg-secondary-100 px-4 py-3 ${containerClassName}`}>
      {left ? <View className="mr-2">{left}</View> : null}
      <TextInput
        {...props}
        className={`flex-1 text-base text-secondary-900 ${className}`}
        placeholderTextColor="#94a3b8"
      />
      {right ? <View className="ml-2">{right}</View> : null}
    </View>
  );
};

export default Input;
