/**
 * Facebook Event ID Generator
 * 
 * Provides consistent event ID generation patterns for both client-side and server-side
 * Facebook tracking to ensure proper deduplication between Pixel and Conversions API.
 * 
 * Key Features:
 * - Consistent timestamp format (seconds, not milliseconds)
 * - Standardized naming patterns
 * - Deduplication-friendly formats
 * - No random strings (for predictable IDs)
 */

/**
 * Get current timestamp in seconds (Facebook standard)
 */
function getTimestampSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Generate standardized event ID for Facebook tracking
 * 
 * @param eventType - The type of event (Purchase, AddToCart, etc.)
 * @param identifier - Optional unique identifier (orderId, productId, etc.)
 * @returns Standardized event ID string
 */
export function generateEventId(eventType: string, identifier?: string | number): string {
  const timestamp = getTimestampSeconds();
  const eventTypeLower = eventType.toLowerCase();
  
  switch (eventTypeLower) {
    case 'purchase':
      // Use orderId for Purchase events (most important for deduplication)
      return identifier ? `purchase_${identifier}` : `purchase_${timestamp}`;
      
    case 'addtocart':
    case 'add_to_cart':
      // Use productId + timestamp for AddToCart
      return identifier ? `add_to_cart_${identifier}_${timestamp}` : `add_to_cart_${timestamp}`;
      
    case 'viewcontent':
    case 'view_content':
      // Use productId + timestamp for ViewContent
      return identifier ? `view_content_${identifier}_${timestamp}` : `view_content_${timestamp}`;
      
    case 'initiatecheckout':
    case 'initiate_checkout':
      // Use timestamp only for InitiateCheckout (no unique product)
      return `initiate_checkout_${timestamp}`;
      
    case 'lead':
      // Use timestamp for Lead events
      return identifier ? `lead_${identifier}_${timestamp}` : `lead_${timestamp}`;
      
    case 'addpaymentinfo':
    case 'add_payment_info':
      // Use timestamp for AddPaymentInfo
      return `add_payment_info_${timestamp}`;
      
    case 'pageview':
    case 'page_view':
      // Use timestamp for PageView (Intelligence system)
      return identifier ? `page_view_${identifier}_${timestamp}` : `page_view_${timestamp}`;
      
    case 'search':
      // Use timestamp for Search events
      return identifier ? `search_${identifier}_${timestamp}` : `search_${timestamp}`;
      
    default:
      // Generic fallback pattern (no random strings!)
      return identifier 
        ? `${eventTypeLower}_${identifier}_${timestamp}` 
        : `${eventTypeLower}_${timestamp}`;
  }
}

/**
 * Validate event ID format
 * 
 * @param eventId - Event ID to validate
 * @returns True if event ID follows standard format
 */
export function isValidEventId(eventId: string): boolean {
  // Basic validation: should contain event type and timestamp
  const parts = eventId.split('_');
  
  // Minimum: eventtype_timestamp
  if (parts.length < 2) return false;
  
  // Last part should be a valid timestamp (10 digits for seconds since epoch)
  const lastPart = parts[parts.length - 1];
  const timestamp = parseInt(lastPart, 10);
  
  // Check if it's a valid timestamp (between 2020 and 2030)
  const minTimestamp = 1577836800; // 2020-01-01
  const maxTimestamp = 1893456000; // 2030-01-01
  
  return timestamp >= minTimestamp && timestamp <= maxTimestamp;
}

/**
 * Extract timestamp from event ID
 * 
 * @param eventId - Event ID to extract timestamp from
 * @returns Timestamp in seconds, or null if invalid
 */
export function extractTimestamp(eventId: string): number | null {
  const parts = eventId.split('_');
  if (parts.length < 2) return null;
  
  const lastPart = parts[parts.length - 1];
  const timestamp = parseInt(lastPart, 10);
  
  return isValidEventId(eventId) ? timestamp : null;
}

/**
 * Check if two event IDs are for the same event (for deduplication)
 * 
 * @param eventId1 - First event ID
 * @param eventId2 - Second event ID  
 * @returns True if they represent the same event
 */
export function areEventIdsEquivalent(eventId1: string, eventId2: string): boolean {
  // Exact match
  if (eventId1 === eventId2) return true;
  
  // For Purchase events, orderId should match exactly
  if (eventId1.startsWith('purchase_') && eventId2.startsWith('purchase_')) {
    return eventId1 === eventId2;
  }
  
  // For other events, check if they have same base pattern and close timestamps
  const parts1 = eventId1.split('_');
  const parts2 = eventId2.split('_');
  
  // Must have same event type
  if (parts1[0] !== parts2[0]) return false;
  
  // If both have identifiers, they should match
  if (parts1.length >= 3 && parts2.length >= 3) {
    return parts1[1] === parts2[1]; // identifier should match
  }
  
  // For timestamp-only events, check if timestamps are within 5 seconds
  const timestamp1 = extractTimestamp(eventId1);
  const timestamp2 = extractTimestamp(eventId2);
  
  if (timestamp1 && timestamp2) {
    return Math.abs(timestamp1 - timestamp2) <= 5; // 5 second window
  }
  
  return false;
}

/**
 * Debug helper: Get event ID breakdown
 * 
 * @param eventId - Event ID to analyze
 * @returns Object with event ID components
 */
export function debugEventId(eventId: string) {
  const parts = eventId.split('_');
  const timestamp = extractTimestamp(eventId);
  
  return {
    eventId,
    isValid: isValidEventId(eventId),
    parts,
    eventType: parts[0] || 'unknown',
    identifier: parts.length >= 3 ? parts[1] : null,
    timestamp,
    timestampDate: timestamp ? new Date(timestamp * 1000).toISOString() : null,
    pattern: parts.length >= 3 ? 'type_identifier_timestamp' : 'type_timestamp'
  };
}
