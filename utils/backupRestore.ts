import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
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
    // Fetch all data from AsyncStorage
    const [notesJson, passwordsJson] = await Promise.all([
      AsyncStorage.getItem(NOTES_KEY),
      AsyncStorage.getItem(PASSWORDS_KEY)
    ]);

    const backupData: BackupData = {
      notes: notesJson ? JSON.parse(notesJson) : [],
      passwords: passwordsJson ? JSON.parse(passwordsJson) : [],
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    const backupString = JSON.stringify(backupData, null, 2);
    const fileUri = `${FileSystem.documentDirectory}${BACKUP_FILENAME}`;

    await FileSystem.writeAsStringAsync(fileUri, backupString);
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Save your backup file'
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
      type: 'application/json'
    });

    if (result.canceled) {
      return false;
    }

    const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
    const backupData: BackupData = JSON.parse(fileContent);

    // Validate backup data structure
    if (!backupData.version || !backupData.timestamp || 
        !Array.isArray(backupData.notes) || !Array.isArray(backupData.passwords)) {
      throw new Error('Invalid backup file format');
    }

    // Restore data to AsyncStorage
    await Promise.all([
      AsyncStorage.setItem(NOTES_KEY, JSON.stringify(backupData.notes)),
      AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(backupData.passwords))
    ]);

    Alert.alert('Success', 'Backup restored successfully');
    return true;
  } catch (error) {
    console.error('Restore failed:', error);
    Alert.alert('Error', 'Failed to restore backup');
    return false;
  }
}