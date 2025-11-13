import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Receipt } from '../types';
import ReceiptDeliveryService from '../services/features/ReceiptDeliveryService';

interface ReceiptDeliveryModalProps {
  visible: boolean;
  receipt: Receipt;
  onClose: () => void;
}

const ReceiptDeliveryModal: React.FC<ReceiptDeliveryModalProps> = ({
  visible,
  receipt,
  onClose,
}) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'sms' | null>(null);

  const handleSendEmail = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      setLoading(true);
      const result = await ReceiptDeliveryService.getInstance().sendEmailReceipt({
        to: email,
        subject: `Receipt #${receipt.receiptNumber} from ${receipt.companyName}`,
        receipt,
      });

      if (result.success) {
        Alert.alert('Success', result.message);
        setEmail('');
        onClose();
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSMS = async () => {
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    try {
      setLoading(true);
      const result = await ReceiptDeliveryService.getInstance().sendSMSReceipt({
        to: phone,
        receipt,
      });

      if (result.success) {
        Alert.alert('Success', result.message);
        setPhone('');
        onClose();
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send SMS');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl p-6">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-2xl font-bold text-gray-900">
              Send Receipt
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-gray-500 text-2xl">×</Text>
            </TouchableOpacity>
          </View>

          {/* Receipt Info */}
          <View className="bg-gray-50 rounded-xl p-4 mb-6">
            <Text className="text-gray-600 text-sm mb-1">Receipt Number</Text>
            <Text className="text-lg font-bold text-gray-900 mb-3">
              #{receipt.receiptNumber}
            </Text>
            <View className="flex-row justify-between">
              <Text className="text-gray-600">Total:</Text>
              <Text className="text-xl font-bold text-green-600">
                ${receipt.total.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Method Selector */}
          {!selectedMethod && (
            <View>
              <Text className="text-gray-700 font-medium mb-3">
                Choose delivery method:
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedMethod('email')}
                className="bg-blue-50 rounded-xl p-4 mb-3 border-2 border-blue-200"
              >
                <View className="flex-row items-center">
                  <Text className="text-3xl mr-3">📧</Text>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900">
                      Email
                    </Text>
                    <Text className="text-gray-600 text-sm">
                      Share via email apps
                    </Text>
                  </View>
                  <Text className="text-blue-500 text-xl">→</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedMethod('sms')}
                className="bg-green-50 rounded-xl p-4 border-2 border-green-200"
              >
                <View className="flex-row items-center">
                  <Text className="text-3xl mr-3">💬</Text>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900">
                      SMS / WhatsApp
                    </Text>
                    <Text className="text-gray-600 text-sm">
                      Share via messaging apps
                    </Text>
                  </View>
                  <Text className="text-green-500 text-xl">→</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Email Form */}
          {selectedMethod === 'email' && (
            <View>
              <TouchableOpacity
                onPress={() => setSelectedMethod(null)}
                className="mb-4"
              >
                <Text className="text-blue-500 font-medium">← Back</Text>
              </TouchableOpacity>

              <Text className="text-gray-700 font-medium mb-2">
                Email Address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="customer@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                className="bg-gray-100 rounded-xl px-4 py-4 mb-4 text-lg"
              />

              <TouchableOpacity
                onPress={handleSendEmail}
                disabled={loading}
                className={`rounded-xl py-4 ${
                  loading ? 'bg-gray-400' : 'bg-blue-500'
                }`}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-center text-lg">
                    Send Email
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* SMS Form */}
          {selectedMethod === 'sms' && (
            <View>
              <TouchableOpacity
                onPress={() => setSelectedMethod(null)}
                className="mb-4"
              >
                <Text className="text-blue-500 font-medium">← Back</Text>
              </TouchableOpacity>

              <Text className="text-gray-700 font-medium mb-2">
                Phone Number
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 123-4567"
                keyboardType="phone-pad"
                className="bg-gray-100 rounded-xl px-4 py-4 mb-4 text-lg"
              />

              <TouchableOpacity
                onPress={handleSendSMS}
                disabled={loading}
                className={`rounded-xl py-4 ${
                  loading ? 'bg-gray-400' : 'bg-green-500'
                }`}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-center text-lg">
                    Send SMS
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Info Note */}
          <View className="mt-4 bg-blue-50 rounded-xl p-3">
            <Text className="text-blue-800 text-xs">
              ℹ️ Note: This uses your device's native sharing feature. You can share via SMS, WhatsApp, Email, or any installed app. Completely free!
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ReceiptDeliveryModal;
