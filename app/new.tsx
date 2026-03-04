import { CustomAlert as Alert } from '../components/CustomAlert';
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { saveNote } from '../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors, NOTE_COLORS, NOTE_ACCENT_COLORS } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';

export default function NewNoteScreen() {
    const router = useRouter();
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [title, setTitle] = useState('');
    const [hasContent, setHasContent] = useState(false);
    const contentRef = useRef('');
    const [selectedColorIndex, setSelectedColorIndex] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    const saveBtnScale = useSharedValue(1);
    const saveBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveBtnScale.value }] }));

    const canSave = title.trim().length > 0 && hasContent;
    const accentColor = NOTE_ACCENT_COLORS[selectedColorIndex];

    const handleContentChange = useCallback((text: string) => {
        contentRef.current = text;
        const nonEmpty = text.trim().length > 0;
        setHasContent(prev => prev !== nonEmpty ? nonEmpty : prev);
    }, []);

    const handleSave = async () => {
        if (isSaving || !canSave) return;
        saveBtnScale.value = withSpring(0.93);
        setTimeout(() => { saveBtnScale.value = withSpring(1); }, 150);

        setIsSaving(true);
        try {
            const newNote = {
                id: Date.now().toString(),
                title: title.trim(),
                content: contentRef.current.trim(),
                date: new Date().toLocaleDateString(),
                lastModified: new Date().toISOString(),
                color: NOTE_COLORS[selectedColorIndex],
            };
            const success = await saveNote(newNote);
            if (success) router.replace('/');
            else Alert.alert('Error', 'Failed to save note');
        } catch (e) {
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBack = () => {
        if (title.trim() || contentRef.current.trim()) {
            Alert.alert('Discard Changes', 'Are you sure?', [
                { text: 'Keep Editing', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => router.back() },
            ]);
        } else {
            router.back();
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Header */}
            <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.8}>
                    <Ionicons name="chevron-back" size={20} color={colors.icon} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>

                <Animated.View style={saveBtnStyle}>
                    <TouchableOpacity
                        style={[styles.saveBtn, canSave && { backgroundColor: accentColor }, !canSave && { opacity: 0.4 }]}
                        onPress={handleSave}
                        disabled={!canSave || isSaving}
                        activeOpacity={0.9}
                    >
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : 'Save'}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>

            <ScrollView
                style={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                automaticallyAdjustKeyboardInsets={true}
                contentContainerStyle={{ paddingBottom: 150 }}
            >
                <Animated.View entering={FadeInDown.delay(100).duration(500)}>
                    <TextInput
                        style={styles.titleInput}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Note title..."
                        placeholderTextColor={colors.icon}
                        maxLength={100}
                    />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(180).duration(500)}>
                    <TextInput
                        style={styles.contentInput}
                        defaultValue=""
                        onChangeText={handleContentChange}
                        placeholder="Start writing..."
                        placeholderTextColor={colors.icon}
                        multiline
                        textAlignVertical="top"
                    />
                </Animated.View>
            </ScrollView>

            {/* Color Picker */}
            <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.colorBar}>
                <Text style={styles.colorLabel}>Card Color</Text>
                <View style={styles.colorRow}>
                    {NOTE_ACCENT_COLORS.map((color, i) => (
                        <TouchableOpacity
                            key={i}
                            style={[
                                styles.colorSwatch,
                                { backgroundColor: color },
                                selectedColorIndex === i && styles.swatchSelected,
                            ]}
                            onPress={() => setSelectedColorIndex(i)}
                            activeOpacity={0.8}
                        >
                            {selectedColorIndex === i && (
                                <Ionicons name="checkmark" size={14} color="#fff" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </Animated.View>
        </KeyboardAvoidingView>
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
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 60,
            paddingBottom: 16,
            borderBottomColor: colors.border,
        },
        backBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingVertical: 6,
            paddingHorizontal: 4,
        },
        backText: {
            color: colors.icon,
            fontSize: 16,
            fontWeight: '500',
        },
        saveBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.surfaceSolid,
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.border,
        },
        saveBtnText: {
            color: '#fff',
            fontSize: 15,
            fontWeight: '700',
        },
        scroll: {
            flex: 1,
        },
        titleInput: {
            fontSize: 28,
            fontWeight: '800',
            color: colors.text,
            paddingHorizontal: 22,
            paddingTop: 24,
            paddingBottom: 8,
            letterSpacing: -0.8,
        },
        contentInput: {
            fontSize: 17,
            color: colors.text,
            paddingHorizontal: 22,
            paddingTop: 12,
            paddingBottom: 120,
            lineHeight: 28,
            minHeight: 800,
            fontWeight: '400',
        },
        colorBar: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.surfaceSolid,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: 22,
            paddingVertical: 16,
            paddingBottom: 34,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
        },
        colorLabel: {
            fontSize: 13,
            color: colors.icon,
            fontWeight: '600',
            letterSpacing: 0.3,
        },
        colorRow: {
            flexDirection: 'row',
            gap: 10,
            flex: 1,
        },
        colorSwatch: {
            width: 32,
            height: 32,
            borderRadius: 16,
            justifyContent: 'center',
            alignItems: 'center',
        },
        swatchSelected: {
        },
    });
}
