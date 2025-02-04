import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import NoteCard from '../components/NoteCard';
import SearchBar from '../components/SearchBar';
import { loadNotes, Note, deleteNote } from '../utils/storage';
import { exportSelectedNotesToFile } from '../utils/exportNotes';
import { Ionicons } from '@expo/vector-icons';

export default function NotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const loadStoredNotes = async () => {
    setIsLoading(true);
    try {
      const storedNotes = await loadNotes();
      setNotes(storedNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
      Alert.alert('Error', 'Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadStoredNotes();
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStoredNotes();
  }, []);

  const handleDeleteNote = async (noteId: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteNote(noteId);
            if (success) {
              loadStoredNotes();
            } else {
              Alert.alert('Error', 'Failed to delete note');
            }
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      return;
    }

    if (selectedNotes.length === 0) {
      Alert.alert('Error', 'Please select at least one note to export');
      return;
    }

    try {
      const notesToExport = notes.filter(note => selectedNotes.includes(note.id));
      await exportSelectedNotesToFile(notesToExport);
      Alert.alert('Success', 'Selected notes exported successfully');
      setIsSelectionMode(false);
      setSelectedNotes([]);
    } catch (error) {
      console.error('Error exporting notes:', error);
      Alert.alert('Error', 'Failed to export notes');
    }
  };

  const toggleNoteSelection = (noteId: string) => {
    if (!isSelectionMode) return;

    setSelectedNotes(prev => {
      if (prev.includes(noteId)) {
        return prev.filter(id => id !== noteId);
      } else {
        return [...prev, noteId];
      }
    });
  };

  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedNotes([]);
  };

  const filteredNotes = notes.filter(note => {
    const searchLower = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(searchLower) ||
      note.content.toLowerCase().includes(searchLower)
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
        <View style={styles.headerRight}>
          {isSelectionMode && (
            <>
              <TouchableOpacity 
                style={styles.headerButton} 
                onPress={cancelSelection}
              >
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.selectionCount}>
                {selectedNotes.length} selected
              </Text>
            </>
          )}
          <TouchableOpacity 
            style={styles.exportButton} 
            onPress={handleExport}
          >
            <Ionicons 
              name={isSelectionMode ? "checkmark" : "share-outline"} 
              size={24} 
              color="#007AFF" 
            />
          </TouchableOpacity>
        </View>
      </View>

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search notes..."
      />

      <FlatList
        data={filteredNotes}
        renderItem={({ item }) => (
          <NoteCard
            note={item}
            onDelete={() => handleDeleteNote(item.id)}
            onPress={() => isSelectionMode ? toggleNoteSelection(item.id) : router.push(`/note/${item.id}`)}
            isSelected={selectedNotes.includes(item.id)}
            isSelectionMode={isSelectionMode}
          />
        )}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.notesList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={["#007AFF"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No notes yet</Text>
            <Text style={styles.emptyStateSubtext}>Tap + to create one</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButton: {
    paddingHorizontal: 8,
  },
  cancelButton: {
    color: '#007AFF',
    fontSize: 17,
  },
  selectionCount: {
    color: '#666',
    fontSize: 17,
  },
  exportButton: {
    padding: 8,
  },
  notesList: {
    padding: 8,
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyStateText: {
    fontSize: 20,
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  }
});