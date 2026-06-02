import { CustomAlert as Alert } from './CustomAlert';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { createBackup, restoreFromBackup } from '../utils/backupRestore';
import {
  isE2EEEnabled, setupE2EE, disableE2EE, changeE2EEPassphrase,
  verifyE2EEPassphrase, setSessionPassphrase, getSessionPassphrase,
} from '../utils/storage';
import PasswordManager from './PasswordManager';
import E2EESetupDialog from './E2EESetupDialog';
import ExportFormatDialog from './ExportFormatDialog';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SettingRowProps {
  icon: string;
  iconColor: string;
  label: string;
  description?: string;
  onPress: () => void;
  index: number;
  colors: typeof Colors.dark;
}

function SettingRow({ icon, iconColor, label, description, onPress, index, colors }: SettingRowProps) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
      <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.75}>
        <View style={[styles.rowIcon, { backgroundColor: `${iconColor}18` }]}>
          <Ionicons name={icon as any} size={20} color={iconColor} />
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowLabel}>{label}</Text>
          {description && <Text style={styles.rowDesc}>{description}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.icon} style={{ opacity: 0.5 }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function Settings({ onClose }: { onClose: () => void }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top]);

  // E2EE state
  const [e2eeEnabled, setE2eeEnabled] = useState(false);
  const [e2eeDialogVisible, setE2eeDialogVisible] = useState(false);
  const [e2eeDialogMode, setE2eeDialogMode] = useState<'setup' | 'unlock' | 'change' | 'disable'>('setup');
  const [exportDialogVisible, setExportDialogVisible] = useState(false);
  const [restorePassphraseDialog, setRestorePassphraseDialog] = useState(false);

  useEffect(() => {
    checkE2EEStatus();
  }, []);

  const checkE2EEStatus = async () => {
    const enabled = await isE2EEEnabled();
    setE2eeEnabled(enabled);
  };

  // ─── E2EE handlers ─────────────────────────────────────────────────

  const handleEnableE2EE = () => {
    setE2eeDialogMode('setup');
    setE2eeDialogVisible(true);
  };

  const handleDisableE2EE = () => {
    setE2eeDialogMode('disable');
    setE2eeDialogVisible(true);
  };

  const handleChangePassphrase = () => {
    setE2eeDialogMode('change');
    setE2eeDialogVisible(true);
  };

  const handleE2EESubmit = async (passphrase: string, newPassphrase?: string): Promise<boolean> => {
    if (e2eeDialogMode === 'setup') {
      const success = await setupE2EE(passphrase);
      if (success) {
        setE2eeEnabled(true);
        setE2eeDialogVisible(false);
        Alert.alert('🔒 E2EE Enabled', 'All your notes and passwords are now encrypted at rest.');
      }
      return success;
    }

    if (e2eeDialogMode === 'disable') {
      const valid = await verifyE2EEPassphrase(passphrase);
      if (!valid) return false;
      const success = await disableE2EE(passphrase);
      if (success) {
        setE2eeEnabled(false);
        setE2eeDialogVisible(false);
        Alert.alert('🔓 E2EE Disabled', 'Encryption has been removed. Data is stored as plaintext.');
      }
      return success;
    }

    if (e2eeDialogMode === 'change' && newPassphrase) {
      const success = await changeE2EEPassphrase(passphrase, newPassphrase);
      if (success) {
        setE2eeDialogVisible(false);
        Alert.alert('✅ Passphrase Changed', 'Your encryption passphrase has been updated.');
      }
      return success;
    }

    return false;
  };

  // ─── Backup / Restore handlers ─────────────────────────────────────

  const handleBackup = async () => {
    if (e2eeEnabled) {
      // Show format choice dialog
      setExportDialogVisible(true);
    } else {
      // No E2EE — just create plaintext backup
      const success = await createBackup(false);
      if (success) {
        Alert.alert('Backup Created', 'Your data has been backed up successfully.');
      }
    }
  };

  const handleExportFormat = async (encrypted: boolean) => {
    setExportDialogVisible(false);
    const success = await createBackup(encrypted);
    if (success) {
      Alert.alert(
        'Backup Created',
        encrypted
          ? 'Your encrypted backup has been created. You\'ll need your passphrase to restore it.'
          : 'Your data has been backed up successfully.'
      );
    }
  };

  const handleRestore = async () => {
    Alert.alert('Restore Data', 'This will overwrite your current data. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore', style: 'destructive',
        onPress: async () => {
          const result = await restoreFromBackup();
          if (result === 'needs_passphrase') {
            // Show passphrase dialog for encrypted backup
            setRestorePassphraseDialog(true);
          }
        }
      }
    ]);
  };

  const handleRestorePassphrase = async (passphrase: string): Promise<boolean> => {
    const result = await restoreFromBackup(passphrase);
    if (result === true) {
      setRestorePassphraseDialog(false);
      return true;
    }
    return false;
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Handle bar */}
      <View style={styles.handleBar} />

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Ionicons name="close" size={20} color={colors.icon} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Appearance section */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <Text style={styles.sectionLabel}>🎨  Appearance</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.card}>
          <TouchableOpacity style={styles.themeRow} onPress={toggleTheme} activeOpacity={0.8}>
            <View style={[styles.rowIcon, { backgroundColor: isDark ? 'rgba(251,191,36,0.15)' : 'rgba(99,102,241,0.12)' }]}>
              <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={isDark ? '#FBBF24' : colors.accent} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
              <Text style={styles.rowDesc}>Tap to switch to {isDark ? 'light' : 'dark'} mode</Text>
            </View>
            <View style={[styles.themeToggle, isDark && styles.themeToggleDark]}>
              <View style={[styles.themeToggleKnob, isDark && styles.themeToggleKnobDark]} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Security section */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={styles.sectionLabel}>🔐  Security</Text>
        </Animated.View>
        <View style={styles.card}>
          <PasswordManager />
        </View>

        {/* E2EE section */}
        <Animated.View entering={FadeInDown.delay(130).duration(400)}>
          <Text style={styles.sectionLabel}>🛡️  Encryption</Text>
        </Animated.View>
        <View style={styles.card}>
          {/* Status indicator */}
          <Animated.View entering={FadeInDown.delay(140).duration(400)}>
            <View style={styles.e2eeStatusRow}>
              <View style={[
                styles.e2eeStatusIcon,
                { backgroundColor: e2eeEnabled ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.12)' }
              ]}>
                <Ionicons
                  name={e2eeEnabled ? 'shield-checkmark' : 'shield-outline'}
                  size={20}
                  color={e2eeEnabled ? '#34D399' : colors.icon}
                />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>End-to-End Encryption</Text>
                <Text style={[styles.rowDesc, e2eeEnabled && { color: '#34D399' }]}>
                  {e2eeEnabled ? 'Active — data encrypted at rest' : 'Disabled — data stored as plaintext'}
                </Text>
              </View>
              <View style={[
                styles.e2eeStatusBadge,
                { backgroundColor: e2eeEnabled ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.12)' }
              ]}>
                <Text style={[
                  styles.e2eeStatusBadgeText,
                  { color: e2eeEnabled ? '#34D399' : colors.danger }
                ]}>
                  {e2eeEnabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </View>
          </Animated.View>

          <View style={styles.separator} />

          {/* Enable/Disable toggle */}
          {e2eeEnabled ? (
            <>
              <SettingRow
                icon="key-outline"
                iconColor="#FBBF24"
                label="Change Passphrase"
                description="Update your master passphrase"
                onPress={handleChangePassphrase}
                index={4}
                colors={colors}
              />
              <View style={styles.separator} />
              <SettingRow
                icon="shield-outline"
                iconColor={colors.danger}
                label="Disable E2EE"
                description="Decrypt and remove encryption"
                onPress={handleDisableE2EE}
                index={5}
                colors={colors}
              />
            </>
          ) : (
            <SettingRow
              icon="shield-checkmark"
              iconColor="#34D399"
              label="Enable E2EE"
              description="Encrypt all notes & passwords"
              onPress={handleEnableE2EE}
              index={4}
              colors={colors}
            />
          )}
        </View>

        {/* Backup section */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          <Text style={styles.sectionLabel}>☁️  Backup & Restore</Text>
        </Animated.View>
        <View style={styles.card}>
          <SettingRow
            icon="cloud-upload-outline"
            iconColor={colors.accent}
            label="Create Backup"
            description={e2eeEnabled ? 'Export notes (choose format)' : 'Export your notes to a file'}
            onPress={handleBackup}
            index={2}
            colors={colors}
          />
          <View style={styles.separator} />
          <SettingRow
            icon="cloud-download-outline"
            iconColor={colors.accentSecondary}
            label="Restore Data"
            description="Import notes from a backup file"
            onPress={handleRestore}
            index={3}
            colors={colors}
          />
        </View>

        {/* About section */}
        <Animated.View entering={FadeInDown.delay(220).duration(400)}>
          <Text style={styles.sectionLabel}>ℹ️  About</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(260).duration(400)} style={styles.aboutCard}>
          <View style={styles.appIconWrap}>
            <Ionicons name="journal" size={36} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.appName}>Note App</Text>
            <Text style={styles.appVersion}>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
          </View>
        </Animated.View>

      </ScrollView>

      {/* E2EE Dialog */}
      <E2EESetupDialog
        visible={e2eeDialogVisible}
        mode={e2eeDialogMode}
        onClose={() => setE2eeDialogVisible(false)}
        onSubmit={handleE2EESubmit}
      />

      {/* Export Format Dialog */}
      <ExportFormatDialog
        visible={exportDialogVisible}
        onClose={() => setExportDialogVisible(false)}
        onSelectFormat={handleExportFormat}
        title="Backup Format"
      />

      {/* Restore Passphrase Dialog (for encrypted backups) */}
      <E2EESetupDialog
        visible={restorePassphraseDialog}
        mode="unlock"
        onClose={() => setRestorePassphraseDialog(false)}
        onSubmit={async (passphrase) => handleRestorePassphrase(passphrase)}
      />
    </View>
  );
}

type ThemeColors = typeof Colors.dark;

function makeStyles(colors: ThemeColors, topInset: number = 0) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: topInset },
    handleBar: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: 16, marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 22,
      paddingTop: 8,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24, fontWeight: '800',
      color: colors.text, letterSpacing: -0.6,
    },
    closeBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: colors.surfaceSolid,
      borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },
    scroll: { padding: 20, paddingBottom: 60 },
    sectionLabel: {
      fontSize: 13, fontWeight: '700',
      color: colors.icon,
      letterSpacing: 0.5,
      marginTop: 24, marginBottom: 10,
      textTransform: 'uppercase',
    },
    card: {
      backgroundColor: colors.surfaceSolid,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 14,
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 14,
    },
    rowIcon: {
      width: 42, height: 42, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center',
    },
    rowContent: { flex: 1 },
    rowLabel: { fontSize: 16, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
    rowDesc: { fontSize: 13, color: colors.icon, marginTop: 2 },
    separator: {
      height: 1, backgroundColor: colors.border,
      marginLeft: 72,
    },
    themeToggle: {
      width: 50, height: 28, borderRadius: 14,
      backgroundColor: colors.glassLight,
      borderWidth: 1, borderColor: colors.border,
      padding: 3, justifyContent: 'center',
    },
    themeToggleDark: {
      backgroundColor: '#818CF8',
      borderColor: '#818CF8',
    },
    themeToggleKnob: {
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.icon,
      alignSelf: 'flex-start',
    },
    themeToggleKnobDark: {
      backgroundColor: '#fff',
      alignSelf: 'flex-end',
    },
    // E2EE status row
    e2eeStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 14,
    },
    e2eeStatusIcon: {
      width: 42, height: 42, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center',
    },
    e2eeStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    e2eeStatusBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    aboutCard: {
      backgroundColor: colors.surfaceSolid,
      borderRadius: 20, borderWidth: 1, borderColor: colors.border,
      padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16,
    },
    appIconWrap: {
      width: 64, height: 64, borderRadius: 20,
      backgroundColor: colors.glassLight,
      borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },
    appName: { fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
    appVersion: { fontSize: 13, color: colors.icon, marginTop: 3 },
  });
}