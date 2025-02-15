import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  FlatList, 
  Alert,
  TextInput,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

interface SavedPassword {
  id: string;
  title: string;
  password: string;
  date: string;
  category?: string;
  lastModified?: string;
}

const PASSWORDS_KEY = 'saved_passwords';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PasswordManager() {
  const [isVisible, setIsVisible] = useState(false);
  const [passwords, setPasswords] = useState<SavedPassword[]>([]);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [newPasswordTitle, setNewPasswordTitle] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [category, setCategory] = useState('');
  const [editingPassword, setEditingPassword] = useState<SavedPassword | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  useEffect(() => {
    checkBiometricSupport();
    loadBiometricSettings();
  }, []);

  const checkBiometricSupport = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    setIsBiometricSupported(compatible);
  };

  const loadBiometricSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      setIsBiometricEnabled(enabled === 'true');
    } catch (error) {
      console.error('Error loading biometric settings:', error);
    }
  };

  const toggleBiometric = async () => {
    try {
      if (!isBiometricEnabled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to enable biometric lock',
          fallbackLabel: 'Use passcode',
          disableDeviceFallback: false,
        });

        if (!result.success) {
          return;
        }
      }

      const newValue = !isBiometricEnabled;
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, String(newValue));
      setIsBiometricEnabled(newValue);
      Alert.alert(
        'Success', 
        `Biometric authentication ${newValue ? 'enabled' : 'disabled'}`
      );
    } catch (error) {
      console.error('Error toggling biometric:', error);
      Alert.alert('Error', 'Failed to update biometric settings');
    }
  };

  const authenticate = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access passwords',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsVisible(true);
        loadPasswords();
      } else {
        Alert.alert('Authentication Failed', 'Please try again');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      Alert.alert('Error', 'Failed to authenticate');
    }
  };

  const handleManagerPress = async () => {
    if (isBiometricSupported && isBiometricEnabled) {
      authenticate();
    } else {
      setIsVisible(true);
      loadPasswords();
    }
  };

  const loadPasswords = async () => {
    try {
      const savedPasswords = await AsyncStorage.getItem(PASSWORDS_KEY);
      if (savedPasswords) {
        setPasswords(JSON.parse(savedPasswords));
      }
    } catch (error) {
      console.error('Error loading passwords:', error);
      Alert.alert('Error', 'Failed to load passwords');
    }
  };

  const saveNewPassword = async () => {
    if (!newPasswordTitle.trim() || !newPassword.trim()) {
      Alert.alert('Error', 'Please enter both Username/Email and password');
      return;
    }

    try {
      const newPasswordEntry: SavedPassword = {
        id: Date.now().toString(),
        title: newPasswordTitle.trim(),
        password: newPassword.trim(),
        date: new Date().toLocaleDateString(),
        category: category.trim() || 'General',
        lastModified: new Date().toISOString()
      };

      const updatedPasswords = [newPasswordEntry, ...passwords];
      await AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(updatedPasswords));
      setPasswords(updatedPasswords);
      resetForm();
      Alert.alert('Success', 'Password saved successfully');
    } catch (error) {
      console.error('Error saving password:', error);
      Alert.alert('Error', 'Failed to save password');
    }
  };

  const resetForm = () => {
    setNewPasswordTitle('');
    setNewPassword('');
    setCategory('');
    setShowAddPassword(false);
    Keyboard.dismiss();
  };

  const deletePassword = async (id: string) => {
    Alert.alert(
      'Delete Password',
      'Are you sure you want to delete this password?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedPasswords = passwords.filter(p => p.id !== id);
              await AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(updatedPasswords));
              setPasswords(updatedPasswords);
            } catch (error) {
              console.error('Error deleting password:', error);
              Alert.alert('Error', 'Failed to delete password');
            }
          }
        }
      ]
    );
  };

  const handleEditPress = (password: SavedPassword) => {
    setEditingPassword(password);
    setEditTitle(password.title);
    setEditPassword(password.password);
    setEditCategory(password.category || '');
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingPassword) return;

    if (!editTitle.trim() || !editPassword.trim()) {
      Alert.alert('Error', 'Please enter both title and password');
      return;
    }

    try {
      const updatedPasswords = passwords.map(p => 
        p.id === editingPassword.id 
          ? {
              ...p,
              title: editTitle.trim(),
              password: editPassword.trim(),
              category: editCategory.trim() || 'General',
              lastModified: new Date().toISOString()
            }
          : p
      );

      await AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(updatedPasswords));
      setPasswords(updatedPasswords);
      closeEditModal();
      Alert.alert('Success', 'Password updated successfully');
    } catch (error) {
      console.error('Error updating password:', error);
      Alert.alert('Error', 'Failed to update password');
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingPassword(null);
    setEditTitle('');
    setEditPassword('');
    setEditCategory('');
  };

  const renderPasswordItem = ({ item }: { item: SavedPassword }) => (
    <View style={styles.passwordItem}>
      <View style={styles.passwordHeader}>
        <View style={styles.passwordTitleContainer}>
          <Text style={styles.passwordTitle}>{item.title}</Text>
          {item.category && (
            <View style={styles.categoryTag}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          )}
        </View>
        <Text style={styles.passwordDate}>{item.date}</Text>
      </View>
      
      <View style={styles.passwordContent}>
        <Text style={styles.passwordText}>
          {showPasswords[item.id] ? item.password : '•'.repeat(item.password.length)}
        </Text>
        
        <View style={styles.passwordActions}>
          <TouchableOpacity 
            onPress={() => setShowPasswords(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
            style={styles.actionButton}
          >
            <Ionicons 
              name={showPasswords[item.id] ? "eye-off" : "eye"} 
              size={20} 
              color="#007AFF" 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => handleEditPress(item)}
            style={styles.actionButton}
          >
            <Ionicons name="pencil" size={20} color="#007AFF" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => deletePassword(item.id)}
            style={styles.actionButton}
          >
            <Ionicons name="trash" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const AuthenticationStatus = () => (
    <View style={styles.authStatus}>
      <Ionicons 
        name={isBiometricSupported ? "finger-print" : "warning"} 
        size={24} 
        color={isBiometricSupported && isBiometricEnabled ? "#007AFF" : "#FF9500"} 
      />
      <Text style={styles.authStatusText}>
        {!isBiometricSupported 
          ? "Biometric authentication not available" 
          : isBiometricEnabled
            ? "Biometric authentication enabled"
            : "Biometric authentication disabled"}
      </Text>
    </View>
  );

  const SettingsModal = () => (
    <Modal
      visible={showSettings}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSettings(false)}
    >
      <View style={styles.settingsOverlay}>
        <View style={styles.settingsContent}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>Settings</Text>
            <TouchableOpacity 
              onPress={() => setShowSettings(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Biometric Authentication</Text>
              <Text style={styles.settingDescription}>
                {isBiometricSupported 
                  ? `Currently ${isBiometricEnabled ? 'enabled' : 'disabled'}. Tap to ${isBiometricEnabled ? 'disable' : 'enable'}.`
                  : 'Biometric authentication not available on this device'}
              </Text>
            </View>
            {isBiometricSupported && (
              <TouchableOpacity 
                style={[
                  styles.toggleButton, 
                  isBiometricEnabled && styles.toggleButtonActive
                ]}
                onPress={toggleBiometric}
              >
                <View style={[
                  styles.toggleKnob, 
                  isBiometricEnabled && styles.toggleKnobActive
                ]} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <TouchableOpacity 
        style={styles.managerButton}
        onPress={handleManagerPress}
      >
        <View style={styles.buttonContent}>
          <Ionicons name="key" size={24} color="#007AFF" />
          <Text style={styles.managerButtonText}>Password Manager</Text>
          {isBiometricSupported && isBiometricEnabled && (
            <Ionicons name="finger-print" size={24} color="#007AFF" style={styles.biometricIcon} />
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        animationType="slide"
        onRequestClose={() => setIsVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setIsVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Password Manager</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                onPress={() => setShowSettings(true)}
                style={styles.headerButton}
              >
                <Ionicons name="settings-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setShowAddPassword(true)}
                style={styles.headerButton}
              >
                <Ionicons name="add" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>

          <AuthenticationStatus />

          {passwords.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="lock-closed" size={64} color="#666" />
              <Text style={styles.emptyStateText}>No saved passwords</Text>
              <TouchableOpacity 
                onPress={() => setShowAddPassword(true)}
                style={styles.emptyStateButton}
              >
                <Text style={styles.emptyStateButtonText}>Add Your First Password</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={passwords}
              renderItem={renderPasswordItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.passwordList}
            />
          )}
        </View>

        <Modal
          visible={showAddPassword}
          transparent
          animationType="fade"
          onRequestClose={resetForm}
        >
          <TouchableWithoutFeedback onPress={resetForm}>
            <View style={styles.addPasswordOverlay}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.addPasswordContent}>
                  <View style={styles.addPasswordHeader}>
                    <Text style={styles.addPasswordTitle}>Add New Password</Text>
                    <TouchableOpacity onPress={resetForm}>
                      <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.input}
                    value={newPasswordTitle}
                    onChangeText={setNewPasswordTitle}
                    placeholder="Username or Email"
                    placeholderTextColor="#666"
                  />

                  <TextInput
                    style={styles.input}
                    value={category}
                    onChangeText={setCategory}
                    placeholder="Website Name (Optional)"
                    placeholderTextColor="#666"
                  />

                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Password"
                      placeholderTextColor="#666"
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off" : "eye"}
                        size={24}
                        color="#666"
                      />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    onPress={saveNewPassword}
                    style={styles.saveButton}
                  >
                    <Text style={styles.saveButtonText}>Save Password</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </Modal>

      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.addPasswordOverlay}>
            <View style={styles.addPasswordContent}>
              <View style={styles.addPasswordHeader}>
                <Text style={styles.addPasswordTitle}>Edit Password</Text>
                <TouchableOpacity onPress={closeEditModal}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Title"
                placeholderTextColor="#666"
              />

              <TextInput
                style={styles.input}
                value={editCategory}
                onChangeText={setEditCategory}
                placeholder="Category (Optional)"
                placeholderTextColor="#666"
              />

              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={editPassword}
                  onChangeText={setEditPassword}
                  placeholder="Password"
                  placeholderTextColor="#666"
                  secureTextEntry={!showEditPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowEditPassword(!showEditPassword)}
                >
                  <Ionicons
                    name={showEditPassword ? "eye-off" : "eye"}
                    size={24}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.editButtonsContainer}>
                <TouchableOpacity 
                  onPress={closeEditModal}
                  style={[styles.editButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={handleUpdate}
                  style={[styles.editButton, styles.updateButton]}
                >
                  <Text style={styles.updateButtonText}>Update</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <SettingsModal />
    </>
  );
}

const styles = StyleSheet.create({
  managerButton: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2c2c2e',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  managerButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  addButton: {
    padding: 8,
  },
  passwordList: {
    padding: 16,
  },
  passwordItem: {
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  passwordHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3c3c3e',
  },
  passwordTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryTag: {
    backgroundColor: '#007AFF33',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#007AFF',
    fontSize: 12,
  },
  passwordDate: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  passwordContent: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passwordText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  passwordActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addPasswordOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  addPasswordContent: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  addPasswordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addPasswordTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    color: '#fff',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2c2c2e',
  },
  updateButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  authStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2c2c2e',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    gap: 12,
  },
  authStatusText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  biometricIcon: {
    marginLeft: 'auto',
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsContent: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  settingDescription: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  toggleButton: {
    width: 51,
    height: 31,
    borderRadius: 15.5,
    backgroundColor: '#2c2c2e',
    padding: 2,
  },
  toggleButtonActive: {
    backgroundColor: '#34C759',
  },
  toggleKnob: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: '#fff',
    transform: [{ translateX: 0 }],
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    color: '#fff',
  },
  eyeButton: {
    padding: 12,
  },
}); 