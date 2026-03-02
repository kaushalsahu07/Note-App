import { CustomAlert as Alert } from '../components/CustomAlert';
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Modal, TextInput, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import NoteCard from '../components/NoteCard';
import SearchBar from '../components/SearchBar';
import { loadNotes, Note, deleteNote, updateNote, setNotesChangeListener } from '../utils/storage';
import Settings from '../components/Settings';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeInDown, FadeInUp, LinearTransition, ZoomIn,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate, Extrapolation
} from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { StatusBar } from 'expo-status-bar';

const USERNAME_KEY = 'user_name';
const { width } = Dimensions.get('window');

export default function NotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [username, setUsername] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempUsername, setTempUsername] = useState('');

  const fabScale = useSharedValue(1);
  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  useEffect(() => {
    checkUsername();
    loadStoredNotes();
    setNotesChangeListener(setNotes);
  }, []);

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

  const handleDeleteNote = async (noteId: string) => {
    const success = await deleteNote(noteId);
    if (success) loadStoredNotes();
    else Alert.alert('Error', 'Failed to delete note');
  };

  const filteredNotes = notes.filter(note => {
    const q = searchQuery.toLowerCase();
    return note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q);
  });

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
      <StatusBar style="light" />

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
            <Ionicons name="settings-outline" size={22} color={Colors.dark.icon} />
          </TouchableOpacity>
        </View>

        {/* Stats pill */}
        <Animated.View entering={FadeInDown.delay(150).duration(600)} style={styles.statsPill}>
          <Ionicons name="document-text" size={14} color={Colors.dark.accent} />
          <Text style={styles.statsText}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
          <View style={styles.statsDot} />
          <Ionicons name="checkmark-circle" size={14} color={Colors.dark.accentSecondary} />
          <Text style={styles.statsText}>
            {notes.filter(n => n.tasks).length} list{notes.filter(n => n.tasks).length !== 1 ? 's' : ''}
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Search */}
      <Animated.View entering={FadeInDown.delay(200).duration(600)}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
      </Animated.View>

      {/* Notes Grid */}
      <Animated.FlatList
        itemLayoutAnimation={LinearTransition}
        data={filteredNotes}
        renderItem={({ item, index }) => (
          <NoteCard
            note={item}
            index={index}
            onDelete={() => handleDeleteNote(item.id)}
            onPress={() => router.push(item.tasks ? `/edit/todo/${item.id}` : `/note/${item.id}`)}
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
            tintColor={Colors.dark.accent}
            colors={[Colors.dark.accent]}
          />
        }
        ListEmptyComponent={
          <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name={searchQuery ? 'search-outline' : 'journal-outline'} size={48} color={Colors.dark.accent} />
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

      {/* FAB */}
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

      {/* Username Modal */}
      <Modal visible={showUsernameModal} transparent animationType="fade"
        onRequestClose={() => { if (username) setShowUsernameModal(false); }}>
        <View style={styles.overlay}>
          <Animated.View entering={ZoomIn.duration(400)} style={styles.modal}>
            <View style={styles.modalIconRow}>
              <View style={styles.modalIconBg}>
                <Ionicons name="person" size={28} color={Colors.dark.accent} />
              </View>
            </View>
            <Text style={styles.modalTitle}>{username ? 'Change Name' : 'Welcome! 🎉'}</Text>
            <Text style={styles.modalSub}>{username ? 'Enter your new name' : "What should we call you?"}</Text>
            <TextInput
              style={styles.modalInput}
              value={tempUsername}
              onChangeText={setTempUsername}
              placeholder="Your name..."
              placeholderTextColor={Colors.dark.icon}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
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
    color: Colors.dark.icon,
    fontWeight: '500',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  greetingName: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -1.2,
  },
  settingsBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.dark.surfaceSolid,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  statsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: Colors.dark.glassLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statsText: {
    fontSize: 13,
    color: Colors.dark.icon,
    fontWeight: '500',
  },
  statsDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.dark.border,
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
    shadowColor: Colors.dark.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 12,
  },
  fabInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.accent,
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
    backgroundColor: Colors.dark.glassLight,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.dark.icon,
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
    backgroundColor: Colors.dark.surfaceSolid,
    borderRadius: 28,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    shadowColor: Colors.dark.accent,
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
    backgroundColor: Colors.dark.glassLight,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 15,
    color: Colors.dark.icon,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalInput: {
    width: '100%',
    backgroundColor: Colors.dark.background,
    borderRadius: 16,
    padding: 16,
    fontSize: 17,
    color: Colors.dark.text,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    fontWeight: '500',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cancelBtnText: {
    color: Colors.dark.icon,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: Colors.dark.accent,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: Colors.dark.accent,
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
});