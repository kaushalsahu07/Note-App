import { CustomAlert as Alert } from '../components/CustomAlert';
import { File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const NOTES_KEY = '@notes_v1';
const PASSWORDS_KEY = 'saved_passwords';
const BACKUP_FILENAME = 'notes_app_backup.json';

interface BackupData {
  notes: any[];
  passwords: any[];
  timestamp: string;
  version: string;
}

export async function createBackup() {
  try {
    const [notesJson, passwordsJson] = await Promise.all([
      AsyncStorage.getItem(NOTES_KEY),
      AsyncStorage.getItem(PASSWORDS_KEY),
    ]);

    const backupData: BackupData = {
      notes: notesJson ? JSON.parse(notesJson) : [],
      passwords: passwordsJson ? JSON.parse(passwordsJson) : [],
      timestamp: new Date().toISOString(),
      version: '1.0',
    };

    const file = new File(Paths.document, BACKUP_FILENAME);
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

export async function restoreFromBackup() {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
    });

    if (result.canceled) return false;

    const fileContent = await new File(result.assets[0].uri).text();
    const backupData: BackupData = JSON.parse(fileContent);

    if (
      !backupData.version || !backupData.timestamp ||
      !Array.isArray(backupData.notes) || !Array.isArray(backupData.passwords)
    ) {
      throw new Error('Invalid backup file format');
    }

    await Promise.all([
      AsyncStorage.setItem(NOTES_KEY, JSON.stringify(backupData.notes)),
      AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(backupData.passwords)),
    ]);

    Alert.alert('Success', 'Backup restored successfully');
    return true;
  } catch (error) {
    console.error('Restore failed:', error);
    Alert.alert('Error', 'Failed to restore backup');
    return false;
  }
}