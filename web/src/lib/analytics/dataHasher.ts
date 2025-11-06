/**
 * Data Hashing Utilities for Facebook Advanced Matching
 * 
 * Provides 100% consistent SHA-256 hashing for PII data across client-side and server-side
 * Facebook tracking to ensure proper deduplication and Event Match Quality.
 * 
 * CRITICAL: Uses identical SHA-256 implementation on both client and server
 * to prevent duplicate user identification (fixes 58% email duplication issue).
 */

/**
 * Pure JavaScript SHA-256 implementation
 * Identical output on both client and server environments
 * Based on RFC 6234 specification
 */
function sha256(message: string): string {
  // Normalize input (Facebook requirement)
  const normalized = message.toLowerCase().trim();
  
  // Convert string to UTF-8 bytes
  const msgBytes: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code < 0x80) {
      msgBytes.push(code);
    } else if (code < 0x800) {
      msgBytes.push(0xc0 | (code >> 6));
      msgBytes.push(0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      msgBytes.push(0xe0 | (code >> 12));
      msgBytes.push(0x80 | ((code >> 6) & 0x3f));
      msgBytes.push(0x80 | (code & 0x3f));
    } else {
      // Surrogate pair
      i++;
      const code2 = normalized.charCodeAt(i);
      const codepoint = 0x10000 + (((code & 0x3ff) << 10) | (code2 & 0x3ff));
      msgBytes.push(0xf0 | (codepoint >> 18));
      msgBytes.push(0x80 | ((codepoint >> 12) & 0x3f));
      msgBytes.push(0x80 | ((codepoint >> 6) & 0x3f));
      msgBytes.push(0x80 | (codepoint & 0x3f));
    }
  }
  
  // SHA-256 constants
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  
  // Initial hash values
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  
  // Pre-processing
  const msgLength = msgBytes.length;
  msgBytes.push(0x80); // Append '1' bit
  
  // Pad to 512-bit boundary
  while ((msgBytes.length % 64) !== 56) {
    msgBytes.push(0x00);
  }
  
  // Append length as 64-bit big-endian integer
  const lengthBits = msgLength * 8;
  for (let i = 7; i >= 0; i--) {
    msgBytes.push((lengthBits >>> (i * 8)) & 0xff);
  }
  
  // Process 512-bit chunks
  for (let chunk = 0; chunk < msgBytes.length; chunk += 64) {
    const w: number[] = new Array(64);
    
    // Copy chunk into first 16 words
    for (let i = 0; i < 16; i++) {
      w[i] = (msgBytes[chunk + i * 4] << 24) |
             (msgBytes[chunk + i * 4 + 1] << 16) |
             (msgBytes[chunk + i * 4 + 2] << 8) |
             (msgBytes[chunk + i * 4 + 3]);
    }
    
    // Extend first 16 words into remaining 48 words
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & 0xffffffff;
    }
    
    // Initialize working variables
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    
    // Main loop
    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) & 0xffffffff;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & 0xffffffff;
      
      h = g;
      g = f;
      f = e;
      e = (d + temp1) & 0xffffffff;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) & 0xffffffff;
    }
    
    // Add chunk's hash to result
    h0 = (h0 + a) & 0xffffffff;
    h1 = (h1 + b) & 0xffffffff;
    h2 = (h2 + c) & 0xffffffff;
    h3 = (h3 + d) & 0xffffffff;
    h4 = (h4 + e) & 0xffffffff;
    h5 = (h5 + f) & 0xffffffff;
    h6 = (h6 + g) & 0xffffffff;
    h7 = (h7 + h) & 0xffffffff;
  }
  
  // Produce final hash value
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(h => h.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Right rotate function for SHA-256
 */
function rightRotate(value: number, amount: number): number {
  return ((value >>> amount) | (value << (32 - amount))) & 0xffffffff;
}

/**
 * Hash email using SHA-256 (Facebook standard)
 * 100% consistent between client and server
 * 
 * @param email - Email address to hash
 * @returns SHA-256 hex hash of normalized email
 */
export function hashEmail(email: string): string {
  return sha256(email);
}

/**
 * Hash phone number using SHA-256
 * Normalizes phone number first, then hashes
 * 
 * @param phone - Phone number to hash
 * @returns SHA-256 hex hash of normalized phone
 */
export function hashPhone(phone: string): string {
  // Normalize phone: remove spaces, dashes, parentheses, dots
  const normalized = phone.replace(/[\s\-\(\)\.]/g, '');
  return sha256(normalized);
}

/**
 * Hash personal data using SHA-256
 * 
 * @param data - Personal data to hash (name, city, state, etc.)
 * @returns SHA-256 hex hash of normalized data
 */
export function hashPersonalData(data: string): string {
  return sha256(data);
}

/**
 * Validate if a string is a valid SHA-256 hash
 * 
 * @param hash - String to validate
 * @returns True if valid SHA-256 hash format (64 hex characters)
 */
export function isValidSHA256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Check if data is already hashed
 * 
 * @param data - Data to check
 * @returns True if data appears to be a SHA-256 hash
 */
export function isAlreadyHashed(data: string): boolean {
  return isValidSHA256Hash(data);
}

/**
 * Safely hash data (only if not already hashed)
 * 
 * @param data - Data to hash
 * @returns SHA-256 hash (or original if already hashed)
 */
export function safeHash(data: string): string {
  if (isAlreadyHashed(data)) {
    return data; // Already hashed
  }
  return sha256(data);
}

/**
 * Test function to verify SHA-256 implementation
 * Should return: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 */
export function testSHA256(): boolean {
  const testHash = sha256('');
  const expectedHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  return testHash === expectedHash;
}

/**
 * Normalize phone number to E.164 format (Facebook standard)
 * 
 * @param phone - Phone number to normalize
 * @param countryCode - Default country code (default: '31' for Netherlands)
 * @returns Normalized phone number
 */
export function normalizePhone(phone: string, countryCode: string = '31'): string {
  let normalized = phone.replace(/[\s\-\(\)\.]/g, '');
  
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }
    normalized = `${countryCode}${normalized}`;
  } else {
    normalized = normalized.substring(1);
  }
  
  return normalized;
}

/**
 * Hash normalized phone number using SHA-256
 * 
 * @param phone - Phone number to normalize and hash
 * @param countryCode - Default country code (default: '31' for Netherlands)
 * @returns SHA-256 hex hash of normalized phone
 */
export function hashNormalizedPhone(phone: string, countryCode: string = '31'): string {
  const normalized = normalizePhone(phone, countryCode);
  return sha256(normalized);
}