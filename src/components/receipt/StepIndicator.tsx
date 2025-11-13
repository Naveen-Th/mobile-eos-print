import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Step = 'customer' | 'items' | 'review';

interface StepConfig {
  key: Step;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface StepIndicatorProps {
  currentStep: Step;
  canProceedFromCustomer: boolean;
  canProceedFromItems: boolean;
}

const steps: StepConfig[] = [
  { key: 'customer', label: 'Customer', icon: 'person' },
  { key: 'items', label: 'Items', icon: 'cube' },
  { key: 'review', label: 'Review', icon: 'checkmark-circle' },
];

const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  canProceedFromCustomer,
  canProceedFromItems,
}) => {
  const isStepCompleted = (step: Step): boolean => {
    if (step === 'customer') return canProceedFromCustomer;
    if (step === 'items') return canProceedFromItems;
    return false;
  };

  return (
    <View style={{
      backgroundColor: 'white',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    }}>
      {steps.map((step, index) => {
        const isActive = currentStep === step.key;
        const isCompleted = isStepCompleted(step.key);
        
        return (
          <View key={step.key} style={{ flex: 1, alignItems: 'center', position: 'relative' }}>
            {/* Step Circle */}
            {isActive ? (
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#111827',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 6,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 4,
              }}>
                <Ionicons name={step.icon} size={20} color="white" />
              </View>
            ) : isCompleted ? (
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#10b981',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 6,
              }}>
                <Ionicons name="checkmark" size={18} color="white" />
              </View>
            ) : (
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#f3f4f6',
                borderWidth: 1.5,
                borderColor: '#e5e7eb',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 6,
              }}>
                <Ionicons name={step.icon} size={18} color="#9ca3af" />
              </View>
            )}

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <View style={{
                position: 'absolute',
                top: 18,
                left: '60%',
                width: '80%',
                height: 2,
                backgroundColor: isCompleted ? '#10b981' : '#e5e7eb',
                zIndex: -1,
              }} />
            )}

            {/* Step Label */}
            <Text style={{
              fontSize: 11,
              fontWeight: isActive ? '700' : '500',
              color: isActive ? '#111827' : isCompleted ? '#10b981' : '#6b7280',
              letterSpacing: 0.2,
            }}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

export default StepIndicator;
