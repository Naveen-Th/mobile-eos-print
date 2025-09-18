import React from 'react';
import { usePrinterStatusWeb, PrinterStatus } from '../hooks/usePrinterStatusWeb';

interface PrinterStatusIndicatorWebProps {
  onPress?: () => void;
  showDetailedStatus?: boolean;
  className?: string;
}

const PrinterStatusIndicatorWeb: React.FC<PrinterStatusIndicatorWebProps> = ({
  onPress,
  showDetailedStatus = false,
  className = '',
}) => {
  const {
    printerStatus,
    isChecking,
    refreshStatus,
    getStatusColor,
    getStatusText,
  } = usePrinterStatusWeb();

  const formatLastCheck = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours}h ago`;
    }
  };

  const getStatusIcon = (status: PrinterStatus['status']) => {
    switch (status) {
      case 'ready':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'busy':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'paper_low':
      case 'paper_empty':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'offline':
      default:
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
          </svg>
        );
    }
  };

  const renderCompactStatus = () => (
    <div 
      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow ${className}`}
      onClick={onPress || refreshStatus}
    >
      <div className="flex items-center space-x-3">
        <div 
          className="w-2 h-2 rounded-full" 
          style={{ backgroundColor: getStatusColor(printerStatus.status) }}
        />
        
        {printerStatus.isConnected ? (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {printerStatus.printer?.name || 'Unknown Printer'}
            </p>
            <p 
              className="text-xs font-medium"
              style={{ color: getStatusColor(printerStatus.status) }}
            >
              {getStatusText(printerStatus.status)}
            </p>
          </div>
        ) : (
          <p className="flex-1 text-sm text-gray-600">No printer connected</p>
        )}

        {isChecking ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        ) : (
          <div style={{ color: getStatusColor(printerStatus.status) }}>
            {getStatusIcon(printerStatus.status)}
          </div>
        )}
      </div>
    </div>
  );

  const renderDetailedStatus = () => (
    <div 
      className={`bg-white rounded-xl p-4 shadow-lg border border-gray-200 cursor-pointer hover:shadow-xl transition-shadow ${className}`}
      onClick={onPress || refreshStatus}
    >
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg 
              className="w-5 h-5"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke={getStatusColor(printerStatus.status)}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <h3 className="font-semibold text-gray-900">Printer Status</h3>
            {isChecking && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              refreshStatus();
            }}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {printerStatus.isConnected ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Printer:</span>
            <span className="text-sm font-medium text-gray-900 truncate max-w-48">
              {printerStatus.printer?.name || 'Unknown'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Connection:</span>
            <span className="text-sm font-medium text-gray-900">
              {printerStatus.printer?.type.toUpperCase() || 'Unknown'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Status:</span>
            <div className="flex items-center space-x-2">
              <div 
                className="w-1.5 h-1.5 rounded-full" 
                style={{ backgroundColor: getStatusColor(printerStatus.status) }}
              />
              <span 
                className="text-sm font-medium"
                style={{ color: getStatusColor(printerStatus.status) }}
              >
                {getStatusText(printerStatus.status)}
              </span>
            </div>
          </div>

          {printerStatus.error && (
            <div className="flex items-center space-x-2 bg-red-50 p-2 rounded-lg">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-700">
                {printerStatus.error}
              </p>
            </div>
          )}
          
          <div className="pt-2 mt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              Last checked: {formatLastCheck(printerStatus.lastCheck)}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
          </svg>
          <h4 className="font-medium text-gray-900 mb-1">No printer connected</h4>
          <p className="text-sm text-gray-500">
            Tap to configure a thermal printer
          </p>
        </div>
      )}
    </div>
  );

  return showDetailedStatus ? renderDetailedStatus() : renderCompactStatus();
};

export default PrinterStatusIndicatorWeb;
