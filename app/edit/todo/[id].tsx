import { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { loadNotes, updateNote, Note, TodoItem } from '../../../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import TodoList from '../../../components/TodoList';

export default function EditTodoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [tasks, setTasks] = useState<TodoItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [originalNote, setOriginalNote] = useState<Note | null>(null);

  useEffect(() => {
    if (id) {
      loadTodoData();
    }
  }, [id]);

  const loadTodoData = async () => {
    try {
      const notes = await loadNotes();
      const todo = notes.find(n => n.id === id);
      if (todo && 'tasks' in todo) {
        setTitle(todo.title);
        setTasks(todo.tasks || []);
        setOriginalNote(todo);
      } else {
        Alert.alert('Error', 'Todo not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading todo:', error);
      Alert.alert('Error', 'Failed to load todo');
      router.back();
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (tasks.length === 0) {
      Alert.alert('Error', 'Please add at least one task');
      return;
    }

    setIsSaving(true);

    try {
      const updatedTodo = {
        ...originalNote!,
        title: title.trim(),
        tasks,
        lastModified: new Date().toISOString(),
      };

      const success = await updateNote(updatedTodo);
      if (success) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to update todo');
      }
    } catch (error) {
      console.error('Error updating todo:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (
      title !== originalNote?.title ||
      JSON.stringify(tasks) !== JSON.stringify(originalNote?.tasks)
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
            onPress={handleSave}
            disabled={isSaving || !title.trim() || tasks.length === 0}
          >
            <Text style={[
              styles.saveButton,
              (isSaving || !title.trim() || tasks.length === 0) && styles.saveButtonDisabled
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
        placeholder="Todo List Title"
        placeholderTextColor="#666"
        maxLength={100}
      />

      <TodoList
        tasks={tasks}
        onTasksChange={setTasks}
        editable={true}
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
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
});