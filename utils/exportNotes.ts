import { Note, getSessionPassphrase } from './storage';
import { encryptObject } from './encryption';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface EncryptedExport {
  encrypted: true;
  version: '1.0';
  data: string; // encrypted JSON string
  timestamp: string;
}

/**
 * Export selected notes to a file.
 * @param notes     The notes to export (already decrypted in memory)
 * @param asEncrypted  If true, export in encrypted form (requires session passphrase)
 */
export async function exportSelectedNotesToFile(notes: Note[], asEncrypted: boolean = false) {
  let content: string;
  let filename: string;

  if (asEncrypted) {
    const passphrase = getSessionPassphrase();
    if (!passphrase) {
      throw new Error('No session passphrase available for encrypted export');
    }
    const encryptedData = await encryptObject(notes, passphrase);
    const exportObj: EncryptedExport = {
      encrypted: true,
      version: '1.0',
      data: encryptedData,
      timestamp: new Date().toISOString(),
    };
    content = JSON.stringify(exportObj, null, 2);
    filename = 'notes_export_encrypted.json';
  } else {
    content = JSON.stringify(notes, null, 2);
    filename = 'notes_export.json';
  }

  const path = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, content);
  await Sharing.shareAsync(path);
}

export const exportNotesToFile = exportSelectedNotesToFile;