import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Note } from '../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown, Layout,
  useAnimatedStyle, useSharedValue,
  withSpring, withTiming, interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Colors, NOTE_COLORS, NOTE_BORDER_COLORS, NOTE_ACCENT_COLORS } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';

interface NoteCardProps {
  note: Note;
  onPress: () => void;
  onLongPress?: () => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onTaskToggle?: (noteId: string, taskId: string) => void;
  index?: number;
}

export default function NoteCard({
  note, onPress, onLongPress,
  isSelected = false, isSelectionMode = false,
  onTaskToggle, index = 0,
}: NoteCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // ─── Animation values ──────────────────────────────────────
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.94, { duration: 150 });
    glow.value = withTiming(1, { duration: 150 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 200 });
    glow.value = withTiming(0, { duration: 300 });
  };

  // ─── Colors ────────────────────────────────────────────────
  const colorIndex = useMemo(() => {
    if (!note.color) return index % NOTE_COLORS.length;
    const foundIndex = NOTE_COLORS.indexOf(note.color);
    return foundIndex !== -1 ? foundIndex : (index % NOTE_COLORS.length);
  }, [note.color, index]);

  const cardBg = NOTE_COLORS[colorIndex];
  const cardBorder = NOTE_BORDER_COLORS[colorIndex];
  const accent = NOTE_ACCENT_COLORS[colorIndex];

  // ─── Task stats ────────────────────────────────────────────
  const totalCount = note.tasks?.length ?? 0;
  const completedCount = note.tasks?.filter((t: any) => t.completed).length ?? 0;
  const progressPct = totalCount > 0 ? completedCount / totalCount : 0;
  const allDone = totalCount > 0 && completedCount === totalCount;

  // ─── Word / char count for notes ───────────────────────────
  const wordCount = note.content
    ? note.content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70).duration(480)}
      style={styles.wrapper}
    >
      {/* Scale + glow layer — separate from layout animation */}
      <Animated.View style={[cardAnimStyle, { borderRadius: 20, flex: 1 }]}>
        <Pressable
          style={[
            styles.card,
            { borderColor: isSelected ? accent : note.pinned ? accent : cardBorder },
            isSelected && styles.selectedCard,
            note.pinned && styles.pinnedCard,
          ]}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={onLongPress}
          delayLongPress={350}
        >
          {/* Solid dark base + translucent color tint overlay */}
          <View style={[styles.colorOverlay, { backgroundColor: cardBg }]} />

          {/* ── Top accent stripe ─────────────────────────────── */}
          <View style={[styles.topStripe, { backgroundColor: accent }]} />

          {/* ── Header row: icon badge + pin + delete ─────────── */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.typePill, { backgroundColor: `${accent}20`, borderColor: `${accent}40` }]}>
                <Ionicons
                  name={note.tasks ? 'checkbox' : 'document-text'}
                  size={11}
                  color={accent}
                />
                <Text style={[styles.typePillText, { color: accent }]}>
                  {note.tasks ? 'List' : 'Note'}
                </Text>
              </View>
              {note.pinned && (
                <Text style={styles.pinnedBadge}>📌</Text>
              )}
              {note.isPasswordProtected && (
                <View style={[styles.lockBadge, { backgroundColor: `${accent}20`, borderColor: `${accent}40` }]}>
                  <Ionicons name="lock-closed" size={10} color={accent} />
                </View>
              )}
            </View>

            {/* Delete icon + pin button (always visible, small) */}
            {!isSelectionMode && null}

            {/* Selection checkbox */}
            {isSelectionMode && (
              <View style={[styles.checkbox, isSelected && { backgroundColor: accent, borderColor: accent }]}>
                {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
            )}
          </View>

          {/* ── Title ─────────────────────────────────────────── */}
          <Text style={styles.title} numberOfLines={2}>{note.title}</Text>

          {/* ── Body: note content OR task list ───────────────── */}
          {note.isPasswordProtected ? (
            <View style={styles.lockedPreview}>
              <Ionicons name="lock-closed" size={20} color={accent} />
              <Text style={[styles.lockedPreviewText, { color: accent }]}>Protected Note</Text>
            </View>
          ) : note.tasks ? (
            <View style={styles.tasksWrap}>
              {note.tasks.slice(0, 4).map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskRow}
                  onPress={(e) => { e.stopPropagation(); onTaskToggle?.(note.id, task.id); }}
                  activeOpacity={0.7}
                >
                  {/* Custom checkbox */}
                  <View style={[
                    styles.taskCheck,
                    { borderColor: task.completed ? accent : `${accent}60` },
                    task.completed && { backgroundColor: accent },
                  ]}>
                    {task.completed && <Ionicons name="checkmark" size={9} color="#fff" />}
                  </View>
                  <Text
                    style={[styles.taskText, task.completed && { color: colors.icon, textDecorationLine: 'line-through' }]}
                    numberOfLines={1}
                  >
                    {task.text}
                  </Text>
                </TouchableOpacity>
              ))}

              {totalCount > 4 && (
                <Text style={[styles.moreText, { color: accent }]}>
                  +{totalCount - 4} more
                </Text>
              )}

              {/* Progress bar */}
              {totalCount > 0 && (
                <View style={styles.progressWrap}>
                  <View style={styles.progressBg}>
                    <Animated.View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progressPct * 100}%` as any,
                          backgroundColor: allDone ? '#34D399' : accent,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressLabel, { color: allDone ? '#34D399' : accent }]}>
                    {completedCount}/{totalCount}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.body} numberOfLines={5}>{note.content}</Text>
          )}

          {/* ── Footer ────────────────────────────────────────── */}
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <Ionicons name="calendar-outline" size={10} color={colors.icon} />
              <Text style={styles.dateText}>{note.date}</Text>
            </View>

            {/* Word count badge for text notes */}
            {!note.tasks && !note.isPasswordProtected && wordCount > 0 && (
              <View style={[styles.wordBadge, { backgroundColor: `${accent}18` }]}>
                <Text style={[styles.wordBadgeText, { color: accent }]}>
                  {wordCount} words
                </Text>
              </View>
            )}

            {/* Done badge for completed lists */}
            {allDone && (
              <View style={[styles.doneBadge]}>
                <Ionicons name="checkmark-circle" size={11} color="#34D399" />
                <Text style={styles.doneBadgeText}>Done</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

type ThemeColors = typeof Colors.dark;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      flex: 1,
      margin: 6,
    },

    // Separate layer for scale/shadow animation — no layout animation here
    scaleLayer: {
      flex: 1,
      borderRadius: 20,
      overflow: 'hidden',
    },

    card: {
      flex: 1,
      borderRadius: 20,
      minHeight: 180,
      borderWidth: 1.5,
      overflow: 'hidden',
      padding: 14,
      paddingTop: 18,
      backgroundColor: colors.cardBase,
    },

    colorOverlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 20,
    },

    selectedCard: {
      borderWidth: 2,
    },

    // ─── Top stripe ──────────────────────────────────────────────
    topStripe: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3.5,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },

    // ─── Header ─────────────────────────────────────────────────
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },

    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    pinnedBadge: {
      fontSize: 12,
    },

    lockBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    typePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1,
    },
    typePillText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },

    deleteBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(248, 113, 113, 0.1)',
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    headerBtns: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    pinnedCard: {
      borderWidth: 2,
    },

    pinBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.border + '30',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },

    pinEmoji: {
      fontSize: 13,
      lineHeight: 16,
    },

    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ─── Title ──────────────────────────────────────────────────
    title: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 9,
      letterSpacing: -0.4,
      lineHeight: 21,
    },

    // ─── Note body ──────────────────────────────────────────────
    body: {
      fontSize: 12.5,
      color: colors.icon,
      lineHeight: 19,
      flex: 1,
    },

    // ─── Locked preview ─────────────────────────────────────────
    lockedPreview: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 16,
    },
    lockedPreviewText: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.3,
    },

    // ─── Task list ──────────────────────────────────────────────
    tasksWrap: {
      flex: 1,
      gap: 6,
    },

    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    taskCheck: {
      width: 15,
      height: 15,
      borderRadius: 4,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },

    taskText: {
      fontSize: 12,
      color: colors.text,
      flex: 1,
      fontWeight: '500',
      lineHeight: 17,
    },

    moreText: {
      fontSize: 11,
      fontWeight: '700',
      marginTop: 1,
      letterSpacing: 0.2,
    },

    // ─── Progress ───────────────────────────────────────────────
    progressWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },

    progressBg: {
      flex: 1,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },

    progressFill: {
      height: 4,
      borderRadius: 3,
    },

    progressLabel: {
      fontSize: 10,
      fontWeight: '700',
      minWidth: 24,
      textAlign: 'right',
    },

    // ─── Footer ─────────────────────────────────────────────────
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    footerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    dateText: {
      fontSize: 10,
      color: colors.icon,
      fontWeight: '500',
      opacity: 0.75,
    },

    wordBadge: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
    },

    wordBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.3,
    },

    doneBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    doneBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#34D399',
      letterSpacing: 0.3,
    },
  });
}