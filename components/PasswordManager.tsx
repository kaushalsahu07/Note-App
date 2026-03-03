import { CustomAlert as Alert } from './CustomAlert';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ──────────────────────────────────────────────────────────
interface SavedPassword {
  id: string;
  title: string;
  password: string;
  date: string;
  category?: string;
  lastModified?: string;
}

const PASSWORDS_KEY = 'saved_passwords';
const BIOMETRIC_ENABLED = 'biometric_enabled';

// ─── Category accent colors ──────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  General: '#818CF8',
  Social: '#F472B6',
  Work: '#38BDF8',
  Finance: '#34D399',
  Shopping: '#FBBF24',
  Other: '#A78BFA',
};
const categoryColor = (cat?: string) =>
  CATEGORY_COLORS[cat ?? 'General'] ?? '#6366F1';

// ────────────────────────────────────────────────────────────────────
export default function PasswordManager() {
  const [isVisible, setIsVisible] = useState(false);
  const [passwords, setPasswords] = useState<SavedPassword[]>([]);
  const [showPasswords, setShowPasswords] = useState<{ [k: string]: boolean }>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [editItem, setEditItem] = useState<SavedPassword | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditPw, setShowEditPw] = useState(false);
  const [isBioSupported, setIsBioSupported] = useState(false);
  const [isBioEnabled, setIsBioEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top]);

  // ─── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    checkBioSupport();
    loadBioSettings();
  }, []);

  const checkBioSupport = async () => setIsBioSupported(await LocalAuthentication.hasHardwareAsync());
  const loadBioSettings = async () => {
    const v = await AsyncStorage.getItem(BIOMETRIC_ENABLED);
    setIsBioEnabled(v === 'true');
  };

  // ─── Biometric ──────────────────────────────────────────────────
  const toggleBiometric = async () => {
    if (!isBioEnabled) {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric lock',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });
      if (!r.success) return;
    }
    const next = !isBioEnabled;
    await AsyncStorage.setItem(BIOMETRIC_ENABLED, String(next));
    setIsBioEnabled(next);
  };

  const authenticate = async () => {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access passwords',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });
    if (r.success) { setIsVisible(true); loadPasswords(); }
    else Alert.alert('Authentication Failed', 'Please try again');
  };

  const handleOpen = () => {
    if (isBioSupported && isBioEnabled) authenticate();
    else { setIsVisible(true); loadPasswords(); }
  };

  // ─── CRUD ────────────────────────────────────────────────────────
  const loadPasswords = async () => {
    const raw = await AsyncStorage.getItem(PASSWORDS_KEY);
    if (raw) setPasswords(JSON.parse(raw));
  };

  const persist = async (list: SavedPassword[]) => {
    await AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(list));
    setPasswords(list);
  };

  const saveNew = async () => {
    if (!newTitle.trim() || !newPassword.trim()) {
      Alert.alert('Error', 'Please enter both a title and password');
      return;
    }
    const entry: SavedPassword = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      password: newPassword.trim(),
      date: new Date().toLocaleDateString(),
      category: newCategory.trim() || 'General',
      lastModified: new Date().toISOString(),
    };
    await persist([entry, ...passwords]);
    resetAdd();
    Alert.alert('Saved', 'Password saved successfully');
  };

  const resetAdd = () => {
    setNewTitle(''); setNewPassword('');
    setNewCategory(''); setShowAdd(false);
    setShowNewPw(false); Keyboard.dismiss();
  };

  const handleEdit = (item: SavedPassword) => {
    setEditItem(item);
    setEditTitle(item.title);
    setEditPassword(item.password);
    setEditCategory(item.category || '');
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editItem) return;
    if (!editTitle.trim() || !editPassword.trim()) {
      Alert.alert('Error', 'Title and password are required');
      return;
    }
    const updated = passwords.map(p =>
      p.id === editItem.id
        ? {
          ...p, title: editTitle.trim(), password: editPassword.trim(),
          category: editCategory.trim() || 'General',
          lastModified: new Date().toISOString()
        }
        : p
    );
    await persist(updated);
    closeEdit();
    Alert.alert('Updated', 'Password updated successfully');
  };

  const closeEdit = () => {
    setShowEditModal(false); setEditItem(null);
    setEditTitle(''); setEditPassword(''); setEditCategory('');
    setShowEditPw(false);
  };

  const deletePassword = (id: string) => {
    Alert.alert('Delete Password', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await persist(passwords.filter(p => p.id !== id)); },
      },
    ]);
  };

  // ─── Filtered list ───────────────────────────────────────────────
  const filtered = passwords.filter(p => {
    const q = searchQuery.toLowerCase();
    return p.title.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q);
  });

  // ─── Password item ───────────────────────────────────────────────
  const renderItem = ({ item, index }: { item: SavedPassword; index: number }) => {
    const cc = categoryColor(item.category);
    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
        <View style={[styles.pwCard, { borderColor: `${cc}40` }]}>
          {/* Left accent bar */}
          <View style={[styles.pwAccentBar, { backgroundColor: cc }]} />

          <View style={styles.pwMain}>
            {/* Header */}
            <View style={styles.pwHeader}>
              <View style={styles.pwTitleWrap}>
                <Text style={styles.pwTitle} numberOfLines={1}>{item.title}</Text>
                {item.category ? (
                  <View style={[styles.catPill, { backgroundColor: `${cc}20`, borderColor: `${cc}45` }]}>
                    <Text style={[styles.catText, { color: cc }]}>{item.category}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.pwDate}>{item.date}</Text>
            </View>

            {/* Password row */}
            <View style={styles.pwBody}>
              <Text style={styles.pwValue} numberOfLines={1}>
                {showPasswords[item.id] ? item.password : '•'.repeat(Math.min(item.password.length, 20))}
              </Text>
              <View style={styles.pwActions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setShowPasswords(p => ({ ...p, [item.id]: !p[item.id] }))}
                >
                  <Ionicons name={showPasswords[item.id] ? 'eye-off' : 'eye'} size={17} color={cc} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleEdit(item)}>
                  <Ionicons name="pencil" size={16} color={colors.icon} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, styles.deleteIconBtn]} onPress={() => deletePassword(item.id)}>
                  <Ionicons name="trash" size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  // ─── Settings modal ──────────────────────────────────────────────
  const SettingsModal = () => (
    <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
      <View style={styles.overlay}>
        <Animated.View entering={ZoomIn.duration(300)} style={styles.settingsCard}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>Settings</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
              <Ionicons name="finger-print" size={18} color="#34D399" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Biometric Lock</Text>
              <Text style={styles.settingDesc}>
                {isBioSupported
                  ? `${isBioEnabled ? 'Enabled' : 'Disabled'} — tap to toggle`
                  : 'Not supported on this device'}
              </Text>
            </View>
            {isBioSupported && (
              <TouchableOpacity
                style={[styles.toggle, isBioEnabled && styles.toggleOn]}
                onPress={toggleBiometric}
              >
                <View style={[styles.toggleKnob, isBioEnabled && styles.toggleKnobOn]} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <>
      {/* Trigger button */}
      <TouchableOpacity style={styles.managerBtn} onPress={handleOpen} activeOpacity={0.85}>
        <View style={styles.managerBtnIcon}>
          <Ionicons name="key" size={18} color={colors.accent} />
        </View>
        <Text style={styles.managerBtnText}>Password Manager</Text>
        <View style={styles.managerBtnRight}>
          {isBioSupported && isBioEnabled && (
            <Ionicons name="finger-print" size={18} color={colors.accentSecondary} />
          )}
          <Ionicons name="chevron-forward" size={16} color={colors.icon} />
        </View>
      </TouchableOpacity>

      {/* Main modal */}
      <Modal visible={isVisible} animationType="slide" onRequestClose={() => setIsVisible(false)}>
        <View style={styles.screen}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setIsVisible(false)} style={styles.closeBtn}>
              <Ionicons name="chevron-down" size={22} color={colors.icon} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
              <Text style={styles.headerTitle}>Password Manager</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSettings(true)}>
                <Ionicons name="settings-outline" size={20} color={colors.icon} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, styles.addIconBtn]}
                onPress={() => setShowAdd(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.icon} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by title or category…"
              placeholderTextColor={colors.icon}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.icon} />
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          {passwords.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="lock-closed" size={40} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No passwords yet</Text>
              <Text style={styles.emptySubtitle}>Tap + to add your first entry</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAdd(true)}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Add Password</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filtered}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="search" size={36} color={colors.icon} />
                  <Text style={[styles.emptyTitle, { marginTop: 12 }]}>No results</Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>

      {/* Add sheet */}
      <SheetModal
        visible={showAdd}
        title="Add Password"
        titleVal={newTitle} onTitleChange={setNewTitle}
        categoryVal={newCategory} onCategoryChange={setNewCategory}
        pwVal={newPassword} onPwChange={setNewPassword}
        showPw={showNewPw} onTogglePw={() => setShowNewPw(!showNewPw)}
        onSave={saveNew}
        onClose={resetAdd}
        styles={styles}
        colors={colors}
      />

      {/* Edit sheet */}
      <SheetModal
        visible={showEditModal}
        title="Edit Password"
        titleVal={editTitle} onTitleChange={setEditTitle}
        categoryVal={editCategory} onCategoryChange={setEditCategory}
        pwVal={editPassword} onPwChange={setEditPassword}
        showPw={showEditPw} onTogglePw={() => setShowEditPw(!showEditPw)}
        onSave={saveEdit}
        onClose={closeEdit}
        styles={styles}
        colors={colors}
      />

      <SettingsModal />
    </>
  );
}

// ─── Add/Edit bottom sheet (outside component to prevent remount on re-render) ──
type ThemeColors = typeof Colors.dark;

function SheetModal({
  visible, title: sheetTitle, titleVal, onTitleChange,
  categoryVal, onCategoryChange, pwVal, onPwChange,
  showPw, onTogglePw, onSave, onClose, styles, colors,
}: {
  visible: boolean; title: string; titleVal: string; onTitleChange: (v: string) => void;
  categoryVal: string; onCategoryChange: (v: string) => void;
  pwVal: string; onPwChange: (v: string) => void;
  showPw: boolean; onTogglePw: () => void; onSave: () => void; onClose: () => void;
  styles: ReturnType<typeof makeStyles>; colors: ThemeColors;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.sheetOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              {/* Handle */}
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{sheetTitle}</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={20} color={colors.icon} />
                </TouchableOpacity>
              </View>

              {/* Title */}
              <Text style={styles.fieldLabel}>Username / Email</Text>
              <View style={styles.fieldInput}>
                <Ionicons name="person-outline" size={16} color={colors.icon} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  value={titleVal}
                  onChangeText={onTitleChange}
                  placeholder="e.g. john@example.com"
                  placeholderTextColor={colors.icon}
                  autoCapitalize="none"
                />
              </View>

              {/* Category */}
              <Text style={styles.fieldLabel}>Website / Category</Text>
              <View style={styles.fieldInput}>
                <Ionicons name="folder-outline" size={16} color={colors.icon} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  value={categoryVal}
                  onChangeText={onCategoryChange}
                  placeholder="e.g. Social, Work, Finance…"
                  placeholderTextColor={colors.icon}
                />
              </View>

              {/* Password */}
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.fieldInput}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.icon} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  value={pwVal}
                  onChangeText={onPwChange}
                  placeholder="Enter password"
                  placeholderTextColor={colors.icon}
                  secureTextEntry={!showPw}
                />
                <TouchableOpacity onPress={onTogglePw} style={{ padding: 4 }}>
                  <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={colors.icon} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, (!titleVal.trim() || !pwVal.trim()) && { opacity: 0.4 }]}
                onPress={onSave}
                disabled={!titleVal.trim() || !pwVal.trim()}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Save Password</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

function makeStyles(colors: ThemeColors, topInset: number = 0) {
  return StyleSheet.create({

    // ─── Trigger button ─────────────────────────────────────────────
    managerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surfaceSolid,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    managerBtnIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: 'rgba(129,140,248,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    managerBtnText: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    managerBtnRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    // ─── Main screen ────────────────────────────────────────────────
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ─── Header ─────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: Math.max(topInset, 16) + 8,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    // ─── Icon buttons ────────────────────────────────────────────────
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceSolid,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.surfaceSolid,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addIconBtn: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    deleteIconBtn: {
      backgroundColor: 'rgba(248,113,113,0.10)',
      borderColor: 'rgba(248,113,113,0.25)',
    },

    // ─── Search ─────────────────────────────────────────────────────
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      backgroundColor: colors.surfaceSolid,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
    },

    // ─── List ────────────────────────────────────────────────────────
    list: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      gap: 12,
    },

    // ─── Password card ───────────────────────────────────────────────
    pwCard: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSolid,
      borderRadius: 18,
      borderWidth: 1,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    pwAccentBar: {
      width: 4,
      borderTopLeftRadius: 18,
      borderBottomLeftRadius: 18,
    },
    pwMain: {
      flex: 1,
      paddingVertical: 13,
      paddingHorizontal: 14,
      gap: 8,
    },
    pwHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    pwTitleWrap: {
      flex: 1,
      gap: 5,
    },
    pwTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    catPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    },
    catText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    pwDate: {
      color: colors.icon,
      fontSize: 11,
      fontWeight: '500',
    },
    pwBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    pwValue: {
      flex: 1,
      color: colors.icon,
      fontSize: 13,
      fontWeight: '500',
      letterSpacing: 0.5,
    },
    pwActions: {
      flexDirection: 'row',
      gap: 6,
    },

    // ─── Empty state ─────────────────────────────────────────────────
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      paddingTop: 60,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(129,140,248,0.12)',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    emptySubtitle: {
      color: colors.icon,
      fontSize: 14,
      fontWeight: '500',
    },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingHorizontal: 22,
      paddingVertical: 12,
      marginTop: 8,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    emptyBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },

    // ─── Bottom sheet ────────────────────────────────────────────────
    sheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(8,12,20,0.85)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surfaceSolid,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      paddingHorizontal: 22,
      paddingBottom: 36,
      paddingTop: 12,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 22,
    },
    sheetTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.5,
    },

    // ─── Form fields ─────────────────────────────────────────────────
    fieldLabel: {
      color: colors.icon,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 6,
      marginTop: 14,
    },
    fieldInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 14,
    },
    textInput: {
      flex: 1,
      paddingVertical: 13,
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 15,
      marginTop: 24,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    saveBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },

    // ─── Settings modal ──────────────────────────────────────────────
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(8,12,20,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 28,
    },
    settingsCard: {
      backgroundColor: colors.surfaceSolid,
      borderRadius: 24,
      padding: 22,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 16,
    },
    settingsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 18,
    },
    settingsTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 10,
    },
    settingIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingInfo: {
      flex: 1,
    },
    settingTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 3,
    },
    settingDesc: {
      color: colors.icon,
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 17,
    },
    toggle: {
      width: 50,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 2,
      justifyContent: 'center',
    },
    toggleOn: {
      backgroundColor: '#34D399',
      borderColor: '#34D399',
    },
    toggleKnob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.icon,
      alignSelf: 'flex-start',
    },
    toggleKnobOn: {
      backgroundColor: '#fff',
      alignSelf: 'flex-end',
    },
  });
}
