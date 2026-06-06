import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { encrypt, decrypt, isEncryptedData } from './encryption';
import { getSessionPassphrase, isE2EEEnabled, notifyNotesChanged } from './storage';
import {
  getSyncApiUrl, getAuthToken, setAuthToken, setSyncEmail,
  clearAllSyncData, setLastSyncTime, getLastSyncTime,
  isAutoSyncEnabled, getSyncSessionPassword, setSyncSessionPassword,
  isLoggedIn,
} from './syncConfig';
import * as Crypto from 'expo-crypto';

// ─── Constants ───────────────────────────────────────────────────────
const NOTES_KEY = '@notes_v1';
const PASSWORDS_KEY = 'saved_passwords';
const AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Types ───────────────────────────────────────────────────────────

interface SyncBundle {
  notes: any[];
  passwords: any[];
  timestamp: string;
  version: string;
}

interface AuthResponse {
  message: string;
  token: string;
  userId: string;
}

interface SyncStatusResponse {
  exists: boolean;
  updatedAt?: string;
  sizeBytes?: number;
}

interface PullResponse {
  data: string;
  checksum: string;
  updatedAt: string;
  sizeBytes: number;
}

// ─── API Helpers ─────────────────────────────────────────────────────

async function apiRequest<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    requireAuth?: boolean;
  } = {}
): Promise<T> {
  const { method = 'GET', body, requireAuth = false } = options;
  const baseUrl = await getSyncApiUrl();
  const url = `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requireAuth) {
    const token = await getAuthToken();
    if (!token) throw new Error('Not logged in');
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

// ─── Auth Functions ──────────────────────────────────────────────────

export async function register(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: { email: email.toLowerCase().trim(), password },
    });

    await setAuthToken(result.token);
    await setSyncEmail(email.toLowerCase().trim());
    await setSyncSessionPassword(password);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { email: email.toLowerCase().trim(), password },
    });

    await setAuthToken(result.token);
    await setSyncEmail(email.toLowerCase().trim());
    await setSyncSessionPassword(password);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function logout(): Promise<void> {
  await clearAllSyncData();
}

// ─── Sync Functions ──────────────────────────────────────────────────

/**
 * Push local notes + passwords to the cloud (encrypted).
 * The user's password is used as the encryption key.
 */
export async function pushToCloud(): Promise<{ success: boolean; error?: string }> {
  try {
    const password = await getSyncSessionPassword();
    if (!password) {
      return { success: false, error: 'Please log in again to sync' };
    }

    // Load raw data from AsyncStorage
    const [notesRaw, passwordsRaw] = await Promise.all([
      AsyncStorage.getItem(NOTES_KEY),
      AsyncStorage.getItem(PASSWORDS_KEY),
    ]);

    // Decrypt if E2EE is active (to get plaintext for re-encryption with cloud key)
    let notesArray: any[] = [];
    let passwordsArray: any[] = [];
    const e2eeActive = await isE2EEEnabled();
    const sessionPassphrase = getSessionPassphrase();

    if (notesRaw) {
      if (e2eeActive && sessionPassphrase && isEncryptedData(notesRaw)) {
        const decrypted = await decrypt(notesRaw, sessionPassphrase);
        notesArray = JSON.parse(decrypted);
      } else if (!isEncryptedData(notesRaw)) {
        notesArray = JSON.parse(notesRaw);
      }
    }

    if (passwordsRaw) {
      if (e2eeActive && sessionPassphrase && isEncryptedData(passwordsRaw)) {
        const decrypted = await decrypt(passwordsRaw, sessionPassphrase);
        passwordsArray = JSON.parse(decrypted);
      } else if (!isEncryptedData(passwordsRaw)) {
        passwordsArray = JSON.parse(passwordsRaw);
      }
    }

    // Bundle data
    const bundle: SyncBundle = {
      notes: notesArray,
      passwords: passwordsArray,
      timestamp: new Date().toISOString(),
      version: '1.0',
    };

    // Encrypt the entire bundle with the user's password
    const plaintext = JSON.stringify(bundle);
    const encryptedData = await encrypt(plaintext, password);

    // Compute checksum
    const checksum = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      encryptedData
    );

    // Push to server
    await apiRequest('/api/sync/push', {
      method: 'POST',
      body: { data: encryptedData, checksum },
      requireAuth: true,
    });

    await setLastSyncTime(new Date().toISOString());
    return { success: true };
  } catch (err: any) {
    console.error('Push to cloud failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Pull notes + passwords from the cloud and MERGE with local data.
 * - Cloud versions take priority for notes/passwords with the same ID.
 * - Local-only notes/passwords are preserved.
 */
export async function pullFromCloud(): Promise<{
  success: boolean;
  error?: string;
  mergeStats?: { totalNotes: number; updatedFromCloud: number; keptLocal: number; newFromCloud: number };
}> {
  try {
    const password = await getSyncSessionPassword();
    if (!password) {
      return { success: false, error: 'Please log in again to sync' };
    }

    // Pull from server
    const response = await apiRequest<PullResponse>('/api/sync/pull', {
      method: 'POST',
      requireAuth: true,
    });

    // Verify checksum
    const computedChecksum = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      response.data
    );

    if (computedChecksum !== response.checksum) {
      return { success: false, error: 'Data integrity check failed — data may be corrupted' };
    }

    // Decrypt with user's password
    let decryptedJson: string;
    try {
      decryptedJson = await decrypt(response.data, password);
    } catch {
      return { success: false, error: 'Decryption failed — wrong password or corrupted data' };
    }

    const bundle: SyncBundle = JSON.parse(decryptedJson);

    // ─── Load existing local data ───────────────────────────────
    const e2eeActive = await isE2EEEnabled();
    const sessionPassphrase = getSessionPassphrase();

    let localNotes: any[] = [];
    let localPasswords: any[] = [];

    const [notesRaw, passwordsRaw] = await Promise.all([
      AsyncStorage.getItem(NOTES_KEY),
      AsyncStorage.getItem(PASSWORDS_KEY),
    ]);

    if (notesRaw) {
      if (e2eeActive && sessionPassphrase && isEncryptedData(notesRaw)) {
        const decrypted = await decrypt(notesRaw, sessionPassphrase);
        localNotes = JSON.parse(decrypted);
      } else if (!isEncryptedData(notesRaw)) {
        localNotes = JSON.parse(notesRaw);
      }
    }

    if (passwordsRaw) {
      if (e2eeActive && sessionPassphrase && isEncryptedData(passwordsRaw)) {
        const decrypted = await decrypt(passwordsRaw, sessionPassphrase);
        localPasswords = JSON.parse(decrypted);
      } else if (!isEncryptedData(passwordsRaw)) {
        localPasswords = JSON.parse(passwordsRaw);
      }
    }

    // ─── Merge notes: cloud priority for duplicates ─────────────
    const cloudNoteIds = new Set(bundle.notes.map((n: any) => n.id));
    const localOnlyNotes = localNotes.filter((n: any) => !cloudNoteIds.has(n.id));

    // Count stats
    const updatedFromCloud = localNotes.filter((n: any) => cloudNoteIds.has(n.id)).length;
    const newFromCloud = bundle.notes.filter(
      (n: any) => !localNotes.some((ln: any) => ln.id === n.id)
    ).length;

    // Cloud notes first (they take priority), then local-only notes
    const mergedNotes = [...bundle.notes, ...localOnlyNotes];

    // ─── Merge passwords: cloud priority for duplicates ─────────
    const cloudPasswordIds = new Set(bundle.passwords.map((p: any) => p.id));
    const localOnlyPasswords = localPasswords.filter((p: any) => !cloudPasswordIds.has(p.id));
    const mergedPasswords = [...bundle.passwords, ...localOnlyPasswords];

    // ─── Save merged data ───────────────────────────────────────
    if (e2eeActive && sessionPassphrase) {
      const encNotes = await encrypt(JSON.stringify(mergedNotes), sessionPassphrase);
      const encPasswords = await encrypt(JSON.stringify(mergedPasswords), sessionPassphrase);
      await Promise.all([
        AsyncStorage.setItem(NOTES_KEY, encNotes),
        AsyncStorage.setItem(PASSWORDS_KEY, encPasswords),
      ]);
    } else {
      await Promise.all([
        AsyncStorage.setItem(NOTES_KEY, JSON.stringify(mergedNotes)),
        AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(mergedPasswords)),
      ]);
    }

    await setLastSyncTime(new Date().toISOString());

    // Notify UI
    await notifyNotesChanged();

    return {
      success: true,
      mergeStats: {
        totalNotes: mergedNotes.length,
        updatedFromCloud,
        keptLocal: localOnlyNotes.length,
        newFromCloud,
      },
    };
  } catch (err: any) {
    console.error('Pull from cloud failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Check if cloud data exists for the logged-in user.
 */
export async function checkCloudStatus(): Promise<SyncStatusResponse> {
  try {
    return await apiRequest<SyncStatusResponse>('/api/sync/status', {
      requireAuth: true,
    });
  } catch {
    return { exists: false };
  }
}

/**
 * Delete all cloud data for the logged-in user.
 */
export async function deleteCloudData(): Promise<{ success: boolean; error?: string }> {
  try {
    await apiRequest('/api/sync/delete', {
      method: 'DELETE',
      requireAuth: true,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Auto Sync ───────────────────────────────────────────────────────

let _appStateSubscription: any = null;

/**
 * Check if auto-sync should run and execute it.
 * Called on app foreground via AppState listener.
 */
async function handleAutoSync() {
  try {
    const [loggedIn, autoEnabled] = await Promise.all([
      isLoggedIn(),
      isAutoSyncEnabled(),
    ]);

    if (!loggedIn || !autoEnabled) return;

    const password = await getSyncSessionPassword();
    if (!password) return; // Can't sync without session password

    const lastSync = await getLastSyncTime();
    if (lastSync) {
      const elapsed = Date.now() - new Date(lastSync).getTime();
      if (elapsed < AUTO_SYNC_INTERVAL_MS) return; // Not time yet
    }

    console.log('⏰ Auto-sync triggered');
    const result = await pushToCloud();
    if (result.success) {
      console.log('✅ Auto-sync completed');
    } else {
      console.warn('⚠️ Auto-sync failed:', result.error);
    }
  } catch (err) {
    console.warn('Auto-sync error:', err);
  }
}

/**
 * Start listening for app state changes to trigger auto-sync.
 * Call this once on app mount.
 */
export function startAutoSync() {
  if (_appStateSubscription) return; // Already listening

  _appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      // App came to foreground — check if auto-sync is due
      handleAutoSync();
    }
  });

  // Also run an initial check
  handleAutoSync();
}

/**
 * Stop auto-sync listener.
 */
export function stopAutoSync() {
  if (_appStateSubscription) {
    _appStateSubscription.remove();
    _appStateSubscription = null;
  }
}

/**
 * Get time until next auto-sync (for display purposes).
 */
export async function getNextSyncInfo(): Promise<{ hoursLeft: number; minutesLeft: number } | null> {
  const lastSync = await getLastSyncTime();
  if (!lastSync) return null;

  const elapsed = Date.now() - new Date(lastSync).getTime();
  const remaining = AUTO_SYNC_INTERVAL_MS - elapsed;

  if (remaining <= 0) return { hoursLeft: 0, minutesLeft: 0 };

  const hoursLeft = Math.floor(remaining / (60 * 60 * 1000));
  const minutesLeft = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  return { hoursLeft, minutesLeft };
}
