import { CustomAlert as Alert } from '../components/CustomAlert';
import { File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { encrypt, decrypt, encryptObject, decryptObject, isEncryptedData } from './encryption';
import { getSessionPassphrase, isE2EEEnabled, notifyNotesChanged } from './storage';

const NOTES_KEY = '@notes_v1';
const PASSWORDS_KEY = 'saved_passwords';

interface BackupData {
  notes: any[];
  passwords: any[];
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
    const [notesJson, passwordsJson] = await Promise.all([
      AsyncStorage.getItem(NOTES_KEY),
      AsyncStorage.getItem(PASSWORDS_KEY),
    ]);

    const passphrase = getSessionPassphrase();
    const e2eeActive = await isE2EEEnabled();

    // Decrypt raw data if currently encrypted (for building backup)
    let notesArray: any[] = [];
    let passwordsArray: any[] = [];

    if (notesJson) {
      if (isEncryptedData(notesJson) && passphrase) {
        const decrypted = await decrypt(notesJson, passphrase);
        notesArray = JSON.parse(decrypted);
      } else if (!isEncryptedData(notesJson)) {
        notesArray = JSON.parse(notesJson);
      }
    }

    if (passwordsJson) {
      if (isEncryptedData(passwordsJson) && passphrase) {
        const decrypted = await decrypt(passwordsJson, passphrase);
        passwordsArray = JSON.parse(decrypted);
      } else if (!isEncryptedData(passwordsJson)) {
        passwordsArray = JSON.parse(passwordsJson);
      }
    }

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
 * Restore from a backup file. Auto-detects encrypted backups.
 * @param passphrase  Optional passphrase to decrypt an encrypted backup.
 *                    If the backup is encrypted and no passphrase is provided,
 *                    the session passphrase is used.
 */
export async function restoreFromBackup(passphrase?: string) {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
    });

    if (result.canceled) return false;

    const fileContent = await new File(result.assets[0].uri).text();
    const backupData: BackupData = JSON.parse(fileContent);

    if (!backupData.version || !backupData.timestamp) {
      throw new Error('Invalid backup file format');
    }

    let notesArray: any[];
    let passwordsArray: any[];

    if (backupData.encrypted && backupData.encryptedNotes && backupData.encryptedPasswords) {
      // Encrypted backup — need a passphrase to decrypt
      const pw = passphrase || getSessionPassphrase();
      if (!pw) {
        Alert.alert('Passphrase Required', 'This backup is encrypted. Please enter your E2EE passphrase to restore it.');
        return 'needs_passphrase';
      }

      try {
        notesArray = await decryptObject<any[]>(backupData.encryptedNotes, pw);
        passwordsArray = await decryptObject<any[]>(backupData.encryptedPasswords, pw);
      } catch {
        Alert.alert('Decryption Failed', 'Wrong passphrase or corrupted backup.');
        return false;
      }
    } else {
      // Plaintext backup
      if (!Array.isArray(backupData.notes) || !Array.isArray(backupData.passwords)) {
        throw new Error('Invalid backup file format');
      }
      notesArray = backupData.notes;
      passwordsArray = backupData.passwords;
    }

    // Save — if E2EE is currently enabled, re-encrypt the imported data
    const e2eeActive = await isE2EEEnabled();
    const sessionPw = getSessionPassphrase();

    if (e2eeActive && sessionPw) {
      const encNotes = await encrypt(JSON.stringify(notesArray), sessionPw);
      const encPasswords = await encrypt(JSON.stringify(passwordsArray), sessionPw);
      await Promise.all([
        AsyncStorage.setItem(NOTES_KEY, encNotes),
        AsyncStorage.setItem(PASSWORDS_KEY, encPasswords),
      ]);
    } else {
      await Promise.all([
        AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notesArray)),
        AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwordsArray)),
      ]);
    }

    Alert.alert('Success', 'Backup restored successfully');
    // Auto-refresh the notes list in the UI
    await notifyNotesChanged();
    return true;
  } catch (error) {
    console.error('Restore failed:', error);
    Alert.alert('Error', 'Failed to restore backup');
    return false;
  }
}