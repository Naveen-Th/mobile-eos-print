import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface AppErrorScreenProps {
  error?: Error | string;
  onRetry?: () => void;
  onGoHome?: () => void;
}

const AppErrorScreen: React.FC<AppErrorScreenProps> = ({ 
  error, 
  onRetry,
  onGoHome 
}) => {
  const errorMessage = typeof error === 'string' 
    ? error 
    : error?.message || 'An unexpected error occurred';

  const isNetworkError = errorMessage.toLowerCase().includes('network') ||
                         errorMessage.toLowerCase().includes('internet') ||
                         errorMessage.toLowerCase().includes('connection') ||
                         errorMessage.toLowerCase().includes('fetch') ||
                         errorMessage.toLowerCase().includes('timeout');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons 
            name={isNetworkError ? "cloud-offline-outline" : "warning-outline"} 
            size={64} 
            color={isNetworkError ? "#3b82f6" : "#ef4444"} 
          />
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {isNetworkError ? "No Internet Connection" : "Something went wrong"}
        </Text>

        {/* Message */}
        <Text style={styles.message}>
          {isNetworkError 
            ? "Please check your internet connection and try again."
            : "We're having trouble loading the app. Please try again."}
        </Text>

        {/* Error Details (optional) */}
        {__DEV__ && error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {onRetry && (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={onRetry}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color="white" />
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}

          {onGoHome && (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={onGoHome}
              activeOpacity={0.8}
            >
              <Ionicons name="home-outline" size={20} color="#3b82f6" />
              <Text style={styles.secondaryButtonText}>Go Home</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Help Text */}
        <Text style={styles.helpText}>
          {isNetworkError 
            ? "The app will work offline once data is synced."
            : "If this problem persists, try restarting the app."}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    maxWidth: '100%',
  },
  errorText: {
    fontSize: 12,
    color: '#991b1b',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  secondaryButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default AppErrorScreen;
