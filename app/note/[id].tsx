import { CustomAlert as Alert } from '../../components/CustomAlert';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ScrollView, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { loadNotes, updateNote, Note, upsertNotePasswordInManager, deleteNotePasswordFromManager } from '../../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import AccessPasswordDialog from '../../components/AccessPasswordDialog';
import PasswordProtectionDialog from '../../components/PasswordProtectionDialog';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';


export default function NoteViewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const contentRef = useRef('');
  const [isSaving, setIsSaving] = useState(false);
  const [originalNote, setOriginalNote] = useState<Note | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showSetPasswordDialog, setShowSetPasswordDialog] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isContentFocused, setIsContentFocused] = useState(false);
  const contentInputRef = useRef<TextInput>(null);

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const handleContentChange = useCallback((text: string) => {
    contentRef.current = text;
  }, []);

  const handleContentFocus = useCallback(() => {
    setIsEditing(true);
    setIsContentFocused(true);
  }, []);

  useEffect(() => {
    if (id) loadNoteData();
  }, [id]);

  useEffect(() => {
    if (isContentFocused) {
      const timer = setTimeout(() => contentInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isContentFocused]);

  const loadNoteData = async () => {
    try {
      const notes = await loadNotes();
      const note = notes.find(n => n.id === id);
      if (note) {
        if (note.isPasswordProtected) {
          setIsLocked(true);
          setShowPasswordDialog(true);
          setOriginalNote(note);
        } else {
          setTitle(note.title);
          contentRef.current = note.content;
          setOriginalNote(note);
        }
      } else {
        Alert.alert('Error', 'Note not found');
        router.back();
      }
    } catch {
      Alert.alert('Error', 'Failed to load note');
      router.back();
    }
  };

  const handleVerifyPassword = (password: string) => {
    if (originalNote?.password === password) {
      setIsLocked(false);
      setShowPasswordDialog(false);
      setTitle(originalNote.title);
      contentRef.current = originalNote.content;
    } else {
      Alert.alert('Wrong Password', 'Please try again.');
    }
  };

  const handleSave = async () => {
    if (isSaving || !title.trim() || !contentRef.current.trim()) return;
    btnScale.value = withSpring(0.93);
    setTimeout(() => { btnScale.value = withSpring(1); }, 150);
    setIsSaving(true);
    try {
      const updated: Note = {
        ...originalNote!,
        title: title.trim(),
        content: contentRef.current.trim(),
        lastModified: new Date().toISOString(),
      };
      const success = await updateNote(updated);
      if (success) {
        setIsEditing(false);
        setIsContentFocused(false);
        setOriginalNote(updated);
        Keyboard.dismiss();
      } else {
        Alert.alert('Error', 'Failed to save changes');
      }
    } catch {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPassword = async (password: string, hint: string) => {
    if (!originalNote) return;
    const updated: Note = {
      ...originalNote,
      isPasswordProtected: true,
      password,
      passwordHint: hint,
      lastModified: new Date().toISOString(),
    };
    const success = await updateNote(updated);
    if (success) {
      await upsertNotePasswordInManager(originalNote.id, originalNote.title, password);
      setOriginalNote(updated);
      Alert.alert('🔒 Note Locked', 'This note is now password protected.\nPassword saved in Password Manager.');
    } else {
      Alert.alert('Error', 'Failed to set password.');
    }
  };

  const handleRemovePassword = () => {
    Alert.alert(
      'Remove Protection',
      'This note will no longer require a password to open. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            if (!originalNote) return;
            const updated: Note = {
              ...originalNote,
              isPasswordProtected: false,
              password: undefined,
              passwordHint: undefined,
              lastModified: new Date().toISOString(),
            };
            const success = await updateNote(updated);
            if (success) {
              await deleteNotePasswordFromManager(originalNote.id);
              setOriginalNote(updated);
              Alert.alert('🔓 Unlocked', 'Password protection removed.');
            }
          },
        },
      ]
    );
  };

  const handleLockPress = () => {
    if (originalNote?.isPasswordProtected) {
      handleRemovePassword();
    } else {
      setShowSetPasswordDialog(true);
    }
  };

  const handleBack = () => {
    // If content is focused, just unfocus and show title/meta again
    if (isContentFocused) {
      Keyboard.dismiss();
      setIsContentFocused(false);
      return;
    }

    const hasChanges = title !== originalNote?.title || contentRef.current !== originalNote?.content;
    if (isEditing && hasChanges) {
      Alert.alert('Discard Changes', 'Are you sure?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  if (isLocked) {
    return (
      <View style={styles.container}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.lockedScreen}>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={40} color={colors.accent} />
          </View>
          <Text style={styles.lockedTitle}>Protected Note</Text>
          <Text style={styles.lockedSub}>Enter password to unlock</Text>
          <TouchableOpacity style={styles.backFromLock} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={colors.icon} />
            <Text style={styles.backFromLockText}>Go Back</Text>
          </TouchableOpacity>
        </View>
        <AccessPasswordDialog
          visible={showPasswordDialog}
          onClose={() => { setShowPasswordDialog(false); router.back(); }}
          onVerifyPassword={handleVerifyPassword}
          hint={originalNote?.passwordHint}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header — always visible */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color={colors.icon} />
          <Text style={styles.backText}>{isContentFocused ? 'Done' : 'Notes'}</Text>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {!isContentFocused && (
            <>
              <TouchableOpacity style={styles.iconBtn} onPress={handleLockPress} activeOpacity={0.8}>
                <Ionicons
                  name={originalNote?.isPasswordProtected ? 'lock-closed' : 'lock-open-outline'}
                  size={18}
                  color={originalNote?.isPasswordProtected ? colors.accentTertiary : colors.icon}
                />
              </TouchableOpacity>
            </>
          )}

          {isEditing ? (
            <Animated.View style={btnStyle}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.9}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)} activeOpacity={0.8}>
              <Ionicons name="pencil" size={16} color={colors.accent} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* VIEW / EDIT MODE — title + meta + content in a scrollview */}
      {!isContentFocused && (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Title..."
            placeholderTextColor={colors.icon}
            maxLength={100}
            editable={isEditing}
            onFocus={() => setIsEditing(true)}
          />

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.icon} />
            <Text style={styles.metaText}>{originalNote?.date || ''}</Text>
            {originalNote?.lastModified && (
              <>
                <View style={styles.metaDot} />
                <Ionicons name="time-outline" size={13} color={colors.icon} />
                <Text style={styles.metaText}>
                  {new Date(originalNote.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </>
            )}
          </View>

          <View style={styles.divider} />

          <TextInput
            style={styles.contentInputView}
            defaultValue={contentRef.current}
            onChangeText={handleContentChange}
            placeholder="Your note content..."
            placeholderTextColor={colors.icon}
            multiline
            textAlignVertical="top"
            editable={isEditing}
            onFocus={handleContentFocus}
            scrollEnabled={false}
          />
        </ScrollView>
      )}

      {/* FULL-SCREEN CONTENT EDIT — only mounted when focused */}
      {isContentFocused && (
        <TextInput
          ref={contentInputRef}
          style={styles.contentInput}
          defaultValue={contentRef.current}
          onChangeText={handleContentChange}
          placeholder="Your note content..."
          placeholderTextColor={colors.icon}
          multiline
          textAlignVertical="top"
          scrollEnabled
          autoFocus
        />
      )}

      <PasswordProtectionDialog
        visible={showSetPasswordDialog}
        onClose={() => setShowSetPasswordDialog(false)}
        onSetPassword={handleSetPassword}
      />
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
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingVertical: 6, paddingHorizontal: 4,
    },
    backText: { color: colors.icon, fontSize: 16, fontWeight: '500' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: colors.surfaceSolid,
      borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },
    saveBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.accent,
      paddingVertical: 9, paddingHorizontal: 16,
      borderRadius: 20,
    },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    editBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.glassLight,
      paddingVertical: 9, paddingHorizontal: 16,
      borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    },
    editBtnText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
    titleInput: {
      fontSize: 30, fontWeight: '800', color: colors.text,
      paddingHorizontal: 22, paddingTop: 24, paddingBottom: 8,
      letterSpacing: -0.8,
    },
    metaRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 22, paddingBottom: 16,
    },
    metaText: { fontSize: 12, color: colors.icon, fontWeight: '500' },
    metaDot: {
      width: 3, height: 3, borderRadius: 2,
      backgroundColor: colors.icon, opacity: 0.4, marginHorizontal: 2,
    },
    divider: {
      height: 1, backgroundColor: colors.border,
      marginHorizontal: 22, marginBottom: 4,
    },
    contentInput: {
      flex: 1,
      fontSize: 17, color: colors.text,
      paddingHorizontal: 22, paddingTop: 16, paddingBottom: 40,
      lineHeight: 28, fontWeight: '400',
    },
    contentInputView: {
      fontSize: 17, color: colors.text,
      paddingHorizontal: 22, paddingTop: 4, paddingBottom: 40,
      lineHeight: 28, minHeight: 300, fontWeight: '400',
    },
    scroll: { flex: 1 },
    // Locked screen
    lockedScreen: {
      flex: 1, justifyContent: 'center', alignItems: 'center',
      padding: 40, gap: 12,
    },
    lockIcon: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: colors.glassLight,
      borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    },
    lockedTitle: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
    lockedSub: { fontSize: 15, color: colors.icon, textAlign: 'center' },
    backFromLock: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 24, paddingVertical: 12, paddingHorizontal: 24,
      backgroundColor: colors.surfaceSolid,
      borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    },
    backFromLockText: { color: colors.icon, fontSize: 15, fontWeight: '600' },
  });
}