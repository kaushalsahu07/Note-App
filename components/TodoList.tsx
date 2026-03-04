import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TodoItem } from '../utils/storage';
import { Colors } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';

interface TodoListProps {
  tasks: TodoItem[];
  onTasksChange: (tasks: TodoItem[]) => void;
}

export default function TodoList({ tasks, onTasksChange }: TodoListProps) {
  const [newTaskText, setNewTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const addTask = () => {
    if (!newTaskText.trim()) return;
    const newTask: TodoItem = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      completed: false,
    };
    onTasksChange([...tasks, newTask]);
    setNewTaskText('');
  };

  const toggleTask = (taskId: string) => {
    onTasksChange(tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (taskId: string) => {
    onTasksChange(tasks.filter(t => t.id !== taskId));
  };

  const startEditing = (taskId: string, taskText: string) => {
    setEditingTaskId(taskId);
    setEditingText(taskText);
  };

  const saveEdit = () => {
    if (!editingTaskId || !editingText.trim()) return;
    onTasksChange(tasks.map(t =>
      t.id === editingTaskId ? { ...t, text: editingText.trim() } : t
    ));
    setEditingTaskId(null);
    setEditingText('');
  };

  const renderItem = ({ item }: { item: TodoItem }) => (
    <View style={styles.taskItem}>
      <TouchableOpacity
        style={[styles.checkbox, item.completed && styles.checkboxChecked]}
        onPress={() => toggleTask(item.id)}
      >
        {item.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
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
        <TouchableOpacity onPress={() => startEditing(item.id, item.text)} style={styles.taskTextWrap}>
          <Text style={[styles.taskText, item.completed && styles.taskCompleted]}>
            {item.text}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => deleteTask(item.id)}
        style={styles.deleteBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={18} color={colors.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Add task input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={newTaskText}
          onChangeText={setNewTaskText}
          placeholder="Add a new task..."
          placeholderTextColor={colors.icon}
          onSubmitEditing={addTask}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addBtn, !newTaskText.trim() && { opacity: 0.4 }]}
          onPress={addTask}
          disabled={!newTaskText.trim()}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: 150 }]}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="list-outline" size={32} color={colors.icon} />
            <Text style={styles.emptyText}>No tasks yet — add one above</Text>
          </View>
        }
      />
    </View>
  );
}

type ThemeColors = typeof Colors.dark;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ─── Input row ───────────────────────────────────────────────
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: colors.surfaceSolid,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    addBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ─── List ────────────────────────────────────────────────────
    list: { flex: 1 },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 20,
    },

    // ─── Task item ───────────────────────────────────────────────
    taskItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSolid,
      marginBottom: 10,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    checkboxChecked: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    taskTextWrap: { flex: 1 },
    taskText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    taskCompleted: {
      textDecorationLine: 'line-through',
      color: colors.icon,
      fontWeight: '400',
    },
    editInput: {
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
    },
    deleteBtn: { padding: 2 },

    // ─── Empty ───────────────────────────────────────────────────
    emptyWrap: {
      alignItems: 'center',
      paddingTop: 40,
      gap: 10,
    },
    emptyText: {
      color: colors.icon,
      fontSize: 14,
      fontWeight: '500',
    },
  });
}