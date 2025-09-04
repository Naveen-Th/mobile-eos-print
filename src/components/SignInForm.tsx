import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MobileAuthService, { MobileUser } from '../services/MobileAuthService';

interface SignInFormProps {
  onSignInSuccess: (user: MobileUser) => void;
  onSignInError?: (error: string) => void;
}

const SignInForm: React.FC<SignInFormProps> = ({ 
  onSignInSuccess, 
  onSignInError 
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email address');
      return false;
    }

    if (!validateEmail(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return false;
    }

    if (!password.trim()) {
      Alert.alert('Validation Error', 'Please enter your password');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters long');
      return false;
    }

    return true;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const user = await MobileAuthService.signIn(email.trim(), password);
      onSignInSuccess(user);
    } catch (error: any) {
      const errorMessage = error.message || 'Sign in failed';
      onSignInError?.(errorMessage);
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address first');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    try {
      await MobileAuthService.resetPassword(email.trim());
      setShowForgotPassword(false);
    } catch (error: any) {
      Alert.alert('Reset Failed', error.message || 'Failed to send reset email');
    }
  };

  const handleDemoLogin = () => {
    setEmail('demo@thermalprinter.com');
    setPassword('demo123');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f9ff' }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            minHeight: '100%'
          }}>
            {/* Sign In Card */}
            <View style={{
              backgroundColor: 'white',
              padding: 24,
              borderRadius: 16,
              width: '100%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 8
            }}>
              {/* Header */}
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                <View style={{
                  width: 64,
                  height: 64,
                  backgroundColor: '#2563eb',
                  borderRadius: 32,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 16
                }}>
                  <Text style={{
                    color: 'white',
                    fontSize: 24,
                    fontWeight: 'bold'
                  }}>📄</Text>
                </View>
                <Text style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#111827',
                  textAlign: 'center',
                  marginBottom: 8
                }}>
                  Thermal Receipt Printer
                </Text>
                <Text style={{
                  fontSize: 16,
                  color: '#6b7280',
                  textAlign: 'center'
                }}>
                  Sign in to your account
                </Text>
              </View>

              {/* Email Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: 8
                }}>
                  Email Address
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 16,
                    backgroundColor: '#f9fafb'
                  }}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>

              {/* Password Input */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: 8
                }}>
                  Password
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 16,
                    backgroundColor: '#f9fafb'
                  }}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!isLoading}
                />
              </View>

              {/* Sign In Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: isLoading ? '#9ca3af' : '#2563eb',
                  padding: 16,
                  borderRadius: 8,
                  alignItems: 'center',
                  marginBottom: 16
                }}
                onPress={handleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={{
                      color: 'white',
                      fontSize: 16,
                      fontWeight: '600',
                      marginLeft: 8
                    }}>
                      Signing In...
                    </Text>
                  </View>
                ) : (
                  <Text style={{
                    color: 'white',
                    fontSize: 16,
                    fontWeight: '600'
                  }}>
                    Sign In
                  </Text>
                )}
              </TouchableOpacity>

              {/* Forgot Password */}
              <TouchableOpacity
                style={{
                  alignItems: 'center',
                  marginBottom: 16
                }}
                onPress={() => setShowForgotPassword(!showForgotPassword)}
                disabled={isLoading}
              >
                <Text style={{
                  color: '#2563eb',
                  fontSize: 14,
                  fontWeight: '500'
                }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              {/* Forgot Password Section */}
              {showForgotPassword && (
                <View style={{
                  backgroundColor: '#f0f9ff',
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 16
                }}>
                  <Text style={{
                    fontSize: 14,
                    color: '#374151',
                    marginBottom: 12,
                    textAlign: 'center'
                  }}>
                    Enter your email to receive a password reset link
                  </Text>
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#1d4ed8',
                      padding: 12,
                      borderRadius: 6,
                      alignItems: 'center'
                    }}
                    onPress={handleForgotPassword}
                  >
                    <Text style={{
                      color: 'white',
                      fontSize: 14,
                      fontWeight: '600'
                    }}>
                      Send Reset Email
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Demo Credentials */}
              <View style={{
                borderTopWidth: 1,
                borderTopColor: '#e5e7eb',
                paddingTop: 16
              }}>
                <TouchableOpacity
                  style={{
                    alignItems: 'center',
                    marginBottom: 8
                  }}
                  onPress={handleDemoLogin}
                  disabled={isLoading}
                >
                  <Text style={{
                    color: '#6b7280',
                    fontSize: 14,
                    fontWeight: '500'
                  }}>
                    Use Demo Credentials
                  </Text>
                </TouchableOpacity>
                <Text style={{
                  fontSize: 12,
                  color: '#9ca3af',
                  textAlign: 'center'
                }}>
                  For testing purposes only
                </Text>
              </View>
            </View>

            {/* Footer */}
            <View style={{ marginTop: 32 }}>
              <Text style={{
                fontSize: 12,
                color: '#9ca3af',
                textAlign: 'center'
              }}>
                Thermal Receipt Printer Mobile v1.0.0
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignInForm;
