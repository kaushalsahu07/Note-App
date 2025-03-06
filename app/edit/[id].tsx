import { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { loadNotes, updateNote, Note } from '../../utils/storage';

const COLORS = ['#ffb3ba', '#baffc9', '#bae1ff', '#ffffba', '#e6baff'];

export default function EditNoteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [originalNote, setOriginalNote] = useState<Note | null>(null);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');

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
        setTitle(note.title);
        setContent(note.content);
        setSelectedColor(note.color);
        setIsPasswordProtected(!!note.isPasswordProtected);
        setPassword(note.password || '');
        setOriginalNote(note);
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

    if (isPasswordProtected && !password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    setIsSaving(true);

    try {
      const updatedNote = {
        ...originalNote!,
        title: title.trim(),
        content: content.trim(),
        lastModified: new Date().toISOString(),
        color: selectedColor,
        isPasswordProtected,
        password: isPasswordProtected ? password.trim() : undefined
      };

      const success = await updateNote(updatedNote);
      if (success) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to update note');
      }
    } catch (error) {
      console.error('Error updating note:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (
      title !== originalNote?.title ||
      content !== originalNote?.content ||
      selectedColor !== originalNote?.color
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.cancelButton}>Cancel</Text>
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

      <View style={styles.colorPicker}>
        {COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              selectedColor === color && styles.selectedColor,
            ]}
            onPress={() => setSelectedColor(color)}
          />
        ))}
      </View>
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
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  cancelButton: {
    color: '#007AFF',
    fontSize: 17,
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
  colorPicker: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2c2c2e',
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  selectedColor: {
    borderWidth: 2,
    borderColor: '#fff',
  },
}); 