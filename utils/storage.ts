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

interface SavedPassword {
  id: string;
  title: string;
  password: string;
  date: string;
  noteId?: string;
  category?: string;
}

// ─── Session key (in-memory only — never persisted) ──────────────────
let _sessionPassphrase: string | null = null;

export async function setSessionPassphrase(passphrase: string) {
  _sessionPassphrase = passphrase;
  // Pre-derive and cache the encryption key so all
  // subsequent encrypt/decrypt calls are instant
  await precomputeSessionKey(passphrase);
}

export function getSessionPassphrase(): string | null {
  return _sessionPassphrase;
}

export function clearSessionPassphrase() {
  _sessionPassphrase = null;
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
    await precomputeSessionKey(newPassphrase);
    return true;
  } catch (error) {
    console.error('Failed to change passphrase:', error);
    return false;
  }
}

// ─── Internal: load/save with encryption awareness ───────────────────

async function loadRawNotes(): Promise<Note[]> {
  const raw = await AsyncStorage.getItem(NOTES_KEY);
  if (!raw) return [];

  if (isEncryptedData(raw)) {
    if (!_sessionPassphrase) {
      console.warn('E2EE enabled but no session passphrase — returning empty');
      return [];
    }
    const decrypted = await decrypt(raw, _sessionPassphrase);
    return JSON.parse(decrypted);
  }

  return JSON.parse(raw);
}

async function saveRawNotes(notes: Note[]): Promise<void> {
  const json = JSON.stringify(notes);
  const enabled = await isE2EEEnabled();

  if (enabled && _sessionPassphrase) {
    const encrypted = await encrypt(json, _sessionPassphrase);
    await AsyncStorage.setItem(NOTES_KEY, encrypted);
  } else {
    await AsyncStorage.setItem(NOTES_KEY, json);
  }
}

async function loadRawPasswords(): Promise<SavedPassword[]> {
  const raw = await AsyncStorage.getItem(PASSWORDS_KEY);
  if (!raw) return [];

  if (isEncryptedData(raw)) {
    if (!_sessionPassphrase) {
      console.warn('E2EE enabled but no session passphrase — returning empty');
      return [];
    }
    const decrypted = await decrypt(raw, _sessionPassphrase);
    return JSON.parse(decrypted);
  }

  return JSON.parse(raw);
}

async function saveRawPasswords(passwords: SavedPassword[]): Promise<void> {
  const json = JSON.stringify(passwords);
  const enabled = await isE2EEEnabled();

  if (enabled && _sessionPassphrase) {
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
 * Reload notes from storage and notify the UI.
 * Used after backup restore to trigger auto-refresh.
 */
export async function notifyNotesChanged(): Promise<void> {
  try {
    const notes = await loadRawNotes();
    notesChangeCallback?.(notes);
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
  try {
    const notes = await loadRawNotes();
    const updatedNotes = notes.map(note =>
      note.id === id ? { ...note, pinned: !note.pinned } : note
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
