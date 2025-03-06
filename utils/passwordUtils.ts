import * as Crypto from 'expo-crypto';

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
  return hash;
}

export async function verifyPassword(inputPassword: string, hashedPassword: string): Promise<boolean> {
  const hashedInput = await hashPassword(inputPassword);
  return hashedInput === hashedPassword;
} 