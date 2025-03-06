import React, { useState } from 'react';
import { View, TextInput, Modal, StyleSheet, Text, TouchableOpacity } from 'react-native';

interface AccessPasswordDialogProps {
  visible: boolean;
  onClose: () => void;
  onVerifyPassword: (password: string) => void;
}

export default function AccessPasswordDialog({
  visible,
  onClose,
  onVerifyPassword
}: AccessPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleVerifyPassword = () => {
    if (!password.trim()) {
      setError('Please enter the password');
      return;
    }

    onVerifyPassword(password);
    setPassword('');
    setError('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.dialog}>
          <Text style={styles.title}>Enter Password</Text>
          
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError('');
            }}
            placeholder="Enter note password"
            placeholderTextColor="#666"
            secureTextEntry
          />
          
          {error ? <Text style={styles.error}>{error}</Text> : null}
          
          <View style={styles.buttons}>
            <TouchableOpacity onPress={onClose} style={styles.button}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleVerifyPassword} 
              style={[styles.button, styles.primaryButton]}
            >
              <Text style={styles.primaryButtonText}>Unlock</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: '#fff',
  },
  error: {
    color: '#ff3b30',
    marginBottom: 12,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    padding: 8,
  },
  buttonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
}); 