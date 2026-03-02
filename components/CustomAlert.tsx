import React, { useState, useImperativeHandle, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';

type ButtonConfig = { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };
type AlertConfig = { title: string; message?: string; buttons?: ButtonConfig[] };

export type CustomAlertRef = {
    alert: (title: string, message?: string, buttons?: ButtonConfig[]) => void;
};

// Global ref to allow triggering alert from outside React tree (like utils)
export const globalAlertRef = React.createRef<CustomAlertRef>();

export const CustomAlertProvider = ({ children }: { children: React.ReactNode }) => {
    const [config, setConfig] = useState<AlertConfig | null>(null);
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    useImperativeHandle(globalAlertRef, () => ({
        alert: (title, message, buttons) => {
            setConfig({ title, message, buttons: buttons || [{ text: 'OK' }] });
        }
    }));

    const closeAlert = () => setConfig(null);

    const handlePress = (btn: ButtonConfig) => {
        closeAlert();
        // Delay executing onPress until modal starts dismissing
        setTimeout(() => { if (btn.onPress) btn.onPress(); }, 150);
    };

    const stackButtons = config?.buttons && config.buttons.length > 2;

    return (
        <>
            {children}
            {config && (
                <Modal transparent visible animationType="none" onRequestClose={closeAlert} statusBarTranslucent>
                    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.overlay}>
                        <Animated.View entering={ZoomIn.duration(250)} exiting={ZoomOut.duration(200)} style={styles.alertBox}>

                            <View style={styles.header}>
                                <View style={styles.iconWrap}>
                                    <Text style={styles.emoji}>{config.buttons?.some(b => b.style === 'destructive') ? '⚠️' : '✨'}</Text>
                                </View>
                            </View>

                            <Text style={styles.title}>{config.title}</Text>
                            {config.message && <Text style={styles.message}>{config.message}</Text>}

                            <View style={[styles.buttonRow, stackButtons && { flexDirection: 'column' }]}>
                                {config.buttons?.map((btn, index) => {
                                    const isDestructive = btn.style === 'destructive';
                                    const isCancel = btn.style === 'cancel';
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.button,
                                                isDestructive && styles.btnDestructive,
                                                isCancel && styles.btnCancel,
                                                !isDestructive && !isCancel && styles.btnDefault,
                                                stackButtons ? { width: '100%', marginBottom: 8 } : { flex: 1, marginHorizontal: 4 }
                                            ]}
                                            onPress={() => handlePress(btn)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[
                                                styles.btnText,
                                                isDestructive && styles.textDestructive,
                                                isCancel && styles.textCancel,
                                                !isDestructive && !isCancel && styles.textDefault,
                                            ]}>
                                                {btn.text}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </Animated.View>
                    </Animated.View>
                </Modal>
            )}
        </>
    );
};

// Drop-in replacement for React Native's Alert.alert
export const CustomAlert = {
    alert: (title: string, message?: string, buttons?: ButtonConfig[]) => {
        globalAlertRef.current?.alert(title, message, buttons);
    }
};

type ThemeColors = typeof Colors.dark;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(8, 12, 20, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    alertBox: {
        backgroundColor: colors.surfaceSolid,
        borderRadius: 28,
        padding: 24,
        width: '100%',
        maxWidth: 360,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.15,
        shadowRadius: 32,
        elevation: 20,
    },
    header: {
        marginBottom: 16,
    },
    iconWrap: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    emoji: {
        fontSize: 28,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        color: colors.icon,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnDefault: {
        backgroundColor: colors.accent,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 6,
    },
    btnCancel: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    btnDestructive: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    btnText: {
        fontSize: 15,
        fontWeight: '700',
    },
    textDefault: {
        color: '#fff',
    },
    textCancel: {
        color: colors.icon,
    },
    textDestructive: {
        color: '#EF4444',
    },
  });
}
