import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { saveNote } from '../../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import TodoList from '../../components/TodoList';

const COLORS = ['#ffb3ba', '#baffc9', '#bae1ff', '#ffffba', '#e6baff'];

export default function NewTodoScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [tasks, setTasks] = useState([]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);

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
      const newTodoList = {
        id: Date.now().toString(),
        title: title.trim(),
        content: '',
        tasks: tasks,
        date: new Date().toLocaleDateString(),
        lastModified: new Date().toISOString(),
        color: selectedColor,
        type: 'todo'
      };

      const success = await saveNote(newTodoList);
      if (success) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to save to-do list');
      }
    } catch (error) {
      console.error('Error saving to-do list:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (title.trim() || tasks.length > 0) {
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
            onPress={handleBack}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
            <Text style={styles.backButtonText}>Back</Text>
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
              Save List
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={setTitle}
        placeholder="List Title"
        placeholderTextColor="#666"
        maxLength={100}
      />

      <TodoList
        tasks={tasks}
        onTasksChange={setTasks}
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
  backButtonText: {
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
  colorPicker: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2c2c2e',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c1e',
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  selectedColor: {
    borderWidth: 2,
    borderColor: '#fff',
  }
});