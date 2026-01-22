/**
 * Encryption utilities for API key storage
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derive encryption key from environment variable
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  // Derive a 32-byte key using SHA-256
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypt an API key
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  // Combine IV + Tag + Encrypted data
  return iv.toString("hex") + tag.toString("hex") + encrypted;
}

/**
 * Decrypt an API key
 */
export function decryptApiKey(encryptedData: string): string {
  const key = getEncryptionKey();

  // Extract IV, Tag, and encrypted data
  const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), "hex");
  const tag = Buffer.from(
    encryptedData.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2),
    "hex"
  );
  const encrypted = encryptedData.slice((IV_LENGTH + TAG_LENGTH) * 2);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generate a masked version of an API key for display
 * e.g., "sk-...abc123"
 */
export function maskApiKey(key: string, visibleChars: number = 4): string {
  if (key.length <= visibleChars + 3) {
    return "•".repeat(key.length);
  }

  const prefix = key.slice(0, 3); // e.g., "sk-"
  const suffix = key.slice(-visibleChars); // Last 4 chars
  return `${prefix}...${suffix}`;
}

/**
 * Hash an API key for storage comparison (not reversible)
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Verify an API key against its hash
 */
export function verifyApiKey(key: string, hash: string): boolean {
  const keyHash = hashApiKey(key);
  return crypto.timingSafeEqual(Buffer.from(keyHash), Buffer.from(hash));
}
