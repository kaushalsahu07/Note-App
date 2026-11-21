import { CustomAlert as Alert } from '../components/CustomAlert';
import { File, Paths } from 'expo-file-system';
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { encryptObject, decryptObject } from './encryption';
import {
  getSessionPassphrase,
  isE2EEEnabled,
  loadAllNotes,
  loadRawPasswords,
  replaceAllNotesAndPasswords,
  Note,
  SavedPassword,
} from './storage';

interface BackupData {
  notes: Note[];
  passwords: SavedPassword[];
  timestamp: string;
  version: string;
  encrypted?: boolean;
  encryptedNotes?: string;
  encryptedPasswords?: string;
}

/**
 * Create a backup file with option to export encrypted or plaintext.
 * @param asEncrypted If true, the backup data itself is encrypted.
 */
export async function createBackup(asEncrypted: boolean = false) {
  try {
    const passphrase = getSessionPassphrase();
    const e2eeActive = await isE2EEEnabled();

    if (e2eeActive && !passphrase) {
      Alert.alert('Vault Locked', 'Please unlock your vault before creating a backup.');
      return false;
    }

    const notesArray = await loadAllNotes();
    const passwordsArray = await loadRawPasswords();

    let backupData: BackupData;

    if (asEncrypted && passphrase) {
      // Export with encryption: encrypt the arrays
      const encNotes = await encryptObject(notesArray, passphrase);
      const encPasswords = await encryptObject(passwordsArray, passphrase);
      backupData = {
        notes: [],
        passwords: [],
        encrypted: true,
        encryptedNotes: encNotes,
        encryptedPasswords: encPasswords,
        timestamp: new Date().toISOString(),
        version: '1.0',
      };
    } else {
      // Export as plaintext
      backupData = {
        notes: notesArray,
        passwords: passwordsArray,
        timestamp: new Date().toISOString(),
        version: '1.0',
      };
    }

    const filename = asEncrypted ? 'notes_app_backup_encrypted.json' : 'notes_app_backup.json';
    const file = new File(Paths.document, filename);
    file.write(JSON.stringify(backupData, null, 2));

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Save your backup file',
      });
      return true;
    } else {
      Alert.alert('Error', 'Sharing is not available on this device');
      return false;
    }
  } catch (error) {
    console.error('Backup creation failed:', error);
    Alert.alert('Error', 'Failed to create backup');
    return false;
  }
}

/**
 * Safely read text from a picked file URI across all platforms (Android, iOS, Web).
 * Handles content://, file://, and sandbox restrictions.
 */
async function readPickedFileText(uri: string): Promise<string> {
  // 1. If it's a local file:// URI (produced by copyToCacheDirectory: true),
  // Expo SDK 58's new File API reads it directly and cleanly
  if (uri.startsWith('file://')) {
    try {
      return await new File(uri).text();
    } catch (fileErr) {
      console.warn('File.text() failed for file:// URI, trying fetch fallback:', fileErr);
    }
  }

  // 2. Fetch API handles content:// and file:// in React Native
  try {
    const response = await fetch(uri);
    return await response.text();
  } catch (fetchErr) {
    console.warn('fetch fallback failed, trying readAsStringAsync:', fetchErr);
  }

  // 3. Try legacy readAsStringAsync for content:// via Android ContentResolver
  try {
    return await readAsStringAsync(uri);
  } catch (legacyErr) {
    console.warn('readAsStringAsync fallback failed:', legacyErr);
  }

  // 4. Final attempt with File API
  return await new File(uri).text();
}

/**
 * Restore from a backup file. Supports:
 * - Full backup format { notes: [...], passwords: [...] }
 * - Direct note array format [ { id, title, content, ... } ]
 * - Encrypted backup format { encrypted: true, encryptedNotes: "...", ... }
 * - Encrypted export format { encrypted: true, data: "..." }
 *
 * @param passphrase Optional passphrase to decrypt an encrypted backup.
 */
export async function restoreFromBackup(passphrase?: string) {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return false;

    const fileContent = await readPickedFileText(result.assets[0].uri);
    let parsed: any;
    try {
      parsed = JSON.parse(fileContent);
    } catch {
      throw new Error('Selected file is not valid JSON.');
    }

    let notesArray: Note[] = [];
    let passwordsArray: SavedPassword[] = [];

    // Format 1: Direct array of notes [ { id, title, ... } ]
    if (Array.isArray(parsed)) {
      notesArray = parsed;
      passwordsArray = [];
    }
    // Format 2: Encrypted export format { encrypted: true, data: "..." }
    else if (parsed.encrypted && typeof parsed.data === 'string') {
      const pw = passphrase || getSessionPassphrase();
      if (!pw) {
        Alert.alert('Passphrase Required', 'This export is encrypted. Please enter your E2EE passphrase.');
        return 'needs_passphrase';
      }
      try {
        notesArray = await decryptObject<Note[]>(parsed.data, pw);
      } catch {
        Alert.alert('Decryption Failed', 'Wrong passphrase or corrupted backup.');
        return false;
      }
    }
    // Format 3: Encrypted full backup { encrypted: true, encryptedNotes: "...", ... }
    else if (parsed.encrypted && parsed.encryptedNotes) {
      const pw = passphrase || getSessionPassphrase();
      if (!pw) {
        Alert.alert('Passphrase Required', 'This backup is encrypted. Please enter your E2EE passphrase to restore it.');
        return 'needs_passphrase';
      }
      try {
        notesArray = await decryptObject<Note[]>(parsed.encryptedNotes, pw);
        if (parsed.encryptedPasswords) {
          passwordsArray = await decryptObject<SavedPassword[]>(parsed.encryptedPasswords, pw);
        }
      } catch {
        Alert.alert('Decryption Failed', 'Wrong passphrase or corrupted backup.');
        return false;
      }
    }
    // Format 4: Standard full backup { notes: [...], passwords: [...] }
    else if (parsed.notes && Array.isArray(parsed.notes)) {
      notesArray = parsed.notes;
      passwordsArray = Array.isArray(parsed.passwords) ? parsed.passwords : [];
    }
    else {
      throw new Error('Unrecognized backup format.');
    }

    // Persist to storage, update in-memory cache, and notify UI immediately
    await replaceAllNotesAndPasswords(notesArray, passwordsArray);

    Alert.alert('Success', `Backup restored successfully (${notesArray.length} note${notesArray.length === 1 ? '' : 's'})`);
    return true;
  } catch (error: any) {
    console.error('Restore failed:', error);
    Alert.alert('Error', error?.message || 'Failed to restore backup');
    return false;
  }
}
