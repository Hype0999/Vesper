import crypto from 'node:crypto';
import fs from 'node:fs';
import { Transform } from 'node:stream';
import { env } from '../config/env.js';

export class VaultCipher {
  private static cachedKey: Buffer | null = null;

  public static getMasterKey(): Buffer {
    if (!this.cachedKey) {
      this.cachedKey = crypto.scryptSync(env.SESSION_SECRET, 'vesper-media-vault-salt-v1', 32);
    }
    return this.cachedKey;
  }

  public static incrementIv(baseIv: Buffer, blockOffset: bigint | number): Buffer {
    const ivCopy = Buffer.from(baseIv);
    let carry = BigInt(blockOffset);
    for (let i = 15; i >= 0 && carry > 0n; i--) {
      const sum = BigInt(ivCopy[i]!) + (carry & 0xffn);
      ivCopy[i] = Number(sum & 0xffn);
      carry = (carry >> 8n) + (sum >> 8n);
    }
    return ivCopy;
  }

  /**
   * Check if file is encrypted (starts with .enc or has the 16-byte IV header in private storage)
   */
  public static isFileEncrypted(filePath: string): boolean {
    return filePath.endsWith('.enc');
  }

  /**
   * Encrypt a plaintext file stream and write to destination encrypted file
   */
  public static async encryptFileStream(
    sourceStream: NodeJS.ReadableStream,
    destPath: string
  ): Promise<{ writtenBytes: number; originalBytes: number }> {
    const key = this.getMasterKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);

    const outStream = fs.createWriteStream(destPath);
    // Write IV first
    outStream.write(iv);

    let originalBytes = 0;
    const counterTransform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        originalBytes += chunk.length;
        callback(null, chunk);
      },
    });

    await new Promise<void>((resolve, reject) => {
      sourceStream
        .pipe(counterTransform)
        .pipe(cipher)
        .pipe(outStream)
        .on('finish', () => resolve())
        .on('error', reject);
    });

    const writtenBytes = originalBytes + 16;
    return { writtenBytes, originalBytes };
  }

  /**
   * Create a stream to decrypt an encrypted vault file with optional range request support
   */
  public static createDecryptionStream(
    filePath: string,
    start?: number,
    end?: number,
    plainFileSize?: number
  ): { stream: NodeJS.ReadableStream; contentLength: number } {
    const key = this.getMasterKey();
    const fd = fs.openSync(filePath, 'r');
    const ivBuffer = Buffer.alloc(16);
    fs.readSync(fd, ivBuffer, 0, 16, 0);
    fs.closeSync(fd);

    const fileStats = fs.statSync(filePath);
    const totalPlain = plainFileSize ?? Math.max(0, fileStats.size - 16);

    const rangeStart = start ?? 0;
    const rangeEnd = end !== undefined ? Math.min(end, totalPlain - 1) : totalPlain - 1;
    const contentLength = Math.max(0, rangeEnd - rangeStart + 1);

    const blockOffset = Math.floor(rangeStart / 16);
    const byteOffsetInBlock = rangeStart % 16;
    const rangeIv = this.incrementIv(ivBuffer, blockOffset);

    const decipher = crypto.createDecipheriv('aes-256-ctr', key, rangeIv);

    const cipherReadStart = 16 + (blockOffset * 16);
    const cipherReadEnd = 16 + rangeEnd;

    const rawCipherStream = fs.createReadStream(filePath, {
      start: cipherReadStart,
      end: cipherReadEnd,
    });

    let bytesDiscarded = 0;
    let bytesEmitted = 0;

    const sliceTransform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        let data = chunk;
        if (bytesDiscarded < byteOffsetInBlock) {
          const needed = byteOffsetInBlock - bytesDiscarded;
          if (data.length <= needed) {
            bytesDiscarded += data.length;
            callback();
            return;
          } else {
            data = data.subarray(needed);
            bytesDiscarded += needed;
          }
        }

        if (bytesEmitted + data.length > contentLength) {
          const toEmit = contentLength - bytesEmitted;
          if (toEmit > 0) {
            bytesEmitted += toEmit;
            callback(null, data.subarray(0, toEmit));
          } else {
            callback();
          }
        } else {
          bytesEmitted += data.length;
          callback(null, data);
        }
      },
    });

    const stream = rawCipherStream.pipe(decipher).pipe(sliceTransform);
    return { stream, contentLength };
  }

  /**
   * Encrypt a small in-memory buffer (e.g. for private thumbnails)
   */
  public static encryptBuffer(buffer: Buffer): Buffer {
    const key = this.getMasterKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
    const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return Buffer.concat([iv, ciphertext]);
  }

  /**
   * Decrypt a small in-memory buffer
   */
  public static decryptBuffer(encryptedBuffer: Buffer): Buffer {
    if (encryptedBuffer.length < 16) return Buffer.alloc(0);
    const key = this.getMasterKey();
    const iv = encryptedBuffer.subarray(0, 16);
    const ciphertext = encryptedBuffer.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}
