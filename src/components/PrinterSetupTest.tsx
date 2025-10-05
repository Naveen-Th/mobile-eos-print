import React, { useState } from 'react';
import PrinterSetupModal from './PrinterSetupModal';
import PrinterStatusIndicatorWeb from './PrinterStatusIndicatorWeb';

const PrinterSetupTest: React.FC = () => {
  const [showPrinterSetup, setShowPrinterSetup] = useState(false);

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Printer Setup Test
          </h1>
          <p className="text-gray-600">
            Test the printer setup functionality
          </p>
        </div>

        {/* Status Indicator - Detailed */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Detailed Status Indicator
          </h2>
          <PrinterStatusIndicatorWeb
            showDetailedStatus={true}
            onPress={() => setShowPrinterSetup(true)}
          />
        </div>

        {/* Status Indicator - Compact */}
        <div> 
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Compact Status Indicator
          </h2>
          <PrinterStatusIndicatorWeb
            showDetailedStatus={false}
            onPress={() => setShowPrinterSetup(true)}
          />
        </div>

        {/* Manual Setup Button */}
        <div className="text-center">
          <button
            onClick={() => setShowPrinterSetup(true)}
            className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
          >
            Open Printer Setup
          </button>
        </div>

        {/* Setup Modal */}
        <PrinterSetupModal
          isOpen={showPrinterSetup}
          onClose={() => setShowPrinterSetup(false)}
          onPrinterSelected={(printer) => {
            console.log('Printer selected:', printer);
          }}
        />
      </div>
    </div>
  );
};

export default PrinterSetupTest;
