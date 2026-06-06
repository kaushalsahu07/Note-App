import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ─── Storage Keys ────────────────────────────────────────────────────
const SYNC_API_URL_KEY = '@sync_api_url';
const SYNC_AUTH_TOKEN_KEY = '@sync_auth_token';
const SYNC_EMAIL_KEY = '@sync_email';
const SYNC_LAST_SYNC_KEY = '@sync_last_sync';
const SYNC_AUTO_ENABLED_KEY = '@sync_auto_enabled';
const SYNC_PASSWORD_KEY = 'sync_session_password'; // stored in SecureStore

// ─── Default API URL ─────────────────────────────────────────────────
const DEFAULT_API_URL = 'Your Server URL or use your computer IP address';

// ─── Session password (cached in-memory, persisted in SecureStore) ───
let _sessionPassword: string | null = null;

export async function setSyncSessionPassword(password: string): Promise<void> {
  _sessionPassword = password;
  try {
    await SecureStore.setItemAsync(SYNC_PASSWORD_KEY, password);
  } catch (err) {
    console.warn('Failed to persist session password to SecureStore:', err);
  }
}

export async function getSyncSessionPassword(): Promise<string | null> {
  if (_sessionPassword) return _sessionPassword;
  // Restore from SecureStore on app restart
  try {
    const stored = await SecureStore.getItemAsync(SYNC_PASSWORD_KEY);
    if (stored) {
      _sessionPassword = stored;
    }
    return _sessionPassword;
  } catch (err) {
    console.warn('Failed to read session password from SecureStore:', err);
    return null;
  }
}

export async function clearSyncSession(): Promise<void> {
  _sessionPassword = null;
  try {
    await SecureStore.deleteItemAsync(SYNC_PASSWORD_KEY);
  } catch (err) {
    console.warn('Failed to clear session password from SecureStore:', err);
  }
}

// ─── API URL ─────────────────────────────────────────────────────────

export async function getSyncApiUrl(): Promise<string> {
  // Clear any stale cached URL from the old "Server settings" feature
  await AsyncStorage.removeItem(SYNC_API_URL_KEY);
  return DEFAULT_API_URL;
}

// ─── Auth Token ──────────────────────────────────────────────────────

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(SYNC_AUTH_TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(SYNC_AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_AUTH_TOKEN_KEY);
}

// ─── Email ───────────────────────────────────────────────────────────

export async function getSyncEmail(): Promise<string | null> {
  return AsyncStorage.getItem(SYNC_EMAIL_KEY);
}

export async function setSyncEmail(email: string): Promise<void> {
  await AsyncStorage.setItem(SYNC_EMAIL_KEY, email.toLowerCase().trim());
}

export async function clearSyncEmail(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_EMAIL_KEY);
}

// ─── Last Sync Time ──────────────────────────────────────────────────

export async function getLastSyncTime(): Promise<string | null> {
  return AsyncStorage.getItem(SYNC_LAST_SYNC_KEY);
}

export async function setLastSyncTime(time: string): Promise<void> {
  await AsyncStorage.setItem(SYNC_LAST_SYNC_KEY, time);
}

// ─── Auto Sync ───────────────────────────────────────────────────────

export async function isAutoSyncEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(SYNC_AUTO_ENABLED_KEY);
  return val === 'true';
}

export async function setAutoSyncEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(SYNC_AUTO_ENABLED_KEY, enabled ? 'true' : 'false');
}

// ─── Login State Check ──────────────────────────────────────────────

export async function isLoggedIn(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token;
}

// ─── Full Logout ─────────────────────────────────────────────────────

export async function clearAllSyncData(): Promise<void> {
  await clearSyncSession();
  await Promise.all([
    clearAuthToken(),
    clearSyncEmail(),
    AsyncStorage.removeItem(SYNC_LAST_SYNC_KEY),
    AsyncStorage.removeItem(SYNC_AUTO_ENABLED_KEY),
  ]);
}
