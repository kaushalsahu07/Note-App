import React, { useState, useMemo } from 'react';
import {
  View, TextInput, Modal, StyleSheet, Text,
  TouchableOpacity, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { ZoomIn, FadeInDown } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';

type DialogMode = 'setup' | 'unlock' | 'change' | 'disable';

interface E2EESetupDialogProps {
  visible: boolean;
  mode: DialogMode;
  onClose: () => void;
  onSubmit: (passphrase: string, newPassphrase?: string) => Promise<boolean>;
}

const MODE_CONFIG: Record<DialogMode, {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  confirmLabel: string;
  showConfirm: boolean;
  showNew: boolean;
}> = {
  setup: {
    icon: 'shield-checkmark',
    iconColor: '#34D399',
    title: 'Enable E2EE',
    subtitle: 'Set a master passphrase to encrypt all your notes and passwords at rest',
    confirmLabel: 'Enable Encryption',
    showConfirm: true,
    showNew: false,
  },
  unlock: {
    icon: 'lock-open',
    iconColor: '#818CF8',
    title: 'Unlock Vault',
    subtitle: 'Enter your master passphrase to access your encrypted data',
    confirmLabel: 'Unlock',
    showConfirm: false,
    showNew: false,
  },
  change: {
    icon: 'key',
    iconColor: '#FBBF24',
    title: 'Change Passphrase',
    subtitle: 'Enter your current passphrase and a new one',
    confirmLabel: 'Change Passphrase',
    showConfirm: true,
    showNew: true,
  },
  disable: {
    icon: 'shield-outline',
    iconColor: '#F87171',
    title: 'Disable E2EE',
    subtitle: 'Enter your passphrase to decrypt and disable encryption',
    confirmLabel: 'Disable Encryption',
    showConfirm: false,
    showNew: false,
  },
};

export default function E2EESetupDialog({
  visible, mode, onClose, onSubmit,
}: E2EESetupDialogProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [newConfirm, setNewConfirm] = useState('');
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const config = MODE_CONFIG[mode];

  const reset = () => {
    setPassphrase('');
    setConfirm('');
    setNewPassphrase('');
    setNewConfirm('');
    setError('');
    setShowPw(false);
    setIsLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!passphrase.trim()) {
      setError('Passphrase is required');
      return;
    }

    if (mode === 'setup' || mode === 'change') {
      const toCheck = mode === 'change' ? newPassphrase : passphrase;
      const toConfirm = mode === 'change' ? newConfirm : confirm;

      if (toCheck.length < 4) {
        setError('Passphrase must be at least 4 characters');
        return;
      }
      if (toCheck !== toConfirm) {
        setError('Passphrases do not match');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      const success = await onSubmit(
        passphrase,
        mode === 'change' ? newPassphrase : undefined
      );
      if (success) {
        reset();
      } else {
        setError(
          mode === 'unlock'
            ? 'Wrong passphrase. Please try again.'
            : mode === 'change'
            ? 'Current passphrase is incorrect.'
            : 'Failed. Please try again.'
        );
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Animated.View entering={ZoomIn.duration(350)} style={styles.dialog}>
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: `${config.iconColor}18` }]}>
            <Ionicons name={config.icon as any} size={28} color={config.iconColor} />
          </View>

          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.subtitle}>{config.subtitle}</Text>

          {/* Passphrase input */}
          <Text style={styles.fieldLabel}>
            {mode === 'change' ? 'Current Passphrase' : 'Master Passphrase'}
          </Text>
          <View style={styles.inputRow}>
            <Ionicons name="key-outline" size={16} color={colors.icon} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              value={passphrase}
              onChangeText={t => { setPassphrase(t); setError(''); }}
              placeholder="Enter passphrase"
              placeholderTextColor={colors.icon}
              secureTextEntry={!showPw}
              autoFocus
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
              <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {/* Confirm — for setup mode */}
          {config.showConfirm && !config.showNew && (
            <>
              <Text style={styles.fieldLabel}>Confirm Passphrase</Text>
              <View style={styles.inputRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.icon} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={t => { setConfirm(t); setError(''); }}
                  placeholder="Confirm passphrase"
                  placeholderTextColor={colors.icon}
                  secureTextEntry={!showPw}
                />
              </View>
            </>
          )}

          {/* New passphrase — for change mode */}
          {config.showNew && (
            <>
              <View style={styles.divider} />
              <Text style={styles.fieldLabel}>New Passphrase</Text>
              <View style={styles.inputRow}>
                <Ionicons name="key-outline" size={16} color={colors.icon} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  value={newPassphrase}
                  onChangeText={t => { setNewPassphrase(t); setError(''); }}
                  placeholder="Enter new passphrase"
                  placeholderTextColor={colors.icon}
                  secureTextEntry={!showPw}
                />
              </View>

              <Text style={styles.fieldLabel}>Confirm New Passphrase</Text>
              <View style={styles.inputRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.icon} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  value={newConfirm}
                  onChangeText={t => { setNewConfirm(t); setError(''); }}
                  placeholder="Confirm new passphrase"
                  placeholderTextColor={colors.icon}
                  secureTextEntry={!showPw}
                />
              </View>
            </>
          )}

          {/* Error */}
          {!!error && (
            <Animated.View entering={FadeInDown.duration(200)} style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* Info pill */}
          {mode === 'setup' && (
            <View style={styles.infoPill}>
              <Ionicons name="information-circle" size={14} color={colors.accent} />
              <Text style={styles.infoText}>
                Remember this passphrase — it cannot be recovered if lost
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={isLoading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: config.iconColor },
                isLoading && { opacity: 0.6 },
              ]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name={config.icon as any} size={15} color="#fff" />
                  <Text style={styles.confirmBtnText}>{config.confirmLabel}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type ThemeColors = typeof Colors.dark;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(8, 12, 20, 0.88)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    dialog: {
      backgroundColor: colors.surfaceSolid,
      borderRadius: 28,
      padding: 26,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 13,
      color: colors.icon,
      marginBottom: 20,
      textAlign: 'center',
      lineHeight: 19,
      paddingHorizontal: 8,
    },
    fieldLabel: {
      alignSelf: 'flex-start',
      fontSize: 11,
      fontWeight: '700',
      color: colors.icon,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 6,
      marginTop: 4,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 14,
      marginBottom: 10,
    },
    input: {
      flex: 1,
      paddingVertical: 13,
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    eyeBtn: { padding: 6 },
    divider: {
      width: '100%',
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
      marginBottom: 4,
      alignSelf: 'flex-start',
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '500',
    },
    infoPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.glassLight,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 8,
      width: '100%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      color: colors.icon,
      fontWeight: '500',
      lineHeight: 17,
    },
    btnRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
      marginTop: 18,
    },
    cancelBtn: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelBtnText: { color: colors.icon, fontSize: 15, fontWeight: '600' },
    confirmBtn: {
      flex: 1.3,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 14,
      paddingVertical: 14,
    },
    confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  });
}
