import { getTaxRate, setTaxRate, DEFAULT_TAX_RATE } from '../services/utilities/TaxSettings';

/**
 * Utility functions to validate tax settings integration
 */

/**
 * Test if tax rate can be saved and retrieved correctly
 */
export async function testTaxRateStorage(): Promise<{ success: boolean; error?: string }> {
  try {
    const testRate = 15.5;
    
    // Save test rate
    await setTaxRate(testRate);
    
    // Retrieve and verify
    const retrievedRate = await getTaxRate();
    
    if (retrievedRate === testRate) {
      console.log('✅ Tax rate storage test passed:', retrievedRate);
      
      // Restore default rate
      await setTaxRate(DEFAULT_TAX_RATE);
      
      return { success: true };
    } else {
      return { 
        success: false, 
        error: `Tax rate mismatch. Expected ${testRate}, got ${retrievedRate}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Validate tax rate value constraints
 */
export function validateTaxRateValue(rate: number): { isValid: boolean; error?: string } {
  if (typeof rate !== 'number' || isNaN(rate)) {
    return { isValid: false, error: 'Tax rate must be a valid number' };
  }
  
  if (rate < 0) {
    return { isValid: false, error: 'Tax rate cannot be negative' };
  }
  
  if (rate > 100) {
    return { isValid: false, error: 'Tax rate cannot exceed 100%' };
  }
  
  // Allow up to 3 decimal places
  const decimalPlaces = (rate.toString().split('.')[1] || '').length;
  if (decimalPlaces > 3) {
    return { isValid: false, error: 'Maximum 3 decimal places allowed' };
  }
  
  return { isValid: true };
}

/**
 * Test tax calculation with different rates
 */
export function testTaxCalculation(subtotal: number, taxRate: number): { tax: number; total: number } {
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  
  return {
    tax: Math.round(tax * 100) / 100, // Round to 2 decimal places
    total: Math.round(total * 100) / 100
  };
}

/**
 * Comprehensive tax settings validation
 */
export async function validateTaxSettingsIntegration(): Promise<{
  success: boolean;
  tests: Array<{ name: string; passed: boolean; error?: string }>;
}> {
  const tests: Array<{ name: string; passed: boolean; error?: string }> = [];
  
  // Test 1: Storage functionality
  const storageTest = await testTaxRateStorage();
  tests.push({
    name: 'Tax rate storage',
    passed: storageTest.success,
    error: storageTest.error
  });
  
  // Test 2: Default value retrieval
  try {
    const defaultRate = await getTaxRate();
    tests.push({
      name: 'Default tax rate retrieval',
      passed: defaultRate === DEFAULT_TAX_RATE,
      error: defaultRate !== DEFAULT_TAX_RATE ? `Expected ${DEFAULT_TAX_RATE}, got ${defaultRate}` : undefined
    });
  } catch (error) {
    tests.push({
      name: 'Default tax rate retrieval',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  // Test 3: Validation constraints
  const validationTests = [
    { rate: -5, shouldPass: false, name: 'Negative rate rejection' },
    { rate: 105, shouldPass: false, name: 'Rate over 100% rejection' },
    { rate: 8.555, shouldPass: true, name: '3 decimal places acceptance' },
    { rate: 8.5555, shouldPass: false, name: '4+ decimal places rejection' },
    { rate: 0, shouldPass: true, name: 'Zero rate acceptance' },
    { rate: 100, shouldPass: true, name: 'Maximum rate acceptance' }
  ];
  
  for (const test of validationTests) {
    const validation = validateTaxRateValue(test.rate);
    const passed = validation.isValid === test.shouldPass;
    tests.push({
      name: test.name,
      passed,
      error: passed ? undefined : `Expected ${test.shouldPass ? 'valid' : 'invalid'}, got ${validation.isValid ? 'valid' : 'invalid'}`
    });
  }
  
  // Test 4: Tax calculation accuracy
  const calculationTests = [
    { subtotal: 100, taxRate: 8, expectedTax: 8, expectedTotal: 108 },
    { subtotal: 250.50, taxRate: 10.5, expectedTax: 26.3, expectedTotal: 276.8 },
    { subtotal: 0, taxRate: 15, expectedTax: 0, expectedTotal: 0 }
  ];
  
  for (const test of calculationTests) {
    const result = testTaxCalculation(test.subtotal, test.taxRate);
    const taxMatch = Math.abs(result.tax - test.expectedTax) < 0.01;
    const totalMatch = Math.abs(result.total - test.expectedTotal) < 0.01;
    
    tests.push({
      name: `Tax calculation: ₹${test.subtotal} @ ${test.taxRate}%`,
      passed: taxMatch && totalMatch,
      error: taxMatch && totalMatch ? undefined : `Expected tax: ${test.expectedTax}, total: ${test.expectedTotal}; Got tax: ${result.tax}, total: ${result.total}`
    });
  }
  
  const allPassed = tests.every(test => test.passed);
  
  return {
    success: allPassed,
    tests
  };
}

/**
 * Log tax settings validation results
 */
export async function logTaxSettingsValidation(): Promise<void> {
  console.log('🧪 Running tax settings validation tests...');
  
  const result = await validateTaxSettingsIntegration();
  
  console.log(`\n📊 Tax Settings Validation Results:`);
  console.log(`Overall Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Tests: ${result.tests.filter(t => t.passed).length}/${result.tests.length} passed\n`);
  
  for (const test of result.tests) {
    const status = test.passed ? '✅' : '❌';
    console.log(`${status} ${test.name}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  }
  
  console.log('\n🧪 Tax settings validation complete\n');
}

export default {
  testTaxRateStorage,
  validateTaxRateValue,
  testTaxCalculation,
  validateTaxSettingsIntegration,
  logTaxSettingsValidation
};
