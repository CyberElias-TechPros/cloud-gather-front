
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 1000, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if a request should be allowed
   */
  isAllowed(identifier: string): { allowed: boolean; remainingRequests: number; resetTime: number } {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    if (!entry || now > entry.resetTime) {
      // New window or expired entry
      const newEntry = {
        count: 1,
        resetTime: now + this.windowMs
      };
      this.limits.set(identifier, newEntry);
      
      return {
        allowed: true,
        remainingRequests: this.maxRequests - 1,
        resetTime: newEntry.resetTime
      };
    }

    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: entry.resetTime
      };
    }

    entry.count++;
    this.limits.set(identifier, entry);

    return {
      allowed: true,
      remainingRequests: this.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}
