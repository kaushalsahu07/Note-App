import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    FadeInDown, FadeInUp,
    useSharedValue, useAnimatedStyle, withSpring
} from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { StatusBar } from 'expo-status-bar';

type OptionConfig = {
    icon: string;
    label: string;
    description: string;
    route: string;
    color: string;
    bg: string;
};

const OPTIONS: OptionConfig[] = [
    {
        icon: 'document-text',
        label: 'Note',
        description: 'Capture thoughts, ideas & rich text',
        route: '/new',
        color: '#818CF8',
        bg: 'rgba(129, 140, 248, 0.12)',
    },
    {
        icon: 'checkbox',
        label: 'To-Do List',
        description: 'Organize tasks and track progress',
        route: '/new-todo',
        color: '#34D399',
        bg: 'rgba(52, 211, 153, 0.12)',
    },
];

function OptionItem({ option, delay, onPress }: { option: OptionConfig; delay: number; onPress: () => void }) {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
        <Animated.View
            entering={FadeInDown.delay(delay).duration(500)}
            style={styles.optionCardWrapper}
        >
            <Animated.View style={animStyle}>
                <Pressable
                    style={[styles.optionCard, { borderColor: `${option.color}35` }]}
                    onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
                    onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
                    onPress={onPress}
                >
                    {/* Glow accent line */}
                    <View style={[styles.accentLine, { backgroundColor: option.color }]} />

                    {/* Icon */}
                    <View style={[styles.optionIconWrap, { backgroundColor: option.bg }]}>
                        <Ionicons name={option.icon as any} size={30} color={option.color} />
                    </View>

                    {/* Text */}
                    <View style={styles.optionText}>
                        <Text style={styles.optionLabel}>{option.label}</Text>
                        <Text style={styles.optionDesc}>{option.description}</Text>
                    </View>

                    {/* Arrow */}
                    <View style={[styles.arrowWrap, { backgroundColor: option.bg }]}>
                        <Ionicons name="arrow-forward" size={16} color={option.color} />
                    </View>
                </Pressable>
            </Animated.View>
        </Animated.View>
    );
}

export default function SelectTypeScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
                <Animated.View style={styles.headerGlow} />
                <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.85}>
                    <Ionicons name="close" size={20} color={Colors.dark.icon} />
                </TouchableOpacity>
            </Animated.View>

            {/* Title */}
            <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.titleSection}>
                <Text style={styles.titleLabel}>✨  Create New</Text>
                <Text style={styles.titleMain}>What are you{'\n'}making today?</Text>
            </Animated.View>

            {/* Options */}
            <View style={styles.optionsContainer}>
                {OPTIONS.map((opt, i) => (
                    <OptionItem
                        key={opt.label}
                        option={opt}
                        delay={200 + i * 100}
                        onPress={() => router.push(opt.route as any)}
                    />
                ))}
            </View>

            {/* Bottom ambient glow */}
            <Animated.View entering={FadeInUp.delay(500).duration(800)} style={styles.bottomGlow} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 22,
        paddingTop: 62,
        paddingBottom: 8,
    },
    headerGlow: {
        position: 'absolute',
        top: -40,
        left: '30%',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: Colors.dark.accent,
        opacity: 0.07,
    },
    closeBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: Colors.dark.surfaceSolid,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleSection: {
        paddingHorizontal: 24,
        paddingBottom: 36,
        paddingTop: 16,
    },
    titleLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.dark.accent,
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    titleMain: {
        fontSize: 40,
        fontWeight: '800',
        color: Colors.dark.text,
        letterSpacing: -1.5,
        lineHeight: 48,
    },
    optionsContainer: {
        paddingHorizontal: 20,
        gap: 14,
    },
    optionCardWrapper: {
        borderRadius: 24,
        overflow: 'hidden',
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surfaceSolid,
        borderRadius: 24,
        padding: 18,
        borderWidth: 1.5,
        gap: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
        overflow: 'hidden',
    },
    accentLine: {
        position: 'absolute',
        left: 0,
        top: '15%',
        bottom: '15%',
        width: 3.5,
        borderRadius: 2,
    },
    optionIconWrap: {
        width: 60,
        height: 60,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionText: {
        flex: 1,
    },
    optionLabel: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.dark.text,
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    optionDesc: {
        fontSize: 13,
        color: Colors.dark.icon,
        lineHeight: 19,
    },
    arrowWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomGlow: {
        position: 'absolute',
        bottom: -30,
        alignSelf: 'center',
        width: 280,
        height: 100,
        backgroundColor: Colors.dark.accentSecondary,
        opacity: 0.06,
        borderRadius: 100,
    },
});
