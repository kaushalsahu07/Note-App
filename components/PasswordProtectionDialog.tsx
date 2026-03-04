import React, { useState, useMemo } from 'react';
import { View, TextInput, Modal, StyleSheet, Text, TouchableOpacity, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';

interface PasswordProtectionDialogProps {
  visible: boolean;
  onClose: () => void;
  onSetPassword: (password: string, hint: string) => void;
}

export default function PasswordProtectionDialog({
  visible, onClose, onSetPassword,
}: PasswordProtectionDialogProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const handleSet = () => {
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    onSetPassword(password, hint.trim());
    setPassword('');
    setConfirm('');
    setHint('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setPassword('');
    setConfirm('');
    setHint('');
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Animated.View entering={ZoomIn.duration(350)} style={styles.dialog}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={28} color={colors.accentTertiary} />
          </View>

          <Text style={styles.title}>Set Password</Text>
          <Text style={styles.subtitle}>Protect this note with a password</Text>

          {/* Password input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={t => { setPassword(t); setError(''); }}
              placeholder="Enter password"
              placeholderTextColor={colors.icon}
              secureTextEntry={!showPw}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
              <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {/* Confirm input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={t => { setConfirm(t); setError(''); }}
              placeholder="Confirm password"
              placeholderTextColor={colors.icon}
              secureTextEntry={!showPw}
              returnKeyType="next"
            />
          </View>

          {/* Hint input */}
          <View style={[styles.inputRow, { marginBottom: 0 }]}>
            <Ionicons name="help-circle-outline" size={16} color={colors.icon} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              value={hint}
              onChangeText={setHint}
              placeholder="Password hint (optional)"
              placeholderTextColor={colors.icon}
              onSubmitEditing={handleSet}
              returnKeyType="done"
            />
          </View>

          {!!error && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={13} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!password.trim() || !confirm.trim()) && { opacity: 0.4 }]}
              onPress={handleSet}
              disabled={!password.trim() || !confirm.trim()}
            >
              <Ionicons name="shield-checkmark-outline" size={15} color="#fff" />
              <Text style={styles.confirmBtnText}>Set Password</Text>
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
    padding: 28,
  },
  dialog: {
    backgroundColor: colors.surfaceSolid,
    borderRadius: 28,
    padding: 28,
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
    backgroundColor: colors.glassLight,
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
    fontSize: 14,
    color: colors.icon,
    marginBottom: 22,
    textAlign: 'center',
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
    marginBottom: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  eyeBtn: { padding: 6 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500',
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accentTertiary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });
}