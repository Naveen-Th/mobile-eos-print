import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MobileAuthService from '../services/auth/MobileAuthService';
import type { MobileUser } from '../services/auth/MobileAuthService';
import { useShouldUseFirebase, useIsOffline } from '../store/networkStore';

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
  const shouldUseFirebase = useShouldUseFirebase();
  const isOffline = useIsOffline();

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

    // Check if offline
    if (isOffline) {
      Alert.alert(
        'No Internet Connection',
        'You need an internet connection to sign in for the first time. Once signed in, you can use the app offline.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    try {
      // Initialize Firebase before sign-in
      if (shouldUseFirebase) {
        console.log('🔥 Initializing Firebase for sign-in...');
        const initialized = MobileAuthService.initializeFirebase();
        if (!initialized) {
          throw new Error('Failed to initialize Firebase. Please check your connection.');
        }
      }

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5C563' }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{
          flex: 1,
          paddingTop: 20
        }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 24,
              marginBottom: 40
            }}>
              <TouchableOpacity
                onPress={() => {}}
                style={{
                  width: 40,
                  height: 40,
                  justifyContent: 'center',
                  alignItems: 'flex-start'
                }}
              >
                <Text style={{ fontSize: 28, color: '#1F1F1F', fontWeight: '600' }}>←</Text>
              </TouchableOpacity>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#1F1F1F'
              }}>
                Register
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Title Section */}
            <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
              <Text style={{
                fontSize: 48,
                fontWeight: '800',
                color: '#1F1F1F',
                marginBottom: 16
              }}>
                Sign In
              </Text>
              <Text style={{
                fontSize: 16,
                lineHeight: 24,
                color: '#3A3A3A',
                opacity: 0.9
              }}>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do tempor
              </Text>
            </View>

            {/* White Card Container */}
            <View style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingHorizontal: 32,
              paddingTop: 48,
              paddingBottom: 48,
              flex: 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.1,
              shadowRadius: 24,
              elevation: 10
            }}>
              {/* Username Input */}
              <View style={{ marginBottom: 20 }}>
                <TextInput
                  style={{
                    backgroundColor: '#F5F5F7',
                    borderRadius: 25,
                    paddingVertical: 20,
                    paddingHorizontal: 24,
                    fontSize: 15,
                    color: '#1F2937',
                    borderWidth: 0
                  }}
                  placeholder="Username"
                  placeholderTextColor="#B0B0B0"
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
                <TextInput
                  style={{
                    backgroundColor: '#F5F5F7',
                    borderRadius: 25,
                    paddingVertical: 20,
                    paddingHorizontal: 24,
                    fontSize: 15,
                    color: '#1F2937',
                    borderWidth: 0
                  }}
                  placeholder="Password"
                  placeholderTextColor="#B0B0B0"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!isLoading}
                />
              </View>

              {/* Forgot Password Link */}
              <TouchableOpacity
                style={{
                  alignItems: 'flex-end',
                  marginBottom: 32,
                  paddingVertical: 4
                }}
                onPress={() => setShowForgotPassword(!showForgotPassword)}
                disabled={isLoading}
              >
                <Text style={{
                  color: '#6B6B6B',
                  fontSize: 15,
                  fontWeight: '500'
                }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              {/* Forgot Password Section */}
              {showForgotPassword && (
                <View style={{
                  backgroundColor: '#FFF9E6',
                  padding: 20,
                  borderRadius: 20,
                  marginBottom: 24
                }}>
                  <Text style={{
                    fontSize: 14,
                    color: '#374151',
                    marginBottom: 16,
                    textAlign: 'center',
                    lineHeight: 20
                  }}>
                    Enter your email to receive a password reset link
                  </Text>
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#1F1F1F',
                      paddingVertical: 16,
                      paddingHorizontal: 24,
                      borderRadius: 25,
                      alignItems: 'center'
                    }}
                    onPress={handleForgotPassword}
                  >
                    <Text style={{
                      color: 'white',
                      fontSize: 16,
                      fontWeight: '600'
                    }}>
                      Send Reset Email
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Sign In Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: isLoading ? '#6B7280' : '#1F1F1F',
                  paddingVertical: 20,
                  paddingHorizontal: 32,
                  borderRadius: 30,
                  alignItems: 'center',
                  marginBottom: 48,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 6
                }}
                onPress={handleSignIn}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={{
                      color: 'white',
                      fontSize: 17,
                      fontWeight: '600',
                      marginLeft: 10
                    }}>
                      Signing In...
                    </Text>
                  </View>
                ) : (
                  <Text style={{
                    color: 'white',
                    fontSize: 17,
                    fontWeight: '600'
                  }}>
                    Sign In
                  </Text>
                )}
              </TouchableOpacity>

              {/* Social Login Buttons */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#FFFFFF',
                  paddingVertical: 18,
                  paddingHorizontal: 24,
                  borderRadius: 25,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 3
                }}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: '#F8F8F8',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 16
                  }}>
                    <Text style={{ fontSize: 18 }}>🔍</Text>
                  </View>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: '#1F1F1F'
                  }}>
                    Continue with Google
                  </Text>
                </View>
                <Text style={{ fontSize: 20, color: '#1F1F1F' }}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  backgroundColor: '#FFFFFF',
                  paddingVertical: 18,
                  paddingHorizontal: 24,
                  borderRadius: 25,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 3
                }}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: '#F8F8F8',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 16
                  }}>
                    <Text style={{ fontSize: 18 }}>📘</Text>
                  </View>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: '#1F1F1F'
                  }}>
                    Continue with Facebook
                  </Text>
                </View>
                <Text style={{ fontSize: 20, color: '#1F1F1F' }}>→</Text>
              </TouchableOpacity>
            </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignInForm;
