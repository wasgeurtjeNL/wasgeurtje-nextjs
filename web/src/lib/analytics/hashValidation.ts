/**
 * Hash Validation & Testing Utilities
 * 
 * Validates that our SHA-256 implementation produces identical results
 * to Facebook's expected hashing for Advanced Matching.
 */

import { hashEmail, hashPersonalData, hashNormalizedPhone, testSHA256 } from './dataHasher';

/**
 * Test hash consistency between our implementation and expected Facebook format
 */
export function validateHashImplementation(): {
  isValid: boolean;
  results: Array<{
    test: string;
    input: string;
    ourHash: string;
    expectedLength: number;
    isValidFormat: boolean;
  }>;
} {
  const tests = [
    { name: 'Empty string', input: '', expectedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    { name: 'Email test', input: 'test@example.com', expectedHash: null },
    { name: 'Phone test', input: '0612345678', expectedHash: null },
    { name: 'Name test', input: 'John Doe', expectedHash: null },
  ];
  
  const results = tests.map(test => {
    let ourHash: string;
    
    if (test.name === 'Email test') {
      ourHash = hashEmail(test.input);
    } else if (test.name === 'Phone test') {
      ourHash = hashNormalizedPhone(test.input, '31');
    } else {
      ourHash = hashPersonalData(test.input);
    }
    
    return {
      test: test.name,
      input: test.input,
      ourHash,
      expectedLength: 64,
      isValidFormat: /^[a-f0-9]{64}$/i.test(ourHash),
      matchesExpected: test.expectedHash ? ourHash === test.expectedHash : true
    };
  });
  
  const allValid = results.every(r => r.isValidFormat && r.matchesExpected);
  
  return {
    isValid: allValid,
    results
  };
}

/**
 * Compare our hashing with server-side crypto module
 * (Only works on server-side)
 */
export function compareWithNodeCrypto(testData: string[]): {
  isConsistent: boolean;
  comparisons: Array<{
    input: string;
    ourHash: string;
    cryptoHash: string;
    matches: boolean;
  }>;
} {
  if (typeof window !== 'undefined') {
    return {
      isConsistent: false,
      comparisons: []
    };
  }
  
  try {
    const crypto = require('crypto');
    
    const comparisons = testData.map(input => {
      const normalized = input.toLowerCase().trim();
      const ourHash = hashEmail(input);
      const cryptoHash = crypto.createHash('sha256').update(normalized).digest('hex');
      
      return {
        input,
        ourHash,
        cryptoHash,
        matches: ourHash === cryptoHash
      };
    });
    
    const isConsistent = comparisons.every(c => c.matches);
    
    return {
      isConsistent,
      comparisons
    };
  } catch (error) {
    return {
      isConsistent: false,
      comparisons: []
    };
  }
}

/**
 * Validate Facebook Advanced Matching data format
 */
export function validateAdvancedMatchingData(userData: Record<string, string>): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check email hash
  if (userData.em) {
    if (!/^[a-f0-9]{64}$/i.test(userData.em)) {
      issues.push('Email (em) is not a valid SHA-256 hash');
    }
  }
  
  // Check phone hash
  if (userData.ph) {
    if (!/^[a-f0-9]{64}$/i.test(userData.ph)) {
      issues.push('Phone (ph) is not a valid SHA-256 hash');
    }
  }
  
  // Check first name hash
  if (userData.fn) {
    if (!/^[a-f0-9]{64}$/i.test(userData.fn)) {
      issues.push('First name (fn) is not a valid SHA-256 hash');
    }
  }
  
  // Check last name hash
  if (userData.ln) {
    if (!/^[a-f0-9]{64}$/i.test(userData.ln)) {
      issues.push('Last name (ln) is not a valid SHA-256 hash');
    }
  }
  
  // Check city hash
  if (userData.ct) {
    if (!/^[a-f0-9]{64}$/i.test(userData.ct)) {
      issues.push('City (ct) is not a valid SHA-256 hash');
    }
  }
  
  // Check state hash
  if (userData.st) {
    if (!/^[a-f0-9]{64}$/i.test(userData.st)) {
      issues.push('State (st) is not a valid SHA-256 hash');
    }
  }
  
  // Check zip code hash
  if (userData.zp) {
    if (!/^[a-f0-9]{64}$/i.test(userData.zp)) {
      issues.push('Zip code (zp) is not a valid SHA-256 hash');
    }
  }
  
  // Check country hash
  if (userData.country) {
    if (!/^[a-f0-9]{64}$/i.test(userData.country)) {
      issues.push('Country is not a valid SHA-256 hash');
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Debug function to test hashing in browser console
 * Usage: Run in browser console to test SHA-256 implementation
 */
export function debugHashTesting() {
  console.log('🔍 Testing SHA-256 Implementation...');
  
  // Test basic SHA-256
  const basicTest = testSHA256();
  console.log('✅ Basic SHA-256 test:', basicTest ? 'PASS' : 'FAIL');
  
  // Test hash validation
  const validation = validateHashImplementation();
  console.log('✅ Hash validation:', validation.isValid ? 'PASS' : 'FAIL');
  console.table(validation.results);
  
  // Test example data
  const testEmail = 'test@example.com';
  const hashedEmail = hashEmail(testEmail);
  console.log('📧 Email hash test:');
  console.log('  Input:', testEmail);
  console.log('  Hash:', hashedEmail);
  console.log('  Length:', hashedEmail.length);
  console.log('  Valid format:', /^[a-f0-9]{64}$/i.test(hashedEmail));
  
  const testPhone = '0612345678';
  const hashedPhone = hashNormalizedPhone(testPhone, '31');
  console.log('📱 Phone hash test:');
  console.log('  Input:', testPhone);
  console.log('  Hash:', hashedPhone);
  console.log('  Length:', hashedPhone.length);
  console.log('  Valid format:', /^[a-f0-9]{64}$/i.test(hashedPhone));
  
  return {
    basicTest,
    validation,
    testEmail: hashedEmail,
    testPhone: hashedPhone
  };
}
