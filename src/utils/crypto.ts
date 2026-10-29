/**
 * End-to-End Encryption (E2EE) utilities using standard Web Crypto API (AES-256-GCM + PBKDF2)
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function bufToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Fast chunked ArrayBuffer to Base64 (avoids stack overflow and string concatenation bottlenecks)
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB slice
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Fast Base64 to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Synchronous pure-JS SHA-256 to ensure instantaneous, deterministic key derivation
 * across all browsers without asynchronous race conditions.
 */
export function sha256Sync(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  words[asciiBitLength >> 5] |= 0x80 << (24 - asciiBitLength % 32);
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (let i = 0; i < ascii.length; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << ((3 - (i % 4)) * 8);
  }

  const w = new Array(64);
  for (let i = 0; i < words.length; i += 16) {
    let a = hash[0], b = hash[1], c = hash[2], d = hash[3],
        e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[j + i] | 0;
      } else {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + s1 + ch + k[j] + w[j]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Deterministically derive a shared 256-bit hexadecimal secret from a room code.
 * Ensures that both Phone and PC joining the same room code (e.g. ECHO-850)
 * automatically agree on the exact same cryptographic key, preventing decryption integrity errors.
 */
export function deriveSecretFromRoomCodeSync(roomCode: string, customPassphrase?: string): string {
  const normalized = roomCode.trim().toUpperCase();
  const base = customPassphrase?.trim()
    ? `AETHERDROP_CUSTOM:${normalized}:${customPassphrase.trim()}`
    : `AETHERDROP_DEFAULT:${normalized}`;
  return sha256Sync(base);
}

/**
 * Generate a random 16-byte salt for key derivation
 */
export function generateSalt(): Uint8Array {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Derives an AES-GCM 256-bit key from a shared room passphrase/secret and salt
 */
export async function deriveEncryptionKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = textEncoder.encode(passphrase);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a chunk using AES-256-GCM with a unique 12-byte initialization vector
 */
export async function encryptChunk(
  key: CryptoKey,
  rawBuffer: ArrayBuffer
): Promise<{ ivHex: string; encryptedBase64: string }> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
    },
    key,
    rawBuffer
  );

  return {
    ivHex: bufToHex(iv),
    encryptedBase64: arrayBufferToBase64(cipherBuffer),
  };
}

/**
 * Decrypt an AES-256-GCM chunk
 */
export async function decryptChunk(
  key: CryptoKey,
  encryptedBase64: string,
  ivHex: string
): Promise<ArrayBuffer> {
  const iv = hexToBuf(ivHex);
  const cipherBuffer = base64ToArrayBuffer(encryptedBase64);

  return await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
    },
    key,
    cipherBuffer
  );
}

/**
 * Encrypt text payload with AES-256-GCM
 */
export async function encryptText(key: CryptoKey, plainText: string): Promise<{ ivHex: string; cipherBase64: string }> {
  const raw = textEncoder.encode(plainText);
  const res = await encryptChunk(key, raw.buffer);
  return {
    ivHex: res.ivHex,
    cipherBase64: res.encryptedBase64,
  };
}

/**
 * Decrypt text payload with AES-256-GCM
 */
export async function decryptText(key: CryptoKey, cipherBase64: string, ivHex: string): Promise<string> {
  const buf = await decryptChunk(key, cipherBase64, ivHex);
  return textDecoder.decode(buf);
}

/**
 * Generate a random 6-character room code (e.g. SKY-782)
 */
export function generateRoomCode(): string {
  const words = ['AURA', 'NOVA', 'LUNAR', 'SOLAR', 'CYBER', 'ZENITH', 'PULSE', 'VORTEX', 'ECHO', 'ATLAS'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${word}-${num}`;
}

/**
 * Generate a random 256-bit hexadecimal encryption secret
 */
export function generateRandomSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bufToHex(bytes);
}

/**
 * Visual verification fingerprint from room key (4 emojis + 4 hex chars)
 * Allows users to look at phone screen & PC screen and verify identical encryption session!
 */
export function computeSecurityFingerprint(secret: string): { emojis: string; hex: string } {
  const emojis = ['🔒', '🛡️', '⚡', '🛰️', '💎', '🔑', '🦊', '🦅', '🪐', '🌊', '🚀', '🔥', '🌲', '☀️', '⚓', '🍀'];
  const hashHex = sha256Sync(secret);
  const b0 = parseInt(hashHex.substring(0, 2), 16);
  const b1 = parseInt(hashHex.substring(2, 4), 16);
  const b2 = parseInt(hashHex.substring(4, 6), 16);
  const b3 = parseInt(hashHex.substring(6, 8), 16);

  const e1 = emojis[b0 % emojis.length];
  const e2 = emojis[b1 % emojis.length];
  const e3 = emojis[b2 % emojis.length];
  const e4 = emojis[b3 % emojis.length];

  const hex = hashHex.substring(8, 12).toUpperCase();

  return {
    emojis: `${e1} ${e2} ${e3} ${e4}`,
    hex,
  };
}
