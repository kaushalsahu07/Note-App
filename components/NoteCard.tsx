import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Note } from '../utils/storage';
import { Ionicons } from '@expo/vector-icons';

interface NoteCardProps {
  note: Note;
  onDelete: () => void;
  onPress: () => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onTaskToggle?: (noteId: string, taskId: string) => void;
}

export default function NoteCard({ 
  note, 
  onDelete, 
  onPress, 
  isSelected = false,
  isSelectionMode = false,
  onTaskToggle
}: NoteCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[
        styles.card, 
        { backgroundColor: note.color },
        isSelected && styles.selectedCard
      ]}
      onPress={onPress}
    >
      {isSelectionMode && (
        <View style={styles.checkboxContainer}>
          <View style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected
          ]}>
            {isSelected && (
              <Ionicons name="checkmark" size={18} color="#fff" />
            )}
          </View>
        </View>
      )}
      <View style={styles.contentContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {note.title}
        </Text>
        {note.tasks ? (
          <View style={styles.tasksContainer}>
            {note.tasks.slice(0, 3).map((task, index) => (
              <View key={task.id} style={styles.taskItem}>
                <TouchableOpacity
                  style={[styles.taskCheckbox, task.completed && styles.taskCheckboxCompleted]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onTaskToggle?.(note.id, task.id);
                  }}
                >
                  {task.completed && <Ionicons name="checkmark" size={12} color="#fff" />}
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={(e) => {
                    e.stopPropagation();
                    onTaskToggle?.(note.id, task.id);
                  }}
                  style={styles.taskTextContainer}
                >
                  <Text style={[styles.taskText, task.completed && styles.taskTextCompleted]} numberOfLines={1}>
                    {task.text}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            {note.tasks.length > 3 && (
              <Text style={styles.moreTasksText}>{note.tasks.length - 3} more tasks...</Text>
            )}
          </View>
        ) : (
          <Text style={styles.content} numberOfLines={3}>
            {note.content}
          </Text>
        )}
        <Text style={styles.date}>{note.date}</Text>
      </View>
      {!isSelectionMode && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2c2c2e',
    minHeight: 150,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedCard: {
    borderWidth: 3,
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  checkboxContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  content: {
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: '#666',
    position: 'absolute',
    bottom: 0,
    right: 0,
    padding: 0,
  },
  tasksContainer: {
    marginBottom: 15,
  },
  moreTasksText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 4,
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
  },
  tasksList: {
    marginBottom: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#333',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskCheckboxCompleted: {
    backgroundColor: '#333',
    borderColor: '#333',
  },
  taskText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  taskTextCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  tasksRemainingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  taskTextContainer: {
    flex: 1,
    paddingVertical: 4, // Added for better touch target
  },
});