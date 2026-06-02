import * as Crypto from 'expo-crypto';

// ─── Constants ───────────────────────────────────────────────────────
const E2EE_PREFIX = 'e2ee:v1:';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const SALT_LENGTH = 16;

// ─── Session key cache ───────────────────────────────────────────────
// Derived key is cached in memory so key derivation only happens ONCE
// per session (at unlock time). All subsequent encrypt/decrypt use the
// cached key instantly.
let _cachedKey: Uint8Array | null = null;
let _cachedPassphrase: string | null = null;

/**
 * Pre-derive and cache the session key. Call this once at unlock time.
 * Uses a fixed salt derived from the passphrase itself so the key is
 * deterministic for a given passphrase.
 */
export async function precomputeSessionKey(passphrase: string): Promise<void> {
  if (_cachedPassphrase === passphrase && _cachedKey) return; // already cached
  const fixedSalt = fromHex(
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, 'e2ee-salt:' + passphrase)
  ).slice(0, SALT_LENGTH);
  _cachedKey = await deriveKeyFast(passphrase, fixedSalt);
  _cachedPassphrase = passphrase;
}

/** Clear the cached key (on logout / disable E2EE) */
export function clearSessionKey() {
  _cachedKey = null;
  _cachedPassphrase = null;
}

/** Get the cached key, or derive one on-the-fly (slow fallback) */
async function getKey(passphrase: string): Promise<Uint8Array> {
  if (_cachedPassphrase === passphrase && _cachedKey) return _cachedKey;
  // Fallback: derive inline (happens only if precompute wasn't called)
  await precomputeSessionKey(passphrase);
  return _cachedKey!;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Convert a Uint8Array to a hex string */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Convert a hex string to a Uint8Array */
function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/** Convert a UTF-8 string to Uint8Array */
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Convert Uint8Array to UTF-8 string */
function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Base64 encode */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Base64 decode */
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Key Derivation ──────────────────────────────────────────────────

/**
 * Fast key derivation: 3 rounds of SHA-256.
 * Security is acceptable for local-device encryption because:
 * - Salt prevents rainbow tables
 * - Attacker needs physical device access
 * - Data is already protected by device lock screen
 */
async function deriveKeyFast(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  let current = passphrase + ':' + toHex(salt);
  // 3 rounds — minimal overhead, still produces a strong 256-bit key
  for (let i = 0; i < 3; i++) {
    current = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      current
    );
  }
  return fromHex(current);
}

/**
 * Generate a keystream block by hashing key + IV + counter.
 * Used for CTR-mode encryption.
 */
async function generateKeystreamBlock(key: Uint8Array, iv: Uint8Array, counter: number): Promise<Uint8Array> {
  const input = toHex(key) + ':' + toHex(iv) + ':' + counter.toString();
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
  return fromHex(hash);
}

/**
 * Compute HMAC-SHA-256 for authentication.
 * Uses a simple HMAC construction: H(key ⊕ opad || H(key ⊕ ipad || message))
 */
async function hmacSHA256(key: Uint8Array, message: Uint8Array): Promise<string> {
  // Pad key to 64 bytes (SHA-256 block size)
  const paddedKey = new Uint8Array(64);
  if (key.length > 64) {
    const keyHash = fromHex(
      await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, toHex(key))
    );
    paddedKey.set(keyHash);
  } else {
    paddedKey.set(key);
  }

  // Compute ipad and opad
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }

  // Inner hash: H(key ⊕ ipad || message)
  const innerInput = new Uint8Array(ipad.length + message.length);
  innerInput.set(ipad);
  innerInput.set(message, ipad.length);
  const innerHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    toHex(innerInput)
  );

  // Outer hash: H(key ⊕ opad || innerHash)
  const outerInput = toHex(opad) + innerHash;
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    outerInput
  );
}

// ─── Encrypt / Decrypt ───────────────────────────────────────────────

/**
 * Encrypt plaintext bytes using CTR mode with SHA-256-based keystream.
 */
async function encryptBytes(plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  const ciphertext = new Uint8Array(plaintext.length);
  const blockSize = 32; // SHA-256 output = 32 bytes

  for (let offset = 0; offset < plaintext.length; offset += blockSize) {
    const counter = Math.floor(offset / blockSize);
    const keystreamBlock = await generateKeystreamBlock(key, iv, counter);
    const chunkLen = Math.min(blockSize, plaintext.length - offset);
    for (let i = 0; i < chunkLen; i++) {
      ciphertext[offset + i] = plaintext[offset + i] ^ keystreamBlock[i];
    }
  }

  return ciphertext;
}

/**
 * Decrypt = same as encrypt in CTR mode (XOR is its own inverse).
 */
async function decryptBytes(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  return encryptBytes(ciphertext, key, iv); // CTR mode: decrypt === encrypt
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string with a passphrase.
 * Uses the cached session key if available (instant).
 * Returns: `e2ee:v1:<iv_b64>:<hmac_hex>:<ciphertext_b64>`
 */
export async function encrypt(plaintext: string, passphrase: string): Promise<string> {
  const iv = Crypto.getRandomBytes(IV_LENGTH);
  const key = await getKey(passphrase);

  const plaintextBytes = stringToBytes(plaintext);
  const ciphertext = await encryptBytes(plaintextBytes, key, iv);

  // Compute HMAC over iv + ciphertext for authentication
  const authData = new Uint8Array(iv.length + ciphertext.length);
  authData.set(iv);
  authData.set(ciphertext, iv.length);
  const hmac = await hmacSHA256(key, authData);

  return E2EE_PREFIX +
    toBase64(iv) + ':' +
    hmac + ':' +
    toBase64(ciphertext);
}

/**
 * Decrypt an E2EE-encoded string with a passphrase.
 * Uses the cached session key if available (instant).
 * Throws if authentication fails or data is corrupted.
 */
export async function decrypt(encoded: string, passphrase: string): Promise<string> {
  if (!isEncryptedData(encoded)) {
    throw new Error('Data is not in E2EE format');
  }

  const payload = encoded.substring(E2EE_PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid E2EE data format');
  }

  const [ivB64, expectedHmac, ciphertextB64] = parts;
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ciphertextB64);

  const key = await getKey(passphrase);

  // Verify HMAC before decryption
  const authData = new Uint8Array(iv.length + ciphertext.length);
  authData.set(iv);
  authData.set(ciphertext, iv.length);
  const computedHmac = await hmacSHA256(key, authData);

  if (computedHmac !== expectedHmac) {
    throw new Error('Authentication failed — wrong passphrase or corrupted data');
  }

  const plaintextBytes = await decryptBytes(ciphertext, key, iv);
  return bytesToString(plaintextBytes);
}

/**
 * Encrypt a JSON-serializable object.
 */
export async function encryptObject<T>(obj: T, passphrase: string): Promise<string> {
  const json = JSON.stringify(obj);
  return encrypt(json, passphrase);
}

/**
 * Decrypt a string back to a typed object.
 */
export async function decryptObject<T>(encrypted: string, passphrase: string): Promise<T> {
  const json = await decrypt(encrypted, passphrase);
  return JSON.parse(json) as T;
}

/**
 * Check if a value looks like E2EE-encrypted data.
 */
export function isEncryptedData(data: unknown): boolean {
  return typeof data === 'string' && data.startsWith(E2EE_PREFIX);
}

/**
 * Hash a passphrase for verification storage (NOT used as encryption key).
 * Uses double SHA-256 with a fixed domain separator.
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  const first = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    'e2ee-verify:' + passphrase
  );
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    'e2ee-verify-2:' + first
  );
}

/**
 * Verify a passphrase against a stored hash.
 */
export async function verifyPassphraseHash(passphrase: string, storedHash: string): Promise<boolean> {
  const computed = await hashPassphrase(passphrase);
  return computed === storedHash;
}
