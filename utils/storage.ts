import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTES_KEY = '@notes_v1';
const PASSWORDS_KEY = 'saved_passwords';

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

let notesChangeCallback: ((notes: Note[]) => void) | null = null;

export function setNotesChangeListener(callback: (notes: Note[]) => void) {
  notesChangeCallback = callback;
}

export function removeNotesChangeListener() {
  notesChangeCallback = null;
}

export async function saveNote(note: Note) {
  try {
    const existingNotes = await loadNotes();
    const updatedNotes = [note, ...existingNotes];
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(updatedNotes));
    console.log('Note saved successfully:', note);
    notesChangeCallback?.(updatedNotes);
    return true;
  } catch (error) {
    console.error('Error saving note:', error);
    return false;
  }
}

export async function loadNotes(): Promise<Note[]> {
  try {
    const notesJson = await AsyncStorage.getItem(NOTES_KEY);
    const notes = notesJson ? JSON.parse(notesJson) : [];
    console.log('Notes loaded:', notes.length);
    return notes;
  } catch (error) {
    console.error('Error loading notes:', error);
    return [];
  }
}

export async function deleteNote(id: string): Promise<boolean> {
  return deleteNotes([id]);
}

export async function deleteNotes(ids: string[]): Promise<boolean> {
  try {
    if (ids.length === 0) return true;
    const notes = await loadNotes();
    const updatedNotes = notes.filter(note => !ids.includes(note.id));
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(updatedNotes));
    // Remove linked note passwords from the password manager
    const savedPasswords = await AsyncStorage.getItem(PASSWORDS_KEY);
    if (savedPasswords) {
      const passwords: SavedPassword[] = JSON.parse(savedPasswords);
      const filteredPasswords = passwords.filter(p => !p.noteId || !ids.includes(p.noteId));
      await AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(filteredPasswords));
    }
    console.log('Notes deleted:', ids);
    notesChangeCallback?.(updatedNotes);
    return true;
  } catch (error) {
    console.error('Error deleting notes:', error);
    return false;
  }
}

export async function updateNote(updatedNote: Note): Promise<boolean> {
  try {
    const notes = await loadNotes();
    const updatedNotes = notes.map(note =>
      note.id === updatedNote.id ? updatedNote : note
    );
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(updatedNotes));
    console.log('Note updated:', updatedNote.id);
    notesChangeCallback?.(updatedNotes);
    return true;
  } catch (error) {
    console.error('Error updating note:', error);
    return false;
  }
}

export async function togglePinNote(id: string): Promise<boolean> {
  try {
    const notes = await loadNotes();
    const updatedNotes = notes.map(note =>
      note.id === id ? { ...note, pinned: !note.pinned } : note
    );
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(updatedNotes));
    notesChangeCallback?.(updatedNotes);
    return true;
  } catch (error) {
    console.error('Error toggling pin:', error);
    return false;
  }
}

export async function savePasswordToManager(title: string, password: string) {
  try {
    const savedPasswords = await AsyncStorage.getItem(PASSWORDS_KEY);
    let passwords: SavedPassword[] = savedPasswords ? JSON.parse(savedPasswords) : [];

    const newPassword: SavedPassword = {
      id: Date.now().toString(),
      title,
      password,
      date: new Date().toLocaleDateString(),
    };

    passwords = [newPassword, ...passwords];
    await AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));
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
    const savedPasswords = await AsyncStorage.getItem(PASSWORDS_KEY);
    let passwords: SavedPassword[] = savedPasswords ? JSON.parse(savedPasswords) : [];
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
    await AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));
  } catch (error) {
    console.error('Error upserting note password:', error);
  }
}

export async function deleteNotePasswordFromManager(noteId: string): Promise<void> {
  try {
    const savedPasswords = await AsyncStorage.getItem(PASSWORDS_KEY);
    if (!savedPasswords) return;
    const passwords: SavedPassword[] = JSON.parse(savedPasswords);
    const filtered = passwords.filter(p => p.noteId !== noteId);
    await AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting note password:', error);
  }
}

