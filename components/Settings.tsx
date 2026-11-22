import { CustomAlert as Alert } from './CustomAlert';
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { createBackup, restoreFromBackup } from '../utils/backupRestore';
import {
  isE2EEEnabled, setupE2EE, disableE2EE, changeE2EEPassphrase,
  verifyE2EEPassphrase,
} from '../utils/storage';
import PasswordManager from './PasswordManager';
import E2EESetupDialog from './E2EESetupDialog';
import ExportFormatDialog from './ExportFormatDialog';
import CloudSyncDialog from './CloudSyncDialog';
import { Colors } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isLoggedIn, getLastSyncTime, isAutoSyncEnabled } from '../utils/syncConfig';
import { getNextSyncInfo } from '../utils/cloudSync';

interface SettingRowProps {
  icon: string;
  iconColor: string;
  label: string;
  description?: string;
  onPress: () => void;
  index?: number;
  colors: typeof Colors.dark;
}

function SettingRow({ icon, iconColor, label, description, onPress, colors }: SettingRowProps) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
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
  );
}

export default function Settings({ onClose }: { onClose: () => void }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'ios' ? 8 : Math.max(insets.top, 12);
  const styles = useMemo(() => makeStyles(colors, topInset), [colors, topInset]);

  // E2EE state
  const [e2eeEnabled, setE2eeEnabled] = useState(false);
  const [e2eeDialogVisible, setE2eeDialogVisible] = useState(false);
  const [e2eeDialogMode, setE2eeDialogMode] = useState<'setup' | 'unlock' | 'change' | 'disable'>('setup');
  const [exportDialogVisible, setExportDialogVisible] = useState(false);
  const [restorePassphraseDialog, setRestorePassphraseDialog] = useState(false);

  // Cloud Sync state
  const [cloudSyncDialogVisible, setCloudSyncDialogVisible] = useState(false);
  const [syncLoggedIn, setSyncLoggedIn] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('Not set up');
  const [autoSyncText, setAutoSyncText] = useState('');

  useEffect(() => {
    checkE2EEStatus();
    loadSyncStatus();
  }, []);

  const checkE2EEStatus = async () => {
    const enabled = await isE2EEEnabled();
    setE2eeEnabled(enabled);
  };

  const loadSyncStatus = async () => {
    try {
      const loggedIn = await isLoggedIn();
      setSyncLoggedIn(loggedIn);
      if (loggedIn) {
        const lastSync = await getLastSyncTime();
        if (lastSync) {
          const d = new Date(lastSync);
          const now = new Date();
          const diffMs = now.getTime() - d.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 1) setSyncStatusText('Synced just now');
          else if (diffMins < 60) setSyncStatusText(`Synced ${diffMins}m ago`);
          else {
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) setSyncStatusText(`Synced ${diffHours}h ago`);
            else setSyncStatusText(`Synced ${Math.floor(diffHours / 24)}d ago`);
          }
        } else {
          setSyncStatusText('Not synced yet');
        }

        const autoEnabled = await isAutoSyncEnabled();
        if (autoEnabled) {
          const nextSync = await getNextSyncInfo();
          if (nextSync) {
            setAutoSyncText(`Auto-sync in ${nextSync.hoursLeft}h ${nextSync.minutesLeft}m`);
          } else {
            setAutoSyncText('Auto-sync enabled');
          }
        }
      } else {
        setSyncStatusText('Not set up');
      }
    } catch {
      setSyncStatusText('Not set up');
    }
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
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Ionicons name="close" size={20} color={colors.icon} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Appearance section */}
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.themeRow} onPress={toggleTheme} activeOpacity={0.8}>
            <View style={[styles.rowIcon, { backgroundColor: isDark ? `${colors.warning}18` : `${colors.accent}12` }]}>
              <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={isDark ? colors.warning : colors.accent} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
              <Text style={styles.rowDesc}>Tap to switch to {isDark ? 'light' : 'dark'} mode</Text>
            </View>
            <View style={[styles.themeToggle, isDark && styles.themeToggleDark]}>
              <View style={[styles.themeToggleKnob, isDark && styles.themeToggleKnobDark]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Security section */}
        <Text style={styles.sectionLabel}>Security</Text>
        <PasswordManager />

        {/* E2EE section */}
        <Text style={styles.sectionLabel}>Encryption</Text>
        <View style={styles.card}>
          {/* Status indicator */}
          <View style={styles.e2eeStatusRow}>
            <View style={[
              styles.e2eeStatusIcon,
              { backgroundColor: e2eeEnabled ? `${colors.success}18` : `${colors.danger}15` }
            ]}>
              <Ionicons
                name={e2eeEnabled ? 'shield-checkmark' : 'shield-outline'}
                size={20}
                color={e2eeEnabled ? colors.success : colors.icon}
              />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>End-to-End Encryption</Text>
              <Text style={[styles.rowDesc, e2eeEnabled && { color: colors.success }]}>
                {e2eeEnabled ? 'Active: data encrypted at rest' : 'Disabled: data stored as plaintext'}
              </Text>
            </View>
            <View style={[
              styles.e2eeStatusBadge,
              { backgroundColor: e2eeEnabled ? `${colors.success}18` : `${colors.danger}15` }
            ]}>
              <Text style={[
                styles.e2eeStatusBadgeText,
                { color: e2eeEnabled ? colors.success : colors.danger }
              ]}>
                {e2eeEnabled ? 'ON' : 'OFF'}
              </Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Enable/Disable toggle */}
          {e2eeEnabled ? (
            <>
              <SettingRow
                icon="key-outline"
                iconColor={colors.warning}
                label="Change Passphrase"
                description="Update your master passphrase"
                onPress={handleChangePassphrase}
                colors={colors}
              />
              <View style={styles.separator} />
              <SettingRow
                icon="shield-outline"
                iconColor={colors.danger}
                label="Disable E2EE"
                description="Decrypt and remove encryption"
                onPress={handleDisableE2EE}
                colors={colors}
              />
            </>
          ) : (
            <SettingRow
              icon="shield-checkmark"
              iconColor={colors.success}
              label="Enable E2EE"
              description="Encrypt all notes & passwords"
              onPress={handleEnableE2EE}
              colors={colors}
            />
          )}
        </View>

        {/* Cloud Sync section */}
        <Text style={styles.sectionLabel}>Cloud sync</Text>
        <View style={styles.card}>
          <SettingRow
            icon="cloud-outline"
            iconColor={colors.accent}
            label="Cloud Sync"
            description={syncLoggedIn ? syncStatusText : 'Sign in to sync your data'}
            onPress={() => setCloudSyncDialogVisible(true)}
            colors={colors}
          />
          {syncLoggedIn && autoSyncText ? (
            <>
              <View style={styles.separator} />
              <View style={styles.autoSyncInfo}>
                <View style={[styles.rowIcon, { backgroundColor: `${colors.success}18` }]}>
                  <Ionicons name="sync-circle" size={20} color={colors.success} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Auto-Sync</Text>
                  <Text style={styles.rowDesc}>{autoSyncText}</Text>
                </View>
                <View style={[styles.e2eeStatusBadge, { backgroundColor: `${colors.success}18` }]}>
                  <Text style={[styles.e2eeStatusBadgeText, { color: colors.success }]}>ON</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* Backup section */}
        <Text style={styles.sectionLabel}>Backup & restore</Text>
        <View style={styles.card}>
          <SettingRow
            icon="cloud-upload-outline"
            iconColor={colors.accent}
            label="Create Backup"
            description={e2eeEnabled ? 'Export notes (choose format)' : 'Export your notes to a file'}
            onPress={handleBackup}
            colors={colors}
          />
          <View style={styles.separator} />
          <SettingRow
            icon="cloud-download-outline"
            iconColor={colors.accentSecondary}
            label="Restore Data"
            description="Import notes from a backup file"
            onPress={handleRestore}
            colors={colors}
          />
        </View>

        {/* About section */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.aboutCard}>
          <View style={styles.appIconWrap}>
            <Ionicons name="journal" size={32} color={colors.accent} />
          </View>
          <View style={styles.aboutContent}>
            <Text style={styles.appName}>Note App</Text>
            <Text style={styles.appVersion}>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
          </View>
        </View>

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

      {/* Cloud Sync Dialog */}
      <CloudSyncDialog
        visible={cloudSyncDialogVisible}
        onClose={() => {
          setCloudSyncDialogVisible(false);
          loadSyncStatus(); // Refresh sync status when dialog closes
        }}
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
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: 10, marginBottom: 6,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 22, fontWeight: '700',
      color: colors.text, letterSpacing: -0.3,
    },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surfaceSolid,
      borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },
    scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 60 },
    sectionLabel: {
      fontSize: 13, fontWeight: '600',
      color: colors.icon,
      marginTop: 20, marginBottom: 8,
    },
    card: {
      backgroundColor: colors.surfaceSolid,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
    },
    rowIcon: {
      width: 40, height: 40, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center',
    },
    rowContent: { flex: 1, flexShrink: 1 },
    rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
    rowDesc: { fontSize: 13, color: colors.icon, marginTop: 2, lineHeight: 18 },
    autoSyncInfo: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
    },
    separator: {
      height: StyleSheet.hairlineWidth, backgroundColor: colors.border,
      marginLeft: 68,
    },
    themeToggle: {
      width: 48, height: 28, borderRadius: 14,
      backgroundColor: colors.glassLight,
      borderWidth: 1, borderColor: colors.border,
      padding: 2, justifyContent: 'center',
    },
    themeToggleDark: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
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
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
    },
    e2eeStatusIcon: {
      width: 40, height: 40, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center',
    },
    e2eeStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      alignSelf: 'center',
    },
    e2eeStatusBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    aboutCard: {
      backgroundColor: colors.surfaceSolid,
      borderRadius: 16, borderWidth: 1, borderColor: colors.border,
      padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
    },
    aboutContent: {
      flex: 1,
      flexShrink: 1,
    },
    appIconWrap: {
      width: 50, height: 50, borderRadius: 14,
      backgroundColor: colors.glassLight,
      borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },
    appName: { fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
    appVersion: { fontSize: 13, color: colors.icon, marginTop: 2 },
  });
}