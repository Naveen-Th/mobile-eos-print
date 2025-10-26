import React from 'react';
import { Modal as RNModal, View, Pressable } from 'react-native';

interface ModalProps {
  visible: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({ visible, onClose, children, className = '' }) => {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <Pressable className="flex-1" onPress={onClose} />
        <View className={`bg-white rounded-t-3xl p-5 shadow-2xl ${className}`}>
          {children}
        </View>
      </View>
    </RNModal>
  );
};

export default Modal;
