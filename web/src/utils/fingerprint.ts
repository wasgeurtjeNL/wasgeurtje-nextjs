/**
 * Browser Fingerprinting Utility
 * 
 * Generates a unique browser fingerprint based on device characteristics.
 * This is used for cross-session customer identification without cookies.
 * 
 * GDPR Compliant: No PII is collected, only device/browser characteristics.
 */

interface FingerprintComponents {
  userAgent: string;
  language: string;
  colorDepth: number;
  deviceMemory: number;
  hardwareConcurrency: number;
  screenResolution: string;
  availableScreenResolution: string;
  timezoneOffset: number;
  timezone: string;
  sessionStorage: boolean;
  localStorage: boolean;
  indexedDb: boolean;
  addBehavior: boolean;
  openDatabase: boolean;
  cpuClass: string;
  platform: string;
  doNotTrack: string;
  plugins: string[];
  canvas: string;
  webgl: string;
  webglVendorAndRenderer: string;
  adBlock: boolean;
  hasLiedLanguages: boolean;
  hasLiedResolution: boolean;
  hasLiedOs: boolean;
  hasLiedBrowser: boolean;
  touchSupport: number[];
  fonts: string[];
  audio: string;
}

/**
 * Generate a unique browser fingerprint
 * @returns SHA-256 hash of browser characteristics
 */
export async function generateFingerprint(): Promise<string> {
  // ✅ Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) {
    console.warn('[Fingerprint] Not in browser environment, cannot generate fingerprint');
    return '';
  }
  
  try {
    const components = await gatherFingerprint();
    const fingerprintString = JSON.stringify(components);
    
    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(fingerprintString)
    );
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('[Fingerprint] Error generating fingerprint:', error);
    return '';
  }
}

/**
 * Gather all browser/device characteristics for fingerprinting
 */
async function gatherFingerprint(): Promise<FingerprintComponents> {
  const nav = navigator as any;
  
  return {
    // Basic browser info
    userAgent: navigator.userAgent,
    language: navigator.language,
    
    // Screen & display
    colorDepth: screen.colorDepth,
    deviceMemory: nav.deviceMemory || 0,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    screenResolution: `${screen.width}x${screen.height}`,
    availableScreenResolution: `${screen.availWidth}x${screen.availHeight}`,
    
    // Time & location
    timezoneOffset: new Date().getTimezoneOffset(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    
    // Storage capabilities
    sessionStorage: !!window.sessionStorage,
    localStorage: !!window.localStorage,
    indexedDb: !!window.indexedDB,
    addBehavior: !!(document.body as any).addBehavior,
    openDatabase: !!window.openDatabase,
    
    // Platform info
    cpuClass: nav.cpuClass || 'unknown',
    platform: navigator.platform,
    doNotTrack: nav.doNotTrack || 'unknown',
    
    // Plugins
    plugins: getPluginData(),
    
    // Canvas fingerprint
    canvas: getCanvasFingerprint(),
    
    // WebGL fingerprint
    webgl: getWebglFingerprint(),
    webglVendorAndRenderer: getWebglVendorAndRenderer(),
    
    // Ad blocker detection
    adBlock: false, // We don't track this for privacy
    
    // Consistency checks
    hasLiedLanguages: false,
    hasLiedResolution: false,
    hasLiedOs: false,
    hasLiedBrowser: false,
    
    // Touch support
    touchSupport: getTouchSupport(),
    
    // Fonts (limited list to avoid performance issues)
    fonts: getFonts(),
    
    // Audio fingerprint
    audio: await getAudioFingerprint()
  };
}

/**
 * Get plugin data
 */
function getPluginData(): string[] {
  const plugins: string[] = [];
  
  if (navigator.plugins) {
    for (let i = 0; i < navigator.plugins.length; i++) {
      const plugin = navigator.plugins[i];
      plugins.push(plugin.name);
    }
  }
  
  return plugins.sort();
}

/**
 * Generate canvas fingerprint
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return 'unsupported';
    
    // Draw text with specific styling
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Wasgeurtje.nl 🌸', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Wasgeurtje.nl 🌸', 4, 17);
    
    return canvas.toDataURL();
  } catch (e) {
    return 'error';
  }
}

/**
 * Generate WebGL fingerprint
 */
function getWebglFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    
    if (!gl) return 'unsupported';
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';
    
    return gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) + '~' + gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  } catch (e) {
    return 'error';
  }
}

/**
 * Get WebGL vendor and renderer
 */
function getWebglVendorAndRenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    
    if (!gl) return 'unsupported';
    
    return `${gl.getParameter(gl.VENDOR)}~${gl.getParameter(gl.RENDERER)}`;
  } catch (e) {
    return 'error';
  }
}

/**
 * Get touch support info
 */
function getTouchSupport(): number[] {
  const nav = navigator as any;
  let maxTouchPoints = 0;
  let touchEvent = false;
  
  if (typeof nav.maxTouchPoints !== 'undefined') {
    maxTouchPoints = nav.maxTouchPoints;
  } else if (typeof nav.msMaxTouchPoints !== 'undefined') {
    maxTouchPoints = nav.msMaxTouchPoints;
  }
  
  try {
    document.createEvent('TouchEvent');
    touchEvent = true;
  } catch (e) {
    // Touch event not supported
  }
  
  const touchStart = 'ontouchstart' in window;
  
  return [maxTouchPoints, touchEvent ? 1 : 0, touchStart ? 1 : 0];
}

/**
 * Get common fonts (limited list for performance)
 */
function getFonts(): string[] {
  // Common fonts to test
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = [
    'Arial', 'Verdana', 'Times New Roman', 'Courier New',
    'Georgia', 'Palatino', 'Garamond', 'Bookman',
    'Comic Sans MS', 'Trebuchet MS', 'Impact'
  ];
  
  const detectedFonts: string[] = [];
  
  // Create canvas for font detection
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return detectedFonts;
  
  const testString = 'mmmmmmmmmmlli';
  const testSize = '72px';
  
  // Get baseline measurements
  const baselines: { [key: string]: { width: number; height: number } } = {};
  for (const baseFont of baseFonts) {
    ctx.font = `${testSize} ${baseFont}`;
    const metrics = ctx.measureText(testString);
    baselines[baseFont] = {
      width: metrics.width,
      height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
    };
  }
  
  // Test each font
  for (const testFont of testFonts) {
    let detected = false;
    
    for (const baseFont of baseFonts) {
      ctx.font = `${testSize} '${testFont}', ${baseFont}`;
      const metrics = ctx.measureText(testString);
      const width = metrics.width;
      const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      
      if (width !== baselines[baseFont].width || height !== baselines[baseFont].height) {
        detected = true;
        break;
      }
    }
    
    if (detected) {
      detectedFonts.push(testFont);
    }
  }
  
  return detectedFonts.sort();
}

/**
 * Generate audio fingerprint
 */
async function getAudioFingerprint(): Promise<string> {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return 'unsupported';
    
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const analyser = context.createAnalyser();
    const gainNode = context.createGain();
    const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
    
    gainNode.gain.value = 0; // Mute
    oscillator.type = 'triangle';
    oscillator.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.start(0);
    
    return new Promise((resolve) => {
      scriptProcessor.onaudioprocess = (event) => {
        const output = event.inputBuffer.getChannelData(0);
        const hash = Array.from(output.slice(0, 30))
          .map(v => v.toFixed(6))
          .join('');
        
        oscillator.stop();
        scriptProcessor.disconnect();
        analyser.disconnect();
        gainNode.disconnect();
        
        resolve(hash.slice(0, 50)); // Truncate to 50 chars
      };
    });
  } catch (e) {
    return 'error';
  }
}

/**
 * Get or create persistent fingerprint from localStorage
 * Falls back to generating new one if not found
 */
export async function getStoredFingerprint(): Promise<string> {
  // ✅ Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return '';
  }
  
  const STORAGE_KEY = 'wg_device_fp';
  
  try {
    // Try to get from localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return stored;
    }
    
    // Generate new fingerprint
    const fingerprint = await generateFingerprint();
    
    // Store for future sessions
    if (fingerprint) {
      localStorage.setItem(STORAGE_KEY, fingerprint);
    }
    
    return fingerprint;
  } catch (error) {
    console.error('[Fingerprint] Error accessing localStorage:', error);
    // If localStorage is disabled, generate fingerprint without storing
    return await generateFingerprint();
  }
}
