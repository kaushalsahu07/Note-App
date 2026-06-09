import { CustomAlert as Alert } from '../components/CustomAlert';
import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, BackHandler } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import NoteCard from '../components/NoteCard';
import { loadArchivedNotes, unarchiveNotes, deleteNotes, Note, updateNote } from '../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown, FadeInUp, FadeOutDown, ZoomIn,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { Colors } from '../constants/Colors';
import { StatusBar } from 'expo-status-bar';

export default function ArchiveScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Auto-reload whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadArchive();
    }, [])
  );

  // Exit selection mode on hardware back
  useEffect(() => {
    if (!isSelectionMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      clearSelection();
      return true;
    });
    return () => sub.remove();
  }, [isSelectionMode]);

  const loadArchive = async () => {
    setIsLoading(true);
    try {
      const archived = await loadArchivedNotes();
      setNotes(archived);
    } catch (e) {
      Alert.alert('Error', 'Failed to load archived notes');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadArchive(); }
    finally { setRefreshing(false); }
  }, []);

  const clearSelection = () => {
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const handleLongPress = (id: string) => {
    setIsSelectionMode(true);
    setSelectedIds([id]);
  };

  const handleCardPress = (item: Note) => {
    if (isSelectionMode) {
      setSelectedIds(prev =>
        prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id]
      );
    } else {
      router.push(item.tasks ? `/edit/todo/${item.id}` : `/note/${item.id}`);
    }
  };

  const handleTaskToggle = async (noteId: string, taskId: string) => {
    const noteToUpdate = notes.find(n => n.id === noteId);
    if (!noteToUpdate?.tasks) return;
    const updatedTasks = noteToUpdate.tasks.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    const updatedNote = { ...noteToUpdate, tasks: updatedTasks, lastModified: new Date().toISOString() };
    const success = await updateNote(updatedNote);
    if (success) setNotes(notes.map(n => n.id === noteId ? updatedNote : n));
  };

  const handleUnarchiveSelected = async () => {
    await unarchiveNotes(selectedIds);
    clearSelection();
    loadArchive();
  };

  const handleDeleteSelected = () => {
    Alert.alert(
      `Delete ${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''} permanently?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await deleteNotes(selectedIds);
            clearSelection();
            loadArchive();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color={colors.icon} />
          <Text style={styles.backText}>Notes</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <View style={styles.archiveIconBg}>
              <Ionicons name="archive" size={20} color={colors.accent} />
            </View>
            <Text style={styles.screenTitle}>Archive</Text>
          </View>
          {notes.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{notes.length}</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Archived Notes Grid */}
      <Animated.FlatList
        data={notes}
        renderItem={({ item, index }) => (
          <NoteCard
            note={item}
            index={index}
            onPress={() => handleCardPress(item)}
            onLongPress={() => handleLongPress(item.id)}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds.includes(item.id)}
            onTaskToggle={handleTaskToggle}
          />
        )}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.notesList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="archive-outline" size={48} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>No archived notes</Text>
            <Text style={styles.emptySubtitle}>
              Notes you archive will appear here.{'\n'}Swipe or long-press to archive from the home screen.
            </Text>
          </Animated.View>
        }
      />

      {/* Selection action bar */}
      {isSelectionMode && (
        <Animated.View entering={FadeInDown.duration(300)} exiting={FadeOutDown.duration(200)} style={styles.actionBar}>
          <TouchableOpacity style={styles.actionBarCancel} onPress={clearSelection}>
            <Ionicons name="close" size={20} color={colors.icon} />
          </TouchableOpacity>

          <Text style={styles.actionBarCount}>
            {selectedIds.length} selected
          </Text>

          <View style={styles.actionBarBtns}>
            <TouchableOpacity
              style={[styles.actionBarBtn, { backgroundColor: `${colors.accentSecondary}15`, borderColor: `${colors.accentSecondary}40` }]}
              onPress={handleUnarchiveSelected}
              disabled={selectedIds.length === 0}
            >
              <Ionicons name="arrow-undo" size={16} color={colors.accentSecondary} />
              <Text style={[styles.actionBarBtnText, { color: colors.accentSecondary }]}>Unarchive</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBarBtn, { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.3)' }]}
              onPress={handleDeleteSelected}
              disabled={selectedIds.length === 0}
            >
              <Ionicons name="trash" size={16} color={colors.danger} />
              <Text style={[styles.actionBarBtnText, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
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
    header: {
      paddingHorizontal: 22,
      paddingTop: 60,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 4,
      marginBottom: 12,
    },
    backText: {
      color: colors.icon,
      fontSize: 16,
      fontWeight: '500',
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    archiveIconBg: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.glassLight,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    screenTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.8,
    },
    countBadge: {
      backgroundColor: colors.glassLight,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
    },
    countText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.accent,
    },
    notesList: {
      paddingHorizontal: 10,
      paddingBottom: 120,
      paddingTop: 12,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: 40,
    },
    emptyIconWrapper: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.glassLight,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    emptySubtitle: {
      fontSize: 15,
      color: colors.icon,
      textAlign: 'center',
      lineHeight: 22,
    },

    // Action bar
    actionBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      paddingBottom: 32,
      backgroundColor: colors.surfaceSolid,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 12,
    },
    actionBarCancel: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionBarCount: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    actionBarBtns: {
      flexDirection: 'row',
      gap: 10,
    },
    actionBarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
    },
    actionBarBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
