/**
 * Local avatar generator - Creates SVG avatars with initials
 * Replaces external ui-avatars.com API for better performance
 */

export interface AvatarOptions {
  name: string;
  size?: number;
  background?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string | number;
}

/**
 * Generate initials from a name
 * Examples: "Jack Wullems" -> "JW", "Jack" -> "JA", "" -> "?"
 */
export function generateInitials(name: string): string {
  if (!name || !name.trim()) {
    return '?';
  }

  const cleanName = name.trim();
  const words = cleanName.split(/\s+/).filter(word => word.length > 0);

  if (words.length === 0) {
    return '?';
  }

  if (words.length === 1) {
    // Single name: take first 2 characters
    return words[0].substring(0, 2).toUpperCase();
  }

  // Multiple words: take first letter of first two words
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Generate SVG avatar as data URI
 * Returns a data:image/svg+xml URI that can be used directly in img src
 */
export function generateAvatarDataUri(options: AvatarOptions): string {
  const {
    name,
    size = 64,
    background = 'D6AD61', // Brand gold color
    color = 'ffffff',      // White text
    fontSize = size * 0.4,
    fontWeight = 600
  } = options;

  const initials = generateInitials(name);
  
  // Clean hex colors (remove # if present)
  const cleanBg = background.replace('#', '');
  const cleanColor = color.replace('#', '');

  // Create SVG with proper viewBox for scaling
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#${cleanBg}" rx="${size * 0.1}"/>
  <text 
    x="50%" 
    y="50%" 
    dominant-baseline="middle" 
    text-anchor="middle" 
    fill="#${cleanColor}" 
    font-family="system-ui, -apple-system, sans-serif" 
    font-size="${fontSize}" 
    font-weight="${fontWeight}"
  >${initials}</text>
</svg>`;

  // Encode to data URI (base64 for better compatibility)
  const encoded = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
}

/**
 * Generate avatar URL (for backward compatibility with existing code)
 * Can be used as drop-in replacement for ui-avatars.com URLs
 */
export function generateAvatarUrl(name: string, size: number = 64): string {
  return generateAvatarDataUri({ name, size });
}

/**
 * Check if a URL is an external avatar service
 */
export function isExternalAvatarUrl(url: string): boolean {
  return url.includes('ui-avatars.com') || url.includes('gravatar.com');
}

/**
 * Replace external avatar URL with local one
 */
export function replaceExternalAvatar(url: string, name: string, size: number = 64): string {
  if (isExternalAvatarUrl(url)) {
    return generateAvatarUrl(name, size);
  }
  return url;
}

