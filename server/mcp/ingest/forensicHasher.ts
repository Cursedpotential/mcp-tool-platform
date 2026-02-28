import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * Calculates a SHA-256 hash of a massive file without loading it into memory.
 * Essential for 4GB+ XML files to maintain Chain of Custody without crashing Node.js.
 */
export async function hashFileStream(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', (err) => {
      reject(new Error(`Failed to hash file stream: ${err.message}`));
    });
  });
}
