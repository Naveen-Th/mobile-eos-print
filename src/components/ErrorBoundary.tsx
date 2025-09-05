import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log the error to console and external services
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // In a real app, you might want to send this to an error reporting service
    // like Sentry, Bugsnag, etc.
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService = (error: Error, errorInfo: any) => {
    // This would typically send to an external error tracking service
    try {
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'React Native',
      };
      
      // For now, just log to console
      console.error('Error Report:', errorReport);
      
      // You could send this to a service like:
      // Sentry.captureException(error, { extra: errorInfo });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private handleRestart = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleShowDetails = () => {
    const { error, errorInfo } = this.state;
    const details = `
Error: ${error?.message || 'Unknown error'}

Stack Trace:
${error?.stack || 'No stack trace available'}

Component Stack:
${errorInfo?.componentStack || 'No component stack available'}
    `.trim();

    Alert.alert(
      'Error Details',
      details,
      [
        { text: 'OK' },
        {
          text: 'Copy to Clipboard',
          onPress: () => {
            // In a real implementation, you'd use a clipboard library
            console.log('Error details copied to clipboard:', details);
          },
        },
      ],
      { cancelable: true }
    );
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <ScrollView 
            contentContainerStyle={{ 
              flex: 1, 
              justifyContent: 'center', 
              alignItems: 'center', 
              padding: 20 
            }}
          >
            <View style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 24,
              width: '100%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            }}>
              {/* Error Icon */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: '#fef2f2',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 16,
                }}>
                  <Ionicons name="warning" size={32} color="#ef4444" />
                </View>
                <Text style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#111827',
                  textAlign: 'center',
                  marginBottom: 8,
                }}>
                  Something went wrong
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: '#6b7280',
                  textAlign: 'center',
                  lineHeight: 20,
                }}>
                  We're sorry! An unexpected error occurred. The error has been logged and we're working to fix it.
                </Text>
              </View>

              {/* Error Message */}
              {this.state.error && (
                <View style={{
                  backgroundColor: '#fef2f2',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 20,
                }}>
                  <Text style={{
                    fontSize: 12,
                    color: '#991b1b',
                    fontFamily: 'monospace',
                  }}>
                    {this.state.error.message}
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={this.handleRestart}
                  style={{
                    backgroundColor: '#3b82f6',
                    borderRadius: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Ionicons name="refresh" size={18} color="white" />
                  <Text style={{
                    color: 'white',
                    fontSize: 16,
                    fontWeight: '600',
                  }}>
                    Try Again
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={this.handleShowDetails}
                  style={{
                    backgroundColor: '#f3f4f6',
                    borderRadius: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Ionicons name="information-circle" size={18} color="#6b7280" />
                  <Text style={{
                    color: '#6b7280',
                    fontSize: 16,
                    fontWeight: '600',
                  }}>
                    Show Details
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Additional Help */}
              <View style={{
                marginTop: 20,
                paddingTop: 20,
                borderTopWidth: 1,
                borderTopColor: '#e5e7eb',
              }}>
                <Text style={{
                  fontSize: 12,
                  color: '#9ca3af',
                  textAlign: 'center',
                  lineHeight: 16,
                }}>
                  If this problem persists, please contact support with the error details above.
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Hook for error handling in functional components
export const useErrorHandler = () => {
  const handleError = React.useCallback((error: Error, errorInfo?: any) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo);
    
    // In a real app, you might want to show a toast notification
    // or send the error to a reporting service
    Alert.alert(
      'Error',
      error.message || 'An unexpected error occurred',
      [{ text: 'OK' }]
    );
  }, []);

  return { handleError };
};

export default ErrorBoundary;
