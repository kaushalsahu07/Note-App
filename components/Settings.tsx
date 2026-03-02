import { CustomAlert as Alert } from './CustomAlert';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { createBackup, restoreFromBackup } from '../utils/backupRestore';
import PasswordManager from './PasswordManager';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { StatusBar } from 'expo-status-bar';

interface SettingRowProps {
  icon: string;
  iconColor: string;
  label: string;
  description?: string;
  onPress: () => void;
  index: number;
}

function SettingRow({ icon, iconColor, label, description, onPress, index }: SettingRowProps) {
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
        <Ionicons name="chevron-forward" size={18} color={Colors.dark.icon} style={{ opacity: 0.5 }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function Settings({ onClose }: { onClose: () => void }) {
  const handleBackup = async () => {
    try {
      await createBackup();
      Alert.alert('Backup Created', 'Your data has been backed up successfully.');
    } catch {
      Alert.alert('Error', 'Failed to create backup');
    }
  };

  const handleRestore = async () => {
    Alert.alert('Restore Data', 'This will overwrite your current data. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore', style: 'destructive',
        onPress: async () => {
          try {
            await restoreFromBackup();
            Alert.alert('Restored!', 'Data restored successfully.');
          } catch {
            Alert.alert('Error', 'Failed to restore data');
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Handle bar */}
      <View style={styles.handleBar} />

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Ionicons name="close" size={20} color={Colors.dark.icon} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Security section */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={styles.sectionLabel}>🔐  Security</Text>
        </Animated.View>
        <View style={styles.card}>
          <PasswordManager />
        </View>

        {/* Backup section */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          <Text style={styles.sectionLabel}>☁️  Backup & Restore</Text>
        </Animated.View>
        <View style={styles.card}>
          <SettingRow
            icon="cloud-upload-outline"
            iconColor={Colors.dark.accent}
            label="Create Backup"
            description="Export your notes to a file"
            onPress={handleBackup}
            index={2}
          />
          <View style={styles.separator} />
          <SettingRow
            icon="cloud-download-outline"
            iconColor={Colors.dark.accentSecondary}
            label="Restore Data"
            description="Import notes from a backup file"
            onPress={handleRestore}
            index={3}
          />
        </View>

        {/* About section */}
        <Animated.View entering={FadeInDown.delay(220).duration(400)}>
          <Text style={styles.sectionLabel}>ℹ️  About</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(260).duration(400)} style={styles.aboutCard}>
          <View style={styles.appIconWrap}>
            <Ionicons name="journal" size={36} color={Colors.dark.accent} />
          </View>
          <View>
            <Text style={styles.appName}>Note App</Text>
            <Text style={styles.appVersion}>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
          </View>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  handleBar: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.dark.border,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  title: {
    fontSize: 24, fontWeight: '800',
    color: Colors.dark.text, letterSpacing: -0.6,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.dark.surfaceSolid,
    borderWidth: 1, borderColor: Colors.dark.border,
    justifyContent: 'center', alignItems: 'center',
  },
  scroll: { padding: 20, paddingBottom: 60 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700',
    color: Colors.dark.icon,
    letterSpacing: 0.5,
    marginTop: 24, marginBottom: 10,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: Colors.dark.surfaceSolid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  settingRow: {
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
  rowLabel: { fontSize: 16, fontWeight: '600', color: Colors.dark.text, letterSpacing: -0.2 },
  rowDesc: { fontSize: 13, color: Colors.dark.icon, marginTop: 2 },
  separator: {
    height: 1, backgroundColor: Colors.dark.border,
    marginLeft: 72,
  },
  aboutCard: {
    backgroundColor: Colors.dark.surfaceSolid,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.dark.border,
    padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  appIconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: Colors.dark.glassLight,
    borderWidth: 1, borderColor: Colors.dark.border,
    justifyContent: 'center', alignItems: 'center',
  },
  appName: { fontSize: 18, fontWeight: '700', color: Colors.dark.text, letterSpacing: -0.3 },
  appVersion: { fontSize: 13, color: Colors.dark.icon, marginTop: 3 },
});