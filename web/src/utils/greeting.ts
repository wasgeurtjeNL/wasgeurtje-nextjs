/**
 * Utility functions for personalized greetings based on time and day
 */

export interface GreetingOptions {
  includeEmoji?: boolean;
  short?: boolean;
}

/**
 * Get time-based greeting (morning, afternoon, evening)
 */
export function getTimeBasedGreeting(options: GreetingOptions = {}): string {
  const { includeEmoji = true, short = false } = options;
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return short 
      ? `Goedemorgen${includeEmoji ? ' ☀️' : ''}`
      : `Goedemorgen${includeEmoji ? ' ☀️' : ''}`;
  } else if (hour >= 12 && hour < 18) {
    return short
      ? `Goedemiddag${includeEmoji ? ' 🌤️' : ''}`
      : `Goedemiddag${includeEmoji ? ' 🌤️' : ''}`;
  } else if (hour >= 18 && hour < 24) {
    return short
      ? `Goedenavond${includeEmoji ? ' 🌙' : ''}`
      : `Goedenavond${includeEmoji ? ' 🌙' : ''}`;
  } else {
    // Late night / very early morning (0-5)
    return short
      ? `Goedenacht${includeEmoji ? ' 🌟' : ''}`
      : `Goedenacht${includeEmoji ? ' 🌟' : ''}`;
  }
}

/**
 * Get day-specific greeting for weekends/special days
 */
export function getDaySpecificGreeting(): string | null {
  const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  const hour = new Date().getHours();

  // Sunday
  if (day === 0) {
    if (hour >= 6 && hour < 12) {
      return "Fijne zondagochtend";
    } else if (hour >= 12 && hour < 18) {
      return "Fijne zondag";
    } else if (hour >= 18) {
      return "Fijne zondagavond";
    }
  }
  
  // Saturday
  if (day === 6) {
    if (hour >= 6 && hour < 12) {
      return "Fijne zaterdagochtend";
    } else if (hour >= 12 && hour < 18) {
      return "Fijn weekend";
    } else if (hour >= 18) {
      return "Fijne zaterdagavond";
    }
  }

  // Friday evening/night - weekend feeling
  if (day === 5 && hour >= 18) {
    return "Fijn weekend alvast";
  }

  return null; // No special greeting for regular weekdays
}

/**
 * Get full personalized greeting with name
 */
export function getPersonalizedGreeting(
  firstName: string | undefined,
  options: GreetingOptions = {}
): string {
  const dayGreeting = getDaySpecificGreeting();
  const timeGreeting = getTimeBasedGreeting(options);
  
  const name = firstName || "daar";

  // If it's a special day, use that greeting
  if (dayGreeting) {
    return `${dayGreeting}, ${name}`;
  }

  // Otherwise use time-based greeting
  return `${timeGreeting} ${name}`;
}

/**
 * Get a contextual message based on time/day
 */
export function getContextualMessage(): string {
  const hour = new Date().getHours();
  const day = new Date().getDay();

  // Weekend messages
  if (day === 0) { // Sunday
    return "Geniet van je zondag!";
  }
  if (day === 6) { // Saturday
    return "Geniet van je weekend!";
  }

  // Friday evening
  if (day === 5 && hour >= 18) {
    return "Het weekend begint hier!";
  }

  // Weekday time-based messages
  if (hour >= 5 && hour < 9) {
    return "Start je dag fris!";
  } else if (hour >= 9 && hour < 12) {
    return "Tijd voor een frisse was!";
  } else if (hour >= 12 && hour < 14) {
    return "Lekker aan het shoppen?";
  } else if (hour >= 14 && hour < 18) {
    return "Fijne middag!";
  } else if (hour >= 18 && hour < 22) {
    return "Ontspan met heerlijke geuren";
  } else if (hour >= 22 || hour < 5) {
    return "Ook laat nog online? 🌟";
  } else {
    return "Ontdek onze heerlijke wasparfums!";
  }
}

