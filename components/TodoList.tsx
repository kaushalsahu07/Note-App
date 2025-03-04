import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TodoItem } from '../utils/storage';

interface TodoListProps {
  tasks: TodoItem[];
  onTasksChange: (tasks: TodoItem[]) => void;
}

export default function TodoList({ tasks, onTasksChange }: TodoListProps) {
  const [newTaskText, setNewTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const addTask = () => {
    if (!newTaskText.trim()) return;

    const newTask: TodoItem = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      completed: false
    };

    onTasksChange([...tasks, newTask]);
    setNewTaskText('');
  };

  const toggleTask = (taskId: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    onTasksChange(updatedTasks);
  };

  const deleteTask = (taskId: string) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    onTasksChange(updatedTasks);
  };

  const startEditing = (taskId: string, taskText: string) => {
    setEditingTaskId(taskId);
    setEditingText(taskText);
  };

  const saveEdit = () => {
    if (!editingTaskId || !editingText.trim()) return;

    const updatedTasks = tasks.map(task =>
      task.id === editingTaskId ? { ...task, text: editingText.trim() } : task
    );
    onTasksChange(updatedTasks);
    setEditingTaskId(null);
    setEditingText('');
  };

  const renderItem = ({ item }: { item: TodoItem }) => (
    <View style={styles.taskItem}>
      <TouchableOpacity 
        style={[styles.checkbox, item.completed && styles.checkboxChecked]} 
        onPress={() => toggleTask(item.id)}
      >
        {item.completed && (
          <Ionicons name="checkmark" size={16} color="#fff" />
        )}
      </TouchableOpacity>
      {editingTaskId === item.id ? (
        <TextInput
          style={[styles.taskText, styles.editInput]}
          value={editingText}
          onChangeText={setEditingText}
          onBlur={saveEdit}
          onSubmitEditing={saveEdit}
          autoFocus
          returnKeyType="done"
        />
      ) : (
        <TouchableOpacity 
          onPress={() => startEditing(item.id, item.text)}
          style={styles.taskTextContainer}
        >
          <Text style={[styles.taskText, item.completed && styles.completedTask]}>
            {item.text}
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity 
        onPress={() => deleteTask(item.id)}
        style={styles.deleteButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={20} color="#FF453A" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newTaskText}
          onChangeText={setNewTaskText}
          placeholder="Add a new task..."
          placeholderTextColor="#666"
          onSubmitEditing={addTask}
          returnKeyType="done"
        />
        <TouchableOpacity 
          style={[styles.addButton, !newTaskText.trim() && styles.addButtonDisabled]}
          onPress={addTask}
          disabled={!newTaskText.trim()}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={tasks}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  taskTextContainer: {
    flex: 1,
  },
  editInput: {
    backgroundColor: '#3c3c3e',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginRight: 12,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#2c2c2e',
    opacity: 0.5,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  taskText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginRight: 8,
  },
  completedTask: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  deleteButton: {
    padding: 4,
  },
});