import { CustomAlert as Alert } from './CustomAlert';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { Colors } from '../constants/Colors';
import {
  register, login, logout, pushToCloud, pullFromCloud,
  checkCloudStatus, deleteCloudData, getNextSyncInfo, startAutoSync,
} from '../utils/cloudSync';
import {
  getSyncEmail, isLoggedIn as checkIsLoggedIn, getLastSyncTime,
  isAutoSyncEnabled, setAutoSyncEnabled,
} from '../utils/syncConfig';

type ThemeColors = typeof Colors.dark;

interface CloudSyncDialogProps {
  visible: boolean;
  onClose: () => void;
}

type ViewMode = 'auth' | 'dashboard';
type AuthMode = 'login' | 'register';

export default function CloudSyncDialog({ visible, onClose }: CloudSyncDialogProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Auth state
  const [viewMode, setViewMode] = useState<ViewMode>('auth');
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Dashboard state
  const [loggedInEmail, setLoggedInEmail] = useState('');
  const [lastSyncTime, setLastSyncTimeSt] = useState<string | null>(null);
  const [cloudExists, setCloudExists] = useState(false);
  const [cloudSize, setCloudSize] = useState(0);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [nextSync, setNextSync] = useState<{ hoursLeft: number; minutesLeft: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);


  // ─── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      checkLoginState();
    }
  }, [visible]);

  const checkLoginState = async () => {
    const loggedIn = await checkIsLoggedIn();
    if (loggedIn) {
      setViewMode('dashboard');
      loadDashboardData();
    } else {
      setViewMode('auth');
      setAuthMode('register');
    }
  };

  const loadDashboardData = async () => {
    try {
      const [emailVal, lastSync, autoEnabled, status, nextSyncInfo] = await Promise.all([
        getSyncEmail(),
        getLastSyncTime(),
        isAutoSyncEnabled(),
        checkCloudStatus(),
        getNextSyncInfo(),
      ]);

      setLoggedInEmail(emailVal || '');
      setLastSyncTimeSt(lastSync);
      setAutoSync(autoEnabled);
      setCloudExists(status.exists);
      setCloudSize(status.sizeBytes || 0);
      setCloudUpdatedAt(status.updatedAt || '');
      setNextSync(nextSyncInfo);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  // ─── Auth Handlers ───────────────────────────────────────────────

  const handleAuth = async () => {
    setError('');

    if (!email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (authMode === 'register') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setIsLoading(true);
    try {
      const result = authMode === 'register'
        ? await register(email, password)
        : await login(email, password);

      if (result.success) {
        setViewMode('dashboard');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setError('');
        loadDashboardData();

        // Enable auto-sync by default on first register
        if (authMode === 'register') {
          await setAutoSyncEnabled(true);
          setAutoSync(true);
          startAutoSync();
        }
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Sync Handlers ──────────────────────────────────────────────

  const handlePush = async () => {
    setIsSyncing(true);
    const result = await pushToCloud();
    setIsSyncing(false);

    if (result.success) {
      Alert.alert('✅ Synced!', 'Your data has been uploaded to the cloud.');
      loadDashboardData();
    } else {
      Alert.alert('Sync Failed', result.error || 'Failed to push data');
    }
  };

  const handlePull = async () => {
    Alert.alert(
      '☁️ Restore from Cloud',
      'Your local notes will be merged with the cloud version.\n\n' +
      '⚠️ If a note exists in both local and cloud, the cloud version will take priority.\n\n' +
      'Local-only notes will be kept safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge & Restore',
          onPress: async () => {
            setIsSyncing(true);
            const result = await pullFromCloud();
            setIsSyncing(false);

            if (result.success && result.mergeStats) {
              const { totalNotes, updatedFromCloud, keptLocal, newFromCloud } = result.mergeStats;
              Alert.alert(
                '✅ Restored!',
                `Your data has been merged successfully.\n\n` +
                `📝 Total notes: ${totalNotes}\n` +
                (updatedFromCloud > 0 ? `☁️ Updated from cloud: ${updatedFromCloud}\n` : '') +
                (newFromCloud > 0 ? `🆕 New from cloud: ${newFromCloud}\n` : '') +
                (keptLocal > 0 ? `📱 Local-only notes kept: ${keptLocal}` : '')
              );
              loadDashboardData();
            } else if (result.success) {
              Alert.alert('✅ Restored!', 'Your data has been merged from the cloud.');
              loadDashboardData();
            } else {
              Alert.alert('Restore Failed', result.error || 'Failed to pull data');
            }
          }
        },
      ]
    );
  };

  const handleDeleteCloud = () => {
    Alert.alert(
      '⚠️ Delete Cloud Data',
      'This will permanently delete ALL your data from the cloud. Your local data will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setIsSyncing(true);
            const result = await deleteCloudData();
            setIsSyncing(false);

            if (result.success) {
              Alert.alert('Deleted', 'Cloud data has been removed.');
              loadDashboardData();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete cloud data');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'You will need to log in again to sync. Your local data will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out', style: 'destructive',
          onPress: async () => {
            await logout();
            setViewMode('auth');
            setAuthMode('login');
          },
        },
      ]
    );
  };

  const handleToggleAutoSync = async () => {
    const newVal = !autoSync;
    setAutoSync(newVal);
    await setAutoSyncEnabled(newVal);
    if (newVal) {
      startAutoSync();
    }
  };



  // ─── Helpers ─────────────────────────────────────────────────────

  const getPasswordStrength = (pw: string): { label: string; color: string; width: string } => {
    if (pw.length === 0) return { label: '', color: 'transparent', width: '0%' };
    if (pw.length < 6) return { label: 'Too short', color: '#EF4444', width: '15%' };
    if (pw.length < 8) return { label: 'Weak', color: '#F59E0B', width: '33%' };
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasNumber = /[0-9]/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    const variety = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    if (pw.length >= 12 && variety >= 3) return { label: 'Strong', color: '#10B981', width: '100%' };
    if (pw.length >= 8 && variety >= 2) return { label: 'Good', color: '#34D399', width: '66%' };
    return { label: 'Fair', color: '#FBBF24', width: '50%' };
  };

  const formatSyncTime = (iso: string | null): string => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const passwordStrength = getPasswordStrength(password);

  // ─── Render ──────────────────────────────────────────────────────

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View entering={ZoomIn.duration(350)} style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="cloud" size={28} color={colors.accent} />
            </View>
            <Text style={styles.headerTitle}>Cloud Sync</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="close" size={18} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {viewMode === 'auth' ? (
              // ────────────── AUTH VIEW ──────────────────────────────
              <Animated.View entering={FadeInDown.duration(300)}>
                {/* Warning Banner */}
                {authMode === 'register' && (
                  <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.warningBanner}>
                    <Ionicons name="warning" size={20} color="#F59E0B" />
                    <Text style={styles.warningText}>
                      Your password is your encryption key. If you forget it, your cloud data will be{' '}
                      <Text style={{ fontWeight: '800' }}>permanently lost</Text>. We cannot recover it.{'\n'}
                      Do not share your password with anyone.
                    </Text>
                  </Animated.View>
                )}

                {/* Auth Mode Tabs */}
                <View style={styles.authTabs}>
                  <TouchableOpacity
                    style={[styles.authTab, authMode === 'register' && styles.authTabActive]}
                    onPress={() => { setAuthMode('register'); setError(''); }}
                  >
                    <Text style={[styles.authTabText, authMode === 'register' && styles.authTabTextActive]}>
                      Sign Up
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.authTab, authMode === 'login' && styles.authTabActive]}
                    onPress={() => { setAuthMode('login'); setError(''); }}
                  >
                    <Text style={[styles.authTabText, authMode === 'login' && styles.authTabTextActive]}>
                      Log In
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Email */}
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={colors.icon} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor={colors.icon}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Password */}
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.icon} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Password"
                    placeholderTextColor={colors.icon}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.icon} />
                  </TouchableOpacity>
                </View>

                {/* Password Strength */}
                {authMode === 'register' && password.length > 0 && (
                  <Animated.View entering={FadeIn.duration(200)}>
                    <View style={styles.strengthBar}>
                      <View style={[styles.strengthFill, { width: passwordStrength.width as any, backgroundColor: passwordStrength.color }]} />
                    </View>
                    <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                      {passwordStrength.label}
                    </Text>
                  </Animated.View>
                )}

                {/* Confirm Password */}
                {authMode === 'register' && (
                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.icon} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm password"
                      placeholderTextColor={colors.icon}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                  </View>
                )}

                {/* Error */}
                {error ? (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </Animated.View>
                ) : null}

                {/* Submit */}
                <TouchableOpacity
                  style={[styles.primaryBtn, isLoading && { opacity: 0.6 }]}
                  onPress={handleAuth}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {authMode === 'register' ? 'Create Account' : 'Log In'}
                    </Text>
                  )}
                </TouchableOpacity>


              </Animated.View>
            ) : (
              // ────────────── DASHBOARD VIEW ────────────────────────
              <Animated.View entering={FadeInDown.duration(300)}>
                {/* Account Info */}
                <View style={styles.accountCard}>
                  <View style={styles.accountIconWrap}>
                    <Ionicons name="person-circle" size={40} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountEmail}>{loggedInEmail}</Text>
                    <Text style={styles.accountLabel}>Logged in</Text>
                  </View>
                  <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                    <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>

                {/* Sync Status */}
                <View style={styles.statusCard}>
                  <View style={styles.statusRow}>
                    <View style={styles.statusItem}>
                      <Ionicons name="time-outline" size={18} color={colors.accent} />
                      <Text style={styles.statusLabel}>Last Sync</Text>
                      <Text style={styles.statusValue}>{formatSyncTime(lastSyncTime)}</Text>
                    </View>
                    <View style={styles.statusDivider} />
                    <View style={styles.statusItem}>
                      <Ionicons name="cloud-outline" size={18} color={colors.accentSecondary} />
                      <Text style={styles.statusLabel}>Cloud</Text>
                      <Text style={styles.statusValue}>
                        {cloudExists ? formatBytes(cloudSize) : 'Empty'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Sync Actions */}
                <View style={styles.syncActions}>
                  <TouchableOpacity
                    style={[styles.syncBtn, styles.pushBtn, isSyncing && { opacity: 0.6 }]}
                    onPress={handlePush}
                    disabled={isSyncing}
                    activeOpacity={0.85}
                  >
                    {isSyncing ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={20} color="#fff" />
                        <Text style={styles.syncBtnText}>Sync Now</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.syncBtn, styles.pullBtn, (isSyncing || !cloudExists) && { opacity: 0.5 }]}
                    onPress={handlePull}
                    disabled={isSyncing || !cloudExists}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="cloud-download" size={20} color={colors.accentSecondary} />
                    <Text style={[styles.syncBtnText, { color: colors.accentSecondary }]}>Restore</Text>
                  </TouchableOpacity>
                </View>

                {/* Auto Sync Toggle */}
                <TouchableOpacity style={styles.autoSyncRow} onPress={handleToggleAutoSync} activeOpacity={0.8}>
                  <View style={[styles.autoSyncIcon, { backgroundColor: autoSync ? 'rgba(52,211,153,0.15)' : `${colors.icon}15` }]}>
                    <Ionicons name="sync-circle" size={20} color={autoSync ? '#34D399' : colors.icon} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.autoSyncLabel}>Daily Auto-Sync</Text>
                    <Text style={styles.autoSyncDesc}>
                      {autoSync
                        ? nextSync
                          ? `Next in ${nextSync.hoursLeft}h ${nextSync.minutesLeft}m`
                          : 'Will sync when app opens'
                        : 'Disabled'}
                    </Text>
                  </View>
                  <View style={[styles.toggle, autoSync && styles.toggleActive]}>
                    <View style={[styles.toggleKnob, autoSync && styles.toggleKnobActive]} />
                  </View>
                </TouchableOpacity>

                {/* Danger Zone */}
                <View style={styles.dangerSection}>
                  <Text style={styles.dangerTitle}>Danger Zone</Text>
                  <TouchableOpacity
                    style={styles.dangerBtn}
                    onPress={handleDeleteCloud}
                    disabled={!cloudExists || isSyncing}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={styles.dangerBtnText}>Delete Cloud Data</Text>
                  </TouchableOpacity>
                </View>


              </Animated.View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(8, 12, 20, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    dialog: {
      backgroundColor: colors.surfaceSolid,
      borderRadius: 28,
      width: '100%',
      maxWidth: 420,
      maxHeight: '85%',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.2,
      shadowRadius: 32,
      elevation: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    headerIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.glassLight,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 28,
    },

    // ─── Warning Banner ────────────────────────────────
    warningBanner: {
      flexDirection: 'row',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
      borderRadius: 16,
      padding: 14,
      gap: 10,
      marginBottom: 20,
      alignItems: 'flex-start',
    },
    warningText: {
      flex: 1,
      fontSize: 12.5,
      color: '#F59E0B',
      lineHeight: 18,
      fontWeight: '500',
    },

    // ─── Auth Tabs ─────────────────────────────────────
    authTabs: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 4,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    authTab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 11,
      alignItems: 'center',
    },
    authTabActive: {
      backgroundColor: colors.surfaceSolid,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    authTabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.icon,
    },
    authTabTextActive: {
      color: colors.text,
    },

    // ─── Inputs ────────────────────────────────────────
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      marginBottom: 12,
      paddingHorizontal: 14,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    eyeBtn: {
      padding: 6,
    },

    // ─── Password Strength ─────────────────────────────
    strengthBar: {
      height: 4,
      backgroundColor: colors.background,
      borderRadius: 2,
      marginBottom: 4,
      marginTop: -6,
      marginHorizontal: 4,
      overflow: 'hidden',
    },
    strengthFill: {
      height: '100%',
      borderRadius: 2,
    },
    strengthLabel: {
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 12,
      marginLeft: 4,
    },

    // ─── Error ─────────────────────────────────────────
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 14,
      paddingHorizontal: 4,
    },
    errorText: {
      fontSize: 13,
      color: colors.danger,
      fontWeight: '500',
      flex: 1,
    },

    // ─── Buttons ───────────────────────────────────────
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: 'center',
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
      marginTop: 4,
    },
    primaryBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryBtn: {
      backgroundColor: colors.glassLight,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryBtnText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '600',
    },

    // ─── Server Config ─────────────────────────────────
    serverConfigLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 16,
      paddingVertical: 8,
    },
    serverConfigLinkText: {
      fontSize: 12,
      color: colors.icon,
      fontWeight: '500',
    },

    // ─── Dashboard: Account ────────────────────────────
    accountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      marginBottom: 16,
    },
    accountIconWrap: {},
    accountEmail: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    accountLabel: {
      fontSize: 12,
      color: colors.accentSecondary,
      fontWeight: '600',
      marginTop: 2,
    },
    logoutBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: 'rgba(248,113,113,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(248,113,113,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ─── Dashboard: Status ─────────────────────────────
    statusCard: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusItem: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
    },
    statusLabel: {
      fontSize: 11,
      color: colors.icon,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statusValue: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '700',
    },
    statusDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.border,
    },

    // ─── Dashboard: Sync Actions ───────────────────────
    syncActions: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    syncBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
    },
    pushBtn: {
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
    pullBtn: {
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    syncBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },

    // ─── Dashboard: Auto Sync ──────────────────────────
    autoSyncRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      marginBottom: 16,
    },
    autoSyncIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    autoSyncLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    autoSyncDesc: {
      fontSize: 12,
      color: colors.icon,
      marginTop: 2,
    },
    toggle: {
      width: 46,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.glassLight,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
      justifyContent: 'center',
    },
    toggleActive: {
      backgroundColor: '#818CF8',
      borderColor: '#818CF8',
    },
    toggleKnob: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.icon,
      alignSelf: 'flex-start',
    },
    toggleKnobActive: {
      backgroundColor: '#fff',
      alignSelf: 'flex-end',
    },

    // ─── Dashboard: Danger Zone ────────────────────────
    dangerSection: {
      marginTop: 4,
    },
    dangerTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.danger,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: 'rgba(248,113,113,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(248,113,113,0.2)',
    },
    dangerBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.danger,
    },
  });
}
