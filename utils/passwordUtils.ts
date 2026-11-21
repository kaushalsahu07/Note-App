import * as Crypto from 'expo-crypto';

export async function hashPassword(password: string): Promise<string> {
  const salted = `note_salt_v1:${password}:protect`;
  const hash1 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salted
  );
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `note_salt_v2:${hash1}`
  );
}

export async function verifyPassword(inputPassword: string, storedPassword?: string): Promise<boolean> {
  if (!storedPassword) return false;
  // Support legacy plain text
  if (inputPassword === storedPassword) return true;

  // Legacy single SHA256 hash
  const oldHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    inputPassword
  );
  if (oldHash === storedPassword) return true;

  // Modern salted hash
  const computed = await hashPassword(inputPassword);
  return computed === storedPassword;
}
 