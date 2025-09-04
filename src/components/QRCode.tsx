import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
} from 'react-native';

interface QRCodeProps {
  data: string;
  size?: number;
}

export const QRCode: React.FC<QRCodeProps> = ({ data, size = 128 }) => {
  const [imageError, setImageError] = useState(false);
  
  // For React Native, we'll use an online QR code service
  // In production, you might want to use react-native-qrcode-svg or similar
  const qrCodeURL = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;

  return (
    <View className="flex flex-col items-center">
      {!imageError ? (
        <Image
          source={{ uri: qrCodeURL }}
          style={{ width: size, height: size }}
          className="border border-gray-300 rounded"
          onError={() => setImageError(true)}
        />
      ) : (
        <View 
          style={{ width: size, height: size }}
          className="flex items-center justify-center bg-gray-100 border border-gray-300 rounded"
        >
          <Text className="text-xs text-gray-500 text-center">
            QR Code{"\n"}Unavailable
          </Text>
        </View>
      )}
    </View>
  );
};
