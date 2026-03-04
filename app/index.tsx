import { CustomAlert as Alert } from '../components/CustomAlert';
import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Modal, TextInput, Dimensions, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import NoteCard from '../components/NoteCard';
import SearchBar from '../components/SearchBar';
import { loadNotes, togglePinNote, Note, deleteNotes, deleteNote, updateNote, setNotesChangeListener } from '../utils/storage';
import Settings from '../components/Settings';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeInDown, FadeInUp, FadeOutDown, LinearTransition, ZoomIn,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate, Extrapolation
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { Colors } from '../constants/Colors';
import { StatusBar } from 'expo-status-bar';

const USERNAME_KEY = 'user_name';
const { width } = Dimensions.get('window');

export default function NotesScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [username, setUsername] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const fabScale = useSharedValue(1);
  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  useEffect(() => {
    checkUsername();
    loadStoredNotes();
    setNotesChangeListener(setNotes);
  }, []);

  // Exit selection mode on hardware back
  useEffect(() => {
    if (!isSelectionMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      clearSelection();
      return true;
    });
    return () => sub.remove();
  }, [isSelectionMode]);

  const checkUsername = async () => {
    try {
      const saved = await AsyncStorage.getItem(USERNAME_KEY);
      if (saved) setUsername(saved);
      else setShowUsernameModal(true);
    } catch (e) { console.error(e); }
  };

  const saveUsername = async () => {
    if (!tempUsername.trim()) return;
    try {
      await AsyncStorage.setItem(USERNAME_KEY, tempUsername.trim());
      setUsername(tempUsername.trim());
      setShowUsernameModal(false);
    } catch (e) { console.error(e); }
  };

  const loadStoredNotes = async () => {
    setIsLoading(true);
    try {
      const storedNotes = await loadNotes();
      setNotes(storedNotes);
    } catch (e) {
      Alert.alert('Error', 'Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadStoredNotes(); }
    finally { setRefreshing(false); }
  }, []);

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

  const allSelectedPinned = selectedIds.length > 0 &&
    selectedIds.every(id => notes.find(n => n.id === id)?.pinned);

  const handlePinSelected = async () => {
    if (selectedIds.length === 1) {
      await togglePinNote(selectedIds[0]);
      clearSelection();
    }
  };

  const handleDeleteSelected = () => {
    Alert.alert(
      `Delete ${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await deleteNotes(selectedIds);
            clearSelection();
            loadStoredNotes();
          },
        },
      ]
    );
  };

  const filteredNotes = notes
    .filter(note => {
      const q = searchQuery.toLowerCase();
      return note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q);
    })
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const handleFabPressIn = () => { fabScale.value = withSpring(0.88); };
  const handleFabPressOut = () => { fabScale.value = withSpring(1); };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(700)} style={styles.header}>
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingLabel}>{getGreeting()} 👋</Text>
            <TouchableOpacity onPress={() => { setTempUsername(username); setShowUsernameModal(true); }} activeOpacity={0.7}>
              <Text style={styles.greetingName}>{username || 'Friend'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)} activeOpacity={0.85}>
            <Ionicons name="settings-outline" size={22} color={colors.icon} />
          </TouchableOpacity>
        </View>

        {/* Stats pill */}
        <Animated.View entering={FadeInDown.delay(150).duration(600)} style={styles.statsPill}>
          <Ionicons name="document-text" size={14} color={colors.accent} />
          <Text style={styles.statsText}>{notes.filter(n => !n.tasks).length} note{notes.filter(n => !n.tasks).length !== 1 ? 's' : ''}</Text>
          <View style={styles.statsDot} />
          <Ionicons name="checkmark-circle" size={14} color={colors.accentSecondary} />
          <Text style={styles.statsText}>
            {notes.filter(n => n.tasks).length} list{notes.filter(n => n.tasks).length !== 1 ? 's' : ''}
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Notes Grid */}
      <Animated.FlatList
        itemLayoutAnimation={LinearTransition}
        data={filteredNotes}
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
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
          </Animated.View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name={searchQuery ? 'search-outline' : 'journal-outline'} size={48} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'Nothing found' : 'Your canvas awaits'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search term' : 'Tap + to create your first note'}
            </Text>
          </Animated.View>
        }
      />

      {/* FAB — hide in selection mode */}
      {!isSelectionMode && (
        <Animated.View entering={ZoomIn.delay(400)} style={styles.fabWrapper}>
          <Animated.View style={fabAnimStyle}>
            <TouchableOpacity
              style={styles.fab}
              onPress={() => router.push('/select-type')}
              onPressIn={handleFabPressIn}
              onPressOut={handleFabPressOut}
              activeOpacity={1}
            >
              <View style={styles.fabInner}>
                <Ionicons name="add" size={30} color="#fff" />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

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
              style={[
                styles.actionBarBtn,
                { backgroundColor: `${colors.accent}20`, borderColor: `${colors.accent}40` },
                selectedIds.length !== 1 && { opacity: 0.4 }
              ]}
              onPress={handlePinSelected}
              disabled={selectedIds.length !== 1}
            >
              <Text style={styles.actionBarBtnEmoji}>📌</Text>
              <Text style={[styles.actionBarBtnText, { color: colors.accent }]}>
                {allSelectedPinned ? 'Unpin' : 'Pin'}
              </Text>
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

      {/* Username Modal */}
      <Modal visible={showUsernameModal} transparent animationType="fade"
        onRequestClose={() => { if (username) setShowUsernameModal(false); }}>
        <View style={styles.overlay}>
          <Animated.View entering={ZoomIn.duration(400)} style={styles.modal}>
            <View style={styles.modalIconRow}>
              <View style={styles.modalIconBg}>
                <Ionicons name="person" size={28} color={colors.accent} />
              </View>
            </View>
            <Text style={styles.modalTitle}>{username ? 'Change Name' : 'Welcome! 🎉'}</Text>
            <Text style={styles.modalSub}>{username ? 'Enter your new name' : "What should we call you?"}</Text>
            <TextInput
              style={styles.modalInput}
              value={tempUsername}
              onChangeText={setTempUsername}
              placeholder="Your name..."
              placeholderTextColor={colors.icon}
              autoFocus
              onSubmitEditing={saveUsername}
            />
            <View style={styles.modalBtns}>
              {username && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowUsernameModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.confirmBtn, !tempUsername.trim() && { opacity: 0.4 }]}
                onPress={saveUsername}
                disabled={!tempUsername.trim()}
              >
                <Text style={styles.confirmBtnText}>{username ? 'Save' : 'Let\'s go →'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Settings Modal */}
      {showSettings && (
        <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
          <Settings onClose={() => setShowSettings(false)} />
        </Modal>
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
      paddingTop: 64,
      paddingBottom: 8,
    },
    greetingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    greetingLabel: {
      fontSize: 15,
      color: colors.icon,
      fontWeight: '500',
      marginBottom: 2,
      letterSpacing: 0.3,
    },
    greetingName: {
      fontSize: 36,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -1.2,
    },
    settingsBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.surfaceSolid,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 4,
    },
    statsPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      backgroundColor: colors.glassLight,
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statsText: {
      fontSize: 13,
      color: colors.icon,
      fontWeight: '500',
    },
    statsDot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginHorizontal: 2,
    },
    notesList: {
      paddingHorizontal: 10,
      paddingBottom: 120,
      paddingTop: 6,
    },
    fabWrapper: {
      position: 'absolute',
      bottom: 36,
      right: 24,
      zIndex: 99,
    },
    fab: {
      width: 64,
      height: 64,
      borderRadius: 32,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.55,
      shadowRadius: 16,
      elevation: 12,
    },
    fabInner: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.2)',
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

    // Modal
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(8, 12, 20, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modal: {
      backgroundColor: colors.surfaceSolid,
      borderRadius: 28,
      padding: 28,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.2,
      shadowRadius: 32,
      elevation: 20,
    },
    modalIconRow: {
      marginBottom: 16,
    },
    modalIconBg: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: colors.glassLight,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.8,
      marginBottom: 6,
    },
    modalSub: {
      fontSize: 15,
      color: colors.icon,
      marginBottom: 24,
      textAlign: 'center',
    },
    modalInput: {
      width: '100%',
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 16,
      fontSize: 17,
      color: colors.text,
      marginBottom: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      fontWeight: '500',
    },
    modalBtns: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    cancelBtn: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelBtnText: {
      color: colors.icon,
      fontSize: 16,
      fontWeight: '600',
    },
    confirmBtn: {
      flex: 1,
      backgroundColor: colors.accent,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 6,
    },
    confirmBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
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
    actionBarBtnEmoji: {
      fontSize: 15,
    },
    actionBarBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
  });
}