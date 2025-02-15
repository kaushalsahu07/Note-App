import React from 'react';
import { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { loadNotes, updateNote, Note } from '../../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { exportNotesToFile } from '../../utils/exportNotes';
import AccessPasswordDialog from '../../components/AccessPasswordDialog';

export default function EditNoteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [originalNote, setOriginalNote] = useState<Note | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (id) {
      loadNoteData();
    }
  }, [id]);

  const loadNoteData = async () => {
    try {
      const notes = await loadNotes();
      const note = notes.find(n => n.id === id);
      if (note) {
        if (note.isPasswordProtected) {
          setIsLocked(true);
          setShowPasswordDialog(true);
          setOriginalNote(note);
        } else {
          setTitle(note.title);
          setContent(note.content);
          setOriginalNote(note);
        }
      } else {
        Alert.alert('Error', 'Note not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading note:', error);
      Alert.alert('Error', 'Failed to load note');
      router.back();
    }
  };

  const handleVerifyPassword = (password: string) => {
    if (originalNote?.password === password) {
      setIsLocked(false);
      setShowPasswordDialog(false);
      setTitle(originalNote.title);
      setContent(originalNote.content);
    } else {
      Alert.alert('Error', 'Incorrect password');
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!content.trim()) {
      Alert.alert('Error', 'Please enter some content');
      return;
    }

    setIsSaving(true);

    try {
      if (!originalNote) {
        throw new Error('Original note not found');
      }

      const updatedNoteData: Note = {
        ...originalNote,
        title: title.trim(),
        content: content.trim(),
        lastModified: new Date().toISOString(),
      };

      const success = await updateNote(updatedNoteData);
      if (success) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to save changes');
      }
    } catch (error) {
      console.error('Error updating note:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportNotesToFile([originalNote!]);
      Alert.alert('Success', 'Note exported successfully');
    } catch (error) {
      console.error('Error exporting notes:', error);
      Alert.alert('Error', 'Failed to export notes');
    }
  };

  const handleCancel = () => {
    if (
      title !== originalNote?.title ||
      content !== originalNote?.content
    ) {
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard your changes?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  if (isLocked) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Protected Note</Text>
        </View>

        <View style={styles.lockedContent}>
          <Ionicons name="lock-closed" size={48} color="#666" />
          <Text style={styles.lockedText}>This note is password protected</Text>
        </View>

        <AccessPasswordDialog
          visible={showPasswordDialog}
          onClose={() => {
            setShowPasswordDialog(false);
            router.back();
          }}
          onVerifyPassword={handleVerifyPassword}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            onPress={handleCancel}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
            <Text style={styles.cancelButton}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={handleExport}
            style={styles.exportButton}
          >
            <Ionicons name="share-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleSave}
            disabled={isSaving || !title.trim() || !content.trim()}
          >
            <Text style={[
              styles.saveButton,
              (isSaving || !title.trim() || !content.trim()) && styles.saveButtonDisabled
            ]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor="#666"
        maxLength={100}
      />

      <TextInput
        style={styles.contentInput}
        value={content}
        onChangeText={setContent}
        placeholder="Type something..."
        placeholderTextColor="#666"
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    color: '#007AFF',
    fontSize: 17,
  },
  exportButton: {
    marginRight: 8,
  },
  saveButton: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    padding: 16,
    paddingTop: 20,
  },
  contentInput: {
    flex: 1,
    fontSize: 17,
    color: '#fff',
    padding: 16,
    textAlignVertical: 'top',
  },
  lockedContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  lockedText: {
    color: '#666',
    fontSize: 16,
  },
});