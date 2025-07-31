
import { createHash, randomBytes } from 'crypto';

export class KeyHasher {
  private static readonly ALGORITHM = 'sha256';
  private static readonly SALT_LENGTH = 32;

  /**
   * Hash an API key with a random salt
   */
  static async hashKey(key: string): Promise<{ hash: string; salt: string }> {
    const salt = randomBytes(this.SALT_LENGTH).toString('hex');
    const hash = createHash(this.ALGORITHM)
      .update(key + salt)
      .digest('hex');
    
    return { hash, salt };
  }

  /**
   * Verify an API key against a stored hash
   */
  static async verifyKey(key: string, storedHash: string, salt: string): Promise<boolean> {
    const hash = createHash(this.ALGORITHM)
      .update(key + salt)
      .digest('hex');
    
    return hash === storedHash;
  }

  /**
   * Generate a secure API key
   */
  static generateApiKey(prefix: string = 'ku'): string {
    const randomPart = randomBytes(32).toString('hex');
    return `${prefix}_${randomPart}`;
  }
}
