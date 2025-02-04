import { Note } from './storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function exportSelectedNotesToFile(notes: Note[]) {
  const notesJson = JSON.stringify(notes, null, 2);
  const path = `${FileSystem.documentDirectory}notes_export.json`;
  
  await FileSystem.writeAsStringAsync(path, notesJson);
  await Sharing.shareAsync(path);
}

export const exportNotesToFile = exportSelectedNotesToFile;