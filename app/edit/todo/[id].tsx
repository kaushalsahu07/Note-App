import { CustomAlert as Alert } from '../../../components/CustomAlert';
import React, { useState, useEffect, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { loadNotes, updateNote, Note, TodoItem } from '../../../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import TodoList from '../../../components/TodoList';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors, NOTE_ACCENT_COLORS } from '../../../constants/Colors';
import { useTheme } from '../../../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';

export default function EditTodoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [tasks, setTasks] = useState<TodoItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [originalNote, setOriginalNote] = useState<Note | null>(null);

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const accentColor = NOTE_ACCENT_COLORS[1]; // emerald for todos

  useEffect(() => {
    if (id) loadTodoData();
  }, [id]);

  const loadTodoData = async () => {
    try {
      const notes = await loadNotes();
      const todo = notes.find(n => n.id === id);
      if (todo && todo.tasks) {
        setTitle(todo.title);
        setTasks(todo.tasks);
        setOriginalNote(todo);
      } else {
        Alert.alert('Error', 'Todo not found');
        router.back();
      }
    } catch {
      Alert.alert('Error', 'Failed to load todo');
      router.back();
    }
  };

  const canSave = title.trim().length > 0 && tasks.length > 0;

  const handleSave = async () => {
    if (isSaving || !canSave) return;
    btnScale.value = withSpring(0.93);
    setTimeout(() => { btnScale.value = withSpring(1); }, 150);
    setIsSaving(true);
    try {
      const updatedTodo: Note = {
        ...originalNote!,
        title: title.trim(),
        tasks,
        lastModified: new Date().toISOString(),
      };
      const success = await updateNote(updatedTodo);
      if (success) router.back();
      else Alert.alert('Error', 'Failed to update todo');
    } catch {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    const hasChanges =
      title !== originalNote?.title ||
      JSON.stringify(tasks) !== JSON.stringify(originalNote?.tasks);
    if (hasChanges) {
      Alert.alert('Discard Changes', 'Are you sure?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleCancel} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color={colors.icon} />
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>

        <Animated.View style={btnStyle}>
          <TouchableOpacity
            style={[styles.saveBtn, canSave && { backgroundColor: accentColor }, !canSave && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={!canSave || isSaving}
            activeOpacity={0.9}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : 'Save List'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="List title..."
          placeholderTextColor={colors.icon}
          maxLength={100}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(500)} style={{ flex: 1 }}>
        <TodoList tasks={tasks} onTasksChange={setTasks} />
      </Animated.View>
    </View>
  );
}

type ThemeColors = typeof Colors.dark;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 4,
  },
  backText: { color: colors.icon, fontSize: 16, fontWeight: '500' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceSolid,
    paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: 22, borderWidth: 1, borderColor: colors.border,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  titleInput: {
    fontSize: 28, fontWeight: '800', color: colors.text,
    paddingHorizontal: 22, paddingTop: 22, paddingBottom: 8,
    letterSpacing: -0.8,
  },
  });
}