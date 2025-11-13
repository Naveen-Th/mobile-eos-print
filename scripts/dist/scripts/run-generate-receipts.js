"use strict";
/**
 * Runner script to generate 1500 test receipts
 *
 * This script initializes Firebase and runs the receipt generator
 */
Object.defineProperty(exports, "__esModule", { value: true });
const generate_test_receipts_1 = require("./generate-test-receipts");
// Main execution
(async () => {
    try {
        console.log('🎯 Starting receipt generation process...\n');
        // Generate 1500 receipts
        await (0, generate_test_receipts_1.generateTestReceipts)(1500);
        console.log('\n✨ All done! Check your Firebase console to see the receipts.');
        process.exit(0);
    }
    catch (error) {
        console.error('\n💥 Fatal error during generation:', error);
        process.exit(1);
    }
})();
