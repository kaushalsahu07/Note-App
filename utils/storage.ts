import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  encrypt, decrypt, encryptObject, decryptObject,
  isEncryptedData, hashPassphrase, verifyPassphraseHash,
  precomputeSessionKey, clearSessionKey,
} from './encryption';

const NOTES_KEY = '@notes_v1';
const PASSWORDS_KEY = 'saved_passwords';
const E2EE_ENABLED_KEY = '@e2ee_enabled';
const E2EE_PASSPHRASE_HASH_KEY = '@e2ee_passphrase_hash';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  color: string;
  lastModified: string;
  tasks?: TodoItem[];
  pinned?: boolean;
  archived?: boolean;
  isPasswordProtected?: boolean;
  password?: string;
  passwordHint?: string;
}

export interface SavedPassword {
  id: string;
  title: string;
  password: string;
  date: string;
  noteId?: string;
  category?: string;
}

// ─── Session key (in-memory only — never persisted) ──────────────────
let _sessionPassphrase: string | null = null;

// ─── In-memory notes cache ──────────────────────────────────────────
// Avoids decrypting the entire blob from AsyncStorage on every read.
// The cache is populated on first load and kept in sync by all writes.
let _notesCache: Note[] | null = null;
let _notesCacheDirty = false; // true when cache diverges from storage

// Same for passwords
let _passwordsCache: SavedPassword[] | null = null;
let _passwordsCacheDirty = false;

export async function setSessionPassphrase(passphrase: string) {
  _sessionPassphrase = passphrase;
  // Invalidate caches when passphrase changes
  _notesCache = null;
  _passwordsCache = null;
  // Pre-derive and cache the encryption key so all
  // subsequent encrypt/decrypt calls are instant
  await precomputeSessionKey(passphrase);
}

export function getSessionPassphrase(): string | null {
  return _sessionPassphrase;
}

export function clearSessionPassphrase() {
  _sessionPassphrase = null;
  _notesCache = null;
  _notesCacheDirty = false;
  _passwordsCache = null;
  _passwordsCacheDirty = false;
  clearSessionKey();
}

// ─── E2EE status helpers ─────────────────────────────────────────────

export async function isE2EEEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(E2EE_ENABLED_KEY);
  return val === 'true';
}

export async function verifyE2EEPassphrase(passphrase: string): Promise<boolean> {
  const storedHash = await AsyncStorage.getItem(E2EE_PASSPHRASE_HASH_KEY);
  if (!storedHash) return false;
  return verifyPassphraseHash(passphrase, storedHash);
}

/**
 * Enable E2EE: store passphrase hash, encrypt all existing data.
 */
export async function setupE2EE(passphrase: string): Promise<boolean> {
  try {
    // Pre-cache key first so encrypt calls are fast
    await precomputeSessionKey(passphrase);

    // Store passphrase hash for future verification
    const hash = await hashPassphrase(passphrase);
    await AsyncStorage.setItem(E2EE_PASSPHRASE_HASH_KEY, hash);

    // Encrypt existing notes
    const notesJson = await AsyncStorage.getItem(NOTES_KEY);
    if (notesJson) {
      const encrypted = await encrypt(notesJson, passphrase);
      await AsyncStorage.setItem(NOTES_KEY, encrypted);
    }

    // Encrypt existing passwords
    const passwordsJson = await AsyncStorage.getItem(PASSWORDS_KEY);
    if (passwordsJson) {
      const encrypted = await encrypt(passwordsJson, passphrase);
      await AsyncStorage.setItem(PASSWORDS_KEY, encrypted);
    }

    await AsyncStorage.setItem(E2EE_ENABLED_KEY, 'true');
    _sessionPassphrase = passphrase;
    // Invalidate caches — data format changed
    _notesCache = null;
    _passwordsCache = null;
    return true;
  } catch (error) {
    console.error('Failed to setup E2EE:', error);
    return false;
  }
}

/**
 * Disable E2EE: decrypt all data, remove E2EE keys.
 */
export async function disableE2EE(passphrase: string): Promise<boolean> {
  try {
    // Decrypt notes
    const notesRaw = await AsyncStorage.getItem(NOTES_KEY);
    if (notesRaw && isEncryptedData(notesRaw)) {
      const decrypted = await decrypt(notesRaw, passphrase);
      await AsyncStorage.setItem(NOTES_KEY, decrypted);
    }

    // Decrypt passwords
    const passwordsRaw = await AsyncStorage.getItem(PASSWORDS_KEY);
    if (passwordsRaw && isEncryptedData(passwordsRaw)) {
      const decrypted = await decrypt(passwordsRaw, passphrase);
      await AsyncStorage.setItem(PASSWORDS_KEY, decrypted);
    }

    await AsyncStorage.removeItem(E2EE_ENABLED_KEY);
    await AsyncStorage.removeItem(E2EE_PASSPHRASE_HASH_KEY);
    _sessionPassphrase = null;
    _notesCache = null;
    _passwordsCache = null;
    clearSessionKey();
    return true;
  } catch (error) {
    console.error('Failed to disable E2EE:', error);
    return false;
  }
}

/**
 * Change passphrase: decrypt with old, re-encrypt with new.
 */
export async function changeE2EEPassphrase(
  oldPassphrase: string,
  newPassphrase: string
): Promise<boolean> {
  try {
    // Verify old passphrase
    const valid = await verifyE2EEPassphrase(oldPassphrase);
    if (!valid) return false;

    // Decrypt notes with old passphrase
    const notesRaw = await AsyncStorage.getItem(NOTES_KEY);
    let notesPlain: string | null = null;
    if (notesRaw && isEncryptedData(notesRaw)) {
      notesPlain = await decrypt(notesRaw, oldPassphrase);
    } else {
      notesPlain = notesRaw;
    }

    // Decrypt passwords with old passphrase
    const passwordsRaw = await AsyncStorage.getItem(PASSWORDS_KEY);
    let passwordsPlain: string | null = null;
    if (passwordsRaw && isEncryptedData(passwordsRaw)) {
      passwordsPlain = await decrypt(passwordsRaw, oldPassphrase);
    } else {
      passwordsPlain = passwordsRaw;
    }

    // Re-encrypt with new passphrase
    if (notesPlain) {
      const encrypted = await encrypt(notesPlain, newPassphrase);
      await AsyncStorage.setItem(NOTES_KEY, encrypted);
    }
    if (passwordsPlain) {
      const encrypted = await encrypt(passwordsPlain, newPassphrase);
      await AsyncStorage.setItem(PASSWORDS_KEY, encrypted);
    }

    // Update stored hash
    const newHash = await hashPassphrase(newPassphrase);
    await AsyncStorage.setItem(E2EE_PASSPHRASE_HASH_KEY, newHash);
    _sessionPassphrase = newPassphrase;
    _notesCache = null;
    _passwordsCache = null;
    await precomputeSessionKey(newPassphrase);
    return true;
  } catch (error) {
    console.error('Failed to change passphrase:', error);
    return false;
  }
}

// ─── Internal: load/save with encryption awareness ───────────────────

async function loadRawNotes(): Promise<Note[]> {
  // Return cached notes if available (avoids expensive decryption)
  if (_notesCache !== null) return _notesCache;

  const raw = await AsyncStorage.getItem(NOTES_KEY);
  if (!raw) {
    _notesCache = [];
    return [];
  }

  if (isEncryptedData(raw)) {
    if (!_sessionPassphrase) {
      console.warn('E2EE enabled but no session passphrase — returning empty');
      return [];
    }
    const decrypted = await decrypt(raw, _sessionPassphrase);
    _notesCache = JSON.parse(decrypted);
    return _notesCache!;
  }

  _notesCache = JSON.parse(raw);
  return _notesCache!;
}

async function saveRawNotes(notes: Note[]): Promise<void> {
  // Update in-memory cache immediately (UI gets instant feedback)
  _notesCache = notes;

  const json = JSON.stringify(notes);
  const enabled = await isE2EEEnabled();

  if (enabled) {
    if (!_sessionPassphrase) {
      throw new Error('E2EE is enabled but vault is locked. Please unlock before saving.');
    }
    // Encrypt & persist in background — cache is already updated
    const encrypted = await encrypt(json, _sessionPassphrase);
    await AsyncStorage.setItem(NOTES_KEY, encrypted);
  } else {
    await AsyncStorage.setItem(NOTES_KEY, json);
  }
}

export async function loadRawPasswords(): Promise<SavedPassword[]> {
  // Return cached passwords if available
  if (_passwordsCache !== null) return _passwordsCache;

  const raw = await AsyncStorage.getItem(PASSWORDS_KEY);
  if (!raw) {
    _passwordsCache = [];
    return [];
  }

  if (isEncryptedData(raw)) {
    if (!_sessionPassphrase) {
      console.warn('E2EE enabled but no session passphrase — returning empty');
      return [];
    }
    const decrypted = await decrypt(raw, _sessionPassphrase);
    _passwordsCache = JSON.parse(decrypted);
    return _passwordsCache!;
  }

  _passwordsCache = JSON.parse(raw);
  return _passwordsCache!;
}

async function saveRawPasswords(passwords: SavedPassword[]): Promise<void> {
  // Update in-memory cache immediately
  _passwordsCache = passwords;

  const json = JSON.stringify(passwords);
  const enabled = await isE2EEEnabled();

  if (enabled) {
    if (!_sessionPassphrase) {
      throw new Error('E2EE is enabled but vault is locked. Please unlock before saving.');
    }
    const encrypted = await encrypt(json, _sessionPassphrase);
    await AsyncStorage.setItem(PASSWORDS_KEY, encrypted);
  } else {
    await AsyncStorage.setItem(PASSWORDS_KEY, json);
  }
}

// ─── Notes change listener ───────────────────────────────────────────

let notesChangeCallback: ((notes: Note[]) => void) | null = null;

export function setNotesChangeListener(callback: (notes: Note[]) => void) {
  notesChangeCallback = callback;
}

export function removeNotesChangeListener() {
  notesChangeCallback = null;
}

/**
 * Invalidate in-memory caches to force a fresh re-read from storage.
 */
export function invalidateNotesCache(): void {
  _notesCache = null;
  _passwordsCache = null;
}

/**
 * Completely replace notes and passwords (e.g. from restore or cloud pull).
 * Updates memory cache, persists to storage (with encryption if E2EE is enabled),
 * and immediately notifies all UI listeners with the new notes.
 */
export async function replaceAllNotesAndPasswords(
  notes: Note[],
  passwords: SavedPassword[] = []
): Promise<void> {
  // Update in-memory caches immediately so any synchronous read gets new data
  _notesCache = [...notes];
  _passwordsCache = [...passwords];
  _notesCacheDirty = false;
  _passwordsCacheDirty = false;

  const enabled = await isE2EEEnabled();
  const passphrase = getSessionPassphrase();

  if (enabled && passphrase) {
    const encNotes = await encrypt(JSON.stringify(notes), passphrase);
    const encPasswords = await encrypt(JSON.stringify(passwords), passphrase);
    await Promise.all([
      AsyncStorage.setItem(NOTES_KEY, encNotes),
      AsyncStorage.setItem(PASSWORDS_KEY, encPasswords),
    ]);
  } else {
    await Promise.all([
      AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes)),
      AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords)),
    ]);
  }

  // Notify UI listener immediately
  notesChangeCallback?.(notes.filter(n => !n.archived));
}

/**
 * Reload notes from storage and notify the UI.
 * Used after backup restore to trigger auto-refresh.
 */
export async function notifyNotesChanged(): Promise<void> {
  try {
    _notesCache = null;
    _passwordsCache = null;
    const notes = await loadRawNotes();
    // Filter out archived notes so the home screen only shows active notes
    notesChangeCallback?.(notes.filter(n => !n.archived));
  } catch (error) {
    console.error('Error notifying notes changed:', error);
  }
}

// ─── Public CRUD (unchanged API, now E2EE-aware internally) ──────────

export async function saveNote(note: Note) {
  try {
    const existingNotes = await loadRawNotes();
    const updatedNotes = [note, ...existingNotes];
    await saveRawNotes(updatedNotes);
    console.log('Note saved successfully:', note);
    notesChangeCallback?.(updatedNotes.filter(n => !n.archived));
    return true;
  } catch (error) {
    console.error('Error saving note:', error);
    return false;
  }
}

export async function loadNotes(): Promise<Note[]> {
  try {
    const notes = await loadRawNotes();
    // Filter out archived notes from the main view
    const activeNotes = notes.filter(n => !n.archived);
    console.log('Notes loaded:', activeNotes.length);
    return activeNotes;
  } catch (error) {
    console.error('Error loading notes:', error);
    return [];
  }
}

/**
 * Load ALL notes including archived ones.
 * Used by detail screens that need to find a note by ID regardless of archive status.
 */
export async function loadAllNotes(): Promise<Note[]> {
  try {
    const notes = await loadRawNotes();
    return notes;
  } catch (error) {
    console.error('Error loading all notes:', error);
    return [];
  }
}

export async function deleteNote(id: string): Promise<boolean> {
  return deleteNotes([id]);
}

export async function deleteNotes(ids: string[]): Promise<boolean> {
  try {
    if (ids.length === 0) return true;
    const notes = await loadRawNotes();
    const updatedNotes = notes.filter(note => !ids.includes(note.id));
    await saveRawNotes(updatedNotes);
    // Remove linked note passwords from the password manager
    const passwords = await loadRawPasswords();
    if (passwords.length > 0) {
      const filteredPasswords = passwords.filter(p => !p.noteId || !ids.includes(p.noteId));
      await saveRawPasswords(filteredPasswords);
    }
    console.log('Notes deleted:', ids);
    notesChangeCallback?.(updatedNotes.filter(n => !n.archived));
    return true;
  } catch (error) {
    console.error('Error deleting notes:', error);
    return false;
  }
}

export async function updateNote(updatedNote: Note): Promise<boolean> {
  try {
    const notes = await loadRawNotes();
    const updatedNotes = notes.map(note =>
      note.id === updatedNote.id ? updatedNote : note
    );
    await saveRawNotes(updatedNotes);
    console.log('Note updated:', updatedNote.id);
    notesChangeCallback?.(updatedNotes.filter(n => !n.archived));
    return true;
  } catch (error) {
    console.error('Error updating note:', error);
    return false;
  }
}

export async function togglePinNote(id: string): Promise<boolean> {
  return togglePinNotes([id]);
}

export async function togglePinNotes(ids: string[]): Promise<boolean> {
  try {
    if (ids.length === 0) return true;
    const notes = await loadRawNotes();
    const allPinned = ids.every(id => notes.find(n => n.id === id)?.pinned);
    const updatedNotes = notes.map(note =>
      ids.includes(note.id) ? { ...note, pinned: !allPinned } : note
    );
    await saveRawNotes(updatedNotes);
    notesChangeCallback?.(updatedNotes.filter(n => !n.archived));
    return true;
  } catch (error) {
    console.error('Error toggling pin:', error);
    return false;
  }
}

// ─── Archive helpers ─────────────────────────────────────────────────

export async function archiveNotes(ids: string[]): Promise<boolean> {
  try {
    if (ids.length === 0) return true;
    const notes = await loadRawNotes();
    const updatedNotes = notes.map(note =>
      ids.includes(note.id)
        ? { ...note, archived: true, pinned: false, lastModified: new Date().toISOString() }
        : note
    );
    await saveRawNotes(updatedNotes);
    console.log('Notes archived:', ids);
    // Notify with only active notes
    notesChangeCallback?.(updatedNotes.filter(n => !n.archived));
    return true;
  } catch (error) {
    console.error('Error archiving notes:', error);
    return false;
  }
}

export async function unarchiveNotes(ids: string[]): Promise<boolean> {
  try {
    if (ids.length === 0) return true;
    const notes = await loadRawNotes();
    const updatedNotes = notes.map(note =>
      ids.includes(note.id)
        ? { ...note, archived: false, lastModified: new Date().toISOString() }
        : note
    );
    await saveRawNotes(updatedNotes);
    console.log('Notes unarchived:', ids);
    notesChangeCallback?.(updatedNotes.filter(n => !n.archived));
    return true;
  } catch (error) {
    console.error('Error unarchiving notes:', error);
    return false;
  }
}

export async function loadArchivedNotes(): Promise<Note[]> {
  try {
    const notes = await loadRawNotes();
    const archived = notes.filter(n => n.archived === true);
    console.log('Archived notes loaded:', archived.length);
    return archived;
  } catch (error) {
    console.error('Error loading archived notes:', error);
    return [];
  }
}

export async function savePasswordToManager(title: string, password: string) {
  try {
    let passwords = await loadRawPasswords();

    const newPassword: SavedPassword = {
      id: Date.now().toString(),
      title,
      password,
      date: new Date().toLocaleDateString(),
    };

    passwords = [newPassword, ...passwords];
    await saveRawPasswords(passwords);
    return true;
  } catch (error) {
    console.error('Error saving password:', error);
    return false;
  }
}

export async function upsertNotePasswordInManager(
  noteId: string,
  noteTitle: string,
  password: string
): Promise<void> {
  try {
    let passwords = await loadRawPasswords();
    const existing = passwords.findIndex(p => p.noteId === noteId);
    if (existing !== -1) {
      passwords[existing] = {
        ...passwords[existing],
        title: noteTitle,
        password,
        date: new Date().toLocaleDateString(),
      };
    } else {
      passwords = [
        { id: Date.now().toString(), title: noteTitle, password, date: new Date().toLocaleDateString(), noteId, category: 'Note' },
        ...passwords,
      ];
    }
    await saveRawPasswords(passwords);
  } catch (error) {
    console.error('Error upserting note password:', error);
  }
}

export async function deleteNotePasswordFromManager(noteId: string): Promise<void> {
  try {
    const passwords = await loadRawPasswords();
    if (passwords.length === 0) return;
    const filtered = passwords.filter(p => p.noteId !== noteId);
    await saveRawPasswords(filtered);
  } catch (error) {
    console.error('Error deleting note password:', error);
  }
}
